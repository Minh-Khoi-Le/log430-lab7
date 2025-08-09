const amqp = require('amqplib');

async function setupRabbitMQ() {
  let connection;
  try {
    // Connect to RabbitMQ
    console.log('Connecting to RabbitMQ...');
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672');
    const channel = await connection.createChannel();
    
    console.log('Connected to RabbitMQ successfully');

    // Declare exchanges
    const exchanges = [
      { name: 'domain-events', type: 'topic' },
      { name: 'saga-events', type: 'topic' },
      { name: 'notification-events', type: 'direct' },
      { name: 'audit-events', type: 'fanout' }
    ];

    for (const exchange of exchanges) {
      await channel.assertExchange(exchange.name, exchange.type, { durable: true });
      console.log(`Exchange '${exchange.name}' (${exchange.type}) declared`);
    }

    // Declare queues with their configurations
    const queues = [
      // Transaction Service Queues
      { name: 'transaction-service-events', durable: true, exclusive: false, autoDelete: false },
      { name: 'transaction-service-saga-events', durable: true, exclusive: false, autoDelete: false },
      
      // User Service Queues
      { name: 'user-service-events', durable: true, exclusive: false, autoDelete: false },
      { name: 'user-service-saga-events', durable: true, exclusive: false, autoDelete: false },
      
      // Catalog Service Queues
      { name: 'catalog-service-events', durable: true, exclusive: false, autoDelete: false },
      { name: 'catalog-service-saga-events', durable: true, exclusive: false, autoDelete: false },
      
      // Complaint Service Queues
      { name: 'complaint-service-events', durable: true, exclusive: false, autoDelete: false },
      { name: 'complaint-service-saga-events', durable: true, exclusive: false, autoDelete: false },
      
      // Notification Service Queues
      { name: 'notification-service-events', durable: true, exclusive: false, autoDelete: false },
      { name: 'email-notifications', durable: true, exclusive: false, autoDelete: false },
      { name: 'sms-notifications', durable: true, exclusive: false, autoDelete: false },
      
      // Audit Service Queues
      { name: 'audit-service-events', durable: true, exclusive: false, autoDelete: false },
      { name: 'audit-service-all-events', durable: true, exclusive: false, autoDelete: false },
      
      // Event Store Service Queues
      { name: 'event-store-service-events', durable: true, exclusive: false, autoDelete: false },
      
      // Saga Orchestrator Queues
      { name: 'saga-orchestrator-events', durable: true, exclusive: false, autoDelete: false },
      { name: 'saga-commands', durable: true, exclusive: false, autoDelete: false },
      { name: 'saga-replies', durable: true, exclusive: false, autoDelete: false },
      
      // Dead Letter Queues
      { name: 'dead-letter-queue', durable: true, exclusive: false, autoDelete: false },
      { name: 'failed-events', durable: true, exclusive: false, autoDelete: false }
    ];

    for (const queue of queues) {
      try {
        // Create a new channel for each queue to avoid channel closure issues
        const queueChannel = await connection.createChannel();
        await queueChannel.assertQueue(queue.name, {
          durable: queue.durable,
          exclusive: queue.exclusive,
          autoDelete: queue.autoDelete
        });
        await queueChannel.close();
        console.log(`Queue '${queue.name}' declared`);
      } catch (error) {
        // If queue already exists, skip it
        console.log(`Warning: Queue '${queue.name}' may already exist or have different properties: ${error.message}`);
      }
    }

    // Bind queues to exchanges
    const bindings = [
      // Domain events bindings
      { queue: 'transaction-service-events', exchange: 'domain-events', routingKey: 'transaction.*' },
      { queue: 'user-service-events', exchange: 'domain-events', routingKey: 'user.*' },
      { queue: 'catalog-service-events', exchange: 'domain-events', routingKey: 'catalog.*' },
      { queue: 'complaint-service-events', exchange: 'domain-events', routingKey: 'complaint.*' },
      { queue: 'notification-service-events', exchange: 'domain-events', routingKey: 'notification.*' },
      { queue: 'event-store-service-events', exchange: 'domain-events', routingKey: '*' },
      
      // Saga events bindings
      { queue: 'transaction-service-saga-events', exchange: 'saga-events', routingKey: 'saga.transaction.*' },
      { queue: 'user-service-saga-events', exchange: 'saga-events', routingKey: 'saga.user.*' },
      { queue: 'catalog-service-saga-events', exchange: 'saga-events', routingKey: 'saga.catalog.*' },
      { queue: 'complaint-service-saga-events', exchange: 'saga-events', routingKey: 'saga.complaint.*' },
      { queue: 'saga-orchestrator-events', exchange: 'saga-events', routingKey: 'saga.*' },
      
      // Notification bindings
      { queue: 'email-notifications', exchange: 'notification-events', routingKey: 'email' },
      { queue: 'sms-notifications', exchange: 'notification-events', routingKey: 'sms' },
      
      // Audit bindings (fanout - all events go to audit)
      { queue: 'audit-service-all-events', exchange: 'audit-events', routingKey: '' },
      
      // Cross-service event bindings for event sourcing
      { queue: 'audit-service-events', exchange: 'domain-events', routingKey: '*' },
      
      // Saga command and reply bindings
      { queue: 'saga-commands', exchange: 'saga-events', routingKey: 'command.*' },
      { queue: 'saga-replies', exchange: 'saga-events', routingKey: 'reply.*' }
    ];

    for (const binding of bindings) {
      try {
        await channel.bindQueue(binding.queue, binding.exchange, binding.routingKey);
        console.log(`Bound queue '${binding.queue}' to exchange '${binding.exchange}' with routing key '${binding.routingKey}'`);
      } catch (error) {
        console.log(`Warning: Could not bind queue '${binding.queue}' to exchange '${binding.exchange}': ${error.message}`);
      }
    }

    // Setup dead letter exchange and queue
    await channel.assertExchange('dead-letter-exchange', 'direct', { durable: true });
    await channel.bindQueue('dead-letter-queue', 'dead-letter-exchange', 'failed');
    console.log('Dead letter exchange and queue setup completed');

    // Create some additional utility exchanges
    await channel.assertExchange('system-events', 'topic', { durable: true });
    await channel.assertExchange('monitoring-events', 'topic', { durable: true });
    console.log('System and monitoring exchanges created');

    console.log('RabbitMQ setup completed successfully!');
    console.log('\nCreated exchanges:');
    exchanges.forEach(ex => console.log(`  - ${ex.name} (${ex.type})`));
    console.log('\nCreated queues:');
    queues.forEach(q => console.log(`  - ${q.name}`));
    console.log('\nQueue bindings configured for proper message routing');

    await channel.close();
    await connection.close();

  } catch (error) {
    console.error('Error setting up RabbitMQ:', error);
    
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }
    
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupRabbitMQ();
}

module.exports = setupRabbitMQ;
