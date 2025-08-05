import "module-alias/register";
import express from "express";
import { json } from "body-parser";
import cors from "cors";
import { ComplaintController } from "./infrastructure/http/complaint.controller";
import { ComplaintCommandHandlers } from "./application/commands/complaint-command.handlers";
import { ComplaintQueryHandlers } from "./application/queries/complaint-query.handlers";
import { ComplaintProjectionHandlers } from "./application/projections/complaint-projection.handlers";
import { ComplaintRepositoryImpl } from "./infrastructure/database/complaint.repository.impl";
import { ComplaintViewRepositoryImpl } from "./infrastructure/database/complaint-view.repository.impl";
import { ComplaintSagaEventHandlers } from "./application/saga/complaint-saga.handlers";
import { ComplaintSagaStateManagerImpl } from "./application/saga/complaint-saga-state.manager";
import { ComplaintSagaStateRepositoryImpl } from "./infrastructure/database/complaint-saga-state.repository.impl";
import { createLogger } from "@shared/infrastructure/logging";
import {
  requestLogger,
  correlationMiddleware,
} from "@shared/infrastructure/http";
import {
  register,
  metricsMiddleware,
  collectSystemMetrics,
} from "@shared/infrastructure/metrics";
import {
  databaseManager,
  createHealthRoutes,
} from "@shared/infrastructure/database";
import {
  eventBus,
  IEventBus,
  createInstrumentedEventBus,
} from "@shared/infrastructure/messaging";
import { DomainEvent } from "@shared/domain/events/domain-events";
import { ComplaintSagaEvent } from "@shared/domain/events/complaint-saga.events";

// Create a logger for the complaint service
const logger = createLogger("complaint-service");

const app = express();
const PORT = process.env["PORT"] ?? 3005;
const SERVICE_NAME = "complaint-service";

// Initialize database monitoring
databaseManager.startMonitoring(SERVICE_NAME);

// Initialize system metrics collection
collectSystemMetrics(SERVICE_NAME);

// Create instrumented event bus for metrics and correlation tracking
const instrumentedEventBus = createInstrumentedEventBus(eventBus, SERVICE_NAME);

// Initialize repositories
const complaintRepository = new ComplaintRepositoryImpl(databaseManager);
const complaintViewRepository = new ComplaintViewRepositoryImpl(
  databaseManager
);
const sagaStateRepository = new ComplaintSagaStateRepositoryImpl(
  databaseManager
);

// Initialize handlers with instrumented event bus
const commandHandlers = new ComplaintCommandHandlers(
  complaintRepository,
  instrumentedEventBus
);
const queryHandlers = new ComplaintQueryHandlers(complaintViewRepository);
const projectionHandlers = new ComplaintProjectionHandlers(
  complaintViewRepository
);

// Initialize saga components with instrumented event bus
const sagaStateManager = new ComplaintSagaStateManagerImpl(sagaStateRepository);
const sagaEventHandlers = new ComplaintSagaEventHandlers(
  complaintRepository,
  commandHandlers,
  sagaStateManager,
  instrumentedEventBus
);

// Convert DomainEvent to ComplaintSagaEvent format
const convertDomainEventToSagaEvent = (
  domainEvent: DomainEvent
): ComplaintSagaEvent => {
  return {
    eventId: domainEvent.eventId,
    eventType: domainEvent.eventType,
    aggregateId: domainEvent.aggregateId,
    correlationId: domainEvent.metadata.correlationId,
    causationId: domainEvent.metadata.causationId,
    timestamp: domainEvent.metadata.occurredOn,
    version: domainEvent.metadata.version,
    eventData: domainEvent.eventData,
    metadata: {
      source: domainEvent.metadata.source,
      userId: domainEvent.metadata.userId,
    },
  } as ComplaintSagaEvent;
};

