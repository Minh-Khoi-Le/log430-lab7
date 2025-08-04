import { 
  IAuditTrailRepository, 
  AuditTrailFilter, 
  PaginationOptions, 
  PaginatedResult
} from '../../domain/audit.repository.interface';
import { AuditTrail } from '../../domain/audit.models';
import { DatabaseManager } from '@shared/infrastructure/database';
import { createLogger } from '@shared/infrastructure/logging';

const logger = createLogger('audit-trail-repository');

export class AuditTrailRepositoryImpl implements IAuditTrailRepository {
  private readonly databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  async create(auditTrail: AuditTrail): Promise<void> {
    try {
      const client = this.databaseManager.getClient();
      
      await client.auditTrail.create({
        data: {
          trailId: auditTrail.trailId,
          entityType: auditTrail.entityType,
          entityId: auditTrail.entityId,
          processName: auditTrail.processName,
          correlationId: auditTrail.correlationId,
          startTime: auditTrail.startTime,
          endTime: auditTrail.endTime,
          status: auditTrail.status,
          totalEvents: auditTrail.totalEvents,
          metadata: auditTrail.metadata
        }
      });

      logger.info('Audit trail created in database', {
        trailId: auditTrail.trailId,
        entityType: auditTrail.entityType,
        processName: auditTrail.processName
      });
    } catch (error) {
      logger.error('Failed to create audit trail in database', error as Error, {
        trailId: auditTrail.trailId
      });
      throw error;
    }
  }

  async update(auditTrail: AuditTrail): Promise<void> {
    try {
      const client = this.databaseManager.getClient();
      
      await client.auditTrail.update({
        where: { trailId: auditTrail.trailId },
        data: {
          endTime: auditTrail.endTime,
          status: auditTrail.status,
          totalEvents: auditTrail.totalEvents,
          metadata: auditTrail.metadata,
          updatedAt: new Date()
        }
      });

      logger.info('Audit trail updated in database', {
        trailId: auditTrail.trailId,
        status: auditTrail.status
      });
    } catch (error) {
      logger.error('Failed to update audit trail in database', error as Error, {
        trailId: auditTrail.trailId
      });
      throw error;
    }
  }

  async findById(trailId: string): Promise<AuditTrail | null> {
    try {
      const client = this.databaseManager.getClient();
      
      const result = await client.auditTrail.findUnique({
        where: { trailId }
      });

      if (!result) {
        return null;
      }

      return this.mapToAuditTrail(result);
    } catch (error) {
      logger.error('Failed to find audit trail by ID', error as Error, { trailId });
      throw error;
    }
  }

  async findByCorrelationId(correlationId: string): Promise<AuditTrail | null> {
    try {
      const client = this.databaseManager.getClient();
      
      const result = await client.auditTrail.findFirst({
        where: { correlationId },
        orderBy: { startTime: 'desc' }
      });

      if (!result) {
        return null;
      }

      return this.mapToAuditTrail(result);
    } catch (error) {
      logger.error('Failed to find audit trail by correlation ID', error as Error, {
        correlationId
      });
      throw error;
    }
  }

  async search(filter: AuditTrailFilter, pagination: PaginationOptions): Promise<PaginatedResult<AuditTrail>> {
    try {
      const client = this.databaseManager.getClient();
      const whereClause = this.buildWhereClause(filter);
      
      const skip = (pagination.page - 1) * pagination.limit;
      const take = pagination.limit;

      const [results, total] = await Promise.all([
        client.auditTrail.findMany({
          where: whereClause,
          orderBy: { startTime: 'desc' },
          skip,
          take
        }),
        client.auditTrail.count({
          where: whereClause
        })
      ]);

      const auditTrails = results.map(result => this.mapToAuditTrail(result));
      const totalPages = Math.ceil(total / pagination.limit);

      return {
        data: auditTrails,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages
      };
    } catch (error) {
      logger.error('Failed to search audit trails', error as Error, { filter });
      throw error;
    }
  }

  async findByEntityId(entityType: string, entityId: string): Promise<AuditTrail[]> {
    try {
      const client = this.databaseManager.getClient();
      
      const results = await client.auditTrail.findMany({
        where: {
          entityType,
          entityId
        },
        orderBy: { startTime: 'desc' }
      });

      return results.map(result => this.mapToAuditTrail(result));
    } catch (error) {
      logger.error('Failed to find audit trails by entity', error as Error, {
        entityType,
        entityId
      });
      throw error;
    }
  }

  async findActiveTrails(): Promise<AuditTrail[]> {
    try {
      const client = this.databaseManager.getClient();
      
      const results = await client.auditTrail.findMany({
        where: {
          status: 'STARTED'
        },
        orderBy: { startTime: 'desc' }
      });

      return results.map(result => this.mapToAuditTrail(result));
    } catch (error) {
      logger.error('Failed to find active audit trails', error as Error);
      throw error;
    }
  }

  async findByProcessName(processName: string, pagination: PaginationOptions): Promise<PaginatedResult<AuditTrail>> {
    try {
      const client = this.databaseManager.getClient();
      
      const skip = (pagination.page - 1) * pagination.limit;
      const take = pagination.limit;

      const [results, total] = await Promise.all([
        client.auditTrail.findMany({
          where: { processName },
          orderBy: { startTime: 'desc' },
          skip,
          take
        }),
        client.auditTrail.count({
          where: { processName }
        })
      ]);

      const auditTrails = results.map(result => this.mapToAuditTrail(result));
      const totalPages = Math.ceil(total / pagination.limit);

      return {
        data: auditTrails,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages
      };
    } catch (error) {
      logger.error('Failed to find audit trails by process name', error as Error, { processName });
      throw error;
    }
  }

  private buildWhereClause(filter: AuditTrailFilter): any {
    const whereClause: any = {};

    if (filter.entityType) {
      whereClause.entityType = filter.entityType;
    }

    if (filter.entityId) {
      whereClause.entityId = filter.entityId;
    }

    if (filter.processName) {
      whereClause.processName = filter.processName;
    }

    if (filter.correlationId) {
      whereClause.correlationId = filter.correlationId;
    }

    if (filter.status) {
      whereClause.status = filter.status;
    }

    if (filter.fromDate || filter.toDate) {
      whereClause.startTime = {};
      if (filter.fromDate) {
        whereClause.startTime.gte = filter.fromDate;
      }
      if (filter.toDate) {
        whereClause.startTime.lte = filter.toDate;
      }
    }

    return whereClause;
  }

  private mapToAuditTrail(data: any): AuditTrail {
    return new AuditTrail(
      data.trailId,
      data.entityType,
      data.entityId,
      data.processName,
      data.correlationId,
      data.startTime,
      data.status,
      data.totalEvents,
      data.metadata,
      data.endTime
    );
  }
}
