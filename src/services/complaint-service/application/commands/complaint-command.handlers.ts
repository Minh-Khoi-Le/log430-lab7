import { ComplaintRepository } from '../../domain/repositories/complaint.repository';
import { Complaint } from '../../domain/entities/complaint.entity';
import { IEventBus } from '@shared/infrastructure/messaging';
import { createLogger } from '@shared/infrastructure/logging';
import { v4 as uuidv4 } from 'uuid';
import { COMPLAINT_SAGA_EVENTS } from '@shared/domain/events/complaint-saga.events';
import {
  CreateComplaintDto,
  AssignComplaintDto,
  StartProcessingDto,
  ResolveComplaintDto,
  CloseComplaintDto,
  UpdatePriorityDto
} from '../dtos/complaint.dto';

const logger = createLogger('complaint-command-handlers');

export class ComplaintCommandHandlers {
  constructor(
    private readonly complaintRepository: ComplaintRepository,
    private readonly eventBus: IEventBus
  ) {}

  async createComplaint(command: CreateComplaintDto): Promise<string> {
    try {
      logger.info('Creating new complaint', { 
        userId: command.userId, 
        title: command.title,
        priority: command.priority,
        category: command.category
      });

      // Create complaint aggregate
      const complaint = Complaint.create({
        userId: command.userId,
        title: command.title,
        description: command.description,
        priority: command.priority,
        category: command.category
      });

      // Save to repository
      await this.complaintRepository.save(complaint);

      // Publish domain events
      await this.publishDomainEvents(complaint);

      // Initiate complaint saga for choreographed processing
      await this.initiateSaga(complaint, command);

      logger.info('Complaint created successfully', { 
        complaintId: complaint.id,
        userId: command.userId
      });

      return complaint.id;
    } catch (error) {
      logger.error('Failed to create complaint', error as Error, {
        userId: command.userId,
        title: command.title
      });
      throw error;
    }
  }

  async assignComplaint(command: AssignComplaintDto): Promise<void> {
    try {
      logger.info('Assigning complaint', {
        complaintId: command.complaintId,
        assignedTo: command.assignedTo,
        assignedBy: command.assignedBy
      });

      // Load complaint aggregate
      const complaint = await this.complaintRepository.findById(command.complaintId);
      if (!complaint) {
        throw new Error(`Complaint with ID ${command.complaintId} not found`);
      }

      // Execute business logic
      complaint.assign(command.assignedTo, command.assignedBy);

      // Save changes
      await this.complaintRepository.save(complaint);

      // Publish domain events
      await this.publishDomainEvents(complaint);

      logger.info('Complaint assigned successfully', {
        complaintId: command.complaintId,
        assignedTo: command.assignedTo
      });
    } catch (error) {
      logger.error('Failed to assign complaint', error as Error, {
        complaintId: command.complaintId,
        assignedTo: command.assignedTo
      });
      throw error;
    }
  }

  async startProcessing(command: StartProcessingDto): Promise<void> {
    try {
      logger.info('Starting complaint processing', {
        complaintId: command.complaintId,
        processedBy: command.processedBy
      });

      // Load complaint aggregate
      const complaint = await this.complaintRepository.findById(command.complaintId);
      if (!complaint) {
        throw new Error(`Complaint with ID ${command.complaintId} not found`);
      }

      // Execute business logic
      complaint.startProcessing(command.processedBy);

      // Save changes
      await this.complaintRepository.save(complaint);

      // Publish domain events
      await this.publishDomainEvents(complaint);

      logger.info('Complaint processing started successfully', {
        complaintId: command.complaintId,
        processedBy: command.processedBy
      });
    } catch (error) {
      logger.error('Failed to start complaint processing', error as Error, {
        complaintId: command.complaintId,
        processedBy: command.processedBy
      });
      throw error;
    }
  }

  async resolveComplaint(command: ResolveComplaintDto): Promise<void> {
    try {
      logger.info('Resolving complaint', {
        complaintId: command.complaintId,
        resolvedBy: command.resolvedBy
      });

      // Load complaint aggregate
      const complaint = await this.complaintRepository.findById(command.complaintId);
      if (!complaint) {
        throw new Error(`Complaint with ID ${command.complaintId} not found`);
      }

      // Execute business logic
      complaint.resolve(command.resolution, command.resolvedBy);

      // Save changes
      await this.complaintRepository.save(complaint);

      // Publish domain events
      await this.publishDomainEvents(complaint);

      logger.info('Complaint resolved successfully', {
        complaintId: command.complaintId,
        resolvedBy: command.resolvedBy
      });
    } catch (error) {
      logger.error('Failed to resolve complaint', error as Error, {
        complaintId: command.complaintId,
        resolvedBy: command.resolvedBy
      });
      throw error;
    }
  }

  async closeComplaint(command: CloseComplaintDto): Promise<void> {
    try {
      logger.info('Closing complaint', {
        complaintId: command.complaintId,
        closedBy: command.closedBy,
        closureReason: command.closureReason
      });

      // Load complaint aggregate
      const complaint = await this.complaintRepository.findById(command.complaintId);
      if (!complaint) {
        throw new Error(`Complaint with ID ${command.complaintId} not found`);
      }

      // Execute business logic
      complaint.close(command.closedBy, command.closureReason, command.customerSatisfaction);

      // Save changes
      await this.complaintRepository.save(complaint);

      // Publish domain events
      await this.publishDomainEvents(complaint);

      logger.info('Complaint closed successfully', {
        complaintId: command.complaintId,
        closedBy: command.closedBy
      });
    } catch (error) {
      logger.error('Failed to close complaint', error as Error, {
        complaintId: command.complaintId,
        closedBy: command.closedBy
      });
      throw error;
    }
  }

