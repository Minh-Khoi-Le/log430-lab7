import { v4 as uuidv4 } from 'uuid';
import { DomainEvent, EventMetadata } from './domain-events';

export class EventFactory {
  public static createEvent(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    eventData: any,
    options: {
      correlationId?: string;
      causationId?: string;
      userId?: string;
      source?: string;
      version?: number;
    } = {}
  ): DomainEvent {
    const {
      correlationId = uuidv4(),
      causationId,
      userId,
      source = 'unknown',
      version = 1
    } = options;

    const metadata: EventMetadata = {
      occurredOn: new Date(),
      version,
      correlationId,
      causationId,
      userId,
      source
    };

    return {
      eventId: uuidv4(),
      aggregateId,
      aggregateType,
      eventType,
      eventData,
      metadata
    };
  }

  public static createCorrelatedEvent(
    parentEvent: DomainEvent,
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    eventData: any,
    source: string = 'unknown'
  ): DomainEvent {
    return this.createEvent(
      aggregateId,
      aggregateType,
      eventType,
      eventData,
      {
        correlationId: parentEvent.metadata.correlationId,
        causationId: parentEvent.eventId,
        userId: parentEvent.metadata.userId,
        source
      }
    );
  }
}