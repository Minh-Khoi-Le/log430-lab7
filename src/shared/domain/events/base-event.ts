import { v4 as uuidv4 } from 'uuid';
import { DomainEvent, EventMetadata } from './domain-events';

export abstract class BaseEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly metadata: EventMetadata;

  constructor(
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly eventType: string,
    public readonly eventData: any,
    correlationId?: string,
    causationId?: string,
    userId?: string,
    source: string = 'unknown'
  ) {
    this.eventId = uuidv4();
    this.metadata = {
      occurredOn: new Date(),
      version: 1,
      correlationId: correlationId || uuidv4(),
      causationId,
      userId,
      source
    };
  }

  public toJSON(): any {
    return {
      eventId: this.eventId,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      eventType: this.eventType,
      eventData: this.eventData,
      metadata: this.metadata
    };
  }

  public static fromJSON(data: any): DomainEvent {
    const event = Object.create(BaseEvent.prototype);
    Object.assign(event, data);
    return event;
  }
}