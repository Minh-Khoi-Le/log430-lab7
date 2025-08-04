/**
 * Complaint Saga State Prisma Repository Implementation
 * 
 * Provides data access layer for complaint saga state persistence using Prisma ORM.
 * Handles CRUD operations for saga state tracking and context management.
 */

import { PrismaClient } from '@prisma/client';
import { 
  ComplaintSagaContext, 
  ComplaintSagaStatus, 
  ComplaintSagaStep,
  ComplaintSagaStateRepository
} from '../../../../shared/domain/saga/complaint-saga-state';

export class ComplaintSagaStatePrismaRepository implements ComplaintSagaStateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(context: ComplaintSagaContext): Promise<void> {
    await this.prisma.complaintSagaState.create({
      data: {
        sagaId: context.sagaId,
        complaintId: context.complaintId,
        correlationId: context.correlationId,
        customerId: context.customerId,
        orderId: context.orderId,
        storeId: context.storeId,
        initiatedAt: context.initiatedAt,
        completedAt: context.completedAt,
        status: context.status,
        currentStep: context.currentStep,
        version: context.version,
        contextData: JSON.parse(JSON.stringify({
          complaintData: context.complaintData,
          customerValidation: context.customerValidation,
          orderVerification: context.orderVerification,
          resolutionProcessing: context.resolutionProcessing,
          compensation: context.compensation,
          errors: context.errors,
          stepHistory: context.stepHistory
        }))
      }
    });
  }

  async findById(sagaId: string): Promise<ComplaintSagaContext | null> {
    const record = await this.prisma.complaintSagaState.findUnique({
      where: { sagaId }
    });

    if (!record) return null;

    return this.mapToComplaintSagaContext(record);
  }

  async findByCorrelationId(correlationId: string): Promise<ComplaintSagaContext | null> {
    const record = await this.prisma.complaintSagaState.findUnique({
      where: { correlationId }
    });

    if (!record) return null;

    return this.mapToComplaintSagaContext(record);
  }

  async findByComplaintId(complaintId: string): Promise<ComplaintSagaContext | null> {
    const record = await this.prisma.complaintSagaState.findFirst({
      where: { complaintId }
    });

    if (!record) return null;

    return this.mapToComplaintSagaContext(record);
  }

  async findActive(): Promise<ComplaintSagaContext[]> {
    const records = await this.prisma.complaintSagaState.findMany({
      where: {
        status: {
          in: [
            ComplaintSagaStatus.INITIATED,
            ComplaintSagaStatus.CUSTOMER_VALIDATING,
            ComplaintSagaStatus.ORDER_VERIFYING,
            ComplaintSagaStatus.RESOLUTION_PROCESSING,
            ComplaintSagaStatus.COMPENSATING
          ]
        }
      }
    });

    return records.map(record => this.mapToComplaintSagaContext(record));
  }

  async findActiveSagas(): Promise<ComplaintSagaContext[]> {
    return this.findActive();
  }

  async findByStatus(status: ComplaintSagaStatus): Promise<ComplaintSagaContext[]> {
    const records = await this.prisma.complaintSagaState.findMany({
      where: { status }
    });

    return records.map(record => this.mapToComplaintSagaContext(record));
  }

  async findStuckSagas(timeoutMinutes: number = 30): Promise<ComplaintSagaContext[]> {
    const timeoutDate = new Date();
    timeoutDate.setMinutes(timeoutDate.getMinutes() - timeoutMinutes);

    const records = await this.prisma.complaintSagaState.findMany({
      where: {
        status: {
          in: [
            ComplaintSagaStatus.INITIATED,
            ComplaintSagaStatus.CUSTOMER_VALIDATING,
            ComplaintSagaStatus.ORDER_VERIFYING,
            ComplaintSagaStatus.RESOLUTION_PROCESSING,
            ComplaintSagaStatus.COMPENSATING
          ]
        },
        updatedAt: {
          lt: timeoutDate
        }
      }
    });

    return records.map(record => this.mapToComplaintSagaContext(record));
  }

  async update(sagaId: string, updates: Partial<ComplaintSagaContext>): Promise<void> {
    // Get current state to merge with updates
    const current = await this.findById(sagaId);
    if (!current) {
      throw new Error(`Saga state not found: ${sagaId}`);
    }

    const merged = { ...current, ...updates };

    await this.prisma.complaintSagaState.update({
      where: { sagaId },
      data: {
        status: merged.status,
        currentStep: merged.currentStep,
        version: merged.version,
        completedAt: merged.completedAt,
        contextData: JSON.parse(JSON.stringify({
          complaintData: merged.complaintData,
          customerValidation: merged.customerValidation,
          orderVerification: merged.orderVerification,
          resolutionProcessing: merged.resolutionProcessing,
          compensation: merged.compensation,
          errors: merged.errors,
          stepHistory: merged.stepHistory
        }))
      }
    });
  }

  async markStepCompleted(
    sagaId: string, 
    step: ComplaintSagaStep, 
    success: boolean, 
    error?: string
  ): Promise<void> {
    const current = await this.findById(sagaId);
    if (!current) {
      throw new Error(`Saga state not found: ${sagaId}`);
    }

    // Add step execution to history
    const stepExecution = {
      step,
      startedAt: new Date(),
      completedAt: new Date(),
      success,
      error,
      duration: 0 // Could calculate actual duration if needed
    };

    const updatedHistory = [...current.stepHistory, stepExecution];

    await this.prisma.complaintSagaState.update({
      where: { sagaId },
      data: {
        currentStep: step,
        version: current.version + 1,
        contextData: JSON.parse(JSON.stringify({
          ...current,
          stepHistory: updatedHistory
        }))
      }
    });
  }

  async delete(sagaId: string): Promise<void> {
    await this.prisma.complaintSagaState.delete({
      where: { sagaId }
    });
  }

  private mapToComplaintSagaContext(record: any): ComplaintSagaContext {
    const contextData = record.contextData || {};
    
    return {
      sagaId: record.sagaId,
      complaintId: record.complaintId,
      correlationId: record.correlationId,
      customerId: record.customerId,
      orderId: record.orderId,
      storeId: record.storeId,
      initiatedAt: record.initiatedAt,
      completedAt: record.completedAt,
      status: record.status as ComplaintSagaStatus,
      currentStep: record.currentStep as ComplaintSagaStep,
      version: record.version,
      complaintData: contextData.complaintData || {
        type: 'OTHER',
        priority: 'MEDIUM',
        description: ''
      },
      customerValidation: contextData.customerValidation,
      orderVerification: contextData.orderVerification,
      resolutionProcessing: contextData.resolutionProcessing,
      compensation: contextData.compensation,
      errors: contextData.errors || [],
      stepHistory: contextData.stepHistory || []
    };
  }
}
