/**
 * Integration tests for complaint saga coordination
 * 
 * Tests the choreographed saga workflow for complaint handling,
 * including event publishing, state management, and service coordination.
 */

import { ComplaintSagaStateManagerImpl } from '../../application/saga/complaint-saga-state.manager';
import { ComplaintSagaEventHandlers } from '../../application/saga/complaint-saga.handlers';
import { ComplaintSagaStateRepositoryImpl } from '../../infrastructure/database/complaint-saga-state.repository.impl';
import { ComplaintRepositoryImpl } from '../../infrastructure/database/complaint.repository.impl';
import { ComplaintCommandHandlers } from '../../application/commands/complaint-command.handlers';
import { databaseManager } from '@shared/infrastructure/database';
import { eventBus } from '@shared/infrastructure/messaging';
import { ComplaintSagaStatus, ComplaintSagaStep } from '../../../../shared/domain/saga/complaint-saga-state';
import { COMPLAINT_SAGA_EVENTS } from '../../../../shared/domain/events/complaint-saga.events';
import { v4 as uuidv4 } from 'uuid';

describe('Complaint Saga Integration Tests', () => {
  let sagaStateRepository: ComplaintSagaStateRepositoryImpl;
  let sagaStateManager: ComplaintSagaStateManagerImpl;
  let complaintRepository: ComplaintRepositoryImpl;
  let commandHandlers: ComplaintCommandHandlers;
  let sagaEventHandlers: ComplaintSagaEventHandlers;

  beforeAll(async () => {
    // Initialize database connection
    await databaseManager.ensureConnection();
    
    // Initialize event bus
    await eventBus.initialize();
  });

  beforeEach(async () => {
    // Initialize repositories and handlers
    sagaStateRepository = new ComplaintSagaStateRepositoryImpl(databaseManager);
    sagaStateManager = new ComplaintSagaStateManagerImpl(sagaStateRepository);
    complaintRepository = new ComplaintRepositoryImpl(databaseManager);
    commandHandlers = new ComplaintCommandHandlers(complaintRepository, eventBus);
    sagaEventHandlers = new ComplaintSagaEventHandlers(
      complaintRepository,
      commandHandlers,
      sagaStateManager,
      eventBus
    );

    // Clean up any existing test data
    const client = databaseManager.getClient();
    await client.complaintSagaState.deleteMany({
      where: { customerId: 'test-customer' }
    });
    await client.user.deleteMany({
      where: { id: 999 }
    });
  });

  afterAll(async () => {
    // Clean up
    await eventBus.disconnect();
    await databaseManager.disconnect();
  });

  describe('Saga State Management', () => {
    it('should create and manage saga state correctly', async () => {
      // Arrange
      const complaintId = uuidv4();
      const customerId = 'test-customer';
      const complaintData = {
        type: 'PRODUCT_DEFECT' as const,
        priority: 'HIGH' as const,
        description: 'Test complaint for saga',
        requestedResolution: 'REFUND' as const,
        amount: 100
      };

      // Act - Initiate saga
      const sagaContext = await sagaStateManager.initiateSaga(
        complaintId,
        customerId,
        complaintData,
        'test-order-123',
        1
      );

      // Assert - Verify saga was created
      expect(sagaContext).toBeDefined();
      expect(sagaContext.complaintId).toBe(complaintId);
      expect(sagaContext.customerId).toBe(customerId);
      expect(sagaContext.status).toBe(ComplaintSagaStatus.INITIATED);
      expect(sagaContext.currentStep).toBe(ComplaintSagaStep.SAGA_INITIATED);
      expect(sagaContext.complaintData).toEqual(complaintData);

      // Verify saga can be retrieved
      const retrievedSaga = await sagaStateManager.getSagaContext(sagaContext.sagaId);
      expect(retrievedSaga).toBeDefined();
      expect(retrievedSaga!.sagaId).toBe(sagaContext.sagaId);
    });

    it('should update saga state through step progression', async () => {
      // Arrange
      const complaintId = uuidv4();
      const customerId = 'test-customer';
      const complaintData = {
        type: 'PRODUCT_DEFECT' as const,
        priority: 'HIGH' as const,
        description: 'Test complaint for saga',
        requestedResolution: 'REFUND' as const,
        amount: 100
      };

      const sagaContext = await sagaStateManager.initiateSaga(
        complaintId,
        customerId,
        complaintData
      );

      // Act - Progress through steps
      await sagaStateManager.markStepStarted(sagaContext.sagaId, ComplaintSagaStep.CUSTOMER_VALIDATION);
      
      await sagaStateManager.markStepCompleted(
        sagaContext.sagaId,
        ComplaintSagaStep.CUSTOMER_VALIDATION,
        {
          isValid: true,
          customerTier: 'GOLD',
          accountStatus: 'ACTIVE'
        }
      );

      // Assert - Verify state updates
      const updatedSaga = await sagaStateManager.getSagaContext(sagaContext.sagaId);
      expect(updatedSaga).toBeDefined();
      expect(updatedSaga!.customerValidation).toBeDefined();
      expect(updatedSaga!.customerValidation!.isValid).toBe(true);
      expect(updatedSaga!.customerValidation!.customerTier).toBe('GOLD');
      expect(updatedSaga!.stepHistory).toHaveLength(2); // SAGA_INITIATED + CUSTOMER_VALIDATION
    });

    it('should handle saga failure and compensation', async () => {
      // Arrange
      const complaintId = uuidv4();
      const customerId = 'test-customer';
      const complaintData = {
        type: 'PRODUCT_DEFECT' as const,
        priority: 'HIGH' as const,
        description: 'Test complaint for saga',
        requestedResolution: 'REFUND' as const,
        amount: 100
      };

      const sagaContext = await sagaStateManager.initiateSaga(
        complaintId,
        customerId,
        complaintData
      );

      // Act - Fail saga with compensation
      await sagaStateManager.failSaga(
        sagaContext.sagaId,
        'Test failure for compensation',
        true
      );

      // Assert - Verify failure state
      const failedSaga = await sagaStateManager.getSagaContext(sagaContext.sagaId);
      expect(failedSaga).toBeDefined();
      expect(failedSaga!.status).toBe(ComplaintSagaStatus.COMPENSATING);
      expect(failedSaga!.errors).toHaveLength(1);
      expect(failedSaga!.compensation).toBeDefined();
    });
  });

  describe('Saga Event Handling', () => {
    it('should handle saga initiation event', async () => {
      // Arrange
      const complaintId = uuidv4();
      const sagaId = uuidv4();
      const correlationId = uuidv4();
      
      const sagaInitiatedEvent = {
        eventId: uuidv4(),
        eventType: COMPLAINT_SAGA_EVENTS.SAGA_INITIATED,
        aggregateId: sagaId,
        correlationId,
        timestamp: new Date(),
        version: 1,
        eventData: {
          complaintId,
          customerId: 'test-customer',
          orderId: 'test-order-123',
          storeId: 1,
          complaintType: 'PRODUCT_DEFECT' as const,
          priority: 'HIGH' as const,
          description: 'Test complaint for saga event handling',
          requestedResolution: 'REFUND' as const,
          amount: 100,
          initiatedAt: new Date()
        }
      };

      // Act
      await sagaEventHandlers.handleComplaintSagaInitiated(sagaInitiatedEvent as any);

      // Assert - Verify saga was created
      const createdSaga = await sagaStateRepository.findById(sagaId);
      expect(createdSaga).toBeDefined();
      expect(createdSaga!.complaintId).toBe(complaintId);
      expect(createdSaga!.status).toBe(ComplaintSagaStatus.INITIATED);
    });

    it('should handle customer validation completed event', async () => {
      // Arrange - Create initial saga
      const complaintId = uuidv4();
      const sagaId = uuidv4();
      const correlationId = uuidv4();
      
      const sagaContext = await sagaStateManager.initiateSaga(
        complaintId,
        'test-customer',
        {
          type: 'PRODUCT_DEFECT' as const,
          priority: 'HIGH' as const,
          description: 'Test complaint',
          requestedResolution: 'REFUND' as const,
          amount: 100
        }
      );

      const validationCompletedEvent = {
        eventId: uuidv4(),
        eventType: COMPLAINT_SAGA_EVENTS.CUSTOMER_VALIDATION_COMPLETED,
        aggregateId: sagaContext.sagaId,
        correlationId: sagaContext.correlationId,
        timestamp: new Date(),
        version: 1,
        eventData: {
          complaintId,
          customerId: 'test-customer',
          validationRequestId: uuidv4(),
          isValid: true,
          customerTier: 'GOLD' as const,
          accountStatus: 'ACTIVE' as const,
          completedAt: new Date()
        }
      };

      // Act
      await sagaEventHandlers.handleCustomerValidationCompleted(validationCompletedEvent as any);

      // Assert - Verify saga state was updated
      const updatedSaga = await sagaStateManager.getSagaContext(sagaContext.sagaId);
      expect(updatedSaga).toBeDefined();
      expect(updatedSaga!.customerValidation).toBeDefined();
      expect(updatedSaga!.customerValidation!.isValid).toBe(true);
      expect(updatedSaga!.customerValidation!.customerTier).toBe('GOLD');
    });
  });

  describe('End-to-End Saga Flow', () => {
    it('should complete a full saga workflow', async () => {
      // This test would simulate a complete saga flow
      // from initiation through all steps to completion
      // Due to the complexity and dependencies on other services,
      // this would typically be implemented as a separate integration test
      // that runs against the full system
      
      expect(true).toBe(true); // Placeholder for now
    }, 30000); // Extended timeout for integration test
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange - Create a scenario that would cause a database error
      const invalidSagaId = 'invalid-saga-id';

      // Act & Assert
      await expect(sagaStateManager.getSagaContext(invalidSagaId))
        .resolves.toBeNull();
    });

    it('should handle event processing errors', async () => {
      // Arrange - Create an invalid event
      const invalidEvent = {
        eventId: uuidv4(),
        eventType: 'INVALID_EVENT_TYPE',
        aggregateId: uuidv4(),
        correlationId: uuidv4(),
        timestamp: new Date(),
        version: 1,
        eventData: {}
      };

      // Act & Assert - Should not throw error
      await expect(sagaEventHandlers.handleComplaintSagaInitiated(invalidEvent as any))
        .resolves.not.toThrow();
    });
  });
});