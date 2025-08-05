import 'module-alias/register';
import './path-aliases';
import express from 'express';
import { json } from 'body-parser';
import cors from 'cors';
import { AuditController } from './infrastructure/http/audit.controller';
import { AuditCommandHandlers } from './application/commands/audit-command.handlers';
import { AuditQueryHandlers } from './application/queries/audit-query.handlers';
import { AuditEventHandlers } from './application/event-handlers/audit-event.handlers';
import { AuditLogRepositoryImpl } from './infrastructure/database/audit-log.repository.impl';
import { AuditTrailRepositoryImpl } from './infrastructure/database/audit-trail.repository.impl';
import { createLogger } from '@shared/infrastructure/logging';
import { register, metricsMiddleware, collectSystemMetrics } from '@shared/infrastructure/metrics';
import { databaseManager, createHealthRoutes } from '@shared/infrastructure/database';
import { eventBus } from '@shared/infrastructure/messaging';

// Create a logger for the audit service
const logger = createLogger('audit-service');

const app = express();
const PORT = process.env['PORT'] ?? 3007;
const SERVICE_NAME = 'audit-service';

// Initialize database monitoring
databaseManager.startMonitoring(SERVICE_NAME);

// Initialize system metrics collection
collectSystemMetrics(SERVICE_NAME);

// Initialize repositories
const auditLogRepository = new AuditLogRepositoryImpl(databaseManager);
const auditTrailRepository = new AuditTrailRepositoryImpl(databaseManager);

// Initialize handlers
const commandHandlers = new AuditCommandHandlers(auditLogRepository, auditTrailRepository);
const queryHandlers = new AuditQueryHandlers(auditLogRepository, auditTrailRepository);
const eventHandlers = new AuditEventHandlers(commandHandlers);

// Initialize controller
const auditController = new AuditController(queryHandlers, commandHandlers);

// Initialize event bus and set up event subscriptions
const initializeEventBus = async () => {
  try {
    await eventBus.initialize();
    logger.info('Event bus initialized successfully');

    // Subscribe to all events for audit logging
    await eventBus.subscribeToAll('audit-service-all-events', {
      handle: async (event) => await eventHandlers.handleDomainEvent(event)
    });

    // Subscribe to specific event types for detailed processing
    await eventBus.subscribe('audit-service-complaint-events', 'COMPLAINT_*', {
      handle: async (event) => await eventHandlers.handleComplaintEvent(event)
    });

    await eventBus.subscribe('audit-service-transaction-events', 'SALE_*', {
      handle: async (event) => await eventHandlers.handleTransactionEvent(event)
    });

    await eventBus.subscribe('audit-service-transaction-events', 'REFUND_*', {
      handle: async (event) => await eventHandlers.handleTransactionEvent(event)
    });

    await eventBus.subscribe('audit-service-transaction-events', 'STOCK_*', {
      handle: async (event) => await eventHandlers.handleTransactionEvent(event)
    });

    await eventBus.subscribe('audit-service-security-events', 'USER_*', {
      handle: async (event) => await eventHandlers.handleSecurityEvent(event)
    });

    await eventBus.subscribe('audit-service-security-events', 'AUTH_*', {
      handle: async (event) => await eventHandlers.handleSecurityEvent(event)
    });

    await eventBus.subscribe('audit-service-saga-events', 'SAGA_*', {
      handle: async (event) => await eventHandlers.handleSagaEvent(event)
    });

    // Subscribe to complaint saga events specifically
    await eventBus.subscribe('audit-service-complaint-saga', 'COMPLAINT_SAGA_*', {
      handle: async (event) => await eventHandlers.handleComplaintSagaEvent(event)
    });

    await eventBus.subscribe('audit-service-complaint-saga', 'CUSTOMER_VALIDATION_*', {
      handle: async (event) => await eventHandlers.handleComplaintSagaEvent(event)
    });

    await eventBus.subscribe('audit-service-complaint-saga', 'ORDER_VERIFICATION_*', {
      handle: async (event) => await eventHandlers.handleComplaintSagaEvent(event)
    });

    await eventBus.subscribe('audit-service-complaint-saga', 'RESOLUTION_PROCESSING_*', {
      handle: async (event) => await eventHandlers.handleComplaintSagaEvent(event)
    });

    await eventBus.subscribe('audit-service-complaint-saga', 'COMPENSATION_*', {
      handle: async (event) => await eventHandlers.handleComplaintSagaEvent(event)
    });

    logger.info('Event subscriptions configured successfully');
  } catch (error) {
    logger.error('Failed to initialize event bus', error as Error);
    process.exit(1);
  }
};

// Initialize event bus asynchronously
initializeEventBus().catch(err => logger.error('Event bus initialization error', err as Error));

// Middleware
app.use(cors());
app.use(json());
app.use(metricsMiddleware);

// Health check routes
app.use('/health', createHealthRoutes());

// Audit Log Routes
app.get('/audit/logs', (req, res) => auditController.searchAuditLogs(req, res));
app.get('/audit/logs/:auditId', (req, res) => auditController.getAuditLog(req, res));
app.get('/audit/logs/correlation/:correlationId', (req, res) => auditController.getAuditLogsByCorrelation(req, res));
app.get('/audit/logs/entity/:entityType/:entityId', (req, res) => auditController.getAuditLogsByEntity(req, res));
app.get('/audit/logs/user/:userId', (req, res) => auditController.getAuditLogsByUser(req, res));

// Audit Trail Routes
app.get('/audit/trails', (req, res) => auditController.searchAuditTrails(req, res));
app.get('/audit/trails/active', (req, res) => auditController.getActiveAuditTrails(req, res));
app.get('/audit/trails/:trailId', (req, res) => auditController.getAuditTrail(req, res));
app.get('/audit/trails/correlation/:correlationId', (req, res) => auditController.getAuditTrailByCorrelation(req, res));

// Statistics Routes
app.get('/audit/statistics', (req, res) => auditController.getAuditStatistics(req, res));

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  } catch (error) {
    logger.error('Failed to generate metrics', error as Error);
    res.status(500).end('Error generating metrics');
  }
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Request error', err, {
    method: req.method,
    url: req.url,
    body: req.body
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Audit service started successfully on port ${PORT}`, {
    port: PORT,
    service: SERVICE_NAME,
    environment: process.env['NODE_ENV'] || 'development'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await eventBus.disconnect();
    await databaseManager.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  try {
    await eventBus.disconnect();
    await databaseManager.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
});
