import { Request, Response } from 'express';
import { AuditQueryHandlers } from '../../application/queries/audit-query.handlers';
import { AuditCommandHandlers } from '../../application/commands/audit-command.handlers';
import { Logger } from '@shared/infrastructure/logging';

export class AuditController {
  private readonly queryHandlers: AuditQueryHandlers;
  private readonly commandHandlers: AuditCommandHandlers;
  private readonly logger: Logger;

  constructor(queryHandlers: AuditQueryHandlers, commandHandlers: AuditCommandHandlers) {
    this.queryHandlers = queryHandlers;
    this.commandHandlers = commandHandlers;
    this.logger = new Logger({ serviceName: 'audit-service' });
  }

  // GET /audit/logs
  async searchAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        eventType,
        entityType,
        entityId,
        userId,
        action,
        serviceName,
        correlationId,
        fromDate,
        toDate,
        page = 1,
        limit = 10,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = req.query;

      const filter = {
        eventType: eventType as string,
        entityType: entityType as string,
        entityId: entityId as string,
        userId: userId as string,
        action: action as string,
        serviceName: serviceName as string,
        correlationId: correlationId as string,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined
      };

      const pagination = {
        page: parseInt(page as string) || 1,
        limit: Math.min(100, parseInt(limit as string) || 10),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const result = await this.queryHandlers.searchAuditLogs({ filter, pagination });

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      this.logger.error('Failed to search audit logs', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to search audit logs'
      });
    }
  }

  // GET /audit/logs/:auditId
  async getAuditLog(req: Request, res: Response): Promise<void> {
    try {
      const { auditId } = req.params;

      const auditLog = await this.queryHandlers.getAuditLog({ auditId });

      if (!auditLog) {
        res.status(404).json({
          success: false,
          error: 'Audit log not found'
        });
        return;
      }

      res.json({
        success: true,
        data: auditLog
      });
    } catch (error) {
      this.logger.error('Failed to get audit log', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit log'
      });
    }
  }

  // GET /audit/logs/correlation/:correlationId
  async getAuditLogsByCorrelation(req: Request, res: Response): Promise<void> {
    try {
      const { correlationId } = req.params;

      const auditLogs = await this.queryHandlers.getAuditLogsByCorrelation({ correlationId });

      res.json({
        success: true,
        data: auditLogs,
        count: auditLogs.length
      });
    } catch (error) {
      this.logger.error('Failed to get audit logs by correlation', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit logs by correlation'
      });
    }
  }

  // GET /audit/logs/entity/:entityType/:entityId
  async getAuditLogsByEntity(req: Request, res: Response): Promise<void> {
    try {
      const { entityType, entityId } = req.params;

      const auditLogs = await this.queryHandlers.getAuditLogsByEntity({ entityType, entityId });

      res.json({
        success: true,
        data: auditLogs,
        count: auditLogs.length
      });
    } catch (error) {
      this.logger.error('Failed to get audit logs by entity', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit logs by entity'
      });
    }
  }

  // GET /audit/logs/user/:userId
  async getAuditLogsByUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const pagination = {
        page: parseInt(page as string) || 1,
        limit: Math.min(100, parseInt(limit as string) || 10),
        sortBy: 'timestamp',
        sortOrder: 'desc' as const
      };

      const result = await this.queryHandlers.getAuditLogsByUser({ userId, pagination });

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      this.logger.error('Failed to get audit logs by user', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit logs by user'
      });
    }
  }

  // GET /audit/statistics
  async getAuditStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = req.query;

      const query = {
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined
      };

      const statistics = await this.queryHandlers.getAuditStatistics(query);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      this.logger.error('Failed to get audit statistics', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit statistics'
      });
    }
  }

  // GET /audit/trails
  async searchAuditTrails(req: Request, res: Response): Promise<void> {
    try {
      const {
        entityType,
        entityId,
        processName,
        correlationId,
        status,
        fromDate,
        toDate,
        page = 1,
        limit = 10,
        sortBy = 'startTime',
        sortOrder = 'desc'
      } = req.query;

      const filter = {
        entityType: entityType as string,
        entityId: entityId as string,
        processName: processName as string,
        correlationId: correlationId as string,
        status: status as string,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined
      };

      const pagination = {
        page: parseInt(page as string) || 1,
        limit: Math.min(100, parseInt(limit as string) || 10),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const result = await this.queryHandlers.searchAuditTrails({ filter, pagination });

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      this.logger.error('Failed to search audit trails', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to search audit trails'
      });
    }
  }

  // GET /audit/trails/active
  async getActiveAuditTrails(req: Request, res: Response): Promise<void> {
    try {
      const activeTrails = await this.queryHandlers.getActiveAuditTrails();

      res.json({
        success: true,
        data: activeTrails,
        count: activeTrails.length
      });
    } catch (error) {
      this.logger.error('Failed to get active audit trails', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active audit trails'
      });
    }
  }

  // GET /audit/trails/:trailId
  async getAuditTrail(req: Request, res: Response): Promise<void> {
    try {
      const { trailId } = req.params;

      const auditTrail = await this.queryHandlers.getAuditTrail({ trailId });

      if (!auditTrail) {
        res.status(404).json({
          success: false,
          error: 'Audit trail not found'
        });
        return;
      }

      res.json({
        success: true,
        data: auditTrail
      });
    } catch (error) {
      this.logger.error('Failed to get audit trail', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit trail'
      });
    }
  }

  // GET /audit/trails/correlation/:correlationId
  async getAuditTrailByCorrelation(req: Request, res: Response): Promise<void> {
    try {
      const { correlationId } = req.params;

      const auditTrail = await this.queryHandlers.getAuditTrailByCorrelation(correlationId);

      if (!auditTrail) {
        res.status(404).json({
          success: false,
          error: 'Audit trail not found'
        });
        return;
      }

      res.json({
        success: true,
        data: auditTrail
      });
    } catch (error) {
      this.logger.error('Failed to get audit trail by correlation', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get audit trail by correlation'
      });
    }
  }
}
