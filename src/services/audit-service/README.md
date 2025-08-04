# Audit Service

The Audit Service provides comprehensive event logging and audit trail management for the microservices architecture. It automatically captures and stores audit logs for all system activities, providing full traceability and compliance capabilities.

## Features

- **Comprehensive Event Logging**: Automatically captures all domain events and system activities
- **Audit Trail Management**: Creates and tracks audit trails for business processes
- **Correlation ID Tracking**: Enables distributed tracing across microservices
- **Advanced Querying**: Search and filter audit logs with multiple criteria
- **Statistics and Reporting**: Provides audit statistics and insights
- **Real-time Processing**: Processes events in real-time via RabbitMQ

## Architecture

The service follows Domain-Driven Design (DDD) principles with:

- **Domain Layer**: Core entities (AuditLog, AuditTrail) and business rules
- **Application Layer**: Command/Query handlers and event processors
- **Infrastructure Layer**: Database repositories and HTTP controllers

## Database Schema

### AuditLog Table

- `id`: Auto-incrementing primary key
- `auditId`: Unique audit log identifier
- `eventType`: Type of event (e.g., 'COMPLAINT_CREATED')
- `entityType`: Type of entity (e.g., 'Complaint', 'Sale')
- `entityId`: ID of the affected entity
- `action`: Action performed (CREATE, UPDATE, DELETE, etc.)
- `userId`: User who performed the action
- `serviceName`: Source microservice
- `correlationId`: Correlation ID for tracing
- `causationId`: Optional causation ID
- `metadata`: Additional metadata (JSON)
- `details`: Event details (JSON)
- `ipAddress`: Client IP address
- `userAgent`: Client user agent
- `timestamp`: When the event occurred

### AuditTrail Table

- `id`: Auto-incrementing primary key
- `trailId`: Unique trail identifier
- `entityType`: Type of entity being tracked
- `entityId`: ID of the tracked entity
- `processName`: Name of the business process
- `correlationId`: Correlation ID for the process
- `startTime`: When the process started
- `endTime`: When the process completed
- `status`: Trail status (STARTED, IN_PROGRESS, COMPLETED, FAILED)
- `totalEvents`: Number of events in the trail
- `metadata`: Additional metadata (JSON)

## API Endpoints

### Audit Logs

- `GET /audit/logs` - Search audit logs with filtering and pagination
- `GET /audit/logs/:auditId` - Get specific audit log
- `GET /audit/logs/correlation/:correlationId` - Get logs by correlation ID
- `GET /audit/logs/entity/:entityType/:entityId` - Get logs for specific entity
- `GET /audit/logs/user/:userId` - Get logs for specific user

### Audit Trails

- `GET /audit/trails` - Search audit trails
- `GET /audit/trails/active` - Get active trails
- `GET /audit/trails/:trailId` - Get specific trail
- `GET /audit/trails/correlation/:correlationId` - Get trail by correlation ID

### Statistics

- `GET /audit/statistics` - Get audit statistics and metrics

## Event Subscriptions

The service subscribes to various event types:

- **All Events**: General audit logging for all domain events
- **Complaint Events**: Specific handling for complaint lifecycle events
- **Transaction Events**: Sales, refunds, and stock changes
- **Security Events**: Authentication and authorization events
- **Saga Events**: Saga orchestration and compensation events

## Configuration

Environment variables:

- `PORT`: Service port (default: 3007)
- `DATABASE_URL`: PostgreSQL connection string
- `RABBITMQ_URL`: RabbitMQ connection string
- `NODE_ENV`: Environment (development/production)

## Usage Examples

### Search Audit Logs

```bash
GET /audit/logs?eventType=COMPLAINT_CREATED&fromDate=2025-01-01&page=1&limit=50
```

### Get Logs by Correlation

```bash
GET /audit/logs/correlation/12345678-1234-1234-1234-123456789012
```

### Get Active Trails

```bash
GET /audit/trails/active
```

### Get Statistics

```bash
GET /audit/statistics?fromDate=2025-01-01&toDate=2025-01-31
```

## Monitoring

The service provides:

- Health check endpoint: `/health`
- Metrics endpoint: `/metrics` (Prometheus format)
- Structured logging with correlation IDs
- Database connection monitoring

## Development

To run the service:

1. Ensure PostgreSQL and RabbitMQ are running
2. Run database migrations if needed
3. Start the service:

   ```bash
   cd src/services/audit-service
   npm run dev
   ```

The service will automatically:

- Connect to the event bus and start processing events
- Create audit logs for all system activities
- Provide REST API for querying audit data
