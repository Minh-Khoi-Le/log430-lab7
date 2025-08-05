import { IEventBus, EventHandler } from "./event-bus";
import { DomainEvent } from "../../domain/events/domain-events";
import { CorrelationContextManager } from "../logging/correlation-context";
import {
  EventPublishingInstrumentation,
  EventConsumptionInstrumentation,
} from "../metrics/event-instrumentation";
import { createLogger } from "../logging";

const logger = createLogger("instrumented-event-bus");

/**
 * Instrumented event bus wrapper that adds metrics and correlation context
 */
export class InstrumentedEventBus implements IEventBus {
  constructor(
    private readonly eventBus: IEventBus,
    private readonly serviceName: string
  ) {}

  async initialize(): Promise<void> {
    return this.eventBus.initialize();
  }

  async disconnect(): Promise<void> {
    return this.eventBus.disconnect();
  }

  isHealthy(): boolean {
    return this.eventBus.isHealthy();
  }

  async publish(
    exchange: string,
    routingKey: string,
    event: DomainEvent
  ): Promise<void> {
    const correlationId =
      event.metadata.correlationId ||
      CorrelationContextManager.generateCorrelationId();

    // Set correlation context for the event
    const context = CorrelationContextManager.createChildContext(
      event.eventId,
      {
        eventType: event.eventType,
        sagaId: event.metadata.sagaId,
        userId: event.metadata.userId,
      }
    );

    return CorrelationContextManager.runWithContext(context, async () => {
      return EventPublishingInstrumentation.instrumentPublish(
        this.serviceName,
        event.eventType,
        exchange,
        routingKey,
        correlationId,
        async () => {
          // Ensure event has correlation metadata
          const enrichedEvent: DomainEvent = {
            ...event,
            metadata: {
              ...event.metadata,
              correlationId,
              occurredOn: event.metadata.occurredOn || new Date(),
            },
          };

          return this.eventBus.publish(exchange, routingKey, enrichedEvent);
        }
      );
    });
  }

  async subscribe(
    queue: string,
    eventType: string,
    handler: EventHandler
  ): Promise<void> {
    // Wrap the handler with instrumentation and correlation context
    const instrumentedHandler: EventHandler = {
      handle: async (event: DomainEvent) => {
        const correlationId =
          event.metadata.correlationId ||
          CorrelationContextManager.generateCorrelationId();

        // Create correlation context from event metadata
        const context = CorrelationContextManager.fromEventMetadata({
          correlationId,
          causationId: event.eventId,
          userId: event.metadata.userId,
          sagaId: event.metadata.sagaId,
          eventType: event.eventType,
          timestamp:
            event.metadata.occurredOn?.toISOString() ||
            new Date().toISOString(),
        });

        return CorrelationContextManager.runWithContext(context, async () => {
          return EventConsumptionInstrumentation.instrumentConsumption(
            this.serviceName,
            eventType,
            queue,
            correlationId,
            async () => {
              return handler.handle(event);
            }
          );
        });
      },
    };

    return this.eventBus.subscribe(queue, eventType, instrumentedHandler);
  }

  async subscribeToAll(queue: string, handler: EventHandler): Promise<void> {
    // Wrap the handler with instrumentation and correlation context
    const instrumentedHandler: EventHandler = {
      handle: async (event: DomainEvent) => {
        const correlationId =
          event.metadata.correlationId ||
          CorrelationContextManager.generateCorrelationId();

        // Create correlation context from event metadata
        const context = CorrelationContextManager.fromEventMetadata({
          correlationId,
          causationId: event.eventId,
          userId: event.metadata.userId,
          sagaId: event.metadata.sagaId,
          eventType: event.eventType,
          timestamp:
            event.metadata.occurredOn?.toISOString() ||
            new Date().toISOString(),
        });

        return CorrelationContextManager.runWithContext(context, async () => {
          return EventConsumptionInstrumentation.instrumentConsumption(
            this.serviceName,
            event.eventType,
            queue,
            correlationId,
            async () => {
              return handler.handle(event);
            }
          );
        });
      },
    };

    return this.eventBus.subscribeToAll(queue, instrumentedHandler);
  }
}

/**
 * Factory function to create an instrumented event bus
 */
export function createInstrumentedEventBus(
  eventBus: IEventBus,
  serviceName: string
): InstrumentedEventBus {
  return new InstrumentedEventBus(eventBus, serviceName);
}
