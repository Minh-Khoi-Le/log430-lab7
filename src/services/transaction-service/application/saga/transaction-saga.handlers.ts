/**
 * Transaction Service Saga Event Handlers
 * 
 * Handles saga events related to order verification and resolution processing
 * in the complaint handling workflow. This service participates in the choreographed
 * saga by verifying order information and processing refunds/replacements.
 */

import { v4 as uuidv4 } from 'uuid';
import { IEventBus } from '@shared/infrastructure/messaging';
import { Logger } from '@shared/infrastructure/logging/logger';
import { ComplaintSagaEvent, COMPLAINT_SAGA_EVENTS } from '@shared/domain/events/complaint-saga.events';
import { SharedSaleRepository } from '../../infrastructure/database/shared-sale.repository';
import { SharedRefundRepository } from '../../infrastructure/database/shared-refund.repository';

const logger = new Logger({ serviceName: 'transaction-service' });

export class TransactionSagaEventHandlers {
  constructor(
    private readonly saleRepository: SharedSaleRepository,
    private readonly refundRepository: SharedRefundRepository,
    private readonly eventBus: IEventBus
  ) {}

  /**
   * Handle order verification started event
   * This verifies if the order exists and is eligible for complaint processing
   */
  async handleOrderVerificationStarted(event: ComplaintSagaEvent): Promise<void> {
    if (event.eventType !== COMPLAINT_SAGA_EVENTS.ORDER_VERIFICATION_STARTED) return;

    try {
      logger.info('Handling order verification started', {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        orderId: event.eventData.orderId,
        verificationRequestId: event.eventData.verificationRequestId
      });

      // Verify order
      const verificationResult = await this.verifyOrder(
        event.eventData.orderId,
        event.eventData.customerId
      );

      if (verificationResult.orderExists) {
        // Publish order verification completed event
        await this.publishOrderVerificationCompleted(
          event.aggregateId, // sagaId
          event.eventData.complaintId,
          event.eventData.orderId,
          event.eventData.verificationRequestId,
          verificationResult,
          event.correlationId
        );
      } else {
        // Publish order verification failed event
        await this.publishOrderVerificationFailed(
          event.aggregateId, // sagaId
          event.eventData.complaintId,
          event.eventData.orderId,
          event.eventData.verificationRequestId,
          verificationResult.reason || 'Order verification failed',
          verificationResult.error || 'Order not found or not eligible',
          event.correlationId
        );
      }

    } catch (error) {
      logger.error('Failed to handle order verification started', error as Error, {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        orderId: event.eventData.orderId
      });

      // Publish verification failed event due to processing error
      await this.publishOrderVerificationFailed(
        event.aggregateId,
        event.eventData.complaintId,
        event.eventData.orderId,
        event.eventData.verificationRequestId,
        'Processing error during order verification',
        error instanceof Error ? error.message : 'Unknown error',
        event.correlationId
      );
    }
  }

  /**
   * Handle resolution processing started event
   * This processes refunds, replacements, or store credits based on the resolution type
   */
  async handleResolutionProcessingStarted(event: ComplaintSagaEvent): Promise<void> {
    if (event.eventType !== COMPLAINT_SAGA_EVENTS.RESOLUTION_PROCESSING_STARTED) return;

    try {
      logger.info('Handling resolution processing started', {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        resolutionType: event.eventData.resolutionType,
        processingRequestId: event.eventData.processingRequestId
      });

      const resolutionType = event.eventData.resolutionType;
      const processingResult = await this.processResolution(
        resolutionType,
        event.eventData.complaintId,
        event.eventData.amount,
        event.eventData.processingRequestId
      );

      if (resolutionType === 'REFUND') {
        await this.publishRefundProcessingCompleted(
          event.aggregateId,
          event.eventData.complaintId,
          event.eventData.processingRequestId,
          processingResult,
          event.correlationId
        );
      } else if (resolutionType === 'REPLACEMENT') {
        await this.publishReplacementProcessingCompleted(
          event.aggregateId,
          event.eventData.complaintId,
          event.eventData.processingRequestId,
          processingResult,
          event.correlationId
        );
      } else if (resolutionType === 'STORE_CREDIT') {
        await this.publishStoreCreditProcessingCompleted(
          event.aggregateId,
          event.eventData.complaintId,
          event.eventData.processingRequestId,
          processingResult,
          event.correlationId
        );
      } else {
        // For other resolution types (REPAIR, EXPLANATION), just mark as completed
        await this.publishResolutionProcessingCompleted(
          event.aggregateId,
          event.eventData.complaintId,
          event.eventData.processingRequestId,
          resolutionType,
          { message: 'Resolution processed successfully' },
          event.correlationId
        );
      }

    } catch (error) {
      logger.error('Failed to handle resolution processing started', error as Error, {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        resolutionType: event.eventData.resolutionType
      });

      // Publish resolution processing failed event
      await this.publishResolutionProcessingFailed(
        event.aggregateId,
        event.eventData.complaintId,
        event.eventData.processingRequestId,
        event.eventData.resolutionType,
        'Processing error during resolution',
        error instanceof Error ? error.message : 'Unknown error',
        event.correlationId
      );
    }
  }

