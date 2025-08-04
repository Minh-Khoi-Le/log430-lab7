import 'module-alias/register';
import express from 'express';
import { json } from 'body-parser';
import cors from 'cors';
import { ComplaintController } from './infrastructure/http/complaint.controller';
import { ComplaintCommandHandlers } from './application/commands/complaint-command.handlers';
import { ComplaintQueryHandlers } from './application/queries/complaint-query.handlers';
import { ComplaintProjectionHandlers } from './application/projections/complaint-projection.handlers';
import { ComplaintRepositoryImpl } from './infrastructure/database/complaint.repository.impl';
import { ComplaintViewRepositoryImpl } from './infrastructure/database/complaint-view.repository.impl';
import { createLogger } from '@shared/infrastructure/logging';
import { requestLogger } from '@shared/infrastructure/http';
import { register, metricsMiddleware, collectSystemMetrics } from '@shared/infrastructure/metrics';
import { databaseManager, createHealthRoutes } from '@shared/infrastructure/database';
import { eventBus, IEventBus } from '@shared/infrastructure/messaging';

// Create a logger for the complaint service
const logger = createLogger('complaint-service');

const app = express();
const PORT = process.env['PORT'] ?? 3005;
const SERVICE_NAME = 'complaint-service';

// Initialize database monitoring
databaseManager.startMonitoring(SERVICE_NAME);

// Initialize system metrics collection
collectSystemMetrics(SERVICE_NAME);

// Initialize repositories
const complaintRepository = new ComplaintRepositoryImpl(databaseManager);
const complaintViewRepository = new ComplaintViewRepositoryImpl(databaseManager);

// Initialize handlers
const commandHandlers = new ComplaintCommandHandlers(complaintRepository, eventBus);
const queryHandlers = new ComplaintQueryHandlers(complaintViewRepository);
const projectionHandlers = new ComplaintProjectionHandlers(complaintViewRepository);

// Initialize event bus and set up event subscriptions
const initializeEventBus = async () => {
  try {
    await eventBus.initialize();
    logger.info('Event bus initialized successfully');

    // Subscribe to complaint events for projection updates
    await eventBus.subscribe('complaint-service-projections', 'COMPLAINT_CREATED', {
      handle: async (event) => await projectionHandlers.handleEvent(event)
    });

    await eventBus.subscribe('complaint-service-projections', 'COMPLAINT_ASSIGNED', {
      handle: async (event) => await projectionHandlers.handleEvent(event)
    });

    await eventBus.subscribe('complaint-service-projections', 'COMPLAINT_PROCESSING_STARTED', {
      handle: async (event) => await projectionHandlers.handleEvent(event)
    });

    await eventBus.subscribe('complaint-service-projections', 'COMPLAINT_RESOLVED', {
      handle: async (event) => await projectionHandlers.handleEvent(event)
    });

    await eventBus.subscribe('complaint-service-projections', 'COMPLAINT_CLOSED', {
      handle: async (event) => await projectionHandlers.handleEvent(event)
    });

    await eventBus.subscribe('complaint-service-projections', 'COMPLAINT_PRIORITY_UPDATED', {
      handle: async (event) => await projectionHandlers.handleEvent(event)
    });

    logger.info('Event subscriptions set up successfully');
  } catch (error) {
    logger.error('Failed to initialize event bus', error as Error);
    logger.warn('Service will operate without event publishing');
  }
};

// Call the initialization function
initializeEventBus().catch(err => logger.error('Event bus initialization error', err as Error));

// Middleware
app.use(cors());
app.use(json());
app.use(requestLogger); // Add request logging middleware
app.use(metricsMiddleware(SERVICE_NAME)); // Add metrics middleware

// Add comprehensive health check routes
app.use('/', createHealthRoutes());

// Routes
const complaintController = new ComplaintController(commandHandlers, queryHandlers);

// Mount complaint routes under /api/complaints to match Kong gateway expectations
app.use('/api/complaints', complaintController.router);

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

// Start the server
app.listen(PORT, () => {
  logger.info(`Complaint service started successfully`, {
    port: PORT,
    environment: process.env['NODE_ENV'] ?? 'development'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  databaseManager.stopMonitoring();
  await databaseManager.disconnect();
  await eventBus.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  databaseManager.stopMonitoring();
  await databaseManager.disconnect();
  await eventBus.disconnect();
  process.exit(0);
});