/**
 * Complaint Saga State Manager Implementation
 * 
 * Manages the state of choreographed complaint handling sagas.
 * Tracks saga progress through event correlation and provides
 * state persistence and recovery capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@shared/infrastructure/logging/logger';
import {
  ComplaintSagaContext,
  ComplaintSagaStateManager,
  ComplaintSagaStateRepository,
  ComplaintSagaStatus,
  ComplaintSagaStep,
  SagaError,
  SagaStepExecution
} from '@shared/domain/saga/complaint-saga-state';

const logger = new Logger({ serviceName: 'complaint-service' });

export class ComplaintSagaStateManagerImpl implements ComplaintSagaStateManager {
  constructor(
    private readonly stateRepository: ComplaintSagaStateRepository
  ) {}

  /**
   * Initialize a new complaint saga
   */
  async initiateSaga(
    complaintId: string,
    customerId: string,
    complaintData: ComplaintSagaContext['complaintData'],
    orderId?: string,
    storeId: number = 1
  ): Promise<ComplaintSagaContext> {
    const sagaId = uuidv4();
    const correlationId = uuidv4();
    const now = new Date();

    const context: ComplaintSagaContext = {
      sagaId,
      complaintId,
      correlationId,
      customerId,
      orderId,
      storeId,
      initiatedAt: now,
      status: ComplaintSagaStatus.INITIATED,
      currentStep: ComplaintSagaStep.SAGA_INITIATED,
      version: 1,
      complaintData,
      errors: [],
      stepHistory: [{
        step: ComplaintSagaStep.SAGA_INITIATED,
        status: 'COMPLETED',
        startedAt: now,
        completedAt: now,
        duration: 0
      }]
    };

    await this.stateRepository.create(context);

    logger.info('Complaint saga initiated', {
      sagaId,
      complaintId,
      customerId,
      correlationId
    });

    return context;
  }

  /**
   * Handle incoming saga events
   */
  async handleEvent(event: any): Promise<void> {
    const correlationId = event.correlationId;
    
    try {
      const sagaContext = await this.stateRepository.findByCorrelationId(correlationId);
      
      if (!sagaContext) {
        logger.warn('No saga found for event', {
          eventType: event.eventType,
          correlationId
        });
        return;
      }

      // Update saga state based on event type
      switch (event.eventType) {
        case 'CUSTOMER_VALIDATION_COMPLETED':
          await this.handleCustomerValidationCompleted(sagaContext, event);
          break;
        case 'CUSTOMER_VALIDATION_FAILED':
          await this.handleCustomerValidationFailed(sagaContext, event);
          break;
        case 'ORDER_VERIFICATION_COMPLETED':
          await this.handleOrderVerificationCompleted(sagaContext, event);
          break;
        case 'ORDER_VERIFICATION_FAILED':
          await this.handleOrderVerificationFailed(sagaContext, event);
          break;
        case 'REFUND_PROCESSING_COMPLETED':
        case 'REPLACEMENT_PROCESSING_COMPLETED':
        case 'STORE_CREDIT_PROCESSING_COMPLETED':
          await this.handleResolutionCompleted(sagaContext, event);
          break;
        case 'RESOLUTION_PROCESSING_FAILED':
          await this.handleResolutionFailed(sagaContext, event);
          break;
        default:
          logger.warn('Unhandled event type in saga', {
            eventType: event.eventType,
            sagaId: sagaContext.sagaId
          });
      }

    } catch (error) {
      logger.error('Error handling saga event', error as Error, {
        eventType: event.eventType,
        correlationId
      });
    }
  }

  /**
   * Mark step as started
   */
  async markStepStarted(sagaId: string, step: ComplaintSagaStep): Promise<void> {
    const context = await this.stateRepository.findById(sagaId);
    if (!context) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    const now = new Date();
    const execution: SagaStepExecution = {
      step,
      status: 'STARTED',
      startedAt: now
    };

    const updates: Partial<ComplaintSagaContext> = {
      currentStep: step,
      stepHistory: [...context.stepHistory, execution],
      version: context.version + 1
    };

    // Update status based on step
    if (step === ComplaintSagaStep.CUSTOMER_VALIDATION) {
      updates.status = ComplaintSagaStatus.CUSTOMER_VALIDATING;
    } else if (step === ComplaintSagaStep.ORDER_VERIFICATION) {
      updates.status = ComplaintSagaStatus.ORDER_VERIFYING;
    } else if (step === ComplaintSagaStep.RESOLUTION_PROCESSING) {
      updates.status = ComplaintSagaStatus.RESOLUTION_PROCESSING;
    } else if (step === ComplaintSagaStep.COMPENSATION) {
      updates.status = ComplaintSagaStatus.COMPENSATING;
    }

    await this.stateRepository.update(sagaId, updates);

    logger.info('Saga step started', {
      sagaId,
      step,
      newStatus: updates.status
    });
  }

  /**
   * Mark step as completed
   */
  async markStepCompleted(
    sagaId: string,
    step: ComplaintSagaStep,
    result?: any
  ): Promise<void> {
    const context = await this.stateRepository.findById(sagaId);
    if (!context) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    const now = new Date();
    
    // Find the step execution to update
    const stepHistory = [...context.stepHistory];
    const stepIndex = stepHistory.findIndex(s => s.step === step && s.status === 'STARTED');
    
    if (stepIndex >= 0) {
      stepHistory[stepIndex] = {
        ...stepHistory[stepIndex],
        status: 'COMPLETED',
        completedAt: now,
        duration: now.getTime() - stepHistory[stepIndex].startedAt.getTime()
      };
    }

    const updates: Partial<ComplaintSagaContext> = {
      stepHistory,
      version: context.version + 1
    };

    // Update step-specific data
    if (step === ComplaintSagaStep.CUSTOMER_VALIDATION && result) {
      updates.customerValidation = {
        requestId: result.requestId || uuidv4(),
        isValid: result.isValid,
        customerTier: result.customerTier,
        accountStatus: result.accountStatus,
        completedAt: now
      };
    } else if (step === ComplaintSagaStep.ORDER_VERIFICATION && result) {
      updates.orderVerification = {
        requestId: result.requestId || uuidv4(),
        orderExists: result.orderExists,
        orderStatus: result.orderStatus,
        orderDate: result.orderDate,
        orderAmount: result.orderAmount,
        eligibleForRefund: result.eligibleForRefund,
        completedAt: now
      };
    } else if (step === ComplaintSagaStep.RESOLUTION_PROCESSING && result) {
      updates.resolutionProcessing = {
        requestId: result.requestId || uuidv4(),
        type: result.type || context.complaintData.requestedResolution || 'EXPLANATION',
        status: 'COMPLETED',
        result,
        completedAt: now
      };
    }

    await this.stateRepository.update(sagaId, updates);

    logger.info('Saga step completed', {
      sagaId,
      step,
      hasResult: !!result
    });
  }

  /**
   * Mark step as failed
   */
  async markStepFailed(
    sagaId: string,
    step: ComplaintSagaStep,
    error: string
  ): Promise<void> {
    const context = await this.stateRepository.findById(sagaId);
    if (!context) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    const now = new Date();
    
    // Find the step execution to update
    const stepHistory = [...context.stepHistory];
    const stepIndex = stepHistory.findIndex(s => s.step === step && s.status === 'STARTED');
    
    if (stepIndex >= 0) {
      stepHistory[stepIndex] = {
        ...stepHistory[stepIndex],
        status: 'FAILED',
        completedAt: now,
        duration: now.getTime() - stepHistory[stepIndex].startedAt.getTime(),
        error
      };
    }

    const sagaError: SagaError = {
      step,
      error,
      timestamp: now,
      recoverable: this.isRecoverableError(step, error)
    };

    const updates: Partial<ComplaintSagaContext> = {
      stepHistory,
      errors: [...context.errors, sagaError],
      status: ComplaintSagaStatus.FAILED,
      version: context.version + 1
    };

    await this.stateRepository.update(sagaId, updates);

    logger.error('Saga step failed', new Error(error), {
      sagaId,
      step,
      recoverable: sagaError.recoverable
    });
  }

  /**
   * Complete saga successfully
   */
  async completeSaga(sagaId: string): Promise<void> {
    const context = await this.stateRepository.findById(sagaId);
    if (!context) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    const now = new Date();
    const updates: Partial<ComplaintSagaContext> = {
      status: ComplaintSagaStatus.COMPLETED,
      currentStep: ComplaintSagaStep.SAGA_COMPLETION,
      completedAt: now,
      version: context.version + 1
    };

    await this.stateRepository.update(sagaId, updates);

    logger.info('Saga completed successfully', {
      sagaId,
      complaintId: context.complaintId,
      duration: now.getTime() - context.initiatedAt.getTime()
    });
  }

  /**
   * Fail saga and initiate compensation if needed
   */
  async failSaga(sagaId: string, error: string, requiresCompensation: boolean): Promise<void> {
    const context = await this.stateRepository.findById(sagaId);
    if (!context) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    const now = new Date();
    const sagaError: SagaError = {
      step: context.currentStep,
      error,
      timestamp: now,
      recoverable: false
    };

    const updates: Partial<ComplaintSagaContext> = {
      status: requiresCompensation ? ComplaintSagaStatus.COMPENSATING : ComplaintSagaStatus.FAILED,
      currentStep: requiresCompensation ? ComplaintSagaStep.COMPENSATION : ComplaintSagaStep.SAGA_FAILURE,
      errors: [...context.errors, sagaError],
      version: context.version + 1
    };

    if (requiresCompensation) {
      updates.compensation = {
        requestId: uuidv4(),
        type: this.determineCompensationType(context),
        status: 'PENDING',
        reason: error
      };
    }

    await this.stateRepository.update(sagaId, updates);

    logger.error('Saga failed', new Error(error), {
      sagaId,
      complaintId: context.complaintId,
      requiresCompensation
    });
  }

  /**
   * Get saga context by ID
   */
  async getSagaContext(sagaId: string): Promise<ComplaintSagaContext | null> {
    return await this.stateRepository.findById(sagaId);
  }

  /**
   * Check for stuck sagas that need intervention
   */
  async checkStuckSagas(): Promise<ComplaintSagaContext[]> {
    const maxDurationMs = 24 * 60 * 60 * 1000; // 24 hours
    return await this.stateRepository.findStuckSagas(maxDurationMs);
  }

  /**
   * Handle customer validation completed event
   */
  private async handleCustomerValidationCompleted(context: ComplaintSagaContext, event: any): Promise<void> {
    await this.markStepCompleted(
      context.sagaId,
      ComplaintSagaStep.CUSTOMER_VALIDATION,
      {
        requestId: event.eventData.validationRequestId,
        isValid: event.eventData.isValid,
        customerTier: event.eventData.customerTier,
        accountStatus: event.eventData.accountStatus
      }
    );
  }

  /**
   * Handle customer validation failed event
   */
  private async handleCustomerValidationFailed(context: ComplaintSagaContext, event: any): Promise<void> {
    await this.markStepFailed(
      context.sagaId,
      ComplaintSagaStep.CUSTOMER_VALIDATION,
      event.eventData.error
    );
  }

  /**
   * Handle order verification completed event
   */
  private async handleOrderVerificationCompleted(context: ComplaintSagaContext, event: any): Promise<void> {
    await this.markStepCompleted(
      context.sagaId,
      ComplaintSagaStep.ORDER_VERIFICATION,
      {
        requestId: event.eventData.verificationRequestId,
        orderExists: event.eventData.orderExists,
        orderStatus: event.eventData.orderStatus,
        orderDate: event.eventData.orderDate,
        orderAmount: event.eventData.orderAmount,
        eligibleForRefund: event.eventData.eligibleForRefund
      }
    );
  }

  /**
   * Handle order verification failed event
   */
  private async handleOrderVerificationFailed(context: ComplaintSagaContext, event: any): Promise<void> {
    await this.markStepFailed(
      context.sagaId,
      ComplaintSagaStep.ORDER_VERIFICATION,
      event.eventData.error
    );
  }

  /**
   * Handle resolution completed event
   */
  private async handleResolutionCompleted(context: ComplaintSagaContext, event: any): Promise<void> {
    let result: any = {};
    
    switch (event.eventType) {
      case 'REFUND_PROCESSING_COMPLETED':
        result = {
          refundId: event.eventData.refundId,
          amount: event.eventData.amount,
          paymentMethod: event.eventData.paymentMethod
        };
        break;
      case 'REPLACEMENT_PROCESSING_COMPLETED':
        result = {
          replacementOrderId: event.eventData.replacementOrderId,
          productId: event.eventData.productId,
          quantity: event.eventData.quantity
        };
        break;
      case 'STORE_CREDIT_PROCESSING_COMPLETED':
        result = {
          creditId: event.eventData.creditId,
          amount: event.eventData.amount,
          expirationDate: event.eventData.expirationDate
        };
        break;
    }

    await this.markStepCompleted(
      context.sagaId,
      ComplaintSagaStep.RESOLUTION_PROCESSING,
      {
        requestId: event.eventData.processingRequestId,
        type: this.getResolutionTypeFromEvent(event.eventType),
        result
      }
    );
  }

  /**
   * Handle resolution failed event
   */
  private async handleResolutionFailed(context: ComplaintSagaContext, event: any): Promise<void> {
    await this.markStepFailed(
      context.sagaId,
      ComplaintSagaStep.RESOLUTION_PROCESSING,
      event.eventData.error
    );
  }

  /**
   * Determine if an error is recoverable
   */
  private isRecoverableError(step: ComplaintSagaStep, error: string): boolean {
    // Customer validation errors are typically not recoverable
    if (step === ComplaintSagaStep.CUSTOMER_VALIDATION) {
      return false;
    }
    
    // Order verification errors might be recoverable if it's a temporary issue
    if (step === ComplaintSagaStep.ORDER_VERIFICATION) {
      return error.includes('timeout') || error.includes('service unavailable');
    }
    
    // Resolution processing errors might be recoverable
    if (step === ComplaintSagaStep.RESOLUTION_PROCESSING) {
      return !error.includes('insufficient funds') && !error.includes('account closed');
    }
    
    return false;
  }

  /**
   * Determine compensation type based on saga state
   */
  private determineCompensationType(context: ComplaintSagaContext): 'REVERSE_REFUND' | 'CANCEL_REPLACEMENT' | 'REVERSE_CREDIT' | 'ROLLBACK_STATUS' {
    if (context.resolutionProcessing?.result?.refundId) {
      return 'REVERSE_REFUND';
    }
    if (context.resolutionProcessing?.result?.replacementOrderId) {
      return 'CANCEL_REPLACEMENT';
    }
    if (context.resolutionProcessing?.result?.creditId) {
      return 'REVERSE_CREDIT';
    }
    return 'ROLLBACK_STATUS';
  }

  /**
   * Get resolution type from event type
   */
  private getResolutionTypeFromEvent(eventType: string): 'REFUND' | 'REPLACEMENT' | 'STORE_CREDIT' | 'REPAIR' | 'EXPLANATION' {
    switch (eventType) {
      case 'REFUND_PROCESSING_COMPLETED':
        return 'REFUND';
      case 'REPLACEMENT_PROCESSING_COMPLETED':
        return 'REPLACEMENT';
      case 'STORE_CREDIT_PROCESSING_COMPLETED':
        return 'STORE_CREDIT';
      default:
        return 'EXPLANATION';
    }
  }
}
