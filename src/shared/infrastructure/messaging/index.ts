// Core event bus interfaces and implementations
export { IEventBus, eventBus, legacyEventBus } from './event-bus';
export { RabbitMQEventBus, EventHandler, EventSubscription } from './rabbitmq-event-bus';
export { RabbitMQConnection, RabbitMQConfig } from './rabbitmq-connection';
export { EventBusFactory } from './event-bus-factory';
export { MessagingHealthCheck, HealthCheckResult } from './health-check';
export { InstrumentedEventBus, createInstrumentedEventBus } from './instrumented-event-bus';

// Domain events and utilities
export { DomainEvent, EventMetadata } from '../../domain/events/domain-events';
export { BaseEvent } from '../../domain/events/base-event';
export { EventFactory } from '../../domain/events/event-factory';

// Existing event types
export {
  StockUpdatedEvent,
  StockReservedEvent,
  StockReleasedEvent,
  SaleCreatedEvent,
  SaleCompletedEvent,
  RefundCreatedEvent,
  RefundCompletedEvent
} from '../../domain/events/domain-events';