  /**
   * Handle compensation initiated event
   * This handles compensation actions like reversing refunds or canceling replacements
   */
  async handleCompensationInitiated(event: ComplaintSagaEvent): Promise<void> {
    if (event.eventType !== COMPLAINT_SAGA_EVENTS.COMPENSATION_INITIATED) return;

    try {
      logger.info('Handling compensation initiated', {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        compensationType: event.eventData.compensationType,
        compensationRequestId: event.eventData.compensationRequestId
      });

      const compensationType = event.eventData.compensationType;
      const compensationResult = await this.processCompensation(
        compensationType,
        event.eventData.complaintId,
        event.eventData.compensationRequestId,
        event.eventData.reason
      );

      // Publish appropriate compensation completed event
      if (compensationType === 'REVERSE_REFUND') {
        await this.publishRefundCompensationCompleted(
          event.aggregateId,
          event.eventData.complaintId,
          event.eventData.compensationRequestId,
          compensationResult,
          event.correlationId
        );
      } else if (compensationType === 'CANCEL_REPLACEMENT') {
        await this.publishReplacementCompensationCompleted(
          event.aggregateId,
          event.eventData.complaintId,
          event.eventData.compensationRequestId,
          compensationResult,
          event.correlationId
        );
      } else if (compensationType === 'REVERSE_CREDIT') {
        await this.publishCreditCompensationCompleted(
          event.aggregateId,
          event.eventData.complaintId,
          event.eventData.compensationRequestId,
          compensationResult,
          event.correlationId
        );
      }

    } catch (error) {
      logger.error('Failed to handle compensation initiated', error as Error, {
        eventId: event.eventId,
        complaintId: event.eventData.complaintId,
        compensationType: event.eventData.compensationType
      });

      // Publish compensation failed event
      await this.publishCompensationFailed(
        event.aggregateId,
        event.eventData.complaintId,
        event.eventData.compensationRequestId,
        event.eventData.compensationType,
        'Processing error during compensation',
        error instanceof Error ? error.message : 'Unknown error',
        event.correlationId
      );
    }
  }

  /**
   * Verify order information and eligibility
   */
  private async verifyOrder(orderId: string, customerId: string): Promise<{
    orderExists: boolean;
    orderStatus?: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
    orderDate?: Date;
    orderAmount?: number;
    eligibleForRefund?: boolean;
    reason?: string;
    error?: string;
  }> {
    try {
      // Get order information from sales repository
      const sale = await this.saleRepository.findById(parseInt(orderId));

      if (!sale) {
        return {
          orderExists: false,
          reason: 'Order not found',
          error: `Order with ID ${orderId} does not exist`
        };
      }

      // Verify the order belongs to the customer
      if (sale.userId.toString() !== customerId) {
        return {
          orderExists: false,
          reason: 'Order does not belong to customer',
          error: `Order ${orderId} does not belong to customer ${customerId}`
        };
      }

      // Determine order status and eligibility
      const orderStatus = this.mapSaleStatusToOrderStatus(sale.status);
      const eligibleForRefund = this.isEligibleForRefund(sale);

      logger.info('Order verification completed successfully', {
        orderId,
        customerId,
        orderStatus,
        eligibleForRefund
      });

      return {
        orderExists: true,
        orderStatus,
        orderDate: sale.date,
        eligibleForRefund
      };

    } catch (error) {
      logger.error('Error during order verification', error as Error, { orderId, customerId });
      
      return {
        orderExists: false,
        reason: 'Database error during verification',
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
    }
  }

  /**
   * Process resolution based on type
   */
  private async processResolution(
    resolutionType: string,
    complaintId: string,
    amount?: number,
    processingRequestId?: string
  ): Promise<any> {
    switch (resolutionType) {
      case 'REFUND':
        return await this.processRefund(complaintId, amount || 0, processingRequestId || '');
      case 'REPLACEMENT':
        return await this.processReplacement(complaintId, processingRequestId || '');
      case 'STORE_CREDIT':
        return await this.processStoreCredit(complaintId, amount || 0, processingRequestId || '');
      default:
        return { message: 'Resolution processed successfully' };
    }
  }

  /**
   * Process refund
   */
  private async processRefund(complaintId: string, amount: number, processingRequestId: string): Promise<any> {
    // Create a refund record
    const refundId = uuidv4();
    
    // In a real implementation, this would create an actual refund record
    // For now, we'll simulate the process
    logger.info('Processing refund', {
      complaintId,
      refundId,
      amount,
      processingRequestId
    });

    return {
      refundId,
      amount,
      paymentMethod: 'ORIGINAL_PAYMENT_METHOD' // Would be determined from original order
    };
  }

  /**
   * Process replacement
   */
  private async processReplacement(complaintId: string, processingRequestId: string): Promise<any> {
    // Create a replacement order
    const replacementOrderId = uuidv4();
    
    logger.info('Processing replacement', {
      complaintId,
      replacementOrderId,
      processingRequestId
    });

    return {
      replacementOrderId,
      productId: 1, // Would be determined from original order
      quantity: 1
    };
  }

  /**
   * Process store credit
   */
  private async processStoreCredit(complaintId: string, amount: number, processingRequestId: string): Promise<any> {
    // Create a store credit
    const creditId = uuidv4();
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1); // 1 year expiration
    
    logger.info('Processing store credit', {
      complaintId,
      creditId,
      amount,
      processingRequestId
    });

    return {
      creditId,
      amount,
      expirationDate
    };
  }

