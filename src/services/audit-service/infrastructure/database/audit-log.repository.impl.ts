/**
 * Audit Log Repository Implementation
 * 
 * This module implements the audit log repository using Prisma ORM
 * for PostgreSQL database operations.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { 
  IAuditLogRepository, 
  AuditLogFilter, 
  PaginationOptions, 
  PaginatedResult,
  AuditStatistics
} from '../../domain/audit.repository.interface';
import { AuditLog } from '../../domain/audit.models';
import { DatabaseManager } from '@shared/infrastructure/database';
import { createLogger } from '@shared/infrastructure/logging';

const logger = createLogger('audit-log-repository');

export class AuditLogRepositoryImpl implements IAuditLogRepository {
  private readonly prisma: PrismaClient;

  constructor(private readonly databaseManager: DatabaseManager) {
    this.prisma = databaseManager.getClient();
  }

  async create(auditLog: AuditLog): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          auditId: auditLog.auditId,
          eventType: auditLog.eventType,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          action: auditLog.action,
          userId: auditLog.userId,
          serviceName: auditLog.serviceName,
          correlationId: auditLog.correlationId,
          causationId: auditLog.causationId,
          metadata: auditLog.metadata,
          details: auditLog.details,
          ipAddress: auditLog.ipAddress,
          userAgent: auditLog.userAgent,
          timestamp: auditLog.timestamp
        }
      });

      logger.info('Audit log created in database', {
        auditId: auditLog.auditId,
        eventType: auditLog.eventType,
        entityType: auditLog.entityType
      });
    } catch (error) {
      logger.error('Failed to create audit log in database', error as Error, {
        auditId: auditLog.auditId
      });
      throw error;
    }
  }

  async findById(auditId: string): Promise<AuditLog | null> {
    try {
      const result = await this.prisma.auditLog.findUnique({
        where: { auditId }
      });

      if (!result) {
        return null;
      }

      return this.mapToAuditLog(result);
    } catch (error) {
      logger.error('Failed to find audit log by ID', error as Error, { auditId });
      throw error;
    }
  }

  async findByCorrelationId(correlationId: string): Promise<AuditLog[]> {
    try {
      const results = await this.prisma.auditLog.findMany({
        where: { correlationId },
        orderBy: { timestamp: 'asc' }
      });

      return results.map(result => this.mapToAuditLog(result));
    } catch (error) {
      logger.error('Failed to find audit logs by correlation ID', error as Error, {
        correlationId
      });
      throw error;
    }
  }

  async search(filter: AuditLogFilter, pagination: PaginationOptions): Promise<PaginatedResult<AuditLog>> {
    try {
      const whereClause = this.buildWhereClause(filter);
      const orderBy = this.buildOrderBy(pagination);
      
      const skip = (pagination.page - 1) * pagination.limit;
      const take = pagination.limit;

      const [results, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where: whereClause,
          orderBy,
          skip,
          take
        }),
        this.prisma.auditLog.count({
          where: whereClause
        })
      ]);

      const auditLogs = results.map(result => this.mapToAuditLog(result));
      const totalPages = Math.ceil(total / pagination.limit);

      return {
        data: auditLogs,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages
      };
    } catch (error) {
      logger.error('Failed to search audit logs', error as Error, { filter });
      throw error;
    }
  }

  async findByEntityId(entityType: string, entityId: string): Promise<AuditLog[]> {
    try {
      const results = await this.prisma.auditLog.findMany({
        where: {
          entityType,
          entityId
        },
        orderBy: { timestamp: 'desc' }
      });

      return results.map(result => this.mapToAuditLog(result));
    } catch (error) {
      logger.error('Failed to find audit logs by entity', error as Error, {
        entityType,
        entityId
      });
      throw error;
    }
  }

  async findByUserId(userId: string, pagination: PaginationOptions): Promise<PaginatedResult<AuditLog>> {
    try {
      const orderBy = this.buildOrderBy(pagination);
      const skip = (pagination.page - 1) * pagination.limit;
      const take = pagination.limit;

      const [results, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where: { userId },
          orderBy,
          skip,
          take
        }),
        this.prisma.auditLog.count({
          where: { userId }
        })
      ]);

      const auditLogs = results.map(result => this.mapToAuditLog(result));
      const totalPages = Math.ceil(total / pagination.limit);

      return {
        data: auditLogs,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages
      };
    } catch (error) {
      logger.error('Failed to find audit logs by user', error as Error, { userId });
      throw error;
    }
  }

  async findByService(serviceName: string, pagination: PaginationOptions): Promise<PaginatedResult<AuditLog>> {
    try {
      const orderBy = this.buildOrderBy(pagination);
      const skip = (pagination.page - 1) * pagination.limit;
      const take = pagination.limit;

      const [results, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where: { serviceName },
          orderBy,
          skip,
          take
        }),
        this.prisma.auditLog.count({
          where: { serviceName }
        })
      ]);

      const auditLogs = results.map(result => this.mapToAuditLog(result));
      const totalPages = Math.ceil(total / pagination.limit);

      return {
        data: auditLogs,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages
      };
    } catch (error) {
      logger.error('Failed to find audit logs by service', error as Error, { serviceName });
      throw error;
    }
  }

  async countByEventType(eventType: string, fromDate?: Date, toDate?: Date): Promise<number> {
    try {
      const whereClause: Prisma.AuditLogWhereInput = {
        eventType
      };

      if (fromDate || toDate) {
        whereClause.timestamp = {};
        if (fromDate) {
          whereClause.timestamp.gte = fromDate;
        }
        if (toDate) {
          whereClause.timestamp.lte = toDate;
        }
      }

      return await this.prisma.auditLog.count({
        where: whereClause
      });
    } catch (error) {
      logger.error('Failed to count audit logs by event type', error as Error, {
        eventType,
        fromDate,
        toDate
      });
      throw error;
    }
  }

  async getAuditStatistics(fromDate?: Date, toDate?: Date): Promise<AuditStatistics> {
    try {
      const whereClause: Prisma.AuditLogWhereInput = {};

      if (fromDate || toDate) {
        whereClause.timestamp = {};
        if (fromDate) {
          whereClause.timestamp.gte = fromDate;
        }
        if (toDate) {
          whereClause.timestamp.lte = toDate;
        }
      }

      const [
        totalEvents,
        eventsByType,
        eventsByService,
        eventsByAction,
        uniqueUsers,
        activeTrails,
        completedTrails,
        failedTrails
      ] = await Promise.all([
        this.prisma.auditLog.count({ where: whereClause }),
        this.prisma.auditLog.groupBy({
          by: ['eventType'],
          where: whereClause,
          _count: { eventType: true }
        }),
        this.prisma.auditLog.groupBy({
          by: ['serviceName'],
          where: whereClause,
          _count: { serviceName: true }
        }),
        this.prisma.auditLog.groupBy({
          by: ['action'],
          where: whereClause,
          _count: { action: true }
        }),
        this.prisma.auditLog.findMany({
          where: {
            ...whereClause,
            userId: { not: null }
          },
          select: { userId: true },
          distinct: ['userId']
        }).then(results => results.length),
        this.prisma.auditTrail.count({
          where: { status: 'STARTED' }
        }),
        this.prisma.auditTrail.count({
          where: { status: 'COMPLETED' }
        }),
        this.prisma.auditTrail.count({
          where: { status: 'FAILED' }
        })
      ]);

      return {
        totalEvents,
        eventsByType: eventsByType.reduce((acc, item) => {
          acc[item.eventType] = item._count.eventType;
          return acc;
        }, {} as Record<string, number>),
        eventsByService: eventsByService.reduce((acc, item) => {
          acc[item.serviceName] = item._count.serviceName;
          return acc;
        }, {} as Record<string, number>),
        eventsByAction: eventsByAction.reduce((acc, item) => {
          acc[item.action] = item._count.action;
          return acc;
        }, {} as Record<string, number>),
        uniqueUsers,
        activeTrails,
        completedTrails,
        failedTrails
      };
    } catch (error) {
      logger.error('Failed to get audit statistics', error as Error, {
        fromDate,
        toDate
      });
      throw error;
    }
  }

  private buildWhereClause(filter: AuditLogFilter): Prisma.AuditLogWhereInput {
    const whereClause: Prisma.AuditLogWhereInput = {};

    if (filter.eventType) {
      whereClause.eventType = filter.eventType;
    }

    if (filter.entityType) {
      whereClause.entityType = filter.entityType;
    }

    if (filter.entityId) {
      whereClause.entityId = filter.entityId;
    }

    if (filter.action) {
      whereClause.action = filter.action;
    }

    if (filter.userId) {
      whereClause.userId = filter.userId;
    }

    if (filter.serviceName) {
      whereClause.serviceName = filter.serviceName;
    }

    if (filter.correlationId) {
      whereClause.correlationId = filter.correlationId;
    }

    if (filter.ipAddress) {
      whereClause.ipAddress = filter.ipAddress;
    }

    if (filter.fromDate || filter.toDate) {
      whereClause.timestamp = {};
      if (filter.fromDate) {
        whereClause.timestamp.gte = filter.fromDate;
      }
      if (filter.toDate) {
        whereClause.timestamp.lte = filter.toDate;
      }
    }

    return whereClause;
  }

  private buildOrderBy(pagination: PaginationOptions): Prisma.AuditLogOrderByWithRelationInput {
    const sortBy = pagination.sortBy || 'timestamp';
    const sortOrder = pagination.sortOrder || 'desc';

    return {
      [sortBy]: sortOrder
    };
  }

  private mapToAuditLog(data: any): AuditLog {
    return new AuditLog(
      data.auditId,
      data.eventType,
      data.entityType,
      data.entityId,
      data.action,
      data.serviceName,
      data.correlationId,
      data.metadata as Record<string, any>,
      data.details as Record<string, any>,
      data.timestamp,
      data.userId,
      data.causationId,
      data.ipAddress,
      data.userAgent
    );
  }
}
