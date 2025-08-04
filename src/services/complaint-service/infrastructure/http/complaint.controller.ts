import { Router, Request, Response } from 'express';
import { ComplaintCommandHandlers } from '../../application/commands/complaint-command.handlers';
import { ComplaintQueryHandlers } from '../../application/queries/complaint-query.handlers';
import { createLogger } from '@shared/infrastructure/logging';
import {
  CreateComplaintDto,
  AssignComplaintDto,
  StartProcessingDto,
  ResolveComplaintDto,
  CloseComplaintDto,
  UpdatePriorityDto,
  ComplaintQueryDto
} from '../../application/dtos/complaint.dto';

const logger = createLogger('complaint-controller');

export class ComplaintController {
  public router: Router;

  constructor(
    private readonly commandHandlers: ComplaintCommandHandlers,
    private readonly queryHandlers: ComplaintQueryHandlers
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Command routes (POST, PUT, PATCH, DELETE)
    this.router.post('/', this.createComplaint.bind(this));
    this.router.patch('/:id/assign', this.assignComplaint.bind(this));
    this.router.patch('/:id/start-processing', this.startProcessing.bind(this));
    this.router.patch('/:id/resolve', this.resolveComplaint.bind(this));
    this.router.patch('/:id/close', this.closeComplaint.bind(this));
    this.router.patch('/:id/priority', this.updatePriority.bind(this));

    // Query routes (GET)
    this.router.get('/search', this.searchComplaints.bind(this));
    this.router.get('/summary', this.getComplaintSummary.bind(this));
    this.router.get('/status/:status?', this.getComplaintsByStatus.bind(this));
    this.router.get('/priority/:priority?', this.getComplaintsByPriority.bind(this));
    this.router.get('/category/:category?', this.getComplaintsByCategory.bind(this));
    this.router.get('/user/:userId', this.getComplaintsByUserId.bind(this));
    this.router.get('/text-search', this.searchComplaintsByText.bind(this));
    this.router.get('/stats/resolution-time', this.getResolutionTimeStats.bind(this));
    this.router.get('/trends/:days', this.getComplaintTrends.bind(this));
    this.router.get('/:id/detail', this.getComplaintDetailById.bind(this));
    this.router.get('/:id', this.getComplaintById.bind(this));
  }

