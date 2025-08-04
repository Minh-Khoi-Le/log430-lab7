/**
 * Example usage of the new RabbitMQ-based event bus
 * This file demonstrates how to use the messaging infrastructure
 */

import { eventBus, EventFactory, EventHandler, DomainEvent } from './index';

// Example event handler
class ExampleEventHandler implements EventHandler {
  async handle(event: DomainEvent): Promise<void> {
    console.log(`Handling event: ${event.eventType}`, {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      occurredOn: event.metadata.occurredOn,
      correlationId: event.metadata.correlationId
    });
    
    // Process the event data
    console.log('Event data:', event.eventData);
  }
}

// Example usage function
export async function demonstrateEventBusUsage(): Promise<void> {
  try {
    // Initialize the event bus
    console.log('Initializing event bus...');
    await eventBus.initialize();
    
    // Create an event handler
    const handler = new ExampleEventHandler();
    
    // Subscribe to specific event types
    await eventBus.subscribe('example.queue', 'EXAMPLE_EVENT', handler);
    
    // Create and publish an event
    const exampleEvent = EventFactory.createEvent(
      'example-aggregate-123',
      'ExampleAggregate',
      'EXAMPLE_EVENT',
      {
        message: 'Hello from the event bus!',
        timestamp: new Date(),
        data: { key: 'value' }
      },
      {
        source: 'example-service',
        userId: 'user-123'
      }
    );
    
    // Publish the event
    console.log('Publishing event...');
    await eventBus.publish('complaints.events', 'example.event', exampleEvent);
    
    console.log('Event published successfully!');
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check health
    const isHealthy = eventBus.isHealthy();
    console.log('Event bus health:', isHealthy ? 'Healthy' : 'Unhealthy');
    
  } catch (error) {
    console.error('Error demonstrating event bus usage:', error);
  }
}

// Example of creating correlated events (for saga patterns)
export function demonstrateCorrelatedEvents(): void {
  // Create an initial event
  const initialEvent = EventFactory.createEvent(
    'complaint-123',
    'Complaint',
    'COMPLAINT_CREATED',
    {
      title: 'Product defect',
      description: 'The product arrived damaged',
      userId: 'user-456'
    },
    {
      source: 'complaint-service',
      userId: 'user-456'
    }
  );
  
  // Create a correlated event (e.g., for saga coordination)
  const correlatedEvent = EventFactory.createCorrelatedEvent(
    initialEvent,
    'notification-789',
    'Notification',
    'NOTIFICATION_REQUIRED',
    {
      type: 'email',
      recipient: 'user@example.com',
      template: 'complaint-created'
    },
    'notification-service'
  );
  
  console.log('Initial event:', {
    eventId: initialEvent.eventId,
    correlationId: initialEvent.metadata.correlationId
  });
  
  console.log('Correlated event:', {
    eventId: correlatedEvent.eventId,
    correlationId: correlatedEvent.metadata.correlationId,
    causationId: correlatedEvent.metadata.causationId
  });
  
  // Both events will have the same correlationId but different eventIds
  // The correlated event will have the initial event's ID as its causationId
}