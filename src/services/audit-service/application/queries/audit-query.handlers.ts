/**
 * Audit Query Handlers
 * 
 * This module implements query handlers for audit operations.
 * It handles queries for searching audit logs and trails with filtering and pagination.
 */

import { 
  IAuditLogRepository, 
  IAuditTrailRepository, 
  AuditLogFilter, 
  AuditTrailFilter, 
  PaginationOptions, 
  PaginatedResult,
  AuditStatistics
} from '../../domain/audit.repository.interface';
import { AuditLog, AuditTrail } from '../../domain/audit.models';
import { createLogger } from '@shared/infrastructure/logging';

const logger = createLogger('audit-query-handlers');

export interface SearchAuditLogsQuery {
  filter: AuditLogFilter;
  pagination: PaginationOptions;
}

export interface SearchAuditTrailsQuery {
  filter: AuditTrailFilter;
  pagination: PaginationOptions;
}

export interface GetAuditLogQuery {
  auditId: string;
}

export interface GetAuditTrailQuery {
  trailId: string;
}

export interface GetAuditLogsByCorrelationQuery {
  correlationId: string;
}

export interface GetAuditLogsByEntityQuery {
  entityType: string;
  entityId: string;
}

export interface GetAuditLogsByUserQuery {
  userId: string;
  pagination: PaginationOptions;
}

export interface GetAuditStatisticsQuery {
  fromDate?: Date;
  toDate?: Date;
}

export class AuditQueryHandlers {
  constructor(
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly auditTrailRepository: IAuditTrailRepository
  ) {}

  async searchAuditLogs(query: SearchAuditLogsQuery): Promise<PaginatedResult<AuditLog>> {
    try {
      logger.info('Searching audit logs', {
        filter: query.filter,
        pagination: query.pagination
      });

      const result = await this.auditLogRepository.search(query.filter, query.pagination);
      
      logger.info('Audit logs search completed', {
        totalResults: result.total,
        page: result.page,
        totalPages: result.totalPages
      });

      return result;
    } catch (error) {
      logger.error('Failed to search audit logs', error as Error, {
        filter: query.filter
      });
      throw error;
    }
  }

  async searchAuditTrails(query: SearchAuditTrailsQuery): Promise<PaginatedResult<AuditTrail>> {
    try {
      logger.info('Searching audit trails', {
        filter: query.filter,
        pagination: query.pagination
      });

      const result = await this.auditTrailRepository.search(query.filter, query.pagination);
      
      logger.info('Audit trails search completed', {
        totalResults: result.total,
        page: result.page,
        totalPages: result.totalPages
      });

      return result;
    } catch (error) {
      logger.error('Failed to search audit trails', error as Error, {
        filter: query.filter
      });
      throw error;
    }
  }

  async getAuditLog(query: GetAuditLogQuery): Promise<AuditLog | null> {
    try {
      logger.info('Getting audit log by ID', { auditId: query.auditId });

      const auditLog = await this.auditLogRepository.findById(query.auditId);
      
      if (!auditLog) {
        logger.warn('Audit log not found', { auditId: query.auditId });
      }

      return auditLog;
    } catch (error) {
      logger.error('Failed to get audit log', error as Error, {
        auditId: query.auditId
      });
      throw error;
    }
  }

  async getAuditTrail(query: GetAuditTrailQuery): Promise<AuditTrail | null> {
    try {
      logger.info('Getting audit trail by ID', { trailId: query.trailId });

      const auditTrail = await this.auditTrailRepository.findById(query.trailId);
      
      if (!auditTrail) {
        logger.warn('Audit trail not found', { trailId: query.trailId });
      }

      return auditTrail;
    } catch (error) {
      logger.error('Failed to get audit trail', error as Error, {
        trailId: query.trailId
      });
      throw error;
    }
  }