  /**
   * Process compensation
   */
  private async processCompensation(
    compensationType: string,
    complaintId: string,
    compensationRequestId: string,
    reason: string
  ): Promise<any> {
    logger.info('Processing compensation', {
      compensationType,
      complaintId,
      compensationRequestId,
      reason
    });

    // Simulate compensation processing
    switch (compensationType) {
      case 'REVERSE_REFUND':
        return {
          originalRefundId: uuidv4(),
          reversalAmount: 100 // Would be determined from original refund
        };
      case 'CANCEL_REPLACEMENT':
        return {
          originalReplacementOrderId: uuidv4(),
          cancellationReason: reason
        };
      case 'REVERSE_CREDIT':
        return {
          originalCreditId: uuidv4(),
          reversalAmount: 100 // Would be determined from original credit
        };
      default:
        return { message: 'Compensation processed successfully' };
    }
  }

  /**
   * Map sale status to order status
   */
  private mapSaleStatusToOrderStatus(saleStatus: string): 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' {
    switch (saleStatus.toUpperCase()) {
      case 'PENDING':
        return 'PENDING';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'CANCELLED':
        return 'CANCELLED';
      case 'REFUNDED':
        return 'REFUNDED';
      default:
        return 'COMPLETED';
    }
  }

  /**
   * Check if order is eligible for refund
   */
  private isEligibleForRefund(sale: any): boolean {
    // Business rules for refund eligibility
    if (sale.status === 'CANCELLED' || sale.status === 'REFUNDED') {
      return false;
    }
    
    // Check if order is within refund period (e.g., 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return sale.createdAt > thirtyDaysAgo;
  }

  // Event publishing methods...

  private async publishOrderVerificationCompleted(
    sagaId: string,
    complaintId: string,
    orderId: string,
    verificationRequestId: string,
    verificationResult: any,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.ORDER_VERIFICATION_COMPLETED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        orderId,
        verificationRequestId,
        orderExists: verificationResult.orderExists,
        orderStatus: verificationResult.orderStatus,
        orderDate: verificationResult.orderDate,
        orderAmount: verificationResult.orderAmount,
        eligibleForRefund: verificationResult.eligibleForRefund,
        completedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'order.verification.completed', event as any);

    logger.info('Order verification completed event published', {
      sagaId,
      complaintId,
      orderId,
      verificationRequestId,
      orderExists: verificationResult.orderExists
    });
  }

  private async publishOrderVerificationFailed(
    sagaId: string,
    complaintId: string,
    orderId: string,
    verificationRequestId: string,
    reason: string,
    error: string,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.ORDER_VERIFICATION_FAILED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        orderId,
        verificationRequestId,
        reason,
        error,
        failedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'order.verification.failed', event as any);

    logger.info('Order verification failed event published', {
      sagaId,
      complaintId,
      orderId,
      reason,
      error
    });
  }

  private async publishRefundProcessingCompleted(
    sagaId: string,
    complaintId: string,
    processingRequestId: string,
    processingResult: any,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.REFUND_PROCESSING_COMPLETED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        processingRequestId,
        refundId: processingResult.refundId,
        amount: processingResult.amount,
        paymentMethod: processingResult.paymentMethod,
        completedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'refund.processing.completed', event as any);

    logger.info('Refund processing completed event published', {
      sagaId,
      complaintId,
      refundId: processingResult.refundId,
      amount: processingResult.amount
    });
  }

  private async publishReplacementProcessingCompleted(
    sagaId: string,
    complaintId: string,
    processingRequestId: string,
    processingResult: any,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.REPLACEMENT_PROCESSING_COMPLETED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        processingRequestId,
        replacementOrderId: processingResult.replacementOrderId,
        productId: processingResult.productId,
        quantity: processingResult.quantity,
        completedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'replacement.processing.completed', event as any);

    logger.info('Replacement processing completed event published', {
      sagaId,
      complaintId,
      replacementOrderId: processingResult.replacementOrderId
    });
  }

  private async publishStoreCreditProcessingCompleted(
    sagaId: string,
    complaintId: string,
    processingRequestId: string,
    processingResult: any,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.STORE_CREDIT_PROCESSING_COMPLETED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        processingRequestId,
        creditId: processingResult.creditId,
        amount: processingResult.amount,
        expirationDate: processingResult.expirationDate,
        completedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'store.credit.processing.completed', event as any);

    logger.info('Store credit processing completed event published', {
      sagaId,
      complaintId,
      creditId: processingResult.creditId,
      amount: processingResult.amount
    });
  }

  private async publishResolutionProcessingCompleted(
    sagaId: string,
    complaintId: string,
    processingRequestId: string,
    resolutionType: string,
    result: any,
    correlationId: string
  ): Promise<void> {
    // For generic resolution types, we can publish a generic completion event
    logger.info('Generic resolution processing completed', {
      sagaId,
      complaintId,
      resolutionType,
      result
    });
  }

  private async publishResolutionProcessingFailed(
    sagaId: string,
    complaintId: string,
    processingRequestId: string,
    resolutionType: string,
    reason: string,
    error: string,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.RESOLUTION_PROCESSING_FAILED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        processingRequestId,
        resolutionType,
        reason,
        error,
        failedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'resolution.processing.failed', event as any);

    logger.info('Resolution processing failed event published', {
      sagaId,
      complaintId,
      resolutionType,
      reason,
      error
    });
  }

  private async publishRefundCompensationCompleted(
    sagaId: string,
    complaintId: string,
    compensationRequestId: string,
    compensationResult: any,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.REFUND_COMPENSATION_COMPLETED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        compensationRequestId,
        originalRefundId: compensationResult.originalRefundId,
        reversalAmount: compensationResult.reversalAmount,
        completedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'refund.compensation.completed', event as any);

    logger.info('Refund compensation completed event published', {
      sagaId,
      complaintId,
      compensationRequestId
    });
  }

  private async publishReplacementCompensationCompleted(
    sagaId: string,
    complaintId: string,
    compensationRequestId: string,
    compensationResult: any,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.REPLACEMENT_COMPENSATION_COMPLETED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        compensationRequestId,
        originalReplacementOrderId: compensationResult.originalReplacementOrderId,
        cancellationReason: compensationResult.cancellationReason,
        completedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'replacement.compensation.completed', event as any);

    logger.info('Replacement compensation completed event published', {
      sagaId,
      complaintId,
      compensationRequestId
    });
  }

  private async publishCreditCompensationCompleted(
    sagaId: string,
    complaintId: string,
    compensationRequestId: string,
    compensationResult: any,
    correlationId: string
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: COMPLAINT_SAGA_EVENTS.CREDIT_COMPENSATION_COMPLETED,
      aggregateId: sagaId,
      correlationId,
      timestamp: new Date(),
      version: 1,
      eventData: {
        complaintId,
        compensationRequestId,
        originalCreditId: compensationResult.originalCreditId,
        reversalAmount: compensationResult.reversalAmount,
        completedAt: new Date()
      }
    };

    await this.eventBus.publish('complaint_saga', 'credit.compensation.completed', event as any);

    logger.info('Credit compensation completed event published', {
      sagaId,
      complaintId,
      compensationRequestId
    });
  }

  private async publishCompensationFailed(
    sagaId: string,
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
      aggregateId: sagaId,
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

    logger.info('Compensation failed event published', {
      sagaId,
      complaintId,
      compensationType,
      reason,
      error
    });
  }
}