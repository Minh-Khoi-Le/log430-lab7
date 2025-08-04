/**
 * Complaint Saga State Tracking
 * 
 * Defines the state management for choreographed complaint handling saga.
 * Unlike orchestrated sagas, this tracks state through event correlation.
 */

export interface ComplaintSagaContext {
  // Basic saga information
  sagaId: string;
  complaintId: string;
  correlationId: string;
  customerId: string;
  orderId?: string;
  storeId: number;
  
  // Saga metadata
  initiatedAt: Date;
  completedAt?: Date;
  status: ComplaintSagaStatus;
  currentStep: ComplaintSagaStep;
  version: number;
  
  // Business data
  complaintData: {
    type: 'PRODUCT_DEFECT' | 'SERVICE_ISSUE' | 'BILLING_DISPUTE' | 'DELIVERY_ISSUE' | 'OTHER';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    requestedResolution?: 'REFUND' | 'REPLACEMENT' | 'STORE_CREDIT' | 'REPAIR' | 'EXPLANATION';
    amount?: number;
  };
  
  // Step results
  customerValidation?: {
    requestId: string;
    isValid: boolean;
    customerTier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
    accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    completedAt?: Date;
    error?: string;
  };
  
  orderVerification?: {
    requestId: string;
    orderExists: boolean;
    orderStatus?: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
    orderDate?: Date;
    orderAmount?: number;
    eligibleForRefund?: boolean;
    completedAt?: Date;
    error?: string;
  };
  
  resolutionProcessing?: {
    requestId: string;
    type: 'REFUND' | 'REPLACEMENT' | 'STORE_CREDIT' | 'REPAIR' | 'EXPLANATION';
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    result?: {
      refundId?: string;
      replacementOrderId?: string;
      creditId?: string;
      amount?: number;
    };
    completedAt?: Date;
    error?: string;
  };
  
  // Compensation tracking
  compensation?: {
    requestId: string;
    type: 'REVERSE_REFUND' | 'CANCEL_REPLACEMENT' | 'REVERSE_CREDIT' | 'ROLLBACK_STATUS';
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    reason: string;
    completedAt?: Date;
    error?: string;
  };
  
  // Error tracking
  errors: SagaError[];
  
  // Step execution tracking
  stepHistory: SagaStepExecution[];
}

export enum ComplaintSagaStatus {
  INITIATED = 'INITIATED',
  CUSTOMER_VALIDATING = 'CUSTOMER_VALIDATING',
  ORDER_VERIFYING = 'ORDER_VERIFYING',
  RESOLUTION_PROCESSING = 'RESOLUTION_PROCESSING',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  FAILED = 'FAILED'
}

export enum ComplaintSagaStep {
  SAGA_INITIATED = 'SAGA_INITIATED',
  CUSTOMER_VALIDATION = 'CUSTOMER_VALIDATION',
  ORDER_VERIFICATION = 'ORDER_VERIFICATION',
  RESOLUTION_PROCESSING = 'RESOLUTION_PROCESSING',
  SAGA_COMPLETION = 'SAGA_COMPLETION',
  COMPENSATION = 'COMPENSATION',
  SAGA_FAILURE = 'SAGA_FAILURE'
}

export interface SagaError {
  step: ComplaintSagaStep;
  error: string;
  timestamp: Date;
  recoverable: boolean;
}

export interface SagaStepExecution {
  step: ComplaintSagaStep;
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  error?: string;
}

/**
 * Saga State Repository Interface
 */
export interface ComplaintSagaStateRepository {
  /**
   * Create a new saga state
   */
  create(context: ComplaintSagaContext): Promise<void>;
  
  /**
   * Update existing saga state
   */
  update(sagaId: string, context: Partial<ComplaintSagaContext>): Promise<void>;
  
  /**
   * Find saga by ID
   */
  findById(sagaId: string): Promise<ComplaintSagaContext | null>;
  
  /**
   * Find saga by complaint ID
   */
  findByComplaintId(complaintId: string): Promise<ComplaintSagaContext | null>;
  
  /**
   * Find saga by correlation ID
   */
  findByCorrelationId(correlationId: string): Promise<ComplaintSagaContext | null>;
  
