/**
 * Audit Event Handlers
 * 
 * This module implements event handlers that listen to domain events
 * and create audit logs automatically for comprehensive event logging.
 */

import { DomainEvent } from '@shared/domain/events/domain-events';
import { AuditCommandHandlers, BusinessEventParams, SecurityEventParams } from '../commands/audit-command.handlers';
import { AuditAction, AuditEventType, AuditTrailStatus } from '../../domain/audit.models';
import { createLogger } from '@shared/infrastructure/logging';

const logger = createLogger('audit-event-handlers');

export class AuditEventHandlers {
  constructor(
    private readonly auditCommandHandlers: AuditCommandHandlers
  ) {}

  /**
   * Handle all domain events and create appropriate audit logs
   */
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      logger.info('Processing domain event for audit', {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        correlationId: event.metadata.correlationId
      });

      // Create audit log based on event type
      await this.createAuditLogFromEvent(event);
      
      // Update or create audit trail if needed
      await this.updateAuditTrail(event);

      logger.info('Domain event processed for audit successfully', {
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.metadata.correlationId
      });
    } catch (error) {
      logger.error('Failed to process domain event for audit', error as Error, {
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.metadata.correlationId
      });
      // Don't throw error to avoid affecting the main business flow
    }
  }

  /**
   * Handle specific complaint events
   */
  async handleComplaintEvent(event: DomainEvent): Promise<void> {
    try {
      if (event.aggregateType !== 'Complaint') {
        return;
      }

      const action = this.mapComplaintEventToAction(event.eventType);
      if (!action) {
        return;
      }

      const params: BusinessEventParams = {
        entityType: event.aggregateType,
        entityId: event.aggregateId,
        action,
        serviceName: event.metadata.source,
        correlationId: event.metadata.correlationId,
        details: {
          eventType: event.eventType,
          eventData: event.eventData,
          version: event.metadata.version
        },
        userId: event.metadata.userId,
        causationId: event.metadata.causationId
      };

      await this.auditCommandHandlers.logBusinessEvent(params);

      logger.info('Complaint event audit log created', {
        eventId: event.eventId,
        action,
        complaintId: event.aggregateId
      });
    } catch (error) {
      logger.error('Failed to handle complaint event for audit', error as Error, {
        eventId: event.eventId,
        eventType: event.eventType
      });
    }
  }

  /**
   * Handle transaction/sale events
   */
  async handleTransactionEvent(event: DomainEvent): Promise<void> {
    try {
      if (!['Sale', 'Refund', 'Stock'].includes(event.aggregateType)) {
        return;
      }

      const action = this.mapTransactionEventToAction(event.eventType);
      if (!action) {
        return;
      }

      const params: BusinessEventParams = {
        entityType: event.aggregateType,
        entityId: event.aggregateId,
        action,
        serviceName: event.metadata.source,
        correlationId: event.metadata.correlationId,
        details: {
          eventType: event.eventType,
          eventData: event.eventData,
          version: event.metadata.version
        },
        userId: event.metadata.userId,
        causationId: event.metadata.causationId
      };

      await this.auditCommandHandlers.logBusinessEvent(params);

      logger.info('Transaction event audit log created', {
        eventId: event.eventId,
        action,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId
      });
    } catch (error) {
      logger.error('Failed to handle transaction event for audit', error as Error, {
        eventId: event.eventId,
        eventType: event.eventType
      });
    }
  }

  /**
   * Handle user authentication and authorization events
   */
  async handleSecurityEvent(event: DomainEvent): Promise<void> {
    try {
      if (!event.eventType.includes('AUTH') && !event.eventType.includes('LOGIN')) {
        return;
      }

      const action = this.mapSecurityEventToAction(event.eventType);
      if (!action) {
        return;
      }

      const params: SecurityEventParams = {
        action,
        serviceName: event.metadata.source,
        correlationId: event.metadata.correlationId,
        details: {
          eventType: event.eventType,
          eventData: event.eventData,
          timestamp: event.metadata.occurredOn
        },
        userId: event.metadata.userId,
        ipAddress: event.eventData.ipAddress,
        userAgent: event.eventData.userAgent
      };

      await this.auditCommandHandlers.logSecurityEvent(params);

      logger.info('Security event audit log created', {
        eventId: event.eventId,
        action,
        userId: event.metadata.userId
      });
    } catch (error) {
      logger.error('Failed to handle security event for audit', error as Error, {
        eventId: event.eventId,
        eventType: event.eventType
      });
    }
  }

  /**
   * Handle saga orchestration events
   */
  async handleSagaEvent(event: DomainEvent): Promise<void> {
    try {
      if (!event.eventType.includes('SAGA')) {
        return;
      }

      const action = this.mapSagaEventToAction(event.eventType);
      if (!action) {
        return;
      }

      const params: BusinessEventParams = {
        entityType: 'Saga',
        entityId: event.aggregateId,
        action,
        serviceName: event.metadata.source,
        correlationId: event.metadata.correlationId,
        details: {
          eventType: event.eventType,
          eventData: event.eventData,
          sagaType: event.eventData.sagaType,
          stepName: event.eventData.stepName,
          status: event.eventData.status
        },
        userId: event.metadata.userId,
        causationId: event.metadata.causationId
      };

      await this.auditCommandHandlers.logBusinessEvent(params);

      // Create or update saga trail
      if (event.eventType === 'SAGA_STARTED') {
        await this.auditCommandHandlers.createAuditTrail({
          entityType: 'Saga',
          entityId: event.aggregateId,
          processName: event.eventData.sagaType || 'UnknownSaga',
          correlationId: event.metadata.correlationId,
          metadata: {
            sagaType: event.eventData.sagaType,
            initiatedBy: event.metadata.userId,
            initiatedAt: event.metadata.occurredOn
          }
        });
      }

      logger.info('Saga event audit log created', {
        eventId: event.eventId,
        action,
        sagaId: event.aggregateId
      });
    } catch (error) {
      logger.error('Failed to handle saga event for audit', error as Error, {
        eventId: event.eventId,
        eventType: event.eventType
      });
    }
  }

  private async createAuditLogFromEvent(event: DomainEvent): Promise<void> {
    // Determine audit event type based on domain event
    const action = this.determineAuditAction(event);

    const params: BusinessEventParams = {
      entityType: event.aggregateType,
      entityId: event.aggregateId,
      action,
      serviceName: event.metadata.source,
      correlationId: event.metadata.correlationId,
      details: {
        eventType: event.eventType,
        eventData: event.eventData,
        version: event.metadata.version,
        originalEventId: event.eventId
      },
      userId: event.metadata.userId,
      causationId: event.metadata.causationId
    };

    await this.auditCommandHandlers.logBusinessEvent(params);
  }

  private async updateAuditTrail(event: DomainEvent): Promise<void> {
    // Check if this event represents the end of a process
    if (this.isProcessEndEvent(event)) {
      const trail = await this.auditCommandHandlers['auditTrailRepository'].findByCorrelationId(
        event.metadata.correlationId
      );
      
      if (trail) {
        await this.auditCommandHandlers.updateAuditTrail({
          trailId: trail.trailId,
          status: this.isSuccessEvent(event) ? AuditTrailStatus.COMPLETED : AuditTrailStatus.FAILED,
          endTime: new Date()
        });
      }
    }
  }

  private mapComplaintEventToAction(eventType: string): AuditAction | null {
    const mapping: Record<string, AuditAction> = {
      'COMPLAINT_CREATED': AuditAction.CREATE,
      'COMPLAINT_ASSIGNED': AuditAction.UPDATE,
      'COMPLAINT_PROCESSING_STARTED': AuditAction.UPDATE,
      'COMPLAINT_RESOLVED': AuditAction.UPDATE,
      'COMPLAINT_CLOSED': AuditAction.UPDATE,
      'COMPLAINT_PRIORITY_UPDATED': AuditAction.UPDATE
    };
    return mapping[eventType] || null;
  }

  private mapTransactionEventToAction(eventType: string): AuditAction | null {
    const mapping: Record<string, AuditAction> = {
      'SALE_CREATED': AuditAction.CREATE,
      'SALE_COMPLETED': AuditAction.UPDATE,
      'REFUND_CREATED': AuditAction.CREATE,
      'REFUND_PROCESSED': AuditAction.UPDATE,
      'STOCK_UPDATED': AuditAction.UPDATE,
      'STOCK_RESERVED': AuditAction.UPDATE,
      'STOCK_RELEASED': AuditAction.UPDATE
    };
    return mapping[eventType] || null;
  }

  private mapSecurityEventToAction(eventType: string): AuditAction | null {
    const mapping: Record<string, AuditAction> = {
      'USER_LOGIN': AuditAction.LOGIN,
      'USER_LOGOUT': AuditAction.LOGOUT,
      'USER_AUTHENTICATED': AuditAction.AUTHENTICATE,
      'USER_AUTHORIZED': AuditAction.AUTHORIZE,
      'AUTH_FAILED': AuditAction.AUTHENTICATE,
      'ACCESS_DENIED': AuditAction.AUTHORIZE
    };
    return mapping[eventType] || null;
  }

  private mapSagaEventToAction(eventType: string): AuditAction | null {
    const mapping: Record<string, AuditAction> = {
      'SAGA_STARTED': AuditAction.SAGA_START,
      'SAGA_STEP_COMPLETED': AuditAction.SAGA_STEP,
      'SAGA_STEP_FAILED': AuditAction.SAGA_STEP,
      'SAGA_COMPLETED': AuditAction.SAGA_COMPLETE,
      'SAGA_COMPENSATING': AuditAction.SAGA_COMPENSATE,
      'SAGA_COMPENSATION_COMPLETED': AuditAction.SAGA_COMPENSATE
    };
    return mapping[eventType] || null;
  }

  private determineAuditEventType(event: DomainEvent): AuditEventType {
    if (event.eventType.includes('AUTH') || event.eventType.includes('LOGIN')) {
      return AuditEventType.SECURITY_EVENT;
    }
    if (event.eventType.includes('SAGA')) {
      return AuditEventType.INTEGRATION_EVENT;
    }
    if (event.eventType.includes('ERROR') || event.eventType.includes('FAILED')) {
      return AuditEventType.ERROR_EVENT;
    }
    return AuditEventType.BUSINESS_EVENT;
  }

  private determineAuditAction(event: DomainEvent): AuditAction {
    if (event.eventType.includes('CREATED')) return AuditAction.CREATE;
    if (event.eventType.includes('UPDATED') || event.eventType.includes('MODIFIED')) return AuditAction.UPDATE;
    if (event.eventType.includes('DELETED') || event.eventType.includes('REMOVED')) return AuditAction.DELETE;
    if (event.eventType.includes('PUBLISHED')) return AuditAction.PUBLISH_EVENT;
    if (event.eventType.includes('CONSUMED')) return AuditAction.CONSUME_EVENT;
    return AuditAction.UPDATE; // Default to update for most events
  }

  private isProcessEndEvent(event: DomainEvent): boolean {
    const endEvents = [
      'COMPLETED', 'CLOSED', 'RESOLVED', 'FAILED', 'CANCELLED', 
      'SAGA_COMPLETED', 'SAGA_COMPENSATION_COMPLETED'
    ];
    return endEvents.some(endEvent => event.eventType.includes(endEvent));
  }

  private isSuccessEvent(event: DomainEvent): boolean {
    const successEvents = ['COMPLETED', 'RESOLVED', 'CLOSED', 'SAGA_COMPLETED'];
    return successEvents.some(successEvent => event.eventType.includes(successEvent));
  }
}
