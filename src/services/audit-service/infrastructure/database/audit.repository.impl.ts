import { AuditLogRepository } from '../../domain/repositories/audit-log.repository';
import { AuditLog } from '../../domain/entities/audit-log';
import { AuditLogQueryParams } from '../../domain/value-objects/audit-query-params';
import { DatabaseManager } from '@shared/infrastructure/database';
import { Logger } from '@shared/infrastructure/logging';

export class AuditLogRepositoryImpl implements AuditLogRepository {
  private readonly databaseManager: DatabaseManager;
  private readonly logger: Logger;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
    this.logger = new Logger({ serviceName: 'audit-service' });
  }

  async save(auditLog: AuditLog): Promise<void> {
    try {
      const client = this.databaseManager.getClient();
      
      await client.auditLog.create({
        data: {
          auditId: auditLog.auditId,
          eventType: auditLog.eventType,
          entityId: auditLog.entityId,
          entityType: auditLog.entityType,
          userId: auditLog.userId,
          action: auditLog.action,
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

      this.logger.info('Audit log saved successfully', { auditId: auditLog.auditId });
    } catch (error) {
      this.logger.error('Failed to save audit log', error as Error);
      throw error;
    }
  }

  async findByAuditId(auditId: string): Promise<AuditLog | null> {
    try {
      const client = this.databaseManager.getClient();
      
      const auditLogData = await client.auditLog.findUnique({
        where: { auditId }
      });

      if (!auditLogData) {
        return null;
      }

      return this.mapToAuditLog(auditLogData);
    } catch (error) {
      this.logger.error('Failed to find audit log by audit id', error as Error);
      throw error;
    }
  }

  async findByQueryParams(params: AuditLogQueryParams): Promise<{
    auditLogs: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const client = this.databaseManager.getClient();
      
      const where: any = {};

      if (params.eventType) {
        where.eventType = params.eventType;
      }

      if (params.entityType) {
        where.entityType = params.entityType;
      }

      if (params.entityId) {
        where.entityId = params.entityId;
      }

      if (params.userId) {
        where.userId = params.userId;
      }

      if (params.action) {
        where.action = params.action;
      }

      if (params.serviceName) {
        where.serviceName = params.serviceName;
      }

      if (params.correlationId) {
        where.correlationId = params.correlationId;
      }

      if (params.fromDate || params.toDate) {
        where.timestamp = {};
        if (params.fromDate) {
          where.timestamp.gte = params.fromDate;
        }
        if (params.toDate) {
          where.timestamp.lte = params.toDate;
        }
      }

      const skip = (params.page - 1) * params.limit;

      const [auditLogsData, total] = await Promise.all([
        client.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: params.limit
        }),
        client.auditLog.count({ where })
      ]);

      const auditLogs = auditLogsData.map(data => this.mapToAuditLog(data));

      return {
        auditLogs,
        total,
        page: params.page,
        limit: params.limit
      };
    } catch (error) {
      this.logger.error('Failed to find audit logs by query params', error as Error);
      throw error;
    }
  }

  async findByCorrelationId(correlationId: string): Promise<AuditLog[]> {
    try {
      const client = this.databaseManager.getClient();
      
      const auditLogsData = await client.auditLog.findMany({
        where: { correlationId },
        orderBy: { timestamp: 'asc' }
      });

      return auditLogsData.map(data => this.mapToAuditLog(data));
    } catch (error) {
      this.logger.error('Failed to find audit logs by correlation id', error as Error);
      throw error;
    }
  }

  private mapToAuditLog(data: any): AuditLog {
    return new AuditLog({
      auditId: data.auditId,
      eventType: data.eventType,
      entityId: data.entityId,
      entityType: data.entityType,
      userId: data.userId,
      action: data.action,
      serviceName: data.serviceName,
      correlationId: data.correlationId,
      causationId: data.causationId,
      metadata: data.metadata,
      details: data.details,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      timestamp: data.timestamp
    });
  }
}
