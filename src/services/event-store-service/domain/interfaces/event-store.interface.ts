import { StoredEvent, EventStream, EventReplayRequest, EventQueryParams } from '../events/stored-event';
import { DomainEvent } from '@shared/infrastructure/messaging';

/**
 * Event Store interface for persisting and retrieving domain events
 */
export interface IEventStore {
  /**
   * Append events to a stream
   */
  appendEvents(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void>;

  /**
   * Get events from a specific stream
   */
  getEvents(streamId: string, fromVersion?: number): Promise<StoredEvent[]>;

  /**
   * Get all events matching query parameters
   */
  queryEvents(params: EventQueryParams): Promise<StoredEvent[]>;

  /**
   * Get event stream with metadata
   */
  getEventStream(streamId: string): Promise<EventStream | null>;

  /**
   * Replay events based on criteria
   */
  replayEvents(request: EventReplayRequest): Promise<StoredEvent[]>;

  /**
   * Get the current version of a stream
   */
  getStreamVersion(streamId: string): Promise<number>;

  /**
   * Check if a stream exists
   */
  streamExists(streamId: string): Promise<boolean>;
}

/**
 * Event handler interface for processing replayed events
 */
export interface IEventHandler {
  handle(event: StoredEvent): Promise<void>;
  canHandle(eventType: string): boolean;
}