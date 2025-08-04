import { IEventStore, IEventHandler } from '../../domain/interfaces/event-store.interface';
import { StoredEvent, EventStream, EventReplayRequest, EventQueryParams } from '../../domain/events/stored-event';
import { DomainEvent } from '@shared/infrastructure/messaging';
import { createLogger } from '@shared/infrastructure/logging';

/**
 * Event Store application service
 */
export class EventStoreService {
  private readonly logger = createLogger('event-store-service');

  constructor(private readonly eventStore: IEventStore) {}

  /**
   * Store events in the event store
   */
  async storeEvents(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void> {
    try {
      this.logger.info('Storing events', { 
        streamId, 
        eventCount: events.length, 
        expectedVersion 
      });

      await this.eventStore.appendEvents(streamId, events, expectedVersion);

      this.logger.info('Events stored successfully', { 
        streamId, 
        eventCount: events.length 
      });
    } catch (error) {
      this.logger.error('Failed to store events', error as Error, { 
        streamId, 
        eventCount: events.length 
      });
      throw error;
    }
  }

  /**
   * Get events from a stream
   */
  async getStreamEvents(streamId: string, fromVersion?: number): Promise<StoredEvent[]> {
    try {
      this.logger.info('Getting stream events', { streamId, fromVersion });

      const events = await this.eventStore.getEvents(streamId, fromVersion);

      this.logger.info('Retrieved stream events', { 
        streamId, 
        eventCount: events.length 
      });

      return events;
    } catch (error) {
      this.logger.error('Failed to get stream events', error as Error, { streamId });
      throw error;
    }
  }

  /**
   * Query events based on criteria
   */
  async queryEvents(params: EventQueryParams): Promise<StoredEvent[]> {
    try {
      this.logger.info('Querying events', params);

      const events = await this.eventStore.queryEvents(params);

      this.logger.info('Query completed', { 
        eventCount: events.length,
        params 
      });

      return events;
    } catch (error) {
      this.logger.error('Failed to query events', error as Error, { params });
      throw error;
    }
  }

  /**
   * Get event stream with metadata
   */
  async getEventStream(streamId: string): Promise<EventStream | null> {
    try {
      this.logger.info('Getting event stream', { streamId });

      const stream = await this.eventStore.getEventStream(streamId);

      if (stream) {
        this.logger.info('Retrieved event stream', { 
          streamId, 
          version: stream.version,
          eventCount: stream.events.length 
        });
      } else {
        this.logger.info('Event stream not found', { streamId });
      }

      return stream;
    } catch (error) {
      this.logger.error('Failed to get event stream', error as Error, { streamId });
      throw error;
    }
  }

  /**
   * Replay events and apply them to handlers
   */
  async replayEvents(request: EventReplayRequest, handlers: IEventHandler[] = []): Promise<StoredEvent[]> {
    try {
      this.logger.info('Starting event replay', request);

      const events = await this.eventStore.replayEvents(request);

      this.logger.info('Retrieved events for replay', { 
        eventCount: events.length 
      });

      // Apply handlers if provided
      if (handlers.length > 0) {
        let processedCount = 0;
        for (const event of events) {
          for (const handler of handlers) {
            if (handler.canHandle(event.eventType)) {
              try {
                await handler.handle(event);
                processedCount++;
              } catch (error) {
                this.logger.error('Handler failed to process event', error as Error, {
                  eventId: event.eventId,
                  eventType: event.eventType,
                  handler: handler.constructor.name
                });
              }
            }
          }
        }

        this.logger.info('Event replay completed', { 
          totalEvents: events.length,
          processedEvents: processedCount 
        });
      }

      return events;
    } catch (error) {
      this.logger.error('Failed to replay events', error as Error, { request });
      throw error;
    }
  }

  /**
   * Get stream version
   */
  async getStreamVersion(streamId: string): Promise<number> {
    try {
      const version = await this.eventStore.getStreamVersion(streamId);
      this.logger.info('Retrieved stream version', { streamId, version });
      return version;
    } catch (error) {
      this.logger.error('Failed to get stream version', error as Error, { streamId });
      throw error;
    }
  }

  /**
   * Check if stream exists
   */
  async streamExists(streamId: string): Promise<boolean> {
    try {
      const exists = await this.eventStore.streamExists(streamId);
      this.logger.info('Checked stream existence', { streamId, exists });
      return exists;
    } catch (error) {
      this.logger.error('Failed to check stream existence', error as Error, { streamId });
      throw error;
    }
  }

  /**
   * Reconstruct aggregate state from events
   */
  async reconstructState<T>(streamId: string, initialState: T, reducer: (state: T, event: StoredEvent) => T): Promise<T> {
    try {
      this.logger.info('Reconstructing state from events', { streamId });

      const events = await this.eventStore.getEvents(streamId);
      
      let state = initialState;
      for (const event of events) {
        state = reducer(state, event);
      }

      this.logger.info('State reconstruction completed', { 
        streamId, 
        eventCount: events.length 
      });

      return state;
    } catch (error) {
      this.logger.error('Failed to reconstruct state', error as Error, { streamId });
      throw error;
    }
  }
}