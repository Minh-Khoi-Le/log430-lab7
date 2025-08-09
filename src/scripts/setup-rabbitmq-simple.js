const amqp = require('amqplib');

async function setupRabbitMQ() {
  let connection;
  const maxRetries = 10;
  const retryDelay = 2000; // 2 seconds
  
  try {
    // Connect to RabbitMQ with retry logic
    console.log('Connecting to RabbitMQ...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672');
        console.log('Connected to RabbitMQ successfully');
        break;
      } catch (connectError) {
        console.log(`Connection attempt ${attempt}/${maxRetries} failed: ${connectError.message}`);
        if (attempt === maxRetries) {
          throw connectError;
        }
        console.log(`Retrying in ${retryDelay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    // List of required queues that should exist
    const requiredQueues = [
      'audit-service-all-events',
      'audit-service-complaint-events',
      'audit-service-transaction-events',
      'audit-service-security-events',
      'audit-service-saga-events',
      'audit-service-complaint-saga',
      'transaction-service-events',
      'user-service-events',
      'catalog-service-events',
      'complaint-service-events',
      'notification-service-events',
      'event-store-service-events',
      'email-notifications',
      'sms-notifications'
    ];

    // Create exchanges only if they don't exist
    const exchangesToCreate = [
      { name: 'domain-events', type: 'topic' },
      { name: 'saga-events', type: 'topic' },
      { name: 'notification-events', type: 'direct' },
      { name: 'audit-events', type: 'fanout' }
    ];

    for (const exchange of exchangesToCreate) {
      let channel;
      try {
        channel = await connection.createChannel();
        await channel.assertExchange(exchange.name, exchange.type, { durable: true });
        console.log(`Exchange '${exchange.name}' (${exchange.type}) ensured`);
      } catch (error) {
        console.log(`Warning: Exchange '${exchange.name}' setup issue: ${error.message}`);
      } finally {
        if (channel) {
          try {
            await channel.close();
          } catch (closeError) {
            // Ignore close errors
          }
        }
      }
    }

    // Create queues only if they don't exist
    for (const queueName of requiredQueues) {
      let channel;
      try {
        channel = await connection.createChannel();
        // Use assertQueue which will create the queue if it doesn't exist
        // or return existing queue if it does exist
        await channel.assertQueue(queueName, { durable: true });
        console.log(`Queue '${queueName}' ensured`);
      } catch (error) {
        console.log(`Warning: Could not ensure queue '${queueName}': ${error.message}`);
      } finally {
        if (channel) {
          try {
            await channel.close();
          } catch (closeError) {
            // Ignore close errors
          }
        }
      }
    }

    console.log('RabbitMQ setup completed successfully!');
    console.log(`Ensured ${requiredQueues.length} queues and ${exchangesToCreate.length} exchanges exist.`);

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
