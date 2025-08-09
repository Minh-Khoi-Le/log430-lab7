// RabbitMQ compatibility wrapper
const amqp = require('amqplib');

/**
 * Connect to RabbitMQ (compatibility function)
 */
async function connectRabbitMQ(config) {
  try {
    // Default config if none provided
    const defaultConfig = {
      url: process.env.RABBITMQ_URL || 'amqp://localhost:5672'
    };
    
    const finalConfig = config || defaultConfig;
    const connection = await amqp.connect(finalConfig.url);
    
    return connection;
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

module.exports = {
  connectRabbitMQ
};
