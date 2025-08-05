import { EventEmitter } from 'events';
import { DomainEvent } from '../../domain/events/domain-events';
import { RabbitMQEventBus, EventHandler } from './rabbitmq-event-bus';
import { EventBusFactory } from './event-bus-factory';

// Legacy in-memory event bus for backward compatibility
class InMemoryEventBus {
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  publish(eventName: string, data: any): void {
    this.eventEmitter.emit(eventName, data);
  }

  subscribe(eventName: string, listener: (data: any) => void): void {
    this.eventEmitter.on(eventName, listener);
  }

  unsubscribe(eventName: string, listener: (data: any) => void): void {
    this.eventEmitter.off(eventName, listener);
  }
}

// Unified event bus interface
export interface IEventBus {
  publish(exchange: string, routingKey: string, event: DomainEvent): Promise<void>;
  subscribe(queue: string, eventType: string, handler: EventHandler): Promise<void>;
  subscribeToAll(queue: string, handler: EventHandler): Promise<void>;
  initialize(): Promise<void>;
  disconnect(): Promise<void>;
  isHealthy(): boolean;
}

// Hybrid event bus that supports both in-memory and RabbitMQ
class HybridEventBus implements IEventBus {
  private inMemoryBus: InMemoryEventBus;
  private rabbitMQBus: RabbitMQEventBus | null = null;
  private useRabbitMQ: boolean;

  constructor(useRabbitMQ: boolean = true) {
    this.inMemoryBus = new InMemoryEventBus();
    this.useRabbitMQ = useRabbitMQ;
    
    if (this.useRabbitMQ) {
      try {
        this.rabbitMQBus = EventBusFactory.createEventBusFromEnvironment();
      } catch (error) {
        console.warn('Failed to create RabbitMQ event bus, falling back to in-memory:', error);
        this.useRabbitMQ = false;
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.useRabbitMQ && this.rabbitMQBus) {
      try {
        await this.rabbitMQBus.initialize();
      } catch (error) {
        console.warn('Failed to initialize RabbitMQ, falling back to in-memory:', error);
        this.useRabbitMQ = false;
        this.rabbitMQBus = null;
      }
    }
  }

  async publish(exchange: string, routingKey: string, event: DomainEvent): Promise<void> {
    if (this.useRabbitMQ && this.rabbitMQBus) {
      await this.rabbitMQBus.publish(exchange, routingKey, event);
    } else {
      // Fallback to in-memory for backward compatibility
      this.inMemoryBus.publish(event.eventType, event);
    }
  }

  async subscribe(queue: string, eventType: string, handler: EventHandler): Promise<void> {
    if (this.useRabbitMQ && this.rabbitMQBus) {
      await this.rabbitMQBus.subscribe(queue, eventType, handler);
    } else {
      // Fallback to in-memory
      this.inMemoryBus.subscribe(eventType, (data) => handler.handle(data));
    }
  }

  async subscribeToAll(queue: string, handler: EventHandler): Promise<void> {
    if (this.useRabbitMQ && this.rabbitMQBus) {
      await this.rabbitMQBus.subscribeToAll(queue, handler);
    } else {
      // In-memory doesn't support "subscribe to all" easily, so we skip this
      console.warn('subscribeToAll not supported in in-memory mode');
    }
  }

  async disconnect(): Promise<void> {
    if (this.rabbitMQBus) {
      await this.rabbitMQBus.disconnect();
    }
  }

  isHealthy(): boolean {
    if (this.useRabbitMQ && this.rabbitMQBus) {
      return this.rabbitMQBus.isHealthy();
    }
    return true; // In-memory is always "healthy"
  }

  // Legacy methods for backward compatibility
  publishLegacy(eventName: string, data: any): void {
    this.inMemoryBus.publish(eventName, data);
  }

  subscribeLegacy(eventName: string, listener: (data: any) => void): void {
    this.inMemoryBus.subscribe(eventName, listener);
  }

  unsubscribeLegacy(eventName: string, listener: (data: any) => void): void {
    this.inMemoryBus.unsubscribe(eventName, listener);
  }
}

// Export singleton instances
export const eventBus = new HybridEventBus();
export const legacyEventBus = new InMemoryEventBus();

export { EventHandler };
