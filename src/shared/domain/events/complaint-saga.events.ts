/**
 * Saga Events for Complaint Handling Workflow
 * 
 * Defines the events that drive the choreographed saga for complaint processing.
 * Unlike the orchestrated saga pattern used for sales, this implements choreography
 * where services listen to events and decide what to do next.
 */

export interface BaseSagaEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  correlationId: string;
  causationId?: string;
  timestamp: Date;
  version: number;
  metadata?: Record<string, any>;
}

/**
 * Complaint Saga Initiation Events
 */
export interface ComplaintSagaInitiatedEvent extends BaseSagaEvent {
  eventType: 'COMPLAINT_SAGA_INITIATED';
  eventData: {
    complaintId: string;
    customerId: string;
    orderId?: string;
    storeId: number;
    complaintType: 'PRODUCT_DEFECT' | 'SERVICE_ISSUE' | 'BILLING_DISPUTE' | 'DELIVERY_ISSUE' | 'OTHER';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    requestedResolution?: 'REFUND' | 'REPLACEMENT' | 'STORE_CREDIT' | 'REPAIR' | 'EXPLANATION';
    amount?: number;
    initiatedAt: Date;
  };
}

/**
 * Customer Validation Events
 */
export interface CustomerValidationStartedEvent extends BaseSagaEvent {
  eventType: 'CUSTOMER_VALIDATION_STARTED';
  eventData: {
    complaintId: string;
    customerId: string;
    validationRequestId: string;
    startedAt: Date;
  };
}

export interface CustomerValidationCompletedEvent extends BaseSagaEvent {
  eventType: 'CUSTOMER_VALIDATION_COMPLETED';
  eventData: {
    complaintId: string;
    customerId: string;
    validationRequestId: string;
    isValid: boolean;
    customerTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
    accountStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    completedAt: Date;
  };
}

export interface CustomerValidationFailedEvent extends BaseSagaEvent {
  eventType: 'CUSTOMER_VALIDATION_FAILED';
  eventData: {
    complaintId: string;
    customerId: string;
    validationRequestId: string;
    reason: string;
    error: string;
    failedAt: Date;
  };
}

/**
 * Order Verification Events
 */
export interface OrderVerificationStartedEvent extends BaseSagaEvent {
  eventType: 'ORDER_VERIFICATION_STARTED';
  eventData: {
    complaintId: string;
    orderId: string;
    customerId: string;
    verificationRequestId: string;
    startedAt: Date;
  };
}

export interface OrderVerificationCompletedEvent extends BaseSagaEvent {
  eventType: 'ORDER_VERIFICATION_COMPLETED';
  eventData: {
    complaintId: string;
    orderId: string;
    verificationRequestId: string;
    orderExists: boolean;
    orderStatus: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
    orderDate: Date;
    orderAmount: number;
    eligibleForRefund: boolean;
    completedAt: Date;
  };
}

export interface OrderVerificationFailedEvent extends BaseSagaEvent {
  eventType: 'ORDER_VERIFICATION_FAILED';
  eventData: {
    complaintId: string;
    orderId: string;
    verificationRequestId: string;
    reason: string;
    error: string;
    failedAt: Date;
  };
}

/**
 * Resolution Processing Events
 */
export interface ResolutionProcessingStartedEvent extends BaseSagaEvent {
  eventType: 'RESOLUTION_PROCESSING_STARTED';
  eventData: {
    complaintId: string;
    resolutionType: 'REFUND' | 'REPLACEMENT' | 'STORE_CREDIT' | 'REPAIR' | 'EXPLANATION';
    processingRequestId: string;
    amount?: number;
    approvalRequired: boolean;
    startedAt: Date;
  };
}

export interface RefundProcessingCompletedEvent extends BaseSagaEvent {
  eventType: 'REFUND_PROCESSING_COMPLETED';
  eventData: {
    complaintId: string;
    processingRequestId: string;
    refundId: string;
    amount: number;
    paymentMethod: string;
    completedAt: Date;
  };
}

export interface ReplacementProcessingCompletedEvent extends BaseSagaEvent {
  eventType: 'REPLACEMENT_PROCESSING_COMPLETED';
  eventData: {
    complaintId: string;
    processingRequestId: string;
    replacementOrderId: string;
    productId: number;
    quantity: number;
    completedAt: Date;
  };
}

export interface StoreCreditProcessingCompletedEvent extends BaseSagaEvent {
  eventType: 'STORE_CREDIT_PROCESSING_COMPLETED';
  eventData: {
    complaintId: string;
    processingRequestId: string;
    creditId: string;
    amount: number;
    expirationDate: Date;
    completedAt: Date;
  };
}

export interface ResolutionProcessingFailedEvent extends BaseSagaEvent {
  eventType: 'RESOLUTION_PROCESSING_FAILED';
  eventData: {
    complaintId: string;
    processingRequestId: string;
    resolutionType: string;
    reason: string;
    error: string;
    failedAt: Date;
  };
}

/**
 * Saga Success Events
 */
export interface ComplaintSagaCompletedEvent extends BaseSagaEvent {
  eventType: 'COMPLAINT_SAGA_COMPLETED';
  eventData: {
    complaintId: string;
    resolutionType: string;
    finalStatus: 'RESOLVED' | 'CLOSED';
    customerId: string;
    completedAt: Date;
    summary: {
      totalProcessingTime: number; // milliseconds
      stepsCompleted: string[];
      resolutionProvided: boolean;
      customerSatisfied?: boolean;
    };
  };
}

