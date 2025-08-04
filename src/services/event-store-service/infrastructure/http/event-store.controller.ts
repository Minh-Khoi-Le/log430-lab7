import { Request, Response, Router } from 'express';
import { EventStoreService } from '../../application/services/event-store.service';
import { EventQueryParams, EventReplayRequest } from '../../domain/events/stored-event';
import { createLogger } from '@shared/infrastructure/logging';

/**
 * Event Store HTTP controller
 */
export class EventStoreController {
  public readonly router = Router();
  private readonly logger = createLogger('event-store-controller');

  constructor(private readonly eventStoreService: EventStoreService) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Get events from a specific stream
    this.router.get('/streams/:streamId/events', this.getStreamEvents.bind(this));
    
    // Get event stream metadata
    this.router.get('/streams/:streamId', this.getEventStream.bind(this));
    
    // Query events
    this.router.get('/events', this.queryEvents.bind(this));
    
    // Replay events
    this.router.post('/replay', this.replayEvents.bind(this));
    
    // Get stream version
    this.router.get('/streams/:streamId/version', this.getStreamVersion.bind(this));
    
    // Check if stream exists
    this.router.head('/streams/:streamId', this.checkStreamExists.bind(this));
    
    // Reconstruct state from events
    this.router.post('/streams/:streamId/reconstruct', this.reconstructState.bind(this));
  }

  /**
   * Get events from a specific stream
   */
  async getStreamEvents(req: Request, res: Response): Promise<void> {
    try {
      const { streamId } = req.params;
      const fromVersion = req.query.fromVersion ? parseInt(req.query.fromVersion as string) : undefined;

      this.logger.info('Getting stream events', { streamId, fromVersion });

      const events = await this.eventStoreService.getStreamEvents(streamId, fromVersion);

      res.json({
        success: true,
        data: {
          streamId,
          events,
          count: events.length
        }
      });
    } catch (error) {
      this.logger.error('Failed to get stream events', error as Error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get event stream with metadata
   */
  async getEventStream(req: Request, res: Response): Promise<void> {
    try {
      const { streamId } = req.params;

      this.logger.info('Getting event stream', { streamId });

      const stream = await this.eventStoreService.getEventStream(streamId);

      if (!stream) {
        res.status(404).json({
          success: false,
          message: 'Stream not found'
        });
        return;
      }

      res.json({
        success: true,
        data: stream
      });
    } catch (error) {
      this.logger.error('Failed to get event stream', error as Error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Query events based on parameters
   */
  async queryEvents(req: Request, res: Response): Promise<void> {
    try {
      const params: EventQueryParams = {
        aggregateId: req.query.aggregateId as string,
        aggregateType: req.query.aggregateType as string,
        eventType: req.query.eventType as string,
        correlationId: req.query.correlationId as string,
        fromTimestamp: req.query.fromTimestamp ? new Date(req.query.fromTimestamp as string) : undefined,
        toTimestamp: req.query.toTimestamp ? new Date(req.query.toTimestamp as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      // Remove undefined values
      Object.keys(params).forEach(key => {
        if (params[key as keyof EventQueryParams] === undefined) {
          delete params[key as keyof EventQueryParams];
        }
      });

      this.logger.info('Querying events', params);

      const events = await this.eventStoreService.queryEvents(params);

      res.json({
        success: true,
        data: {
          events,
          count: events.length,
          params
        }
      });
    } catch (error) {
      this.logger.error('Failed to query events', error as Error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Replay events based on criteria
   */
  async replayEvents(req: Request, res: Response): Promise<void> {
    try {
      const request: EventReplayRequest = {
        streamId: req.body.streamId,
        aggregateType: req.body.aggregateType,
        fromTimestamp: req.body.fromTimestamp ? new Date(req.body.fromTimestamp) : undefined,
        toTimestamp: req.body.toTimestamp ? new Date(req.body.toTimestamp) : undefined,
        fromVersion: req.body.fromVersion,
        toVersion: req.body.toVersion,
        eventTypes: req.body.eventTypes
      };

      this.logger.info('Replaying events', request);

      const events = await this.eventStoreService.replayEvents(request);

      res.json({
        success: true,
        data: {
          events,
          count: events.length,
          request
        }
      });
    } catch (error) {
      this.logger.error('Failed to replay events', error as Error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get stream version
   */
  async getStreamVersion(req: Request, res: Response): Promise<void> {
    try {
      const { streamId } = req.params;

      this.logger.info('Getting stream version', { streamId });

      const version = await this.eventStoreService.getStreamVersion(streamId);

      res.json({
        success: true,
        data: {
          streamId,
          version
        }
      });
    } catch (error) {
      this.logger.error('Failed to get stream version', error as Error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check if stream exists
   */
  async checkStreamExists(req: Request, res: Response): Promise<void> {
    try {
      const { streamId } = req.params;

      const exists = await this.eventStoreService.streamExists(streamId);

      if (exists) {
        res.status(200).end();
      } else {
        res.status(404).end();
      }
    } catch (error) {
      this.logger.error('Failed to check stream existence', error as Error);
      res.status(500).end();
    }
  }

  /**
   * Reconstruct state from events
   */
  async reconstructState(req: Request, res: Response): Promise<void> {
    try {
      const { streamId } = req.params;
      const { initialState, reducerType } = req.body;

      this.logger.info('Reconstructing state', { streamId, reducerType });

      // For now, we'll return the events and let the client handle reconstruction
      // In a real implementation, you might have registered reducers
      const events = await this.eventStoreService.getStreamEvents(streamId);

      res.json({
        success: true,
        data: {
          streamId,
          events,
          message: 'Events retrieved for state reconstruction. Apply your reducer function to reconstruct state.'
        }
      });
    } catch (error) {
      this.logger.error('Failed to reconstruct state', error as Error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}