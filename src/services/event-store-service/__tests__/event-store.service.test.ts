import { EventStoreService } from '../application/services/event-store.service';
import { IEventStore } from '../domain/interfaces/event-store.interface';
import { StoredEvent, EventQueryParams } from '../domain/events/stored-event';
import { DomainEvent } from '@shared/infrastructure/messaging';

// Mock the logger
jest.mock('@shared/infrastructure/logging', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  })
}));

describe('EventStoreService', () => {
  let eventStoreService: EventStoreService;
  let mockEventStore: jest.Mocked<IEventStore>;

  beforeEach(() => {
    mockEventStore = {
      appendEvents: jest.fn(),
      getEvents: jest.fn(),
      queryEvents: jest.fn(),
      getEventStream: jest.fn(),
      replayEvents: jest.fn(),
      getStreamVersion: jest.fn(),
      streamExists: jest.fn()
    };

    eventStoreService = new EventStoreService(mockEventStore);
  });

  describe('storeEvents', () => {
    it('should store events successfully', async () => {
      const streamId = 'test-stream';
      const events: DomainEvent[] = [
        {
          eventId: '1',
          eventType: 'TEST_EVENT',
          aggregateId: 'test-aggregate',
          aggregateType: 'Test',
          eventData: { test: 'data' },
          metadata: {
            occurredOn: new Date(),
            version: 1,
            correlationId: 'corr-1',
            source: 'test'
          }
        }
      ];

      mockEventStore.appendEvents.mockResolvedValue();

      await eventStoreService.storeEvents(streamId, events);

      expect(mockEventStore.appendEvents).toHaveBeenCalledWith(streamId, events, undefined);
    });

    it('should handle store events error', async () => {
      const streamId = 'test-stream';
      const events: DomainEvent[] = [];
      const error = new Error('Store failed');

      mockEventStore.appendEvents.mockRejectedValue(error);

      await expect(eventStoreService.storeEvents(streamId, events)).rejects.toThrow('Store failed');
    });
  });

  describe('getStreamEvents', () => {
    it('should get stream events successfully', async () => {
      const streamId = 'test-stream';
      const mockEvents: StoredEvent[] = [
        {
          eventId: '1',
          eventType: 'TEST_EVENT',
          aggregateId: streamId,
          aggregateType: 'Test',
          eventData: { test: 'data' },
          metadata: {
            timestamp: new Date(),
            correlationId: 'corr-1',
            source: 'test'
          },
          createdAt: new Date(),
          version: 1
        }
      ];

      mockEventStore.getEvents.mockResolvedValue(mockEvents);

      const result = await eventStoreService.getStreamEvents(streamId);

      expect(result).toEqual(mockEvents);
      expect(mockEventStore.getEvents).toHaveBeenCalledWith(streamId, undefined);
    });
  });

  describe('queryEvents', () => {
    it('should query events successfully', async () => {
      const params: EventQueryParams = {
        aggregateType: 'Test',
        eventType: 'TEST_EVENT'
      };

      const mockEvents: StoredEvent[] = [];
      mockEventStore.queryEvents.mockResolvedValue(mockEvents);

      const result = await eventStoreService.queryEvents(params);

      expect(result).toEqual(mockEvents);
      expect(mockEventStore.queryEvents).toHaveBeenCalledWith(params);
    });
  });

  describe('getStreamVersion', () => {
    it('should get stream version successfully', async () => {
      const streamId = 'test-stream';
      const version = 5;

      mockEventStore.getStreamVersion.mockResolvedValue(version);

      const result = await eventStoreService.getStreamVersion(streamId);

      expect(result).toBe(version);
      expect(mockEventStore.getStreamVersion).toHaveBeenCalledWith(streamId);
    });
  });

  describe('streamExists', () => {
    it('should check if stream exists', async () => {
      const streamId = 'test-stream';

      mockEventStore.streamExists.mockResolvedValue(true);

      const result = await eventStoreService.streamExists(streamId);

      expect(result).toBe(true);
      expect(mockEventStore.streamExists).toHaveBeenCalledWith(streamId);
    });
  });
});