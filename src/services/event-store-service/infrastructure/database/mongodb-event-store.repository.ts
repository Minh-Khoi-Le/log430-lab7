import { IEventStore } from '../../domain/interfaces/event-store.interface';
import { StoredEvent, EventStream, EventReplayRequest, EventQueryParams } from '../../domain/events/stored-event';
import { DomainEvent } from '@shared/infrastructure/messaging';
import { MongoClient, Db, Collection } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@shared/infrastructure/logging';

/**
 * MongoDB implementation of the Event Store
 */
export class MongoDBEventStore implements IEventStore {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private eventsCollection: Collection | null = null;
  private streamsCollection: Collection | null = null;
  private snapshotsCollection: Collection | null = null;
  private readonly logger = createLogger('mongodb-event-store');

  constructor(private readonly connectionString: string = process.env.MONGODB_URL || '') {
    if (!this.connectionString) {
      throw new Error('MONGODB_URL environment variable is required');
    }
  }

  /**
   * Initialize MongoDB connection
   */
  async initialize(): Promise<void> {
    try {
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db();
      
      this.eventsCollection = this.db.collection('events');
      this.streamsCollection = this.db.collection('streams');
      this.snapshotsCollection = this.db.collection('snapshots');

      // Create indexes for better performance
      await this.createIndexes();
      
      this.logger.info('MongoDB Event Store initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MongoDB Event Store', error as Error);
      throw error;
    }
  }

  /**
   * Create necessary indexes
   */
  private async createIndexes(): Promise<void> {
    if (!this.eventsCollection || !this.streamsCollection || !this.snapshotsCollection) {
      throw new Error('Collections not initialized');
    }

    try {
      // Check and create indexes only if they don't exist
      const eventsIndexes = await this.eventsCollection.listIndexes().toArray();
      const streamsIndexes = await this.streamsCollection.listIndexes().toArray();
      const snapshotsIndexes = await this.snapshotsCollection.listIndexes().toArray();

      // Events collection indexes
      const aggregateVersionIndexExists = eventsIndexes.some(idx => 
        idx.name === 'aggregateId_1_version_1' || 
        (idx.key && idx.key.aggregateId === 1 && idx.key.version === 1)
      );
      if (!aggregateVersionIndexExists) {
        await this.eventsCollection.createIndex({ aggregateId: 1, version: 1 }, { unique: true });
      }

      const eventTypeIndexExists = eventsIndexes.some(idx => 
        idx.name === 'eventType_1' || (idx.key && idx.key.eventType === 1)
      );
      if (!eventTypeIndexExists) {
        await this.eventsCollection.createIndex({ eventType: 1 });
      }

      const timestampIndexExists = eventsIndexes.some(idx => 
        idx.name === 'metadata.timestamp_1' || (idx.key && idx.key['metadata.timestamp'] === 1)
      );
      if (!timestampIndexExists) {
        await this.eventsCollection.createIndex({ 'metadata.timestamp': 1 });
      }

      const correlationIndexExists = eventsIndexes.some(idx => 
        idx.name === 'metadata.correlationId_1' || (idx.key && idx.key['metadata.correlationId'] === 1)
      );
      if (!correlationIndexExists) {
        await this.eventsCollection.createIndex({ 'metadata.correlationId': 1 });
      }

      // Streams collection indexes
      const streamIdIndexExists = streamsIndexes.some(idx => 
        idx.name === 'streamId_1' || (idx.key && idx.key.streamId === 1)
      );
      if (!streamIdIndexExists) {
        await this.streamsCollection.createIndex({ streamId: 1 }, { unique: true });
      }

      // Snapshots collection indexes
      const snapshotIndexExists = snapshotsIndexes.some(idx => 
        idx.name === 'aggregateId_1_version_1' || 
        (idx.key && idx.key.aggregateId === 1 && idx.key.version === 1)
      );
      if (!snapshotIndexExists) {
        await this.snapshotsCollection.createIndex({ aggregateId: 1, version: 1 });
      }

      this.logger.info('MongoDB indexes checked and created as needed');
    } catch (error) {
      this.logger.warn('Failed to create some indexes, but continuing', error as Error);
      // Don't throw error, as some indexes might already exist
    }
  }

