import amqp, { Connection, Channel } from 'amqplib';

export interface RabbitMQConfig {
  url: string;
  exchanges: {
    name: string;
    type: 'direct' | 'topic' | 'fanout' | 'headers';
    options?: amqp.Options.AssertExchange;
  }[];
  queues: {
    name: string;
    exchange: string;
    routingKey: string;
    options?: amqp.Options.AssertQueue;
  }[];
}

export class RabbitMQConnection {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;

  constructor(private config: RabbitMQConfig) {}

  public async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.config.url);
      this.channel = await this.connection.createChannel();
      
      // Set up error handlers
      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        console.log('RabbitMQ connection closed');
        this.isConnected = false;
      });

      // Create exchanges
      for (const exchange of this.config.exchanges) {
        await this.channel.assertExchange(
          exchange.name,
          exchange.type,
          exchange.options || { durable: true }
        );
      }

      // Create queues and bind them to exchanges
      for (const queue of this.config.queues) {
        await this.channel.assertQueue(
          queue.name,
          queue.options || { durable: true }
        );
        await this.channel.bindQueue(
          queue.name,
          queue.exchange,
          queue.routingKey
        );
      }

      this.isConnected = true;
      console.log('RabbitMQ connected and configured successfully');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.isConnected = false;
      console.log('RabbitMQ disconnected');
    } catch (error) {
      console.error('Error disconnecting from RabbitMQ:', error);
    }
  }

  public getChannel(): Channel {
    if (!this.channel || !this.isConnected) {
      throw new Error('RabbitMQ channel not available. Make sure to connect first.');
    }
    return this.channel;
  }

  public isConnectionHealthy(): boolean {
    return this.isConnected && this.connection !== null && this.channel !== null;
  }

  public async ensureConnection(): Promise<void> {
    if (!this.isConnectionHealthy()) {
      await this.connect();
    }
  }
}