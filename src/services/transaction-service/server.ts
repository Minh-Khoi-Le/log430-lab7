import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

// Import shared infrastructure
import {
  redisClient,
  CacheService,
  createCacheMiddleware,
} from "@shared/infrastructure/caching";
import { createLogger } from "@shared/infrastructure/logging";
import {
  register,
  metricsMiddleware,
  collectSystemMetrics,
} from "@shared/infrastructure/metrics";
import { databaseManager } from "@shared/infrastructure/database/database-manager";
import { createCrossDomainQueries } from "@shared/infrastructure/database/cross-domain-queries";
import { eventBus } from "@shared/infrastructure/messaging";

// Import new shared repositories
import { SharedSaleRepository } from "./infrastructure/database/shared-sale.repository";
import { SharedRefundRepository } from "./infrastructure/database/shared-refund.repository";

// Import use cases
import { SaleUseCases } from "./application/use-cases/sale.use-cases";
import { RefundUseCases } from "./application/use-cases/refund.use-cases";

// Import controllers
import { SaleController } from "./infrastructure/http/sale.controller";
import { RefundController } from "./infrastructure/http/refund.controller";

// Import external services
import { CatalogService } from "./infrastructure/services/catalog.service";

// Import saga handlers
import { TransactionSagaEventHandlers } from "./application/saga/transaction-saga.handlers";
import { DomainEvent } from "@shared/domain/events/domain-events";
import { ComplaintSagaEvent } from "@shared/domain/events/complaint-saga.events";

dotenv.config();

const app = express();
const PORT = process.env["PORT"] ?? 3000;
const SERVICE_NAME = "transaction-service";

// Initialize system metrics collection
collectSystemMetrics(SERVICE_NAME);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware(SERVICE_NAME));

// Create a logger for the service
const logger = createLogger("transaction-service");

// Initialize shared database infrastructure
const initializeDatabase = async () => {
  try {
    await databaseManager.ensureConnection();
    logger.info("Shared database infrastructure connected successfully");
  } catch (error) {
    logger.error(
      "Failed to connect to shared database infrastructure",
      error as Error
    );
    throw error;
  }
};