  // Command handlers
  private async createComplaint(req: Request, res: Response): Promise<void> {
    try {
      const { userId, title, description, priority, category } = req.body;

      // Validate required fields
      if (!userId || !title || !description || !priority || !category) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, title, description, priority, category'
        });
        return;
      }

      const command: CreateComplaintDto = {
        userId,
        title,
        description,
        priority,
        category
      };

      const complaintId = await this.commandHandlers.createComplaint(command);

      logger.info('Complaint created successfully', {
        complaintId,
        userId,
        title
      });

      res.status(201).json({
        success: true,
        data: { complaintId },
        message: 'Complaint created successfully'
      });
    } catch (error) {
      logger.error('Failed to create complaint', error as Error, {
        body: req.body
      });

      res.status(500).json({
        success: false,
        message: 'Failed to create complaint',
        error: (error as Error).message
      });
    }
  }

  private async assignComplaint(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { assignedTo, assignedBy } = req.body;

      if (!assignedTo || !assignedBy) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: assignedTo, assignedBy'
        });
        return;
      }

      const command: AssignComplaintDto = {
        complaintId: id,
        assignedTo,
        assignedBy
      };

      await this.commandHandlers.assignComplaint(command);

      logger.info('Complaint assigned successfully', {
        complaintId: id,
        assignedTo,
        assignedBy
      });

      res.json({
        success: true,
        message: 'Complaint assigned successfully'
      });
    } catch (error) {
      logger.error('Failed to assign complaint', error as Error, {
        complaintId: req.params.id,
        body: req.body
      });

      res.status(500).json({
        success: false,
        message: 'Failed to assign complaint',
        error: (error as Error).message
      });
    }
  }

  private async startProcessing(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { processedBy } = req.body;

      if (!processedBy) {
        res.status(400).json({
          success: false,
          message: 'Missing required field: processedBy'
        });
        return;
      }

      const command: StartProcessingDto = {
        complaintId: id,
        processedBy
      };

      await this.commandHandlers.startProcessing(command);

      logger.info('Complaint processing started successfully', {
        complaintId: id,
        processedBy
      });

      res.json({
        success: true,
        message: 'Complaint processing started successfully'
      });
    } catch (error) {
      logger.error('Failed to start complaint processing', error as Error, {
        complaintId: req.params.id,
        body: req.body
      });

      res.status(500).json({
        success: false,
        message: 'Failed to start complaint processing',
        error: (error as Error).message
      });
    }
  }

  private async resolveComplaint(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { resolution, resolvedBy } = req.body;

      if (!resolution || !resolvedBy) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: resolution, resolvedBy'
        });
        return;
      }

      const command: ResolveComplaintDto = {
        complaintId: id,
        resolution,
        resolvedBy
      };

      await this.commandHandlers.resolveComplaint(command);

      logger.info('Complaint resolved successfully', {
        complaintId: id,
        resolvedBy
      });

      res.json({
        success: true,
        message: 'Complaint resolved successfully'
      });
    } catch (error) {
      logger.error('Failed to resolve complaint', error as Error, {
        complaintId: req.params.id,
        body: req.body
      });

      res.status(500).json({
        success: false,
        message: 'Failed to resolve complaint',
        error: (error as Error).message
      });
    }
  }

  private async closeComplaint(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { closedBy, closureReason, customerSatisfaction } = req.body;

      if (!closedBy || !closureReason) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: closedBy, closureReason'
        });
        return;
      }

      const command: CloseComplaintDto = {
        complaintId: id,
        closedBy,
        closureReason,
        customerSatisfaction
      };

      await this.commandHandlers.closeComplaint(command);

      logger.info('Complaint closed successfully', {
        complaintId: id,
        closedBy
      });

      res.json({
        success: true,
        message: 'Complaint closed successfully'
      });
    } catch (error) {
      logger.error('Failed to close complaint', error as Error, {
        complaintId: req.params.id,
        body: req.body
      });

      res.status(500).json({
        success: false,
        message: 'Failed to close complaint',
        error: (error as Error).message
      });
    }
  }

  private async updatePriority(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { newPriority, updatedBy } = req.body;

      if (!newPriority || !updatedBy) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: newPriority, updatedBy'
        });
        return;
      }

      const command: UpdatePriorityDto = {
        complaintId: id,
        newPriority,
        updatedBy
      };

      await this.commandHandlers.updatePriority(command);

      logger.info('Complaint priority updated successfully', {
        complaintId: id,
        newPriority,
        updatedBy
      });

      res.json({
        success: true,
        message: 'Complaint priority updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update complaint priority', error as Error, {
        complaintId: req.params.id,
        body: req.body
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update complaint priority',
        error: (error as Error).message
      });
    }
  }

  // Query handlers
  private async getComplaintById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const complaint = await this.queryHandlers.getComplaintById(id);

      if (!complaint) {
        res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
        return;
      }

      res.json({
        success: true,
        data: complaint
      });
    } catch (error) {
      logger.error('Failed to get complaint by ID', error as Error, {
        complaintId: req.params.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get complaint',
        error: (error as Error).message
      });
    }
  }

  private async getComplaintDetailById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const complaintDetail = await this.queryHandlers.getComplaintDetailById(id);

      if (!complaintDetail) {
        res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
        return;
      }

      res.json({
        success: true,
        data: complaintDetail
      });
    } catch (error) {
      logger.error('Failed to get complaint detail by ID', error as Error, {
        complaintId: req.params.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get complaint detail',
        error: (error as Error).message
      });
    }
  }

  private async getComplaintsByUserId(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const complaints = await this.queryHandlers.getComplaintsByUserId(userId);

      res.json({
        success: true,
        data: complaints
      });
    } catch (error) {
      logger.error('Failed to get complaints by user ID', error as Error, {
        userId: req.params.userId
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get complaints',
        error: (error as Error).message
      });
    }
  }

  private async searchComplaints(req: Request, res: Response): Promise<void> {
    try {
      const query: ComplaintQueryDto = {
        userId: req.query.userId as string,
        status: req.query.status as any,
        priority: req.query.priority as any,
        category: req.query.category as string,
        assignedTo: req.query.assignedTo as string,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const result = await this.queryHandlers.searchComplaints(query);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to search complaints', error as Error, {
        query: req.query
      });

      res.status(500).json({
        success: false,
        message: 'Failed to search complaints',
        error: (error as Error).message
      });
    }
  }

  private async getComplaintsByStatus(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.params;

      const complaints = await this.queryHandlers.getComplaintsByStatus(status);

      res.json({
        success: true,
        data: complaints
      });
    } catch (error) {
      logger.error('Failed to get complaints by status', error as Error, {
        status: req.params.status
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get complaints by status',
        error: (error as Error).message
      });
    }
  }

  private async getComplaintsByPriority(req: Request, res: Response): Promise<void> {
    try {
      const { priority } = req.params;

      const complaints = await this.queryHandlers.getComplaintsByPriority(priority);

      res.json({
        success: true,
        data: complaints
      });
    } catch (error) {
      logger.error('Failed to get complaints by priority', error as Error, {
        priority: req.params.priority
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get complaints by priority',
        error: (error as Error).message
      });
    }
  }

  private async getComplaintsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params;

      const complaints = await this.queryHandlers.getComplaintsByCategory(category);

      res.json({
        success: true,
        data: complaints
      });
    } catch (error) {
      logger.error('Failed to get complaints by category', error as Error, {
        category: req.params.category
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get complaints by category',
        error: (error as Error).message
      });
    }
  }

  private async getComplaintSummary(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.query.userId as string;

      const summary = await this.queryHandlers.getComplaintSummary(userId);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to get complaint summary', error as Error, {
        userId: req.query.userId
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get complaint summary',
        error: (error as Error).message
      });
    }
  }

  private async searchComplaintsByText(req: Request, res: Response): Promise<void> {
    try {
      const searchText = req.query.q as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      if (!searchText) {
        res.status(400).json({
          success: false,
          message: 'Missing required query parameter: q'
        });
        return;
      }

      const complaints = await this.queryHandlers.searchComplaintsByText(searchText, limit);

      res.json({
        success: true,
        data: complaints
      });
    } catch (error) {
      logger.error('Failed to search complaints by text', error as Error, {
        searchText: req.query.q
      });

      res.status(500).json({
        success: false,
        message: 'Failed to search complaints by text',
        error: (error as Error).message
      });
    }
  }

  private async getResolutionTimeStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.queryHandlers.getResolutionTimeStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get resolution time stats', error as Error);

      res.status(500).json({
        success: false,
        message: 'Failed to get resolution time stats',
        error: (error as Error).message
      });
    }
  }

  private async getComplaintTrends(req: Request, res: Response): Promise<void> {
    try {
      const days = parseInt(req.params.days);

      if (isNaN(days) || days <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid days parameter'
        });
        return;
      }

      const trends = await this.queryHandlers.getComplaintTrends(days);

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      logger.error('Failed to get complaint trends', error as Error, {
        days: req.params.days
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get complaint trends',
        error: (error as Error).message
      });
    }
  }
}