# Complaint Service

A microservice implementing CQRS (Command Query Responsibility Segregation) pattern for handling customer complaints in an event-driven architecture.

## Features

- **CQRS Implementation**: Separate command and query handlers with dedicated read/write models
- **Domain-Driven Design**: Rich domain entities with business logic encapsulation
- **Event Sourcing**: Domain events for state changes and saga coordination
- **Event Publishing**: RabbitMQ integration for publishing business events
- **Read Model Projections**: Optimized query models updated via event handlers
- **Comprehensive API**: RESTful endpoints for complaint lifecycle management

## Architecture

### Domain Layer

- **Complaint Aggregate**: Rich domain entity with business rules and event publishing
- **Repository Interfaces**: Abstraction for data persistence

### Application Layer

- **Command Handlers**: Process business commands and coordinate domain operations
- **Query Handlers**: Handle read operations using optimized projections
- **Projection Handlers**: Update read models based on domain events
- **DTOs**: Data transfer objects for API communication

### Infrastructure Layer

- **Database Repositories**: PostgreSQL implementations for command and query sides
- **HTTP Controllers**: RESTful API endpoints
- **Event Bus Integration**: RabbitMQ event publishing and subscription

## API Endpoints

### Commands (Write Operations)

- `POST /api/complaints` - Create new complaint
- `PATCH /api/complaints/:id/assign` - Assign complaint to agent
- `PATCH /api/complaints/:id/start-processing` - Start processing complaint
- `PATCH /api/complaints/:id/resolve` - Resolve complaint with solution
- `PATCH /api/complaints/:id/close` - Close resolved complaint
- `PATCH /api/complaints/:id/priority` - Update complaint priority

### Queries (Read Operations)

- `GET /api/complaints/:id` - Get complaint by ID
- `GET /api/complaints/:id/detail` - Get complaint with timeline
- `GET /api/complaints/user/:userId` - Get complaints by user
- `GET /api/complaints/search` - Search complaints with filters
- `GET /api/complaints/status/:status?` - Get complaints by status
- `GET /api/complaints/priority/:priority?` - Get complaints by priority
- `GET /api/complaints/category/:category?` - Get complaints by category
- `GET /api/complaints/summary` - Get complaint statistics
- `GET /api/complaints/text-search?q=text` - Full-text search
- `GET /api/complaints/stats/resolution-time` - Resolution time statistics
- `GET /api/complaints/trends/:days` - Complaint trends over time

## Domain Events

The service publishes the following domain events:

- `COMPLAINT_CREATED` - When a new complaint is created
- `COMPLAINT_ASSIGNED` - When complaint is assigned to an agent
- `COMPLAINT_PROCESSING_STARTED` - When processing begins
- `COMPLAINT_RESOLVED` - When complaint is resolved
- `COMPLAINT_CLOSED` - When complaint is closed
- `COMPLAINT_PRIORITY_UPDATED` - When priority is changed

## Database Schema

### Command Side (Write Model)

```sql
CREATE TABLE complaints (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  category VARCHAR(100) NOT NULL,
  assigned_to INTEGER,
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  version INTEGER NOT NULL DEFAULT 1
);
```

### Query Side (Read Model)

```sql
CREATE TABLE complaint_views (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  category VARCHAR(100) NOT NULL,
  assigned_to INTEGER,
  resolution TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP,
  version INTEGER NOT NULL
);

CREATE TABLE complaint_timeline (
  id UUID PRIMARY KEY,
  complaint_id UUID NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  action VARCHAR(255) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  details TEXT NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL
);
```

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL
- RabbitMQ
- Redis

### Installation

```bash
npm install
```

### Configuration

Copy `.env` file and configure:

```bash
NODE_ENV=development
PORT=3005
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/microservices_db
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## CQRS Implementation Details

### Command Side

- Commands are processed by dedicated handlers
- Domain entities enforce business rules
- Events are published after successful operations
- Write models are optimized for consistency

### Query Side

- Separate read models for optimized queries
- Projections updated via event handlers
- Denormalized data for fast reads
- Timeline tracking for audit purposes

### Event Flow

1. Command received via HTTP API
2. Command handler loads aggregate
3. Business logic executed on domain entity
4. Domain events raised
5. Aggregate persisted to write model
6. Events published to message bus
7. Projection handlers update read models
8. Query handlers serve optimized read models

## Integration

This service integrates with:

- **Event Store Service**: For event persistence and replay
- **Notification Service**: For sending complaint notifications
- **Audit Service**: For compliance and audit logging
- **User Service**: For user information and authentication

## Monitoring

The service exposes:

- Health check endpoints
- Prometheus metrics
- Structured logging
- Performance monitoring
