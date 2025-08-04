# Event Store Service

The Event Store Service provides event sourcing capabilities for the event-driven architecture. It stores domain events immutably and provides functionality for event replay and state reconstruction.

## Features

- **Event Storage**: Immutable storage of domain events with PostgreSQL JSONB
- **Event Replay**: Replay events based on various criteria (time, version, type)
- **State Reconstruction**: Reconstruct aggregate state from stored events
- **Query API**: Flexible querying of events by aggregate, type, correlation ID, etc.
- **Optimistic Concurrency**: Version-based concurrency control for event streams
- **REST API**: HTTP endpoints for event operations

## API Endpoints

### Event Stream Operations

- `GET /api/events/streams/{streamId}/events` - Get events from a stream
- `GET /api/events/streams/{streamId}` - Get event stream with metadata
- `GET /api/events/streams/{streamId}/version` - Get current stream version
- `HEAD /api/events/streams/{streamId}` - Check if stream exists

### Event Querying

- `GET /api/events/events` - Query events with filters
- `POST /api/events/replay` - Replay events based on criteria

### State Reconstruction

- `POST /api/events/streams/{streamId}/reconstruct` - Get events for state reconstruction

## Query Parameters

### GET /api/events/events

- `aggregateId` - Filter by aggregate ID
- `aggregateType` - Filter by aggregate type
- `eventType` - Filter by event type
- `correlationId` - Filter by correlation ID
- `fromTimestamp` - Filter events from timestamp
- `toTimestamp` - Filter events to timestamp
- `limit` - Limit number of results (default: 100)
- `offset` - Offset for pagination

### POST /api/events/replay

```json
{
  "streamId": "optional-stream-id",
  "aggregateType": "optional-aggregate-type",
  "fromTimestamp": "2024-01-01T00:00:00Z",
  "toTimestamp": "2024-12-31T23:59:59Z",
  "fromVersion": 1,
  "toVersion": 100,
  "eventTypes": ["EVENT_TYPE_1", "EVENT_TYPE_2"]
}
```

## Database Schema

The service uses two main tables:

### EventStore Table

```sql
CREATE TABLE "EventStore" (
  id SERIAL PRIMARY KEY,
  "eventId" TEXT UNIQUE NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "eventData" JSONB NOT NULL,
  metadata JSONB NOT NULL,
  version INTEGER NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE("aggregateId", version)
);
```

### EventSnapshot Table (for future optimization)

```sql
CREATE TABLE "EventSnapshot" (
  id SERIAL PRIMARY KEY,
  "aggregateId" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE("aggregateId", version)
);
```

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis (for caching)

### Installation

```bash
cd src/services/event-store-service
npm install
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

### Environment Variables

```env
PORT=3008
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/retail_db
REDIS_URL=redis://localhost:6379
```

## Docker

Build and run with Docker:

```bash
# Build
docker build -t event-store-service .

# Run
docker run -p 3008:3000 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/retail_db \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  event-store-service
```

## Integration

The Event Store Service integrates with:

- **PostgreSQL**: Primary storage for events
- **Redis**: Caching layer
- **Prometheus**: Metrics collection
- **Shared Infrastructure**: Logging, monitoring, health checks

## Usage Examples

### Storing Events

Events are typically stored by other services through the messaging system, but can also be stored directly via the repository:

```typescript
import { PostgreSQLEventStore } from './infrastructure/database/event-store.repository';

const eventStore = new PostgreSQLEventStore();

await eventStore.appendEvents('complaint-123', [
  {
    eventId: 'evt-1',
    eventType: 'COMPLAINT_CREATED',
    aggregateType: 'Complaint',
    eventData: { title: 'Product Issue', userId: 'user-123' },
    timestamp: new Date(),
    correlationId: 'corr-123'
  }
]);
```

### Querying Events

```typescript
const events = await eventStore.queryEvents({
  aggregateType: 'Complaint',
  eventType: 'COMPLAINT_CREATED',
  fromTimestamp: new Date('2024-01-01'),
  limit: 50
});
```

### Event Replay

```typescript
const events = await eventStore.replayEvents({
  aggregateType: 'Complaint',
  fromTimestamp: new Date('2024-01-01'),
  eventTypes: ['COMPLAINT_CREATED', 'COMPLAINT_ASSIGNED']
});
```

## Monitoring

The service exposes metrics at `/metrics` endpoint for Prometheus scraping:

- Event storage rates
- Query performance
- Error rates
- Database connection health

## Architecture

The service follows Domain-Driven Design principles:

- **Domain Layer**: Event interfaces and business logic
- **Application Layer**: Service orchestration
- **Infrastructure Layer**: Database repositories and HTTP controllers
- **Shared Infrastructure**: Common utilities and patterns