  /**
   * Append events to a stream with optimistic concurrency control
   */
  async appendEvents(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void> {
    if (events.length === 0) {
      return;
    }

    if (!this.eventsCollection || !this.streamsCollection) {
      throw new Error('MongoDB Event Store not initialized');
    }

    const session = this.client!.startSession();

    try {
      await session.withTransaction(async () => {
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

        // Prepare events for insertion
        const eventsToInsert = events.map((event) => ({
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
            version: nextVersion++
          },
          version: nextVersion - 1,
          createdAt: new Date()
        }));

        // Insert events
        await this.eventsCollection!.insertMany(eventsToInsert, { session });

        // Update or create stream record
        await this.streamsCollection!.replaceOne(
          { streamId },
          {
            streamId,
            currentVersion: nextVersion - 1,
            eventCount: currentVersion + events.length,
            lastModified: new Date()
          },
          { upsert: true, session }
        );
      });

      this.logger.info(`Appended ${events.length} events to stream ${streamId}`);
    } catch (error) {
      this.logger.error(`Failed to append events to stream ${streamId}`, error as Error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get events from a stream
   */
  async getEvents(streamId: string, fromVersion?: number, toVersion?: number): Promise<StoredEvent[]> {
    if (!this.eventsCollection) {
      throw new Error('MongoDB Event Store not initialized');
    }

    try {
      const query: any = { aggregateId: streamId };
      
      if (fromVersion !== undefined || toVersion !== undefined) {
        query.version = {};
        if (fromVersion !== undefined) query.version.$gte = fromVersion;
        if (toVersion !== undefined) query.version.$lte = toVersion;
      }

      const cursor = this.eventsCollection
        .find(query)
        .sort({ version: 1 });

      const events = await cursor.toArray();
      
      return events.map(event => ({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventData: event.eventData,
        metadata: event.metadata,
        version: event.version,
        createdAt: event.createdAt
      }));
    } catch (error) {
      this.logger.error(`Failed to get events for stream ${streamId}`, error as Error);
      throw error;
    }
  }

  /**
   * Get current version of a stream
   */
  async getStreamVersion(streamId: string): Promise<number> {
    if (!this.streamsCollection) {
      throw new Error('MongoDB Event Store not initialized');
    }

    try {
      const stream = await this.streamsCollection.findOne({ streamId });
      return stream?.currentVersion || 0;
    } catch (error) {
      this.logger.error(`Failed to get stream version for ${streamId}`, error as Error);
      throw error;
    }
  }

  /**
   * Get all events matching query parameters
   */
  async queryEvents(params: EventQueryParams): Promise<StoredEvent[]> {
    if (!this.eventsCollection) {
      throw new Error('MongoDB Event Store not initialized');
    }

    try {
      const query: any = {};
      
      if (params.aggregateId) {
        query.aggregateId = params.aggregateId;
      }
      if (params.aggregateType) {
        query.aggregateType = params.aggregateType;
      }
      if (params.eventType) {
        query.eventType = params.eventType;
      }
      if (params.correlationId) {
        query['metadata.correlationId'] = params.correlationId;
      }
      if (params.fromTimestamp) {
        query['metadata.timestamp'] = { $gte: params.fromTimestamp };
      }
      if (params.toTimestamp) {
        query['metadata.timestamp'] = { 
          ...query['metadata.timestamp'], 
          $lte: params.toTimestamp 
        };
      }

      const cursor = this.eventsCollection
        .find(query)
        .sort({ 'metadata.timestamp': 1 });

      if (params.limit) {
        cursor.limit(params.limit);
      }
      if (params.offset) {
        cursor.skip(params.offset);
      }

      const events = await cursor.toArray();
      
      return events.map(event => ({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventData: event.eventData,
        metadata: event.metadata,
        version: event.version,
        createdAt: event.createdAt
      }));
    } catch (error) {
      this.logger.error('Failed to query events', error as Error);
      throw error;
    }
  }

  /**
   * Check if a stream exists
   */
  async streamExists(streamId: string): Promise<boolean> {
    if (!this.streamsCollection) {
      throw new Error('MongoDB Event Store not initialized');
    }

    try {
      const stream = await this.streamsCollection.findOne({ streamId });
      return stream !== null;
    } catch (error) {
      this.logger.error(`Failed to check if stream exists ${streamId}`, error as Error);
      throw error;
    }
  }

  /**
   * Get all events by type
   */
  async getEventsByType(eventType: string, params?: EventQueryParams): Promise<StoredEvent[]> {
    if (!this.eventsCollection) {
      throw new Error('MongoDB Event Store not initialized');
    }

    try {
      const query: any = { eventType };
      
      if (params?.fromTimestamp) {
        query['metadata.timestamp'] = { $gte: params.fromTimestamp };
      }
      if (params?.toTimestamp) {
        query['metadata.timestamp'] = { 
          ...query['metadata.timestamp'], 
          $lte: params.toTimestamp 
        };
      }
      if (params?.correlationId) {
        query['metadata.correlationId'] = params.correlationId;
      }

      const cursor = this.eventsCollection
        .find(query)
        .sort({ 'metadata.timestamp': 1 });

      if (params?.limit) {
        cursor.limit(params.limit);
      }
      if (params?.offset) {
        cursor.skip(params.offset);
      }

      const events = await cursor.toArray();
      
      return events.map(event => ({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventData: event.eventData,
        metadata: event.metadata,
        version: event.version,
        createdAt: event.createdAt
      }));
    } catch (error) {
      this.logger.error(`Failed to get events by type ${eventType}`, error as Error);
      throw error;
    }
  }

  /**
   * Get event stream information
   */
  async getEventStream(streamId: string): Promise<EventStream | null> {
    if (!this.streamsCollection || !this.eventsCollection) {
      throw new Error('MongoDB Event Store not initialized');
    }

    try {
      const stream = await this.streamsCollection.findOne({ streamId });
      if (!stream) {
        return null;
      }

      const firstEvent = await this.eventsCollection
        .findOne({ aggregateId: streamId }, { sort: { version: 1 } });

      return {
        streamId: stream.streamId,
        aggregateType: firstEvent?.aggregateType || 'Unknown',
        events: [], // We don't load all events here for performance
        version: stream.currentVersion
      };
    } catch (error) {
      this.logger.error(`Failed to get event stream ${streamId}`, error as Error);
      throw error;
    }
  }

  /**
   * Create snapshot
   */
  async createSnapshot(aggregateId: string, version: number, data: any): Promise<void> {
    if (!this.snapshotsCollection) {
      throw new Error('MongoDB Event Store not initialized');
    }

    try {
      await this.snapshotsCollection.replaceOne(
        { aggregateId },
        {
          aggregateId,
          version,
          data,
          createdAt: new Date()
        },
        { upsert: true }
      );

      this.logger.info(`Created snapshot for aggregate ${aggregateId} at version ${version}`);
    } catch (error) {
      this.logger.error(`Failed to create snapshot for aggregate ${aggregateId}`, error as Error);
      throw error;
    }
  }

  /**
   * Get latest snapshot
   */
  async getSnapshot(aggregateId: string): Promise<{ version: number; data: any } | null> {
    if (!this.snapshotsCollection) {
      throw new Error('MongoDB Event Store not initialized');
    }

    try {
      const snapshot = await this.snapshotsCollection
        .findOne({ aggregateId }, { sort: { version: -1 } });

      return snapshot ? { version: snapshot.version, data: snapshot.data } : null;
    } catch (error) {
      this.logger.error(`Failed to get snapshot for aggregate ${aggregateId}`, error as Error);
      throw error;
    }
  }

  /**
   * Replay events
   */
  async replayEvents(request: EventReplayRequest): Promise<StoredEvent[]> {
    if (!this.eventsCollection) {
      throw new Error('MongoDB Event Store not initialized');
    }

    try {
      const query: any = {};
      
      if (request.streamId) {
        query.aggregateId = request.streamId;
      }
      if (request.aggregateType) {
        query.aggregateType = request.aggregateType;
      }
      if (request.fromTimestamp) {
        query['metadata.timestamp'] = { $gte: request.fromTimestamp };
      }
      if (request.toTimestamp) {
        query['metadata.timestamp'] = { 
          ...query['metadata.timestamp'], 
          $lte: request.toTimestamp 
        };
      }
      if (request.eventTypes?.length) {
        query.eventType = { $in: request.eventTypes };
      }
      if (request.fromVersion !== undefined) {
        query.version = { $gte: request.fromVersion };
      }
      if (request.toVersion !== undefined) {
        query.version = { 
          ...query.version, 
          $lte: request.toVersion 
        };
      }

      const cursor = this.eventsCollection
        .find(query)
        .sort({ 'metadata.timestamp': 1 });

      const events = await cursor.toArray();
      
      this.logger.info(`Replayed ${events.length} events`);
      
      return events.map(event => ({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventData: event.eventData,
        metadata: event.metadata,
        version: event.version,
        createdAt: event.createdAt
      }));
    } catch (error) {
      this.logger.error('Failed to replay events', error as Error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      
      await this.client.db().admin().ping();
      return true;
    } catch (error) {
      this.logger.error('MongoDB health check failed', error as Error);
      return false;
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.logger.info('MongoDB Event Store connection closed');
    }
  }
}
