/**
 * Audit Command Handlers
 * 
 * This module implements command handlers for audit operations.
 * It handles commands for creating audit logs and managing audit trails.
 */

import { v4 as uuidv4 } from 'uuid';
import { AuditLog, AuditTrail, AuditAction, AuditEventType, AuditTrailStatus } from '../../domain/audit.models';
import { IAuditLogRepository, IAuditTrailRepository } from '../../domain/audit.repository.interface';
import { createLogger } from '@shared/infrastructure/logging';

const logger = createLogger('audit-command-handlers');

export interface CreateAuditLogCommand {
  eventType: string;
  entityType: string;
  entityId: string;
  action: string;
  serviceName: string;
  correlationId: string;
  metadata?: Record<string, any>;
  details?: Record<string, any>;
  userId?: string;
  causationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateAuditTrailCommand {
  entityType: string;
  entityId: string;
  processName: string;
  correlationId: string;
  metadata?: Record<string, any>;
}

export interface UpdateAuditTrailCommand {
  trailId: string;
  status: AuditTrailStatus;
  endTime?: Date;
  metadata?: Record<string, any>;
}

export interface BusinessEventParams {
  entityType: string;
  entityId: string;
  action: AuditAction;
  serviceName: string;
  correlationId: string;
  details: Record<string, any>;
  userId?: string;
  causationId?: string;
}

export interface SecurityEventParams {
  action: AuditAction;
  serviceName: string;
  correlationId: string;
  details: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditCommandHandlers {
  constructor(
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly auditTrailRepository: IAuditTrailRepository
  ) {}

  async createAuditLog(command: CreateAuditLogCommand): Promise<string> {
    try {
      const auditId = uuidv4();
      
      const auditLog = new AuditLog(
        auditId,
        command.eventType,
        command.entityType,
        command.entityId,
        command.action,
        command.serviceName,
        command.correlationId,
        command.metadata || {},
        command.details || {},
        new Date(),
        command.userId,
        command.causationId,
        command.ipAddress,
        command.userAgent
      );

      await this.auditLogRepository.create(auditLog);
      
      // Update audit trail event count if trail exists
      await this.incrementTrailEventCount(command.correlationId);

      logger.info('Audit log created successfully', {
        auditId,
        eventType: command.eventType,
        entityType: command.entityType,
        entityId: command.entityId,
        correlationId: command.correlationId
      });

      return auditId;
    } catch (error) {
      logger.error('Failed to create audit log', error as Error, {
        eventType: command.eventType,
        entityType: command.entityType
      });
      throw error;
    }
  }

  async createAuditTrail(command: CreateAuditTrailCommand): Promise<string> {
    try {
      const trailId = uuidv4();
      
      const auditTrail = new AuditTrail(
        trailId,
        command.entityType,
        command.entityId,
        command.processName,
        command.correlationId,
        new Date(),
        AuditTrailStatus.STARTED,
        0,
        command.metadata || {}
      );

      await this.auditTrailRepository.create(auditTrail);

      logger.info('Audit trail created successfully', {
        trailId,
        entityType: command.entityType,
        entityId: command.entityId,
        processName: command.processName,
        correlationId: command.correlationId
      });

      return trailId;
    } catch (error) {
      logger.error('Failed to create audit trail', error as Error, {
        entityType: command.entityType,
        processName: command.processName
      });
      throw error;
    }
  }

  async updateAuditTrail(command: UpdateAuditTrailCommand): Promise<void> {
    try {
      const existingTrail = await this.auditTrailRepository.findById(command.trailId);
      
      if (!existingTrail) {
        throw new Error(`Audit trail not found: ${command.trailId}`);
      }

      const updatedTrail = existingTrail.updateStatus(command.status, command.endTime, command.metadata);
      await this.auditTrailRepository.update(updatedTrail);

      logger.info('Audit trail updated successfully', {
        trailId: command.trailId,
        status: command.status,
        endTime: command.endTime,
        metadataUpdated: !!command.metadata
      });
    } catch (error) {
      logger.error('Failed to update audit trail', error as Error, {
        trailId: command.trailId
      });
      throw error;
    }
  }

  async logBusinessEvent(params: BusinessEventParams): Promise<string> {
    return this.createAuditLog({
      eventType: AuditEventType.BUSINESS_EVENT,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      serviceName: params.serviceName,
      correlationId: params.correlationId,
      details: params.details,
      userId: params.userId,
      causationId: params.causationId,
      metadata: {
        category: 'business',
        importance: 'high'
      }
    });
  }

  async logSecurityEvent(params: SecurityEventParams): Promise<string> {
    return this.createAuditLog({
      eventType: AuditEventType.SECURITY_EVENT,
      entityType: 'Security',
      entityId: params.userId || 'anonymous',
      action: params.action,
      serviceName: params.serviceName,
      correlationId: params.correlationId,
      details: params.details,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        category: 'security',
        importance: 'critical'
      }
    });
  }

  async logSystemEvent(
    action: AuditAction,
    serviceName: string,
    correlationId: string,
    details: Record<string, any>
  ): Promise<string> {
    return this.createAuditLog({
      eventType: AuditEventType.SYSTEM_EVENT,
      entityType: 'System',
      entityId: serviceName,
      action,
      serviceName,
      correlationId,
      details,
      metadata: {
        category: 'system',
        importance: 'medium'
      }
    });
  }

  private async incrementTrailEventCount(correlationId: string): Promise<void> {
    try {
      const trail = await this.auditTrailRepository.findByCorrelationId(correlationId);
      if (trail) {
        const updatedTrail = trail.incrementEventCount();
        await this.auditTrailRepository.update(updatedTrail);
      }
    } catch (error) {
      logger.warn('Failed to increment trail event count', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw error as this is not critical
    }
  }
}
