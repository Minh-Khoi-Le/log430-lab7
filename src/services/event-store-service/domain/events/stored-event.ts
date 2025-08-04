import { DomainEvent } from '@shared/infrastructure/messaging';

/**
 * Represents an event stored in the Event Store with additional metadata
 */
export interface StoredEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  eventData: any;
  metadata: EventMetadata;
  createdAt: Date;
  version: number;
}

/**
 * Metadata associated with stored events
 */
export interface EventMetadata {
  timestamp: Date;
  correlationId: string;
  causationId?: string;
  userId?: string;
  source: string;
  [key: string]: any;
}

/**
 * Event stream represents a sequence of events for a specific aggregate
 */
export interface EventStream {
  streamId: string;
  aggregateType: string;
  events: StoredEvent[];
  version: number;
}

/**
 * Event replay request parameters
 */
export interface EventReplayRequest {
  streamId?: string;
  aggregateType?: string;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  fromVersion?: number;
  toVersion?: number;
  eventTypes?: string[];
}

/**
 * Event query parameters for searching events
 */
export interface EventQueryParams {
  aggregateId?: string;
  aggregateType?: string;
  eventType?: string;
  correlationId?: string;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
  offset?: number;
}