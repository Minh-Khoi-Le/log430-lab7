/**
 * Complaint Saga Event Handlers
 * 
 * Handles saga events for the choreographed complaint handling workflow.
 * These handlers participate in the saga by listening to events and deciding
 * what actions to take next based on business rules.
 */

import { IEventBus } from '@shared/infrastructure/messaging';
import { Logger } from '@shared/infrastructure/logging/logger';
import { ComplaintSagaEvent, COMPLAINT_SAGA_EVENTS } from '@shared/domain/events/complaint-saga.events';
import { ComplaintSagaStateManager, ComplaintSagaStep } from '@shared/domain/saga/complaint-saga-state';
import { ComplaintRepository } from '../../domain/repositories/complaint.repository';
import { ComplaintCommandHandlers } from '../commands/complaint-command.handlers';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger({ serviceName: 'complaint-service' });

export class ComplaintSagaEventHandlers {
  constructor(
    private readonly complaintRepository: ComplaintRepository,
    private readonly complaintCommandHandlers: ComplaintCommandHandlers,
    private readonly sagaStateManager: ComplaintSagaStateManager,
    private readonly eventBus: IEventBus
  ) {}

  /**
   * Handle complaint saga initiation
   * This is triggered when a complaint is created and requires saga coordination
   */
  async handleComplaintSagaInitiated(event: ComplaintSagaEvent): Promise<void> {
    if (event.eventType !== COMPLAINT_SAGA_EVENTS.SAGA_INITIATED) return;

    try {
      logger.info('Handling complaint saga initiation', {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        correlationId: event.correlationId
      });

      // Initialize saga state
      const sagaContext = await this.sagaStateManager.initiateSaga(
        event.eventData.complaintId,
        event.eventData.customerId,
        {
          type: event.eventData.complaintType,
          priority: event.eventData.priority,
          description: event.eventData.description,
          requestedResolution: event.eventData.requestedResolution,
          amount: event.eventData.amount
        },
        event.eventData.orderId,
        event.eventData.storeId
      );

      // Start customer validation
      await this.initiateCustomerValidation(sagaContext.sagaId, event.eventData.customerId, event.correlationId);

    } catch (error) {
      logger.error('Failed to handle complaint saga initiation', error as Error, {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId
      });

      // Publish saga failure event
      await this.publishSagaFailureEvent(
        event.eventData.complaintId,
        'SAGA_INITIATION',
        'Failed to initiate complaint saga',
        error instanceof Error ? error.message : 'Unknown error',
        event.correlationId
      );
    }
  }

  /**
   * Handle customer validation completion
   */
  async handleCustomerValidationCompleted(event: ComplaintSagaEvent): Promise<void> {
    if (event.eventType !== COMPLAINT_SAGA_EVENTS.CUSTOMER_VALIDATION_COMPLETED) return;

    try {
      logger.info('Handling customer validation completion', {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        isValid: event.eventData.isValid
      });

      // Update saga state
      await this.sagaStateManager.markStepCompleted(
        event.aggregateId, // Assuming aggregateId is sagaId
        ComplaintSagaStep.CUSTOMER_VALIDATION,
        {
          isValid: event.eventData.isValid,
          customerTier: event.eventData.customerTier,
          accountStatus: event.eventData.accountStatus
        }
      );

      if (event.eventData.isValid) {
        // Get saga context to check if order verification is needed
        const sagaContext = await this.sagaStateManager.getSagaContext(event.aggregateId);
        
        if (sagaContext && sagaContext.orderId) {
          // Start order verification if order ID is present
          await this.initiateOrderVerification(
            sagaContext.sagaId,
            sagaContext.orderId,
            sagaContext.customerId,
            event.correlationId
          );
        } else {
          // Skip order verification and go directly to resolution processing
          await this.initiateResolutionProcessing(sagaContext!.sagaId, event.correlationId);
        }
      } else {
        // Customer validation failed - close complaint
        await this.failSaga(
          event.aggregateId,
          'CUSTOMER_VALIDATION',
          'Customer validation failed - invalid customer',
          'Customer is not valid or account is not in good standing',
          event.correlationId,
          false // No compensation needed
        );
      }

    } catch (error) {
      logger.error('Failed to handle customer validation completion', error as Error, {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId
      });

      await this.failSaga(
        event.aggregateId,
        'CUSTOMER_VALIDATION',
        'Failed to process customer validation result',
        error instanceof Error ? error.message : 'Unknown error',
        event.correlationId,
        false
      );
    }
  }