  async getAuditLogsByCorrelation(query: GetAuditLogsByCorrelationQuery): Promise<AuditLog[]> {
    try {
      logger.info('Getting audit logs by correlation ID', { 
        correlationId: query.correlationId 
      });

      const auditLogs = await this.auditLogRepository.findByCorrelationId(query.correlationId);
      
      logger.info('Retrieved audit logs by correlation ID', {
        correlationId: query.correlationId,
        count: auditLogs.length
      });

      return auditLogs;
    } catch (error) {
      logger.error('Failed to get audit logs by correlation ID', error as Error, {
        correlationId: query.correlationId
      });
      throw error;
    }
  }

  async getAuditLogsByEntity(query: GetAuditLogsByEntityQuery): Promise<AuditLog[]> {
    try {
      logger.info('Getting audit logs by entity', {
        entityType: query.entityType,
        entityId: query.entityId
      });

      const auditLogs = await this.auditLogRepository.findByEntityId(
        query.entityType, 
        query.entityId
      );
      
      logger.info('Retrieved audit logs by entity', {
        entityType: query.entityType,
        entityId: query.entityId,
        count: auditLogs.length
      });

      return auditLogs;
    } catch (error) {
      logger.error('Failed to get audit logs by entity', error as Error, {
        entityType: query.entityType,
        entityId: query.entityId
      });
      throw error;
    }
  }

  async getAuditLogsByUser(query: GetAuditLogsByUserQuery): Promise<PaginatedResult<AuditLog>> {
    try {
      logger.info('Getting audit logs by user ID', {
        userId: query.userId,
        pagination: query.pagination
      });

      const result = await this.auditLogRepository.findByUserId(query.userId, query.pagination);
      
      logger.info('Retrieved audit logs by user ID', {
        userId: query.userId,
        totalResults: result.total,
        page: result.page
      });

      return result;
    } catch (error) {
      logger.error('Failed to get audit logs by user', error as Error, {
        userId: query.userId
      });
      throw error;
    }
  }

  async getAuditStatistics(query: GetAuditStatisticsQuery): Promise<AuditStatistics> {
    try {
      logger.info('Getting audit statistics', {
        fromDate: query.fromDate,
        toDate: query.toDate
      });

      const statistics = await this.auditLogRepository.getAuditStatistics(
        query.fromDate,
        query.toDate
      );
      
      logger.info('Retrieved audit statistics', {
        totalEvents: statistics.totalEvents,
        uniqueUsers: statistics.uniqueUsers,
        activeTrails: statistics.activeTrails
      });

      return statistics;
    } catch (error) {
      logger.error('Failed to get audit statistics', error as Error, {
        fromDate: query.fromDate,
        toDate: query.toDate
      });
      throw error;
    }
  }

  async getActiveAuditTrails(): Promise<AuditTrail[]> {
    try {
      logger.info('Getting active audit trails');

      const activeTrails = await this.auditTrailRepository.findActiveTrails();
      
      logger.info('Retrieved active audit trails', {
        count: activeTrails.length
      });

      return activeTrails;
    } catch (error) {
      logger.error('Failed to get active audit trails', error as Error);
      throw error;
    }
  }

  async getAuditTrailsByEntity(entityType: string, entityId: string): Promise<AuditTrail[]> {
    try {
      logger.info('Getting audit trails by entity', {
        entityType,
        entityId
      });

      const trails = await this.auditTrailRepository.findByEntityId(entityType, entityId);
      
      logger.info('Retrieved audit trails by entity', {
        entityType,
        entityId,
        count: trails.length
      });

      return trails;
    } catch (error) {
      logger.error('Failed to get audit trails by entity', error as Error, {
        entityType,
        entityId
      });
      throw error;
    }
  }

  async getAuditTrailByCorrelation(correlationId: string): Promise<AuditTrail | null> {
    try {
      logger.info('Getting audit trail by correlation ID', { correlationId });

      const trail = await this.auditTrailRepository.findByCorrelationId(correlationId);
      
      if (!trail) {
        logger.warn('Audit trail not found by correlation ID', { correlationId });
      }

      return trail;
    } catch (error) {
      logger.error('Failed to get audit trail by correlation ID', error as Error, {
        correlationId
      });
      throw error;
    }
  }
}
