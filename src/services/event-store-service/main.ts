import 'module-alias/register';
import './path-aliases';
import express from 'express';
import { json } from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import { EventStoreController } from './infrastructure/http/event-store.controller';
import { EventStoreService } from './application/services/event-store.service';
import { MongoDBEventStore } from './infrastructure/database/mongodb-event-store.repository';
import { createLogger } from '@shared/infrastructure/logging';
import { requestLogger } from '@shared/infrastructure/http';
import { redisClient, CacheService } from '@shared/infrastructure/caching';
import { register, metricsMiddleware, collectSystemMetrics } from '@shared/infrastructure/metrics';

// Create a logger for the event store service
const logger = createLogger('event-store-service');

const app = express();
const PORT = process.env['PORT'] ?? 3008;
const SERVICE_NAME = 'event-store-service';

// Initialize system metrics collection
collectSystemMetrics(SERVICE_NAME);

// Initialize Event Store components
let eventStore: MongoDBEventStore;
let eventStoreService: EventStoreService;

// Initialize MongoDB Event Store
const initializeEventStore = async () => {
  try {
    eventStore = new MongoDBEventStore();
    await eventStore.initialize();
    eventStoreService = new EventStoreService(eventStore);
    logger.info('MongoDB Event Store initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize MongoDB Event Store', error as Error);
    throw error;
  }
};

// Initialize Redis and Cache Service
const initializeCache = async () => {
  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis', error as Error);
    logger.warn('Service will operate without caching');
  }
};

// Create cache service
const cacheService = new CacheService(redisClient, SERVICE_NAME);

// Initialize all services
const initializeServices = async () => {
  await initializeCache();
  await initializeEventStore();
};

// Middleware
app.use(helmet()); // Security headers
app.use(cors());
app.use(json({ limit: '10mb' })); // Increase limit for large event payloads
app.use(requestLogger); // Add request logging middleware
app.use(metricsMiddleware(SERVICE_NAME)); // Add metrics middleware

// Simple health check endpoint
app.get('/health', async (req, res) => {
  try {
    const isHealthy = await eventStore.healthCheck();
    if (isHealthy) {
      res.status(200).json({ status: 'healthy', service: SERVICE_NAME });
    } else {
      res.status(503).json({ status: 'unhealthy', service: SERVICE_NAME });
    }
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: SERVICE_NAME, error: (error as Error).message });
  }
});

// Routes
let eventStoreController: EventStoreController;

// Event Store API routes - will be initialized after services start
app.use('/api/events', (req, res, next) => {
  if (eventStoreController) {
    eventStoreController.router(req, res, next);
  } else {
    res.status(503).json({ error: 'Service not ready' });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Failed to generate metrics', error as Error);
    res.status(500).end();
  }
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  logger.error('Request error', err, {
    path: req.path,
    method: req.method,
  });
  
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start the server
const startServer = async () => {
  try {
    await initializeServices();
    eventStoreController = new EventStoreController(eventStoreService);
    
    app.listen(PORT, () => {
      logger.info(`Event Store service started successfully`, {
        port: PORT,
        environment: process.env['NODE_ENV'] ?? 'development'
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await eventStore?.close();
  await redisClient.disconnect().catch(err => logger.error('Error disconnecting Redis', err as Error));
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await eventStore?.close();
  await redisClient.disconnect().catch(err => logger.error('Error disconnecting Redis', err as Error));
  process.exit(0);
});