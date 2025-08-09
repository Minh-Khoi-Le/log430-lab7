const redis = require('redis');
const logger = require('../../utils/logger');

class ServiceRegistry {
  constructor(redisConfig = {}) {
    // Redis v4+ configuration format
    const redisHost = redisConfig.host || process.env.REDIS_HOST || 'localhost';
    const redisPort = redisConfig.port || process.env.REDIS_PORT || 6379;
    
    this.redisClient = redis.createClient({
      socket: {
        host: redisHost,
        port: redisPort
      },
      ...redisConfig
    });
    
    this.serviceName = process.env.SERVICE_NAME || 'unknown-service';
    this.servicePort = process.env.PORT || 3000;
    this.registrationInterval = null;
  }

  async initialize() {
    try {
      await this.redisClient.connect();
      logger.info('Service registry connected to Redis');
      
      // Register this service
      await this.registerService();
      
      // Set up periodic registration renewal
      this.registrationInterval = setInterval(async () => {
        await this.registerService();
      }, 30000); // Renew every 30 seconds
      
      // Handle graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
      
    } catch (error) {
      logger.error('Failed to initialize service registry:', error);
      throw error;
    }
  }

  async registerService() {
    try {
      const serviceInfo = {
        name: this.serviceName,
        host: process.env.SERVICE_HOST || 'localhost',
        port: this.servicePort,
        status: 'healthy',
        lastHeartbeat: new Date().toISOString(),
        metadata: {
          version: process.env.SERVICE_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };

      const key = `services:${this.serviceName}`;
      await this.redisClient.setEx(key, 60, JSON.stringify(serviceInfo)); // TTL of 60 seconds
      
      logger.debug(`Service ${this.serviceName} registered in service registry`);
    } catch (error) {
      logger.error('Failed to register service:', error);
    }
  }

  async discoverService(serviceName) {
    try {
      const key = `services:${serviceName}`;
      const serviceData = await this.redisClient.get(key);
      
      if (serviceData) {
        return JSON.parse(serviceData);
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to discover service ${serviceName}:`, error);
      return null;
    }
  }

  async getAllServices() {
    try {
      const keys = await this.redisClient.keys('services:*');
      const services = {};
      
      for (const key of keys) {
        const serviceName = key.replace('services:', '');
        const serviceData = await this.redisClient.get(key);
        if (serviceData) {
          services[serviceName] = JSON.parse(serviceData);
        }
      }
      
      return services;
    } catch (error) {
      logger.error('Failed to get all services:', error);
      return {};
    }
  }

  async updateServiceStatus(status) {
    try {
      const key = `services:${this.serviceName}`;
      const serviceData = await this.redisClient.get(key);
      
      if (serviceData) {
        const serviceInfo = JSON.parse(serviceData);
        serviceInfo.status = status;
        serviceInfo.lastHeartbeat = new Date().toISOString();
        
        await this.redisClient.setEx(key, 60, JSON.stringify(serviceInfo));
        logger.debug(`Service ${this.serviceName} status updated to ${status}`);
      }
    } catch (error) {
      logger.error('Failed to update service status:', error);
    }
  }

  async shutdown() {
    try {
      if (this.registrationInterval) {
        clearInterval(this.registrationInterval);
      }
      
      // Remove service from registry
      const key = `services:${this.serviceName}`;
      await this.redisClient.del(key);
      
      await this.redisClient.disconnect();
      logger.info('Service registry shutdown completed');
    } catch (error) {
      logger.error('Error during service registry shutdown:', error);
    }
  }
}

module.exports = ServiceRegistry;