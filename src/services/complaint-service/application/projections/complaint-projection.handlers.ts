import { DomainEvent } from '@shared/infrastructure/messaging';
import { ComplaintViewRepository } from '../queries/repositories/complaint-view.repository';
import { ComplaintView, ComplaintTimelineEntry } from '../queries/models/complaint-view.model';
import { createLogger } from '@shared/infrastructure/logging';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('complaint-projection-handlers');

export class ComplaintProjectionHandlers {
  constructor(
    private readonly complaintViewRepository: ComplaintViewRepository
  ) {}

  async handleComplaintCreated(event: DomainEvent): Promise<void> {
    try {
      logger.info('Handling COMPLAINT_CREATED event', {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });

      const { eventData } = event;
      
      // Create new complaint view
      const complaintView: ComplaintView = {
        id: eventData.complaintId,
        userId: eventData.userId,
        title: eventData.title,
        description: eventData.description,
        priority: eventData.priority,
        category: eventData.category,
        status: 'OPEN',
        createdAt: eventData.createdAt,
        updatedAt: eventData.createdAt,
        version: 1
      };

      await this.complaintViewRepository.upsertComplaintView(complaintView);

      // Add timeline entry
      const timelineEntry: ComplaintTimelineEntry = {
        id: uuidv4(),
        complaintId: eventData.complaintId,
        timestamp: event.metadata.occurredOn,
        action: 'Complaint Created',
        actor: eventData.userId,
        details: `Complaint "${eventData.title}" was created with ${eventData.priority} priority`,
        eventType: event.eventType,
        eventData: eventData
      };

      await this.complaintViewRepository.addTimelineEntry(timelineEntry);

      logger.info('COMPLAINT_CREATED projection updated successfully', {
        complaintId: eventData.complaintId
      });
    } catch (error) {
      logger.error('Failed to handle COMPLAINT_CREATED event', error as Error, {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });
      throw error;
    }
  }

  async handleComplaintAssigned(event: DomainEvent): Promise<void> {
    try {
      logger.info('Handling COMPLAINT_ASSIGNED event', {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });

      const { eventData } = event;
      
      // Get existing complaint view
      const existingView = await this.complaintViewRepository.findById(eventData.complaintId);
      if (!existingView) {
        throw new Error(`Complaint view not found for ID: ${eventData.complaintId}`);
      }

      // Update complaint view
      const updatedView: ComplaintView = {
        ...existingView,
        status: 'ASSIGNED',
        assignedTo: eventData.assignedTo,
        updatedAt: eventData.assignedAt,
        version: existingView.version + 1
      };

      await this.complaintViewRepository.upsertComplaintView(updatedView);

      // Add timeline entry
      const timelineEntry: ComplaintTimelineEntry = {
        id: uuidv4(),
        complaintId: eventData.complaintId,
        timestamp: event.metadata.occurredOn,
        action: 'Complaint Assigned',
        actor: eventData.assignedBy,
        details: `Complaint assigned to ${eventData.assignedTo}${eventData.previousAssignee ? ` (previously assigned to ${eventData.previousAssignee})` : ''}`,
        eventType: event.eventType,
        eventData: eventData
      };

      await this.complaintViewRepository.addTimelineEntry(timelineEntry);

      logger.info('COMPLAINT_ASSIGNED projection updated successfully', {
        complaintId: eventData.complaintId,
        assignedTo: eventData.assignedTo
      });
    } catch (error) {
      logger.error('Failed to handle COMPLAINT_ASSIGNED event', error as Error, {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });
      throw error;
    }
  }

  async handleComplaintProcessingStarted(event: DomainEvent): Promise<void> {
    try {
      logger.info('Handling COMPLAINT_PROCESSING_STARTED event', {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });

      const { eventData } = event;
      
      // Get existing complaint view
      const existingView = await this.complaintViewRepository.findById(eventData.complaintId);
      if (!existingView) {
        throw new Error(`Complaint view not found for ID: ${eventData.complaintId}`);
      }

      // Update complaint view
      const updatedView: ComplaintView = {
        ...existingView,
        status: 'IN_PROGRESS',
        updatedAt: eventData.startedAt,
        version: existingView.version + 1
      };

      await this.complaintViewRepository.upsertComplaintView(updatedView);

      // Add timeline entry
      const timelineEntry: ComplaintTimelineEntry = {
        id: uuidv4(),
        complaintId: eventData.complaintId,
        timestamp: event.metadata.occurredOn,
        action: 'Processing Started',
        actor: eventData.processedBy,
        details: `Complaint processing started by ${eventData.processedBy}`,
        eventType: event.eventType,
        eventData: eventData
      };

      await this.complaintViewRepository.addTimelineEntry(timelineEntry);

      logger.info('COMPLAINT_PROCESSING_STARTED projection updated successfully', {
        complaintId: eventData.complaintId,
        processedBy: eventData.processedBy
      });
    } catch (error) {
      logger.error('Failed to handle COMPLAINT_PROCESSING_STARTED event', error as Error, {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });
      throw error;
    }
  }

