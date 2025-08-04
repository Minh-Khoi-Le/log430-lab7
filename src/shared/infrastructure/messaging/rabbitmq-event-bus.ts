import { DomainEvent } from '../../domain/events/domain-events';
import { RabbitMQConnection, RabbitMQConfig } from './rabbitmq-connection';
import { Buffer } from 'buffer';
import * as amqp from 'amqplib';

export interface EventHandler {
  handle(event: DomainEvent): Promise<void>;
}

export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  queue: string;
}

export class RabbitMQEventBus {
  private readonly connection: RabbitMQConnection;
  private readonly subscriptions: Map<string, EventSubscription[]> = new Map();
  private isInitialized = false;

  constructor(config: RabbitMQConfig) {
    this.connection = new RabbitMQConnection(config);
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    await this.connection.connect();
    this.isInitialized = true;
  }

  public async publish(
    exchange: string,
    routingKey: string,
    event: DomainEvent
  ): Promise<void> {
    try {
      await this.connection.ensureConnection();
      const channel = this.connection.getChannel();

      const message = Buffer.from(JSON.stringify(event));
      const options = {
        persistent: true,
        messageId: event.eventId,
        correlationId: event.metadata.correlationId,
        timestamp: event.metadata.occurredOn.getTime(),
        headers: {
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          source: event.metadata.source
        }
      };

      const published = channel.publish(exchange, routingKey, message, options);

      if (!published) {
        throw new Error(`Failed to publish event ${event.eventId} to exchange ${exchange}`);
      }

      console.log(`Event published: ${event.eventType} (${event.eventId}) to ${exchange}/${routingKey}`);
    } catch (error) {
      console.error('Error publishing event:', error);
      throw error;
    }
  }

  public async subscribe(
    queue: string,
    eventType: string,
    handler: EventHandler
  ): Promise<void> {
    try {
      await this.connection.ensureConnection();
      const channel = this.connection.getChannel();

      // Store subscription for management
      if (!this.subscriptions.has(queue)) {
        this.subscriptions.set(queue, []);
      }
      this.subscriptions.get(queue)!.push({ eventType, handler, queue });

      // Set up consumer
      await channel.consume(
        queue,
        async (msg: amqp.ConsumeMessage | null) => {
          if (!msg) {
            return;
          }

          try {
            const event: DomainEvent = JSON.parse(msg.content.toString());

            // Check if this handler should process this event type
            if (event.eventType === eventType || eventType === '*') {
              console.log(`Processing event: ${event.eventType} (${event.eventId}) in queue ${queue}`);
              await handler.handle(event);
              channel.ack(msg);
            } else {
              // Not for this handler, acknowledge anyway to remove from queue
              channel.ack(msg);
            }
          } catch (error) {
            console.error(`Error processing event in queue ${queue}:`, error);

            // Check if message has been retried too many times
            const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;
            const maxRetries = 3;

            if (retryCount < maxRetries) {
              // Retry with exponential backoff
              const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
              setTimeout(() => {
                channel.nack(msg, false, true);
              }, delay);
            } else {
              // Max retries exceeded, send to dead letter queue or acknowledge
              console.error(`Max retries exceeded for message ${msg.properties.messageId}, acknowledging to prevent infinite loop`);
              channel.ack(msg);
            }
          }
        },
        { noAck: false }
      );

      console.log(`Subscribed to queue ${queue} for event type ${eventType}`);
    } catch (error) {
      console.error('Error setting up subscription:', error);
      throw error;
    }
  }

  public async subscribeToAll(
    queue: string,
    handler: EventHandler
  ): Promise<void> {
    await this.subscribe(queue, '*', handler);
  }

  public getSubscriptions(): Map<string, EventSubscription[]> {
    return new Map(this.subscriptions);
  }

  public async disconnect(): Promise<void> {
    await this.connection.disconnect();
    this.subscriptions.clear();
    this.isInitialized = false;
  }

  public isHealthy(): boolean {
    return this.isInitialized && this.connection.isConnectionHealthy();
  }
}
