const express = require('express');
const { createPrometheusMetrics } = require('../../shared/monitoring/prometheus');
const logger = require('../../shared/utils/logger');
const { connectRabbitMQ } = require('../../shared/messaging/rabbitmq');
const ServiceRegistry = require('../../shared/infrastructure/service-discovery/registry');
const NotificationHandler = require('./src/handlers/notificationHandler');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Prometheus metrics
const metrics = createPrometheusMetrics('notification_service');
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      checks: {
        rabbitmq: 'healthy',
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    // Check RabbitMQ connection if available
    if (global.rabbitmqConnection) {
      try {
        // Simple check to see if connection is still alive
        await global.rabbitmqConnection.createChannel();
        healthStatus.checks.rabbitmq = 'healthy';
      } catch (error) {
        healthStatus.checks.rabbitmq = 'unhealthy';
        healthStatus.status = 'degraded';
      }
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Notification endpoints
app.get('/api/notifications', (req, res) => {
  res.json({ message: 'Notification service is running' });
});

// Service discovery endpoint
app.get('/api/services', async (req, res) => {
  try {
    const serviceRegistry = new ServiceRegistry();
    const services = await serviceRegistry.getAllServices();
    res.json(services);
  } catch (error) {
    logger.error('Failed to get services:', error);
    res.status(500).json({ error: 'Failed to retrieve services' });
  }
});

// Initialize service
async function startService() {
  try {
    // Initialize service registry
    const serviceRegistry = new ServiceRegistry();
    await serviceRegistry.initialize();
    
    // Connect to RabbitMQ and set up event handlers
    const connection = await connectRabbitMQ();
    global.rabbitmqConnection = connection; // Store for health checks
    const notificationHandler = new NotificationHandler();
    
    // Set up event subscriptions
    await notificationHandler.initialize(connection);
    
    app.listen(port, async () => {
      logger.info(`Notification service listening on port ${port}`);
      await serviceRegistry.updateServiceStatus('healthy');
    });
  } catch (error) {
    logger.error('Failed to start notification service:', error);
    process.exit(1);
  }
}

startService();

module.exports = app;