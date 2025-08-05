/**
 * Complaint Saga State Repository Implementation
 * 
 * Prisma implementation for storing and retrieving complaint saga state.
 * Uses JSONB columns for flexible state storage while maintaining relational integrity.
 */

import { DatabaseManager } from '../../../../shared/infrastructure/database/database-manager';
import { Logger } from '../../../../shared/infrastructure/logging/logger';
import {
  ComplaintSagaContext,
  ComplaintSagaStateRepository,
  ComplaintSagaStatus
} from '../../../../shared/domain/saga/complaint-saga-state';

const logger = new Logger({ serviceName: 'complaint-service' });

export class ComplaintSagaStateRepositoryImpl implements ComplaintSagaStateRepository {
  constructor(private readonly databaseManager: DatabaseManager) {}

  /**
   * Create a new saga state
   */
  async create(context: ComplaintSagaContext): Promise<void> {
    try {
      const client = this.databaseManager.getClient();
      
      await client.complaintSagaState.create({
        data: {
          sagaId: context.sagaId,
          complaintId: context.complaintId,
          correlationId: context.correlationId,
          customerId: context.customerId,
          orderId: context.orderId || null,
          storeId: context.storeId,
          initiatedAt: context.initiatedAt,
          completedAt: context.completedAt || null,
          status: context.status,
          currentStep: context.currentStep,
          version: context.version,
          complaintData: context.complaintData,
          customerValidation: context.customerValidation || undefined,
          orderVerification: context.orderVerification || undefined,
          resolutionProcessing: context.resolutionProcessing || undefined,
          compensation: context.compensation || undefined,
          errors: context.errors as any,
          stepHistory: context.stepHistory as any
        }
      });
      
      logger.info('Saga state created', {
        sagaId: context.sagaId,
        complaintId: context.complaintId,
        status: context.status
      });
    } catch (error) {
      logger.error('Failed to create saga state', error as Error, {
        sagaId: context.sagaId,
        complaintId: context.complaintId
      });
      throw error;
    }
  }

  /**
   * Update existing saga state
   */
  async update(sagaId: string, updates: Partial<ComplaintSagaContext>): Promise<void> {
    try {
      const client = this.databaseManager.getClient();
      
      // Build update data
      const updateData: any = {};
      
      if (updates.status !== undefined) {
        updateData.status = updates.status;
      }
      
      if (updates.currentStep !== undefined) {
        updateData.currentStep = updates.currentStep;
      }
      
      if (updates.version !== undefined) {
        updateData.version = updates.version;
      }
      
      if (updates.completedAt !== undefined) {
        updateData.completedAt = updates.completedAt;
      }

      if (updates.customerValidation !== undefined) {
        updateData.customerValidation = updates.customerValidation;
      }

      if (updates.orderVerification !== undefined) {
        updateData.orderVerification = updates.orderVerification;
      }

      if (updates.resolutionProcessing !== undefined) {
        updateData.resolutionProcessing = updates.resolutionProcessing;
      }

      if (updates.compensation !== undefined) {
        updateData.compensation = updates.compensation;
      }

      if (updates.errors !== undefined) {
        updateData.errors = updates.errors as any;
      }

      if (updates.stepHistory !== undefined) {
        updateData.stepHistory = updates.stepHistory as any;
      }

      if (Object.keys(updateData).length === 0) {
        logger.warn('No fields to update in saga state', { sagaId });
        return;
      }

      await client.complaintSagaState.update({
        where: { sagaId },
        data: updateData
      });

      logger.info('Saga state updated', {
        sagaId,
        updatedFields: Object.keys(updateData).length,
        newStatus: updates.status,
        newStep: updates.currentStep
      });
    } catch (error) {
      logger.error('Failed to update saga state', error as Error, {
        sagaId
      });
      throw error;
    }
  }

  /**
   * Find saga by ID
   */
  async findById(sagaId: string): Promise<ComplaintSagaContext | null> {
    try {
      const client = this.databaseManager.getClient();
      
      const result = await client.complaintSagaState.findUnique({
        where: { sagaId }
      });
      
      if (!result) {
        return null;
      }

      return this.mapPrismaToContext(result);
    } catch (error) {
      logger.error('Failed to find saga by ID', error as Error, { sagaId });
      throw error;
    }
  }

