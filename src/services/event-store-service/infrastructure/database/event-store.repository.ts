import { IEventStore } from '../../domain/interfaces/event-store.interface';
import { StoredEvent, EventStream, EventReplayRequest, EventQueryParams } from '../../domain/events/stored-event';
import { DomainEvent } from '@shared/infrastructure/messaging';
import { databaseManager } from '@shared/infrastructure/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * PostgreSQL implementation of the Event Store
 */
export class PostgreSQLEventStore implements IEventStore {
  private readonly prisma = databaseManager.getClient();

  /**
   * Append events to a stream with optimistic concurrency control
   */
  async appendEvents(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Check current version if expectedVersion is provided
        if (expectedVersion !== undefined) {
          const currentVersion = await this.getStreamVersion(streamId);
          if (currentVersion !== expectedVersion) {
            throw new Error(`Concurrency conflict: expected version ${expectedVersion}, but current version is ${currentVersion}`);
          }
        }

        // Get the next version number
        const currentVersion = await this.getStreamVersion(streamId);
        let nextVersion = currentVersion + 1;

        // Insert events
        for (const event of events) {
          const storedEvent = {
            eventId: event.eventId || uuidv4(),
            eventType: event.eventType,
            aggregateId: streamId,
            aggregateType: event.aggregateType || 'Unknown',
            eventData: event.eventData || {},
            metadata: {
              ...event.metadata,
              timestamp: event.metadata?.occurredOn || new Date(),
              correlationId: event.metadata?.correlationId || uuidv4(),
              causationId: event.metadata?.causationId,
              userId: event.metadata?.userId,
              source: event.metadata?.source || 'event-store-service',
              version: event.metadata?.version || nextVersion
            },
            version: nextVersion,
            createdAt: new Date()
          };

          await tx.eventStore.create({
            data: storedEvent
          });

          nextVersion++;
        }
      });
    } catch (error) {
      throw new Error(`Failed to append events to stream ${streamId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get events from a specific stream
   */
  async getEvents(streamId: string, fromVersion?: number): Promise<StoredEvent[]> {
    try {
      const events = await this.prisma.eventStore.findMany({
        where: {
          aggregateId: streamId,
          ...(fromVersion !== undefined && { version: { gte: fromVersion } })
        },
        orderBy: {
          version: 'asc'
        }
      });

      return events.map(this.mapToStoredEvent);
    } catch (error) {
      throw new Error(`Failed to get events for stream ${streamId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Query events based on parameters
   */
  async queryEvents(params: EventQueryParams): Promise<StoredEvent[]> {
    try {
      const where: any = {};

      if (params.aggregateId) {
        where.aggregateId = params.aggregateId;
      }

      if (params.aggregateType) {
        where.aggregateType = params.aggregateType;
      }

      if (params.eventType) {
        where.eventType = params.eventType;
      }

      if (params.correlationId) {
        where.metadata = {
          path: ['correlationId'],
          equals: params.correlationId
        };
      }

      if (params.fromTimestamp || params.toTimestamp) {
        where.createdAt = {};
        if (params.fromTimestamp) {
          where.createdAt.gte = params.fromTimestamp;
        }
        if (params.toTimestamp) {
          where.createdAt.lte = params.toTimestamp;
        }
      }

      const events = await this.prisma.eventStore.findMany({
        where,
        orderBy: {
          createdAt: 'asc'
        },
        take: params.limit || 100,
        skip: params.offset || 0
      });

      return events.map(this.mapToStoredEvent);
    } catch (error) {
      throw new Error(`Failed to query events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get event stream with metadata
   */
  async getEventStream(streamId: string): Promise<EventStream | null> {
    try {
      const events = await this.getEvents(streamId);
      
      if (events.length === 0) {
        return null;
      }

      const version = await this.getStreamVersion(streamId);
      const aggregateType = events[0]?.aggregateType || 'Unknown';

      return {
        streamId,
        aggregateType,
        events,
        version
      };
    } catch (error) {
      throw new Error(`Failed to get event stream ${streamId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Replay events based on criteria
   */
  async replayEvents(request: EventReplayRequest): Promise<StoredEvent[]> {
    try {
      const where: any = {};

      if (request.streamId) {
        where.aggregateId = request.streamId;
      }

      if (request.aggregateType) {
        where.aggregateType = request.aggregateType;
      }

      if (request.eventTypes && request.eventTypes.length > 0) {
        where.eventType = {
          in: request.eventTypes
        };
      }

      if (request.fromTimestamp || request.toTimestamp) {
        where.createdAt = {};
        if (request.fromTimestamp) {
          where.createdAt.gte = request.fromTimestamp;
        }
        if (request.toTimestamp) {
          where.createdAt.lte = request.toTimestamp;
        }
      }

      if (request.fromVersion !== undefined || request.toVersion !== undefined) {
        where.version = {};
        if (request.fromVersion !== undefined) {
          where.version.gte = request.fromVersion;
        }
        if (request.toVersion !== undefined) {
          where.version.lte = request.toVersion;
        }
      }

      const events = await this.prisma.eventStore.findMany({
        where,
        orderBy: [
          { aggregateId: 'asc' },
          { version: 'asc' }
        ]
      });

      return events.map(this.mapToStoredEvent);
    } catch (error) {
      throw new Error(`Failed to replay events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current version of a stream
   */
  async getStreamVersion(streamId: string): Promise<number> {
    try {
      const result = await this.prisma.eventStore.findFirst({
        where: {
          aggregateId: streamId
        },
        orderBy: {
          version: 'desc'
        },
        select: {
          version: true
        }
      });

      return result?.version || 0;
    } catch (error) {
      throw new Error(`Failed to get stream version for ${streamId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a stream exists
   */
  async streamExists(streamId: string): Promise<boolean> {
    try {
      const count = await this.prisma.eventStore.count({
        where: {
          aggregateId: streamId
        }
      });

      return count > 0;
    } catch (error) {
      throw new Error(`Failed to check if stream exists ${streamId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map database record to StoredEvent
   */
  private mapToStoredEvent(record: any): StoredEvent {
    return {
      eventId: record.eventId,
      eventType: record.eventType,
      aggregateId: record.aggregateId,
      aggregateType: record.aggregateType,
      eventData: record.eventData,
      metadata: record.metadata,
      createdAt: record.createdAt,
      version: record.version
    };
  }
}