  /**
   * Find all active sagas
   */
  findActiveSagas(): Promise<ComplaintSagaContext[]>;
  
  /**
   * Find sagas by status
   */
  findByStatus(status: ComplaintSagaStatus): Promise<ComplaintSagaContext[]>;
  
  /**
   * Find sagas that have been running longer than specified duration
   */
  findStuckSagas(maxDurationMs: number): Promise<ComplaintSagaContext[]>;
}

/**
 * Saga State Manager Interface
 */
export interface ComplaintSagaStateManager {
  /**
   * Initialize a new complaint saga
   */
  initiateSaga(
    complaintId: string,
    customerId: string,
    complaintData: ComplaintSagaContext['complaintData'],
    orderId?: string,
    storeId?: number
  ): Promise<ComplaintSagaContext>;
  
  /**
   * Update saga state based on received event
   */
  handleEvent(event: any): Promise<void>;
  
  /**
   * Mark step as started
   */
  markStepStarted(sagaId: string, step: ComplaintSagaStep): Promise<void>;
  
  /**
   * Mark step as completed
   */
  markStepCompleted(
    sagaId: string, 
    step: ComplaintSagaStep, 
    result?: any
  ): Promise<void>;
  
  /**
   * Mark step as failed
   */
  markStepFailed(
    sagaId: string, 
    step: ComplaintSagaStep, 
    error: string
  ): Promise<void>;
  
  /**
   * Complete saga successfully
   */
  completeSaga(sagaId: string): Promise<void>;
  
  /**
   * Fail saga and initiate compensation if needed
   */
  failSaga(sagaId: string, error: string, requiresCompensation: boolean): Promise<void>;
  
  /**
   * Get saga context by ID
   */
  getSagaContext(sagaId: string): Promise<ComplaintSagaContext | null>;
  
  /**
   * Check if saga is stuck and needs intervention
   */
  checkStuckSagas(): Promise<ComplaintSagaContext[]>;
}

/**
 * Saga State Transitions
 */
export class ComplaintSagaStateTransitions {
  /**
   * Valid state transitions mapping
   */
  private static readonly VALID_TRANSITIONS: Record<ComplaintSagaStatus, ComplaintSagaStatus[]> = {
    [ComplaintSagaStatus.INITIATED]: [
      ComplaintSagaStatus.CUSTOMER_VALIDATING,
      ComplaintSagaStatus.FAILED
    ],
    [ComplaintSagaStatus.CUSTOMER_VALIDATING]: [
      ComplaintSagaStatus.ORDER_VERIFYING,
      ComplaintSagaStatus.RESOLUTION_PROCESSING,
      ComplaintSagaStatus.FAILED
    ],
    [ComplaintSagaStatus.ORDER_VERIFYING]: [
      ComplaintSagaStatus.RESOLUTION_PROCESSING,
      ComplaintSagaStatus.FAILED
    ],
    [ComplaintSagaStatus.RESOLUTION_PROCESSING]: [
      ComplaintSagaStatus.COMPLETED,
      ComplaintSagaStatus.COMPENSATING,
      ComplaintSagaStatus.FAILED
    ],
    [ComplaintSagaStatus.COMPENSATING]: [
      ComplaintSagaStatus.COMPENSATED,
      ComplaintSagaStatus.FAILED
    ],
    [ComplaintSagaStatus.COMPLETED]: [], // Terminal state
    [ComplaintSagaStatus.COMPENSATED]: [], // Terminal state
    [ComplaintSagaStatus.FAILED]: [] // Terminal state
  };
  
  /**
   * Check if state transition is valid
   */
  static isValidTransition(from: ComplaintSagaStatus, to: ComplaintSagaStatus): boolean {
    const allowedTransitions = this.VALID_TRANSITIONS[from];
    return allowedTransitions.includes(to);
  }
  
  /**
   * Get next possible states
   */
  static getNextStates(currentState: ComplaintSagaStatus): ComplaintSagaStatus[] {
    return this.VALID_TRANSITIONS[currentState] || [];
  }
  
  /**
   * Check if state is terminal
   */
  static isTerminalState(state: ComplaintSagaStatus): boolean {
    return this.VALID_TRANSITIONS[state].length === 0;
  }
}