  async updatePriority(command: UpdatePriorityDto): Promise<void> {
    try {
      logger.info('Updating complaint priority', {
        complaintId: command.complaintId,
        newPriority: command.newPriority,
        updatedBy: command.updatedBy
      });

      // Load complaint aggregate
      const complaint = await this.complaintRepository.findById(command.complaintId);
      if (!complaint) {
        throw new Error(`Complaint with ID ${command.complaintId} not found`);
      }

      // Execute business logic
      complaint.updatePriority(command.newPriority, command.updatedBy);

      // Save changes
      await this.complaintRepository.save(complaint);

      // Publish domain events
      await this.publishDomainEvents(complaint);

      logger.info('Complaint priority updated successfully', {
        complaintId: command.complaintId,
        newPriority: command.newPriority
      });
    } catch (error) {
      logger.error('Failed to update complaint priority', error as Error, {
        complaintId: command.complaintId,
        newPriority: command.newPriority
      });
      throw error;
    }
  }

  /**
   * Initiate complaint saga for choreographed processing
   */
  private async initiateSaga(complaint: Complaint, command: CreateComplaintDto): Promise<void> {
    try {
      const correlationId = uuidv4();
      
      // Determine if saga processing is needed based on complaint characteristics
      const needsSagaProcessing = this.shouldInitiateSaga(complaint, command);
      
      if (!needsSagaProcessing) {
        logger.info('Complaint does not require saga processing', {
          complaintId: complaint.id,
          category: command.category,
          priority: command.priority
        });
        return;
      }

      // Create saga initiation event
      const sagaEvent = {
        eventId: uuidv4(),
        eventType: COMPLAINT_SAGA_EVENTS.SAGA_INITIATED,
        aggregateId: uuidv4(), // This will be the saga ID
        correlationId,
        timestamp: new Date(),
        version: 1,
        eventData: {
          complaintId: complaint.id,
          customerId: command.userId.toString(),
          orderId: command.orderId, // Optional order ID from command
          storeId: command.storeId || 1,
          complaintType: this.mapCategoryToComplaintType(command.category),
          priority: command.priority,
          description: command.description,
          requestedResolution: command.requestedResolution,
          amount: command.amount,
          initiatedAt: new Date()
        }
      };

      // Publish saga initiation event
      await this.eventBus.publish('complaint_saga', 'saga.initiated', sagaEvent as any);

      logger.info('Complaint saga initiated', {
        complaintId: complaint.id,
        sagaId: sagaEvent.aggregateId,
        correlationId,
        complaintType: sagaEvent.eventData.complaintType,
        priority: command.priority
      });

    } catch (error) {
      logger.error('Failed to initiate complaint saga', error as Error, {
        complaintId: complaint.id,
        userId: command.userId
      });
      // Don't throw here to avoid breaking the complaint creation
      // The complaint can still be processed manually if saga fails
    }
  }

  /**
   * Determine if a complaint should trigger saga processing
   */
  private shouldInitiateSaga(complaint: Complaint, command: CreateComplaintDto): boolean {
    // Business rules for when to initiate saga processing
    
    // Always initiate saga for high priority complaints
    if (command.priority === 'HIGH' || command.priority === 'CRITICAL') {
      return true;
    }

    // Initiate saga for complaints with financial implications
    if (command.requestedResolution && 
        ['REFUND', 'REPLACEMENT', 'STORE_CREDIT'].includes(command.requestedResolution)) {
      return true;
    }

    // Initiate saga for complaints related to orders
    if (command.orderId) {
      return true;
    }

    // Initiate saga for specific complaint categories
    const sagaCategories = ['PRODUCT_DEFECT', 'SERVICE_ISSUE', 'BILLING_DISPUTE', 'DELIVERY_ISSUE'];
    if (sagaCategories.includes(command.category)) {
      return true;
    }

    // For other cases, use regular complaint processing
    return false;
  }

  /**
   * Map complaint category to saga complaint type
   */
  private mapCategoryToComplaintType(category: string): 'PRODUCT_DEFECT' | 'SERVICE_ISSUE' | 'BILLING_DISPUTE' | 'DELIVERY_ISSUE' | 'OTHER' {
    const mapping: Record<string, 'PRODUCT_DEFECT' | 'SERVICE_ISSUE' | 'BILLING_DISPUTE' | 'DELIVERY_ISSUE' | 'OTHER'> = {
      'PRODUCT_DEFECT': 'PRODUCT_DEFECT',
      'SERVICE_ISSUE': 'SERVICE_ISSUE',
      'BILLING_DISPUTE': 'BILLING_DISPUTE',
      'DELIVERY_ISSUE': 'DELIVERY_ISSUE'
    };
    
    return mapping[category] || 'OTHER';
  }

  private async publishDomainEvents(complaint: Complaint): Promise<void> {
    const events = complaint.domainEvents;
    
    for (const event of events) {
      try {
        await this.eventBus.publish('complaints.events', event.eventType, event);
        logger.info('Domain event published', {
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          eventId: event.eventId
        });
      } catch (error) {
        logger.error('Failed to publish domain event', error as Error, {
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          eventId: event.eventId
        });
        // Don't throw here to avoid breaking the command execution
        // Consider implementing a retry mechanism or dead letter queue
      }
    }

    // Clear events after publishing
    complaint.clearDomainEvents();
  }
}