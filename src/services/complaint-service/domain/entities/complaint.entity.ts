import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from '@shared/infrastructure/messaging';

export type ComplaintStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ComplaintProps {
  id?: string;
  userId: string;
  title: string;
  description: string;
  priority: ComplaintPriority;
  category: string;
  status?: ComplaintStatus;
  assignedTo?: string;
  resolution?: string;
  createdAt?: Date;
  updatedAt?: Date;
  closedAt?: Date;
  version?: number;
}

// Complaint aggregate root implementing domain-driven design patterns
export class Complaint {
  private _id: string;
  private _userId: string;
  private _title: string;
  private _description: string;
  private _priority: ComplaintPriority;
  private _category: string;
  private _status: ComplaintStatus;
  private _assignedTo?: string;
  private _resolution?: string;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _closedAt?: Date;
  private _version: number;
  private _domainEvents: DomainEvent[] = [];

  constructor(props: ComplaintProps) {
    this._id = props.id || uuidv4();
    this._userId = props.userId;
    this._title = props.title;
    this._description = props.description;
    this._priority = props.priority;
    this._category = props.category;
    this._status = props.status || 'OPEN';
    this._assignedTo = props.assignedTo;
    this._resolution = props.resolution;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
    this._closedAt = props.closedAt;
    this._version = props.version || 1;

    // Validate business rules
    this.validateComplaint();
  }