  /**
   * Handle customer validation failure
   */
  async handleCustomerValidationFailed(event: ComplaintSagaEvent): Promise<void> {
    if (event.eventType !== COMPLAINT_SAGA_EVENTS.CUSTOMER_VALIDATION_FAILED) return;

    try {
      logger.info('Handling customer validation failure', {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        reason: event.eventData.reason
      });

      await this.failSaga(
        event.aggregateId,
        'CUSTOMER_VALIDATION',
        'Customer validation failed',
        event.eventData.error,
        event.correlationId,
        false // No compensation needed for validation failure
      );

    } catch (error) {
      logger.error('Failed to handle customer validation failure', error as Error, {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId
      });
    }
  }

  /**
   * Handle order verification completion
   */
  async handleOrderVerificationCompleted(event: ComplaintSagaEvent): Promise<void> {
    if (event.eventType !== COMPLAINT_SAGA_EVENTS.ORDER_VERIFICATION_COMPLETED) return;

    try {
      logger.info('Handling order verification completion', {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        orderExists: event.eventData.orderExists,
        eligibleForRefund: event.eventData.eligibleForRefund
      });

      // Update saga state
      await this.sagaStateManager.markStepCompleted(
        event.aggregateId,
        ComplaintSagaStep.ORDER_VERIFICATION,
        {
          orderExists: event.eventData.orderExists,
          orderStatus: event.eventData.orderStatus,
          orderDate: event.eventData.orderDate,
          orderAmount: event.eventData.orderAmount,
          eligibleForRefund: event.eventData.eligibleForRefund
        }
      );

      if (event.eventData.orderExists) {
        // Order exists - proceed to resolution processing
        await this.initiateResolutionProcessing(event.aggregateId, event.correlationId);
      } else {
        // Order doesn't exist - fail saga
        await this.failSaga(
          event.aggregateId,
          'ORDER_VERIFICATION',
          'Order verification failed - order not found',
          `Order ${event.eventData.orderId} not found in system`,
          event.correlationId,
          false // No compensation needed
        );
      }

    } catch (error) {
      logger.error('Failed to handle order verification completion', error as Error, {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId
      });

      await this.failSaga(
        event.aggregateId,
        'ORDER_VERIFICATION',
        'Failed to process order verification result',
        error instanceof Error ? error.message : 'Unknown error',
        event.correlationId,
        false
      );
    }
  }

  /**
   * Handle resolution processing completion
   */
  async handleResolutionProcessingCompleted(event: ComplaintSagaEvent): Promise<void> {
    const validEvents = [
      COMPLAINT_SAGA_EVENTS.REFUND_PROCESSING_COMPLETED,
      COMPLAINT_SAGA_EVENTS.REPLACEMENT_PROCESSING_COMPLETED,
      COMPLAINT_SAGA_EVENTS.STORE_CREDIT_PROCESSING_COMPLETED
    ];

    if (!validEvents.includes(event.eventType as any)) return;

    try {
      logger.info('Handling resolution processing completion', {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        resolutionType: event.eventType
      });

      // Update saga state with resolution result
      const result = this.extractResolutionResult(event);
      
      await this.sagaStateManager.markStepCompleted(
        event.aggregateId,
        ComplaintSagaStep.RESOLUTION_PROCESSING,
        result
      );

      // Complete the saga
      await this.completeSaga(event.aggregateId, event.correlationId);

    } catch (error) {
      logger.error('Failed to handle resolution processing completion', error as Error, {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId
      });

      await this.failSaga(
        event.aggregateId,
        'RESOLUTION_PROCESSING',
        'Failed to process resolution completion',
        error instanceof Error ? error.message : 'Unknown error',
        event.correlationId,
        true // May need compensation depending on what was processed
      );
    }
  }