// Initialize Redis and Cache Service
const initializeCache = async () => {
  try {
    await redisClient.connect();
    logger.info("Redis connected successfully");
  } catch (error) {
    logger.error("Failed to connect to Redis", error as Error);
    logger.warn("Service will operate without caching");
  }
};

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
const initializeEventBus = async (
  saleRepo: SharedSaleRepository,
  refundRepo: SharedRefundRepository
) => {
  try {
    await eventBus.initialize();
    logger.info("Event bus initialized successfully");

    // Initialize saga event handlers
    const transactionSagaEventHandlers = new TransactionSagaEventHandlers(
      saleRepo,
      refundRepo,
      eventBus
    );

    // Subscribe to saga events
    await eventBus.subscribe(
      "transaction-service-saga",
      "ORDER_VERIFICATION_STARTED",
      {
        handle: async (event) =>
          await transactionSagaEventHandlers.handleOrderVerificationStarted(
            convertDomainEventToSagaEvent(event)
          ),
      }
    );

    await eventBus.subscribe(
      "transaction-service-saga",
      "RESOLUTION_PROCESSING_STARTED",
      {
        handle: async (event) =>
          await transactionSagaEventHandlers.handleResolutionProcessingStarted(
            convertDomainEventToSagaEvent(event)
          ),
      }
    );

    await eventBus.subscribe(
      "transaction-service-saga",
      "COMPENSATION_INITIATED",
      {
        handle: async (event) =>
          await transactionSagaEventHandlers.handleCompensationInitiated(
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

// Initialize all services
const initializeServices = async () => {
  await initializeDatabase();
  await initializeCache().catch((err) =>
    logger.error("Redis initialization error", err as Error)
  );
};

// Only initialize services if not in test environment
if (process.env.NODE_ENV !== "test") {
  // Call the initialization function
  initializeServices().catch((err) => {
    logger.error("Service initialization failed", err as Error);
    process.exit(1);
  });
}

// Create cache service with proper service name
const cacheService = new CacheService(redisClient, "transaction-service");

// Create cache middleware with different TTLs for different types of data
const transactionListCache = createCacheMiddleware({
  cacheService,
  ttl: 300, // 5 minutes for lists
});

const transactionItemCache = createCacheMiddleware({
  cacheService,
  ttl: 600, // 10 minutes for individual items
});

const summaryCache = createCacheMiddleware({
  cacheService,
  ttl: 1800, // 30 minutes for summary data which changes less frequently
});

// Initialize cross-domain queries
const crossDomainQueries = createCrossDomainQueries(databaseManager);

// Repositories using shared database infrastructure
const saleRepository = new SharedSaleRepository(
  databaseManager,
  crossDomainQueries
);
const refundRepository = new SharedRefundRepository(
  databaseManager,
  crossDomainQueries
);

// Use cases
const catalogService = new CatalogService();
const saleUseCases = new SaleUseCases(saleRepository);
const refundUseCases = new RefundUseCases(
  refundRepository,
  saleRepository,
  catalogService
);

// Controllers
const saleController = new SaleController(saleUseCases);
const refundController = new RefundController(refundUseCases);

// Initialize event bus after repositories are created
if (process.env.NODE_ENV !== "test") {
  initializeEventBus(saleRepository, refundRepository).catch((err) =>
    logger.error("Event bus initialization error", err as Error)
  );
}

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "transaction-service" });
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set("Content-Type", register.contentType);
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
});

// Sale routes
app.post("/api/sales", (req, res) => {
  saleController.createSale(req, res);
  // Invalidate related caches after creation
  cacheService.delete("GET:/api/sales");
  cacheService.delete("GET:/api/sales/summary");
});

app.get("/api/sales", transactionListCache, (req, res) =>
  saleController.getAllSales(req, res)
);
app.get("/api/sales/summary", summaryCache, (req, res) =>
  saleController.getSalesSummary(req, res)
);
app.get("/api/sales/:id", transactionItemCache, (req, res) =>
  saleController.getSale(req, res)
);

app.put("/api/sales/:id/status", (req, res) => {
  saleController.updateSaleStatus(req, res);
  // Invalidate caches after status update
  const id = parseInt(req.params.id);
  cacheService.delete(`GET:/api/sales/${id}`);
  cacheService.delete("GET:/api/sales");
  cacheService.delete("GET:/api/sales/summary");
});

app.get("/api/sales/user/:userId", transactionListCache, (req, res) =>
  saleController.getSalesByUser(req, res)
);
app.get("/api/sales/store/:storeId", transactionListCache, (req, res) =>
  saleController.getSalesByStore(req, res)
);

// Refund routes
app.post("/api/refunds", (req, res) => {
  refundController.createRefund(req, res);
  // Invalidate related caches after creation
  cacheService.delete("GET:/api/refunds");
  cacheService.delete("GET:/api/refunds/summary");
  // Also invalidate sales summary since refunds affect it
  cacheService.delete("GET:/api/sales/summary");
});

app.get("/api/refunds", transactionListCache, (req, res) =>
  refundController.getAllRefunds(req, res)
);
app.get("/api/refunds/summary", summaryCache, (req, res) =>
  refundController.getRefundsSummary(req, res)
);
app.get("/api/refunds/:id", transactionItemCache, (req, res) =>
  refundController.getRefund(req, res)
);
app.get("/api/refunds/user/:userId", transactionListCache, (req, res) =>
  refundController.getRefundsByUser(req, res)
);
app.get("/api/refunds/store/:storeId", transactionListCache, (req, res) =>
  refundController.getRefundsByStore(req, res)
);
app.get("/api/refunds/sale/:saleId", transactionListCache, (req, res) =>
  refundController.getRefundsBySale(req, res)
);

// Error handling middleware
app.use((err: Error, req: any, res: any, next: any) => {
  logger.error("Internal server error", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Transaction Service running on port ${PORT}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  await databaseManager.disconnect();
  await eventBus.disconnect();
  await redisClient
    .disconnect()
    .catch((err: Error) => logger.error("Error disconnecting Redis", err));
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  await databaseManager.disconnect();
  await eventBus.disconnect();
  await redisClient
    .disconnect()
    .catch((err: Error) => logger.error("Error disconnecting Redis", err));
  process.exit(0);
});

export default app;
