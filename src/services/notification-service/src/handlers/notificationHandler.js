const logger = require('../../shared/utils/logger');
const { v4: uuidv4 } = require('uuid');

class NotificationHandler {
  constructor() {
    this.processedEvents = new Set(); // Simple in-memory deduplication
  }

  async initialize(connection) {
    const channel = await connection.createChannel();
    
    // Set up exchange and queues
    await channel.assertExchange('complaints.events', 'topic', { durable: true });
    
    const queue = await channel.assertQueue('notification.queue', { durable: true });
    await channel.bindQueue(queue.queue, 'complaints.events', 'complaint.*');
    
    // Set up event handlers
    await channel.consume(queue.queue, async (msg) => {
      if (msg) {
        try {
          const event = JSON.parse(msg.content.toString());
          await this.handleEvent(event);
          channel.ack(msg);
        } catch (error) {
          logger.error('Error processing notification event:', error);
          channel.nack(msg, false, false); // Send to dead letter queue
        }
      }
    });

    logger.info('Notification handler initialized');
  }

  async handleEvent(event) {
    // Idempotency check
    if (this.processedEvents.has(event.eventId)) {
      logger.info(`Event ${event.eventId} already processed, skipping`);
      return;
    }

    logger.info(`Processing notification event: ${event.eventType}`, { eventId: event.eventId });

    switch (event.eventType) {
      case 'COMPLAINT_CREATED':
        await this.handleComplaintCreated(event);
        break;
      case 'COMPLAINT_ASSIGNED':
        await this.handleComplaintAssigned(event);
        break;
      case 'COMPLAINT_PROCESSED':
        await this.handleComplaintProcessed(event);
        break;
      case 'COMPLAINT_CLOSED':
        await this.handleComplaintClosed(event);
        break;
      default:
        logger.warn(`Unknown event type: ${event.eventType}`);
    }

    // Mark as processed
    this.processedEvents.add(event.eventId);
  }

  async handleComplaintCreated(event) {
    const { complaintId, userId, title, priority } = event.eventData;
    
    logger.info(`Sending complaint created notification`, {
      complaintId,
      userId,
      title,
      priority
    });

    // Simulate email notification
    await this.sendNotification({
      type: 'COMPLAINT_CREATED',
      recipient: `user-${userId}@example.com`,
      subject: `Complaint Created: ${title}`,
      content: `Your complaint has been created and assigned ID: ${complaintId}. Priority: ${priority}`
    });
  }

  async handleComplaintAssigned(event) {
    const { complaintId, assignedTo, assignedBy } = event.eventData;
    
    logger.info(`Sending complaint assigned notification`, {
      complaintId,
      assignedTo,
      assignedBy
    });

    await this.sendNotification({
      type: 'COMPLAINT_ASSIGNED',
      recipient: `agent-${assignedTo}@example.com`,
      subject: `Complaint Assigned: ${complaintId}`,
      content: `You have been assigned complaint ${complaintId} by ${assignedBy}`
    });
  }

  async handleComplaintProcessed(event) {
    const { complaintId, processedBy, resolution } = event.eventData;
    
    logger.info(`Sending complaint processed notification`, {
      complaintId,
      processedBy,
      resolution
    });

    await this.sendNotification({
      type: 'COMPLAINT_PROCESSED',
      recipient: `customer@example.com`,
      subject: `Complaint Update: ${complaintId}`,
      content: `Your complaint has been processed. Resolution: ${resolution}`
    });
  }

  async handleComplaintClosed(event) {
    const { complaintId, closedBy, closureReason } = event.eventData;
    
    logger.info(`Sending complaint closed notification`, {
      complaintId,
      closedBy,
      closureReason
    });

    await this.sendNotification({
      type: 'COMPLAINT_CLOSED',
      recipient: `customer@example.com`,
      subject: `Complaint Closed: ${complaintId}`,
      content: `Your complaint has been closed. Reason: ${closureReason}`
    });
  }

  async sendNotification(notification) {
    // Simulate email sending (in real implementation, use nodemailer)
    logger.info(`📧 Email notification sent:`, {
      type: notification.type,
      recipient: notification.recipient,
      subject: notification.subject,
      timestamp: new Date().toISOString()
    });

    // In a real implementation, you would:
    // 1. Store notification in database
    // 2. Send actual email using nodemailer
    // 3. Track delivery status
    // 4. Handle retry logic for failed deliveries
  }
}

module.exports = NotificationHandler;