/**
 * Compensation Events
 */
export interface CompensationInitiatedEvent extends BaseSagaEvent {
  eventType: 'COMPENSATION_INITIATED';
  eventData: {
    complaintId: string;
    compensationType: 'REVERSE_REFUND' | 'CANCEL_REPLACEMENT' | 'REVERSE_CREDIT' | 'ROLLBACK_STATUS';
    reason: string;
    compensationRequestId: string;
    initiatedAt: Date;
  };
}

export interface RefundCompensationCompletedEvent extends BaseSagaEvent {
  eventType: 'REFUND_COMPENSATION_COMPLETED';
  eventData: {
    complaintId: string;
    compensationRequestId: string;
    originalRefundId: string;
    reversalAmount: number;
    completedAt: Date;
  };
}

export interface ReplacementCompensationCompletedEvent extends BaseSagaEvent {
  eventType: 'REPLACEMENT_COMPENSATION_COMPLETED';
  eventData: {
    complaintId: string;
    compensationRequestId: string;
    originalReplacementOrderId: string;
    cancellationReason: string;
    completedAt: Date;
  };
}

export interface CreditCompensationCompletedEvent extends BaseSagaEvent {
  eventType: 'CREDIT_COMPENSATION_COMPLETED';
  eventData: {
    complaintId: string;
    compensationRequestId: string;
    originalCreditId: string;
    reversalAmount: number;
    completedAt: Date;
  };
}

export interface CompensationFailedEvent extends BaseSagaEvent {
  eventType: 'COMPENSATION_FAILED';
  eventData: {
    complaintId: string;
    compensationRequestId: string;
    compensationType: string;
    reason: string;
    error: string;
    requiresManualIntervention: boolean;
    failedAt: Date;
  };
}

/**
 * Saga Failure Events
 */
export interface ComplaintSagaFailedEvent extends BaseSagaEvent {
  eventType: 'COMPLAINT_SAGA_FAILED';
  eventData: {
    complaintId: string;
    failureReason: string;
    failedStep: string;
    error: string;
    compensationRequired: boolean;
    escalationRequired: boolean;
    failedAt: Date;
  };
}

/**
 * Union type for all complaint saga events
 */
export type ComplaintSagaEvent =
  | ComplaintSagaInitiatedEvent
  | CustomerValidationStartedEvent
  | CustomerValidationCompletedEvent
  | CustomerValidationFailedEvent
  | OrderVerificationStartedEvent
  | OrderVerificationCompletedEvent
  | OrderVerificationFailedEvent
  | ResolutionProcessingStartedEvent
  | RefundProcessingCompletedEvent
  | ReplacementProcessingCompletedEvent
  | StoreCreditProcessingCompletedEvent
  | ResolutionProcessingFailedEvent
  | ComplaintSagaCompletedEvent
  | CompensationInitiatedEvent
  | RefundCompensationCompletedEvent
  | ReplacementCompensationCompletedEvent
  | CreditCompensationCompletedEvent
  | CompensationFailedEvent
  | ComplaintSagaFailedEvent;

/**
 * Event type constants for easier reference
 */
export const COMPLAINT_SAGA_EVENTS = {
  // Initiation
  SAGA_INITIATED: 'COMPLAINT_SAGA_INITIATED' as const,
  
  // Customer Validation
  CUSTOMER_VALIDATION_STARTED: 'CUSTOMER_VALIDATION_STARTED' as const,
  CUSTOMER_VALIDATION_COMPLETED: 'CUSTOMER_VALIDATION_COMPLETED' as const,
  CUSTOMER_VALIDATION_FAILED: 'CUSTOMER_VALIDATION_FAILED' as const,
  
  // Order Verification
  ORDER_VERIFICATION_STARTED: 'ORDER_VERIFICATION_STARTED' as const,
  ORDER_VERIFICATION_COMPLETED: 'ORDER_VERIFICATION_COMPLETED' as const,
  ORDER_VERIFICATION_FAILED: 'ORDER_VERIFICATION_FAILED' as const,
  
  // Resolution Processing
  RESOLUTION_PROCESSING_STARTED: 'RESOLUTION_PROCESSING_STARTED' as const,
  REFUND_PROCESSING_COMPLETED: 'REFUND_PROCESSING_COMPLETED' as const,
  REPLACEMENT_PROCESSING_COMPLETED: 'REPLACEMENT_PROCESSING_COMPLETED' as const,
  STORE_CREDIT_PROCESSING_COMPLETED: 'STORE_CREDIT_PROCESSING_COMPLETED' as const,
  RESOLUTION_PROCESSING_FAILED: 'RESOLUTION_PROCESSING_FAILED' as const,
  
  // Success
  SAGA_COMPLETED: 'COMPLAINT_SAGA_COMPLETED' as const,
  
  // Compensation
  COMPENSATION_INITIATED: 'COMPENSATION_INITIATED' as const,
  REFUND_COMPENSATION_COMPLETED: 'REFUND_COMPENSATION_COMPLETED' as const,
  REPLACEMENT_COMPENSATION_COMPLETED: 'REPLACEMENT_COMPENSATION_COMPLETED' as const,
  CREDIT_COMPENSATION_COMPLETED: 'CREDIT_COMPENSATION_COMPLETED' as const,
  COMPENSATION_FAILED: 'COMPENSATION_FAILED' as const,
  
  // Failure
  SAGA_FAILED: 'COMPLAINT_SAGA_FAILED' as const
} as const;