  /**
   * Handle resolution processing failure
   */
  async handleResolutionProcessingFailed(event: ComplaintSagaEvent): Promise<void> {
    if (event.eventType !== COMPLAINT_SAGA_EVENTS.RESOLUTION_PROCESSING_FAILED) return;

    try {
      logger.info('Handling resolution processing failure', {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        reason: event.eventData.reason
      });

      await this.failSaga(
        event.aggregateId,
        'RESOLUTION_PROCESSING',
        'Resolution processing failed',
        event.eventData.error,
        event.correlationId,
        false // Resolution processing failure typically doesn't need compensation
      );

    } catch (error) {
      logger.error('Failed to handle resolution processing failure', error as Error, {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId
      });
    }
  }

  /**
   * Initiate customer validation
   */
  private async initiateCustomerValidation(sagaId: string, customerId: string, correlationId: string): Promise<void> {
    const validationRequestId = uuidv4();

    await this.sagaStateManager.markStepStarted(sagaId, ComplaintSagaStep.CUSTOMER_VALIDATION);

    // Publish customer validation started event
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.CUSTOMER_VALIDATION_STARTED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId: (await this.sagaStateManager.getSagaContext(sagaId))?.complaintId || '',
        customerId,
        validationRequestId,
        startedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'customer.validation.started', event as any);