// Initialize event bus and set up event subscriptions
const initializeEventBus = async () => {
  try {
    await instrumentedEventBus.initialize();
    logger.info("Event bus initialized successfully");

    // Subscribe to complaint events for projection updates
    await instrumentedEventBus.subscribe(
      "complaint-service-projections",
      "COMPLAINT_CREATED",
      {
        handle: async (event: DomainEvent) =>
          await projectionHandlers.handleEvent(event),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-service-projections",
      "COMPLAINT_ASSIGNED",
      {
        handle: async (event: DomainEvent) =>
          await projectionHandlers.handleEvent(event),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-service-projections",
      "COMPLAINT_PROCESSING_STARTED",
      {
        handle: async (event: DomainEvent) =>
          await projectionHandlers.handleEvent(event),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-service-projections",
      "COMPLAINT_RESOLVED",
      {
        handle: async (event: DomainEvent) =>
          await projectionHandlers.handleEvent(event),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-service-projections",
      "COMPLAINT_CLOSED",
      {
        handle: async (event: DomainEvent) =>
          await projectionHandlers.handleEvent(event),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-service-projections",
      "COMPLAINT_PRIORITY_UPDATED",
      {
        handle: async (event: DomainEvent) =>
          await projectionHandlers.handleEvent(event),
      }
    );

    // Subscribe to saga events
    await instrumentedEventBus.subscribe(
      "complaint-saga",
      "COMPLAINT_SAGA_INITIATED",
      {
        handle: async (event: DomainEvent) =>
          await sagaEventHandlers.handleComplaintSagaInitiated(
            convertDomainEventToSagaEvent(event)
          ),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-saga",
      "CUSTOMER_VALIDATION_COMPLETED",
      {
        handle: async (event: DomainEvent) =>
          await sagaEventHandlers.handleCustomerValidationCompleted(
            convertDomainEventToSagaEvent(event)
          ),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-saga",
      "CUSTOMER_VALIDATION_FAILED",
      {
        handle: async (event: DomainEvent) =>
          await sagaEventHandlers.handleCustomerValidationFailed(
            convertDomainEventToSagaEvent(event)
          ),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-saga",
      "ORDER_VERIFICATION_COMPLETED",
      {
        handle: async (event: DomainEvent) =>
          await sagaEventHandlers.handleOrderVerificationCompleted(
            convertDomainEventToSagaEvent(event)
          ),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-saga",
      "REFUND_PROCESSING_COMPLETED",
      {
        handle: async (event: DomainEvent) =>
          await sagaEventHandlers.handleResolutionProcessingCompleted(
            convertDomainEventToSagaEvent(event)
          ),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-saga",
      "REPLACEMENT_PROCESSING_COMPLETED",
      {
        handle: async (event: DomainEvent) =>
          await sagaEventHandlers.handleResolutionProcessingCompleted(
            convertDomainEventToSagaEvent(event)
          ),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-saga",
      "STORE_CREDIT_PROCESSING_COMPLETED",
      {
        handle: async (event: DomainEvent) =>
          await sagaEventHandlers.handleResolutionProcessingCompleted(
            convertDomainEventToSagaEvent(event)
          ),
      }
    );

    await instrumentedEventBus.subscribe(
      "complaint-saga",
      "RESOLUTION_PROCESSING_FAILED",
      {
        handle: async (event: DomainEvent) =>
          await sagaEventHandlers.handleResolutionProcessingFailed(
            convertDomainEventToSagaEvent(event)
          ),
      }
    );

    logger.info("Event subscriptions set up successfully");
  } catch (error) {
    logger.error("Failed to initialize event bus", error as Error);
    logger.warn("Service will operate without event publishing");
  }
};

// Call the initialization function
initializeEventBus().catch((err) =>
  logger.error("Event bus initialization error", err as Error)
);

// Middleware
app.use(cors());
app.use(json());
app.use(correlationMiddleware); // Add correlation context middleware
app.use(requestLogger); // Add request logging middleware
app.use(metricsMiddleware(SERVICE_NAME)); // Add metrics middleware

// Add comprehensive health check routes
app.use("/", createHealthRoutes());

// Routes
const complaintController = new ComplaintController(
  commandHandlers,
  queryHandlers
);

// Mount complaint routes under /api/complaints to match Kong gateway expectations
app.use("/api/complaints", complaintController.router);

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  logger.error("Request error", err, {
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Complaint service started successfully`, {
    port: PORT,
    environment: process.env["NODE_ENV"] ?? "development",
  });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  databaseManager.stopMonitoring();
  await databaseManager.disconnect();
  await instrumentedEventBus.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  databaseManager.stopMonitoring();
  await databaseManager.disconnect();
  await instrumentedEventBus.disconnect();
  process.exit(0);
});
