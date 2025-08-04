import 'module-alias/register';
import express from 'express';
import { json } from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import { EventStoreController } from './infrastructure/http/event-store.controller';
import { EventStoreService } from './application/services/event-store.service';
import { PostgreSQLEventStore } from './infrastructure/database/event-store.repository';
import { createLogger } from '@shared/infrastructure/logging';
import { requestLogger } from '@shared/infrastructure/http';
import { redisClient, CacheService } from '@shared/infrastructure/caching';
import { register, metricsMiddleware, collectSystemMetrics } from '@shared/infrastructure/metrics';
import { databaseManager, createHealthRoutes } from '@shared/infrastructure/database';

// Create a logger for the event store service
const logger = createLogger('event-store-service');

const app = express();
const PORT = process.env['PORT'] ?? 3008;
const SERVICE_NAME = 'event-store-service';

// Initialize database monitoring
databaseManager.startMonitoring(SERVICE_NAME);

// Initialize system metrics collection
collectSystemMetrics(SERVICE_NAME);

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

// Call the initialization function
initializeCache().catch(err => logger.error('Redis initialization error', err as Error));

// Create cache service
const cacheService = new CacheService(redisClient, SERVICE_NAME);

// Initialize Event Store components
const eventStore = new PostgreSQLEventStore();
const eventStoreService = new EventStoreService(eventStore);

// Middleware
app.use(helmet()); // Security headers
app.use(cors());
app.use(json({ limit: '10mb' })); // Increase limit for large event payloads
app.use(requestLogger); // Add request logging middleware
app.use(metricsMiddleware(SERVICE_NAME)); // Add metrics middleware

// Add comprehensive health check routes
app.use('/', createHealthRoutes());

// Routes
const eventStoreController = new EventStoreController(eventStoreService);

// Event Store API routes
app.use('/api/events', eventStoreController.router);

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
app.listen(PORT, () => {
  logger.info(`Event Store service started successfully`, {
    port: PORT,
    environment: process.env['NODE_ENV'] ?? 'development'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  databaseManager.stopMonitoring();
  await databaseManager.disconnect();
  await redisClient.disconnect().catch(err => logger.error('Error disconnecting Redis', err as Error));
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  databaseManager.stopMonitoring();
  await databaseManager.disconnect();
  await redisClient.disconnect().catch(err => logger.error('Error disconnecting Redis', err as Error));
  process.exit(0);
});