    logger.info('Customer validation initiated', {
      sagaId,
      customerId,
      validationRequestId,
      correlationId
    });
  }

  /**
   * Initiate order verification
   */
  private async initiateOrderVerification(
    sagaId: string,
    orderId: string,
    customerId: string,
    correlationId: string
  ): Promise<void> {
    const verificationRequestId = uuidv4();

    await this.sagaStateManager.markStepStarted(sagaId, ComplaintSagaStep.ORDER_VERIFICATION);

    // Publish order verification started event
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.ORDER_VERIFICATION_STARTED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId: (await this.sagaStateManager.getSagaContext(sagaId))?.complaintId || '',
        orderId,
        customerId,
        verificationRequestId,
        startedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'order.verification.started', event as any);

    logger.info('Order verification initiated', {
      sagaId,
      orderId,
      verificationRequestId,
      correlationId
    });
  }

  /**
   * Initiate resolution processing
   */
  private async initiateResolutionProcessing(sagaId: string, correlationId: string): Promise<void> {
    const sagaContext = await this.sagaStateManager.getSagaContext(sagaId);
    if (!sagaContext) {
      throw new Error(`Saga context not found for ID: ${sagaId}`);
    }

    const processingRequestId = uuidv4();
    const resolutionType = sagaContext.complaintData.requestedResolution || 'EXPLANATION';

    await this.sagaStateManager.markStepStarted(sagaId, ComplaintSagaStep.RESOLUTION_PROCESSING);

    // Publish resolution processing started event
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.RESOLUTION_PROCESSING_STARTED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId: sagaContext.complaintId,
        resolutionType,
        processingRequestId,
        amount: sagaContext.complaintData.amount,
        approvalRequired: this.isApprovalRequired(resolutionType, sagaContext.complaintData.amount),
        startedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'resolution.processing.started', event as any);

    logger.info('Resolution processing initiated', {
      sagaId,
      resolutionType,
      processingRequestId,
      correlationId
    });
  }

  /**
   * Complete saga successfully
   */
  private async completeSaga(sagaId: string, correlationId: string): Promise<void> {
    const sagaContext = await this.sagaStateManager.getSagaContext(sagaId);
    if (!sagaContext) {
      throw new Error(`Saga context not found for ID: ${sagaId}`);
    }

    await this.sagaStateManager.completeSaga(sagaId);

    // Publish saga completion event
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.SAGA_COMPLETED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId: sagaContext.complaintId,
        resolutionType: sagaContext.resolutionProcessing?.type || 'UNKNOWN',
        finalStatus: 'RESOLVED' as const,
        customerId: sagaContext.customerId,
        completedAt: new Date(),
        summary: {
          totalProcessingTime: Date.now() - sagaContext.initiatedAt.getTime(),
          stepsCompleted: sagaContext.stepHistory.map(step => step.step),
          resolutionProvided: true,
          customerSatisfied: true // Could be determined by other factors
        }
      }
    };

    await this.eventBus.publish('complaint_saga', 'saga.completed', event as any);

    logger.info('Complaint saga completed successfully', {
      sagaId,
      complaintId: sagaContext.complaintId,
      correlationId
    });
  }

  /**
   * Fail saga and optionally initiate compensation
   */
  private async failSaga(
    sagaId: string,
    failedStep: string,
    reason: string,
    error: string,
    correlationId: string,
    requiresCompensation: boolean
  ): Promise<void> {
    const sagaContext = await this.sagaStateManager.getSagaContext(sagaId);
    if (!sagaContext) {
      throw new Error(`Saga context not found for ID: ${sagaId}`);
    }

    await this.sagaStateManager.failSaga(sagaId, error, requiresCompensation);

    // Publish saga failure event
    await this.publishSagaFailureEvent(
      sagaContext.complaintId,
      failedStep,
      reason,
      error,
      correlationId,
      requiresCompensation
    );

    if (requiresCompensation) {
      await this.initiateCompensation(sagaId, reason, correlationId);
    }
  }

  /**
   * Publish saga failure event
   */
  private async publishSagaFailureEvent(
    complaintId: string,
    failedStep: string,
    reason: string,
    error: string,
    correlationId: string,
    requiresCompensation: boolean = false
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.SAGA_FAILED,
      aggregateId: complaintId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        failureReason: reason,
        failedStep,
        error,
        compensationRequired: requiresCompensation,
        escalationRequired: true, // Complaint failures typically need escalation
        failedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'saga.failed', event as any);
  }

  /**
   * Initiate compensation
   */
  private async initiateCompensation(sagaId: string, reason: string, correlationId: string): Promise<void> {
    const compensationRequestId = uuidv4();

    // Determine compensation type based on saga state
    const sagaContext = await this.sagaStateManager.getSagaContext(sagaId);
    const compensationType = this.determineCompensationType(sagaContext!);

    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.COMPENSATION_INITIATED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId: sagaContext!.complaintId,
        compensationType,
        reason,
        compensationRequestId,
        initiatedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'compensation.initiated', event as any);

    logger.info('Compensation initiated', {
      sagaId,
      compensationType,
      reason,
      correlationId
    });
  }

  /**
   * Extract resolution result from event
   */
  private extractResolutionResult(event: ComplaintSagaEvent): any {
    switch (event.eventType) {
      case COMPLAINT_SAGA_EVENTS.REFUND_PROCESSING_COMPLETED:
        return {
          refundId: event.eventData.refundId,
          amount: event.eventData.amount,
          paymentMethod: event.eventData.paymentMethod
        };
      case COMPLAINT_SAGA_EVENTS.REPLACEMENT_PROCESSING_COMPLETED:
        return {
          replacementOrderId: event.eventData.replacementOrderId,
          productId: event.eventData.productId,
          quantity: event.eventData.quantity
        };
      case COMPLAINT_SAGA_EVENTS.STORE_CREDIT_PROCESSING_COMPLETED:
        return {
          creditId: event.eventData.creditId,
          amount: event.eventData.amount,
          expirationDate: event.eventData.expirationDate
        };
      default:
        return {};
    }
  }

  /**
   * Determine if approval is required for resolution
   */
  private isApprovalRequired(resolutionType: string, amount?: number): boolean {
    // Business rules for approval
    if (resolutionType === 'REFUND' && amount && amount > 500) {
      return true;
    }
    if (resolutionType === 'REPLACEMENT' && amount && amount > 1000) {
      return true;
    }
    return false;
  }

  /**
   * Determine compensation type based on saga state
   */
  private determineCompensationType(sagaContext: any): string {
    if (sagaContext.resolutionProcessing?.result?.refundId) {
      return 'REVERSE_REFUND';
    }
    if (sagaContext.resolutionProcessing?.result?.replacementOrderId) {
      return 'CANCEL_REPLACEMENT';
    }
    if (sagaContext.resolutionProcessing?.result?.creditId) {
      return 'REVERSE_CREDIT';
    }
    return 'ROLLBACK_STATUS';
  }
}