  // Getters
  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get title(): string { return this._title; }
  get description(): string { return this._description; }
  get priority(): ComplaintPriority { return this._priority; }
  get category(): string { return this._category; }
  get status(): ComplaintStatus { return this._status; }
  get assignedTo(): string | undefined { return this._assignedTo; }
  get resolution(): string | undefined { return this._resolution; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get closedAt(): Date | undefined { return this._closedAt; }
  get version(): number { return this._version; }
  get domainEvents(): DomainEvent[] { return [...this._domainEvents]; }

  // Business methods with domain logic
  public assign(assignedTo: string, assignedBy: string): void {
    if (this._status === 'CLOSED') {
      throw new Error('Cannot assign a closed complaint');
    }

    if (!assignedTo || assignedTo.trim() === '') {
      throw new Error('Assigned user cannot be empty');
    }

    const previousAssignee = this._assignedTo;
    this._assignedTo = assignedTo;
    this._status = 'ASSIGNED';
    this._updatedAt = new Date();
    this._version++;

    // Raise domain event
    this.addDomainEvent({
      eventId: uuidv4(),
      aggregateId: this._id,
      aggregateType: 'Complaint',
      eventType: 'COMPLAINT_ASSIGNED',
      eventData: {
        complaintId: this._id,
        assignedTo,
        assignedBy,
        previousAssignee,
        assignedAt: this._updatedAt
      },
      metadata: {
        occurredOn: new Date(),
        version: this._version,
        correlationId: uuidv4(),
        source: 'complaint-service'
      }
    });
  }

  public startProcessing(processedBy: string): void {
    if (this._status === 'CLOSED') {
      throw new Error('Cannot process a closed complaint');
    }

    if (this._status === 'OPEN') {
      throw new Error('Complaint must be assigned before processing');
    }

    this._status = 'IN_PROGRESS';
    this._updatedAt = new Date();
    this._version++;

    // Raise domain event
    this.addDomainEvent({
      eventId: uuidv4(),
      aggregateId: this._id,
      aggregateType: 'Complaint',
      eventType: 'COMPLAINT_PROCESSING_STARTED',
      eventData: {
        complaintId: this._id,
        processedBy,
        startedAt: this._updatedAt
      },
      metadata: {
        occurredOn: new Date(),
        version: this._version,
        correlationId: uuidv4(),
        source: 'complaint-service'
      }
    });
  }

  public resolve(resolution: string, resolvedBy: string): void {
    if (this._status === 'CLOSED') {
      throw new Error('Cannot resolve a closed complaint');
    }

    if (!resolution || resolution.trim() === '') {
      throw new Error('Resolution cannot be empty');
    }

    this._resolution = resolution;
    this._status = 'RESOLVED';
    this._updatedAt = new Date();
    this._version++;

    // Raise domain event
    this.addDomainEvent({
      eventId: uuidv4(),
      aggregateId: this._id,
      aggregateType: 'Complaint',
      eventType: 'COMPLAINT_RESOLVED',
      eventData: {
        complaintId: this._id,
        resolution,
        resolvedBy,
        resolvedAt: this._updatedAt
      },
      metadata: {
        occurredOn: new Date(),
        version: this._version,
        correlationId: uuidv4(),
        source: 'complaint-service'
      }
    });
  }

  public close(closedBy: string, closureReason: string, customerSatisfaction?: number): void {
    if (this._status === 'CLOSED') {
      throw new Error('Complaint is already closed');
    }

    if (this._status !== 'RESOLVED') {
      throw new Error('Complaint must be resolved before closing');
    }

    this._status = 'CLOSED';
    this._closedAt = new Date();
    this._updatedAt = this._closedAt;
    this._version++;

    // Raise domain event
    this.addDomainEvent({
      eventId: uuidv4(),
      aggregateId: this._id,
      aggregateType: 'Complaint',
      eventType: 'COMPLAINT_CLOSED',
      eventData: {
        complaintId: this._id,
        closedBy,
        closureReason,
        customerSatisfaction,
        closedAt: this._closedAt
      },
      metadata: {
        occurredOn: new Date(),
        version: this._version,
        correlationId: uuidv4(),
        source: 'complaint-service'
      }
    });
  }

  public updatePriority(newPriority: ComplaintPriority, updatedBy: string): void {
    if (this._status === 'CLOSED') {
      throw new Error('Cannot update priority of a closed complaint');
    }

    const oldPriority = this._priority;
    this._priority = newPriority;
    this._updatedAt = new Date();
    this._version++;

    // Raise domain event
    this.addDomainEvent({
      eventId: uuidv4(),
      aggregateId: this._id,
      aggregateType: 'Complaint',
      eventType: 'COMPLAINT_PRIORITY_UPDATED',
      eventData: {
        complaintId: this._id,
        oldPriority,
        newPriority,
        updatedBy,
        updatedAt: this._updatedAt
      },
      metadata: {
        occurredOn: new Date(),
        version: this._version,
        correlationId: uuidv4(),
        source: 'complaint-service'
      }
    });
  }

  // Domain event management
  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  // Business rule validation
  private validateComplaint(): void {
    if (!this._userId || this._userId.trim() === '') {
      throw new Error('User ID is required');
    }

    if (!this._title || this._title.trim() === '') {
      throw new Error('Title is required');
    }

    if (this._title.length > 255) {
      throw new Error('Title cannot exceed 255 characters');
    }

    if (!this._description || this._description.trim() === '') {
      throw new Error('Description is required');
    }

    if (this._description.length > 2000) {
      throw new Error('Description cannot exceed 2000 characters');
    }

    if (!this._category || this._category.trim() === '') {
      throw new Error('Category is required');
    }

    const validPriorities: ComplaintPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validPriorities.includes(this._priority)) {
      throw new Error('Invalid priority level');
    }

    const validStatuses: ComplaintStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(this._status)) {
      throw new Error('Invalid status');
    }
  }

  // Factory method for creating new complaints
  public static create(props: Omit<ComplaintProps, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'version'>): Complaint {
    const complaint = new Complaint({
      ...props,
      status: 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    });

    // Raise domain event for complaint creation
    complaint.addDomainEvent({
      eventId: uuidv4(),
      aggregateId: complaint.id,
      aggregateType: 'Complaint',
      eventType: 'COMPLAINT_CREATED',
      eventData: {
        complaintId: complaint.id,
        userId: complaint.userId,
        title: complaint.title,
        description: complaint.description,
        priority: complaint.priority,
        category: complaint.category,
        createdAt: complaint.createdAt
      },
      metadata: {
        occurredOn: new Date(),
        version: 1,
        correlationId: uuidv4(),
        source: 'complaint-service'
      }
    });

    return complaint;
  }

  // Convert to plain object for persistence
  public toPlainObject(): ComplaintProps {
    return {
      id: this._id,
      userId: this._userId,
      title: this._title,
      description: this._description,
      priority: this._priority,
      category: this._category,
      status: this._status,
      assignedTo: this._assignedTo,
      resolution: this._resolution,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      closedAt: this._closedAt,
      version: this._version
    };
  }
}