  /**
   * Find saga by complaint ID
   */
  async findByComplaintId(complaintId: string): Promise<ComplaintSagaContext | null> {
    try {
      const client = this.databaseManager.getClient();
      
      const result = await client.complaintSagaState.findFirst({
        where: { complaintId },
        orderBy: { initiatedAt: 'desc' }
      });
      
      if (!result) {
        return null;
      }

      return this.mapPrismaToContext(result);
    } catch (error) {
      logger.error('Failed to find saga by complaint ID', error as Error, { complaintId });
      throw error;
    }
  }

  /**
   * Find saga by correlation ID
   */
  async findByCorrelationId(correlationId: string): Promise<ComplaintSagaContext | null> {
    try {
      const client = this.databaseManager.getClient();
      
      const result = await client.complaintSagaState.findUnique({
        where: { correlationId }
      });
      
      if (!result) {
        return null;
      }

      return this.mapPrismaToContext(result);
    } catch (error) {
      logger.error('Failed to find saga by correlation ID', error as Error, { correlationId });
      throw error;
    }
  }

  /**
   * Find all active sagas
   */
  async findActiveSagas(): Promise<ComplaintSagaContext[]> {
    try {
      const client = this.databaseManager.getClient();
      
      const results = await client.complaintSagaState.findMany({
        where: {
          status: {
            notIn: ['COMPLETED', 'FAILED', 'COMPENSATED']
          }
        },
        orderBy: { initiatedAt: 'asc' }
      });
      
      return results.map(result => this.mapPrismaToContext(result));
    } catch (error) {
      logger.error('Failed to find active sagas', error as Error);
      throw error;
    }
  }

  /**
   * Find sagas by status
   */
  async findByStatus(status: ComplaintSagaStatus): Promise<ComplaintSagaContext[]> {
    try {
      const client = this.databaseManager.getClient();
      
      const results = await client.complaintSagaState.findMany({
        where: { status },
        orderBy: { initiatedAt: 'asc' }
      });
      
      return results.map(result => this.mapPrismaToContext(result));
    } catch (error) {
      logger.error('Failed to find sagas by status', error as Error, { status });
      throw error;
    }
  }

  /**
   * Find sagas that have been running longer than specified duration
   */
  async findStuckSagas(maxDurationMs: number): Promise<ComplaintSagaContext[]> {
    try {
      const client = this.databaseManager.getClient();
      const cutoffTime = new Date(Date.now() - maxDurationMs);

      const results = await client.complaintSagaState.findMany({
        where: {
          status: {
            notIn: ['COMPLETED', 'FAILED', 'COMPENSATED']
          },
          initiatedAt: {
            lt: cutoffTime
          }
        },
        orderBy: { initiatedAt: 'asc' }
      });
      
      return results.map(result => this.mapPrismaToContext(result));
    } catch (error) {
      logger.error('Failed to find stuck sagas', error as Error, { maxDurationMs });
      throw error;
    }
  }

  /**
   * Map Prisma result to ComplaintSagaContext
   */
  private mapPrismaToContext(row: any): ComplaintSagaContext {
    return {
      sagaId: row.sagaId,
      complaintId: row.complaintId,
      correlationId: row.correlationId,
      customerId: row.customerId,
      orderId: row.orderId,
      storeId: row.storeId,
      initiatedAt: row.initiatedAt,
      completedAt: row.completedAt,
      status: row.status,
      currentStep: row.currentStep,
      version: row.version,
      complaintData: row.complaintData as any,
      customerValidation: row.customerValidation as any || undefined,
      orderVerification: row.orderVerification as any || undefined,
      resolutionProcessing: row.resolutionProcessing as any || undefined,
      compensation: row.compensation as any || undefined,
      errors: (row.errors as any) || [],
      stepHistory: (row.stepHistory as any) || []
    };
  }
}