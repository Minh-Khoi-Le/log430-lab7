import { RabbitMQEventBus } from './rabbitmq-event-bus';
import { RabbitMQConfig } from './rabbitmq-connection';

export class EventBusFactory {
  public static createRabbitMQEventBus(
    rabbitmqUrl: string = 'amqp://admin:admin123@localhost:5672'
  ): RabbitMQEventBus {
    const config: RabbitMQConfig = {
      url: rabbitmqUrl,
      exchanges: [
        {
          name: 'complaints.events',
          type: 'topic',
          options: { durable: true }
        },
        {
          name: 'notifications.events',
          type: 'topic',
          options: { durable: true }
        },
        {
          name: 'audit.events',
          type: 'topic',
          options: { durable: true }
        },
        {
          name: 'saga.events',
          type: 'topic',
          options: { durable: true }
        },
        {
          name: 'inventory.events',
          type: 'topic',
          options: { durable: true }
        },
        {
          name: 'sales.events',
          type: 'topic',
          options: { durable: true }
        }
      ],
      queues: [
        // Complaint service queues
        {
          name: 'complaint.commands',
          exchange: 'complaints.events',
          routingKey: 'complaint.command.*',
          options: { durable: true }
        },
        {
          name: 'complaint.events',
          exchange: 'complaints.events',
          routingKey: 'complaint.event.*',
          options: { durable: true }
        },
        
        // Notification service queues
        {
          name: 'notification.events',
          exchange: 'notifications.events',
          routingKey: 'notification.*',
          options: { durable: true }
        },
        {
          name: 'complaint.notifications',
          exchange: 'complaints.events',
          routingKey: 'complaint.event.*',
          options: { durable: true }
        },
        
        // Audit service queues
        {
          name: 'audit.events',
          exchange: 'audit.events',
          routingKey: 'audit.*',
          options: { durable: true }
        },
        {
          name: 'audit.all.events',
          exchange: 'complaints.events',
          routingKey: '*',
          options: { durable: true }
        },
        
        // Saga coordination queues
        {
          name: 'saga.events',
          exchange: 'saga.events',
          routingKey: 'saga.*',
          options: { durable: true }
        },
        {
          name: 'saga.compensation',
          exchange: 'saga.events',
          routingKey: 'saga.compensation.*',
          options: { durable: true }
        },
        
        // Existing inventory and sales queues
        {
          name: 'inventory.events',
          exchange: 'inventory.events',
          routingKey: 'inventory.*',
          options: { durable: true }
        },
        {
          name: 'sales.events',
          exchange: 'sales.events',
          routingKey: 'sales.*',
          options: { durable: true }
        }
      ]
    };

    return new RabbitMQEventBus(config);
  }

  public static createEventBusFromEnvironment(): RabbitMQEventBus {
    const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672';
    return this.createRabbitMQEventBus(rabbitmqUrl);
  }
}