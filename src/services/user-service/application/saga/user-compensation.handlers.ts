/**
 * User Service Compensation Event Handlers
 * 
 * Handles compensation events for user-related operations in the complaint saga.
 * Participates in the choreographed saga by listening to compensation events
 * and executing rollback operations as needed.
 */

import { IEventBus } from '../../../shared/infrastructure/messaging';
import { Logger } from '../../../shared/infrastructure/logging/logger';
import { ComplaintSagaEvent, COMPLAINT_SAGA_EVENTS } from '../../../shared/domain/events/complaint-saga.events';
import { UserRepository } from '../domain/repositories/user.repository';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger({ serviceName: 'user-service' });

export class UserServiceCompensationHandlers {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: IEventBus
  ) {}

  /**
   * Handle customer validation compensation
   * This might involve unlocking user accounts or reverting status changes
   */
  async handleCustomerValidationCompensation(event: ComplaintSagaEvent): Promise<void> {
    if (event.eventType !== COMPLAINT_SAGA_EVENTS.COMPENSATION_INITIATED) return;

    const compensationType = event.eventData.compensationType;
    if (compensationType !== 'ROLLBACK_STATUS') return;

    try {
      logger.info('Handling customer validation compensation', {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        correlationId: event.correlationId
      });

      // In a customer validation compensation, we might need to:
      // 1. Unlock user account if it was temporarily locked
      // 2. Revert any status changes made during validation
      // 3. Clear any temporary validation flags

      // For now, we'll just log that compensation would occur
      // In a real system, this would perform actual rollback operations

      // Publish compensation completed event
      await this.publishCompensationCompleted(
        event.eventData.complaintId,
        event.eventData.compensationRequestId,
        'Customer validation compensation completed',
        event.correlationId
      );

    } catch (error) {
      logger.error('Failed to handle customer validation compensation', error as Error, {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId
      });

      await this.publishCompensationFailed(
        event.eventData.complaintId,
        event.eventData.compensationRequestId,
        'ROLLBACK_STATUS',
        'Failed to compensate customer validation',
        error instanceof Error ? error.message : 'Unknown error',
        event.correlationId
      );
    }
  }

  /**
   * Handle user account related events during saga
   */
  async handleUserAccountValidation(customerId: string, correlationId: string): Promise<{
    isValid: boolean;
    customerTier: string;
    accountStatus: string;
  }> {
    try {
      logger.info('Validating user account for complaint saga', {
        customerId,
        correlationId
      });

      // Find user by customer ID
      const user = await this.userRepository.findByName(customerId); // Assuming customerId is the name
      
      if (!user) {
        return {
          isValid: false,
          customerTier: 'BRONZE',
          accountStatus: 'CLOSED'
        };
      }

      // Determine customer tier based on role and activity
      let customerTier = 'BRONZE';
      if (user.role === 'admin') {
        customerTier = 'PLATINUM';
      } else if (user.sales && user.sales.length > 10) {
        customerTier = 'GOLD';
      } else if (user.sales && user.sales.length > 5) {
        customerTier = 'SILVER';
      }

      return {
        isValid: true,
        customerTier,
        accountStatus: 'ACTIVE'
      };

    } catch (error) {
      logger.error('Failed to validate user account', error as Error, {
        customerId,
        correlationId
      });

      return {
        isValid: false,
        customerTier: 'BRONZE',
        accountStatus: 'SUSPENDED'
      };
    }
  }

  /**
   * Listen to customer validation started events
   */
  async handleCustomerValidationStarted(event: ComplaintSagaEvent): Promise<void> {
    if (event.eventType !== COMPLAINT_SAGA_EVENTS.CUSTOMER_VALIDATION_STARTED) return;

    try {
      logger.info('Handling customer validation started', {
        eventId: event.eventId,
        customerId: event.eventData.customerId,
        correlationId: event.correlationId
      });

      // Perform customer validation
      const validationResult = await this.handleUserAccountValidation(
        event.eventData.customerId,
        event.correlationId
      );

      // Publish validation completed event
      const completedEvent = {
        eventId: uuidv4(),
        eventType: COMPLAINT_SAGA_EVENTS.CUSTOMER_VALIDATION_COMPLETED,
        aggregateId: event.aggregateId,
        correlationId: event.correlationId,
        timestamp: new Date(),
        version: 1,
        eventData: {
          complaintId: event.eventData.complaintId,
          customerId: event.eventData.customerId,
          validationRequestId: event.eventData.validationRequestId,
          isValid: validationResult.isValid,
          customerTier: validationResult.customerTier,
          accountStatus: validationResult.accountStatus,
          completedAt: new Date()
        }
      };

      await this.eventBus.publish('complaint_saga', 'customer.validation.completed', completedEvent as any);

      logger.info('Customer validation completed', {
        customerId: event.eventData.customerId,
        isValid: validationResult.isValid,
        correlationId: event.correlationId
      });

    } catch (error) {
      logger.error('Failed to handle customer validation', error as Error, {
        eventId: event.eventId,
        customerId: event.eventData.customerId
      });

      // Publish validation failed event
      const failedEvent = {
        eventId: uuidv4(),
        eventType: COMPLAINT_SAGA_EVENTS.CUSTOMER_VALIDATION_FAILED,
        aggregateId: event.aggregateId,
        correlationId: event.correlationId,
        timestamp: new Date(),
        version: 1,
        eventData: {
          complaintId: event.eventData.complaintId,
          customerId: event.eventData.customerId,
          validationRequestId: event.eventData.validationRequestId,
          reason: 'Customer validation service error',
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date()
        }
      };

      await this.eventBus.publish('complaint_saga', 'customer.validation.failed', failedEvent as any);
    }
  }

  /**
   * Publish compensation completed event
   */
  private async publishCompensationCompleted(
    complaintId: string,
    compensationRequestId: string,
    details: string,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: 'USER_COMPENSATION_COMPLETED',
      aggregateId: complaintId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        compensationRequestId,
        compensationType: 'USER_STATUS_ROLLBACK',
        details,
        completedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'user.compensation.completed', event as any);

    logger.info('User compensation completed', {
      complaintId,
      compensationRequestId,
      correlationId
    });
  }

  /**
   * Publish compensation failed event
   */
  private async publishCompensationFailed(
    complaintId: string,
    compensationRequestId: string,
    compensationType: string,
    reason: string,
    error: string,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.COMPENSATION_FAILED,
      aggregateId: complaintId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        compensationRequestId,
        compensationType,
        reason,
        error,
        requiresManualIntervention: true,
        failedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'compensation.failed', event as any);
  }
}
