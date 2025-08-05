import client from 'prom-client';
import { register } from './index';

// Event Publishing Metrics
export const eventPublishingTotal = new client.Counter({
  name: 'events_published_total',
  help: 'Total number of events published',
  labelNames: ['service', 'event_type', 'exchange', 'routing_key', 'status']
});

export const eventPublishingDuration = new client.Histogram({
  name: 'event_publishing_duration_seconds',
  help: 'Duration of event publishing operations in seconds',
  labelNames: ['service', 'event_type', 'exchange', 'routing_key', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// Event Consumption Metrics
export const eventConsumptionTotal = new client.Counter({
  name: 'events_consumed_total',
  help: 'Total number of events consumed',
  labelNames: ['service', 'event_type', 'queue', 'status']
});

export const eventConsumptionDuration = new client.Histogram({
  name: 'event_consumption_duration_seconds',
  help: 'Duration of event consumption processing in seconds',
  labelNames: ['service', 'event_type', 'queue', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

export const eventProcessingErrors = new client.Counter({
  name: 'event_processing_errors_total',
  help: 'Total number of event processing errors',
  labelNames: ['service', 'event_type', 'queue', 'error_type']
});

// Event Queue Metrics
export const eventQueueDepth = new client.Gauge({
  name: 'event_queue_depth',
  help: 'Current depth of event queues',
  labelNames: ['service', 'queue']
});

export const eventQueueConsumers = new client.Gauge({
  name: 'event_queue_consumers',
  help: 'Number of active consumers per queue',
  labelNames: ['service', 'queue']
});

// Saga Execution Metrics
export const sagaExecutionTotal = new client.Counter({
  name: 'saga_executions_total',
  help: 'Total number of saga executions',
  labelNames: ['service', 'saga_type', 'status']
});

export const sagaExecutionDuration = new client.Histogram({
  name: 'saga_execution_duration_seconds',
  help: 'Duration of saga executions in seconds',
  labelNames: ['service', 'saga_type', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
});

export const sagaStepExecutionTotal = new client.Counter({
  name: 'saga_step_executions_total',
  help: 'Total number of saga step executions',
  labelNames: ['service', 'saga_type', 'step_name', 'status']
});

export const sagaStepExecutionDuration = new client.Histogram({
  name: 'saga_step_execution_duration_seconds',
  help: 'Duration of individual saga step executions in seconds',
  labelNames: ['service', 'saga_type', 'step_name', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30]
});

export const sagaCompensationTotal = new client.Counter({
  name: 'saga_compensations_total',
  help: 'Total number of saga compensations executed',
  labelNames: ['service', 'saga_type', 'compensation_step', 'status']
});

export const activeSagas = new client.Gauge({
  name: 'active_sagas',
  help: 'Number of currently active sagas',
  labelNames: ['service', 'saga_type', 'status']
});

// Event Store Metrics
export const eventStoreOperationsTotal = new client.Counter({
  name: 'event_store_operations_total',
  help: 'Total number of event store operations',
  labelNames: ['service', 'operation', 'status']
});

export const eventStoreOperationDuration = new client.Histogram({
  name: 'event_store_operation_duration_seconds',
  help: 'Duration of event store operations in seconds',
  labelNames: ['service', 'operation', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

export const eventStoreSize = new client.Gauge({
  name: 'event_store_size_bytes',
  help: 'Size of event store in bytes',
  labelNames: ['service']
});

export const eventStoreEventCount = new client.Gauge({
  name: 'event_store_event_count',
  help: 'Total number of events in the event store',
  labelNames: ['service', 'aggregate_type']
});

// CQRS Metrics
export const commandExecutionTotal = new client.Counter({
  name: 'command_executions_total',
  help: 'Total number of command executions',
  labelNames: ['service', 'command_type', 'status']
});

export const commandExecutionDuration = new client.Histogram({
  name: 'command_execution_duration_seconds',
  help: 'Duration of command executions in seconds',
  labelNames: ['service', 'command_type', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

export const queryExecutionTotal = new client.Counter({
  name: 'query_executions_total',
  help: 'Total number of query executions',
  labelNames: ['service', 'query_type', 'status']
});

export const queryExecutionDuration = new client.Histogram({
  name: 'query_execution_duration_seconds',
  help: 'Duration of query executions in seconds',
  labelNames: ['service', 'query_type', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2]
});

export const projectionUpdateTotal = new client.Counter({
  name: 'projection_updates_total',
  help: 'Total number of projection updates',
  labelNames: ['service', 'projection_type', 'status']
});

export const projectionUpdateDuration = new client.Histogram({
  name: 'projection_update_duration_seconds',
  help: 'Duration of projection updates in seconds',
  labelNames: ['service', 'projection_type', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2]
});

// Register all event-specific metrics
register.registerMetric(eventPublishingTotal);
register.registerMetric(eventPublishingDuration);
register.registerMetric(eventConsumptionTotal);
register.registerMetric(eventConsumptionDuration);
register.registerMetric(eventProcessingErrors);
register.registerMetric(eventQueueDepth);
register.registerMetric(eventQueueConsumers);
register.registerMetric(sagaExecutionTotal);
register.registerMetric(sagaExecutionDuration);
register.registerMetric(sagaStepExecutionTotal);
register.registerMetric(sagaStepExecutionDuration);
register.registerMetric(sagaCompensationTotal);
register.registerMetric(activeSagas);
register.registerMetric(eventStoreOperationsTotal);
register.registerMetric(eventStoreOperationDuration);
register.registerMetric(eventStoreSize);
register.registerMetric(eventStoreEventCount);
register.registerMetric(commandExecutionTotal);
register.registerMetric(commandExecutionDuration);
register.registerMetric(queryExecutionTotal);
register.registerMetric(queryExecutionDuration);
register.registerMetric(projectionUpdateTotal);
register.registerMetric(projectionUpdateDuration);