  async handleComplaintResolved(event: DomainEvent): Promise<void> {
    try {
      logger.info('Handling COMPLAINT_RESOLVED event', {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });

      const { eventData } = event;
      
      // Get existing complaint view
      const existingView = await this.complaintViewRepository.findById(eventData.complaintId);
      if (!existingView) {
        throw new Error(`Complaint view not found for ID: ${eventData.complaintId}`);
      }

      // Update complaint view
      const updatedView: ComplaintView = {
        ...existingView,
        status: 'RESOLVED',
        resolution: eventData.resolution,
        updatedAt: eventData.resolvedAt,
        version: existingView.version + 1
      };

      await this.complaintViewRepository.upsertComplaintView(updatedView);

      // Add timeline entry
      const timelineEntry: ComplaintTimelineEntry = {
        id: uuidv4(),
        complaintId: eventData.complaintId,
        timestamp: event.metadata.occurredOn,
        action: 'Complaint Resolved',
        actor: eventData.resolvedBy,
        details: `Complaint resolved by ${eventData.resolvedBy}: ${eventData.resolution}`,
        eventType: event.eventType,
        eventData: eventData
      };

      await this.complaintViewRepository.addTimelineEntry(timelineEntry);

      logger.info('COMPLAINT_RESOLVED projection updated successfully', {
        complaintId: eventData.complaintId,
        resolvedBy: eventData.resolvedBy
      });
    } catch (error) {
      logger.error('Failed to handle COMPLAINT_RESOLVED event', error as Error, {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });
      throw error;
    }
  }

  async handleComplaintClosed(event: DomainEvent): Promise<void> {
    try {
      logger.info('Handling COMPLAINT_CLOSED event', {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });

      const { eventData } = event;
      
      // Get existing complaint view
      const existingView = await this.complaintViewRepository.findById(eventData.complaintId);
      if (!existingView) {
        throw new Error(`Complaint view not found for ID: ${eventData.complaintId}`);
      }

      // Update complaint view
      const updatedView: ComplaintView = {
        ...existingView,
        status: 'CLOSED',
        closedAt: eventData.closedAt,
        updatedAt: eventData.closedAt,
        version: existingView.version + 1
      };

      await this.complaintViewRepository.upsertComplaintView(updatedView);

      // Add timeline entry
      const timelineEntry: ComplaintTimelineEntry = {
        id: uuidv4(),
        complaintId: eventData.complaintId,
        timestamp: event.metadata.occurredOn,
        action: 'Complaint Closed',
        actor: eventData.closedBy,
        details: `Complaint closed by ${eventData.closedBy}. Reason: ${eventData.closureReason}${eventData.customerSatisfaction ? `. Customer satisfaction: ${eventData.customerSatisfaction}/5` : ''}`,
        eventType: event.eventType,
        eventData: eventData
      };

      await this.complaintViewRepository.addTimelineEntry(timelineEntry);

      logger.info('COMPLAINT_CLOSED projection updated successfully', {
        complaintId: eventData.complaintId,
        closedBy: eventData.closedBy
      });
    } catch (error) {
      logger.error('Failed to handle COMPLAINT_CLOSED event', error as Error, {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });
      throw error;
    }
  }

  async handleComplaintPriorityUpdated(event: DomainEvent): Promise<void> {
    try {
      logger.info('Handling COMPLAINT_PRIORITY_UPDATED event', {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });

      const { eventData } = event;
      
      // Get existing complaint view
      const existingView = await this.complaintViewRepository.findById(eventData.complaintId);
      if (!existingView) {
        throw new Error(`Complaint view not found for ID: ${eventData.complaintId}`);
      }

      // Update complaint view
      const updatedView: ComplaintView = {
        ...existingView,
        priority: eventData.newPriority,
        updatedAt: eventData.updatedAt,
        version: existingView.version + 1
      };

      await this.complaintViewRepository.upsertComplaintView(updatedView);

      // Add timeline entry
      const timelineEntry: ComplaintTimelineEntry = {
        id: uuidv4(),
        complaintId: eventData.complaintId,
        timestamp: event.metadata.occurredOn,
        action: 'Priority Updated',
        actor: eventData.updatedBy,
        details: `Priority changed from ${eventData.oldPriority} to ${eventData.newPriority} by ${eventData.updatedBy}`,
        eventType: event.eventType,
        eventData: eventData
      };

      await this.complaintViewRepository.addTimelineEntry(timelineEntry);

      logger.info('COMPLAINT_PRIORITY_UPDATED projection updated successfully', {
        complaintId: eventData.complaintId,
        newPriority: eventData.newPriority
      });
    } catch (error) {
      logger.error('Failed to handle COMPLAINT_PRIORITY_UPDATED event', error as Error, {
        eventId: event.eventId,
        aggregateId: event.aggregateId
      });
      throw error;
    }
  }

  // Event router to handle different event types
  async handleEvent(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'COMPLAINT_CREATED':
        await this.handleComplaintCreated(event);
        break;
      case 'COMPLAINT_ASSIGNED':
        await this.handleComplaintAssigned(event);
        break;
      case 'COMPLAINT_PROCESSING_STARTED':
        await this.handleComplaintProcessingStarted(event);
        break;
      case 'COMPLAINT_RESOLVED':
        await this.handleComplaintResolved(event);
        break;
      case 'COMPLAINT_CLOSED':
        await this.handleComplaintClosed(event);
        break;
      case 'COMPLAINT_PRIORITY_UPDATED':
        await this.handleComplaintPriorityUpdated(event);
        break;
      default:
        logger.warn('Unknown event type received', {
          eventType: event.eventType,
          eventId: event.eventId,
          aggregateId: event.aggregateId
        });
    }
  }
}