import { DomainEvent } from '../../domain/events/domain-events';
import { createLogger } from '../logging';
import {
  eventPublishingTotal,
  eventPublishingDuration,
  eventConsumptionTotal,
  eventConsumptionDuration,
  eventProcessingErrors,
  sagaExecutionTotal,
  sagaExecutionDuration,
  sagaStepExecutionTotal,
  sagaStepExecutionDuration,
  sagaCompensationTotal,
  activeSagas,
  commandExecutionTotal,
  commandExecutionDuration,
  queryExecutionTotal,
  queryExecutionDuration,
  projectionUpdateTotal,
  projectionUpdateDuration
} from './event-metrics';

const logger = createLogger('event-instrumentation');

// Event Publishing Instrumentation
export class EventPublishingInstrumentation {
  static async instrumentPublish<T>(
    serviceName: string,
    eventType: string,
    exchange: string,
    routingKey: string,
    correlationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const timer = eventPublishingDuration.startTimer({
      service: serviceName,
      event_type: eventType,
      exchange,
      routing_key: routingKey,
      status: 'success'
    });

    try {
      logger.info('Publishing event', {
        service: serviceName,
        eventType,
        exchange,
        routingKey,
        correlationId,
        timestamp: new Date().toISOString()
      });

      const result = await operation();

      timer({ status: 'success' });
      eventPublishingTotal.inc({
        service: serviceName,
        event_type: eventType,
        exchange,
        routing_key: routingKey,
        status: 'success'
      });

      logger.info('Event published successfully', {
        service: serviceName,
        eventType,
        exchange,
        routingKey,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      timer({ status: 'error' });
      eventPublishingTotal.inc({
        service: serviceName,
        event_type: eventType,
        exchange,
        routing_key: routingKey,
        status: 'error'
      });

      logger.error('Event publishing failed', error as Error, {
        service: serviceName,
        eventType,
        exchange,
        routingKey,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }
}

// Event Consumption Instrumentation
export class EventConsumptionInstrumentation {
  static async instrumentConsumption<T>(
    serviceName: string,
    eventType: string,
    queue: string,
    correlationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const timer = eventConsumptionDuration.startTimer({
      service: serviceName,
      event_type: eventType,
      queue,
      status: 'success'
    });

    try {
      logger.info('Processing event', {
        service: serviceName,
        eventType,
        queue,
        correlationId,
        timestamp: new Date().toISOString()
      });

      const result = await operation();

      timer({ status: 'success' });
      eventConsumptionTotal.inc({
        service: serviceName,
        event_type: eventType,
        queue,
        status: 'success'
      });

      logger.info('Event processed successfully', {
        service: serviceName,
        eventType,
        queue,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      timer({ status: 'error' });
      eventConsumptionTotal.inc({
        service: serviceName,
        event_type: eventType,
        queue,
        status: 'error'
      });

      eventProcessingErrors.inc({
        service: serviceName,
        event_type: eventType,
        queue,
        error_type: (error as Error).name || 'UnknownError'
      });

      logger.error('Event processing failed', error as Error, {
        service: serviceName,
        eventType,
        queue,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }
}

// Saga Execution Instrumentation
export class SagaInstrumentation {
  static async instrumentSagaExecution<T>(
    serviceName: string,
    sagaType: string,
    sagaId: string,
    correlationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const timer = sagaExecutionDuration.startTimer({
      service: serviceName,
      saga_type: sagaType,
      status: 'success'
    });

    // Track active saga
    activeSagas.inc({ service: serviceName, saga_type: sagaType, status: 'active' });

    try {
      logger.info('Starting saga execution', {
        service: serviceName,
        sagaType,
        sagaId,
        correlationId,
        timestamp: new Date().toISOString()
      });

      const result = await operation();

      timer({ status: 'success' });
      sagaExecutionTotal.inc({
        service: serviceName,
        saga_type: sagaType,
        status: 'success'
      });

      activeSagas.dec({ service: serviceName, saga_type: sagaType, status: 'active' });
      activeSagas.inc({ service: serviceName, saga_type: sagaType, status: 'completed' });

      logger.info('Saga execution completed successfully', {
        service: serviceName,
        sagaType,
        sagaId,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      timer({ status: 'error' });
      sagaExecutionTotal.inc({
        service: serviceName,
        saga_type: sagaType,
        status: 'error'
      });

      activeSagas.dec({ service: serviceName, saga_type: sagaType, status: 'active' });
      activeSagas.inc({ service: serviceName, saga_type: sagaType, status: 'failed' });

      logger.error('Saga execution failed', error as Error, {
        service: serviceName,
        sagaType,
        sagaId,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  static async instrumentSagaStep<T>(
    serviceName: string,
    sagaType: string,
    stepName: string,
    sagaId: string,
    correlationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const timer = sagaStepExecutionDuration.startTimer({
      service: serviceName,
      saga_type: sagaType,
      step_name: stepName,
      status: 'success'
    });

    try {
      logger.info('Executing saga step', {
        service: serviceName,
        sagaType,
        stepName,
        sagaId,
        correlationId,
        timestamp: new Date().toISOString()
      });

      const result = await operation();

      timer({ status: 'success' });
      sagaStepExecutionTotal.inc({
        service: serviceName,
        saga_type: sagaType,
        step_name: stepName,
        status: 'success'
      });

      logger.info('Saga step completed successfully', {
        service: serviceName,
        sagaType,
        stepName,
        sagaId,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      timer({ status: 'error' });
      sagaStepExecutionTotal.inc({
        service: serviceName,
        saga_type: sagaType,
        step_name: stepName,
        status: 'error'
      });

      logger.error('Saga step failed', error as Error, {
        service: serviceName,
        sagaType,
        stepName,
        sagaId,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  static async instrumentCompensation<T>(
    serviceName: string,
    sagaType: string,
    compensationStep: string,
    sagaId: string,
    correlationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      logger.info('Executing saga compensation', {
        service: serviceName,
        sagaType,
        compensationStep,
        sagaId,
        correlationId,
        timestamp: new Date().toISOString()
      });

      const result = await operation();

      sagaCompensationTotal.inc({
        service: serviceName,
        saga_type: sagaType,
        compensation_step: compensationStep,
        status: 'success'
      });

      logger.info('Saga compensation completed successfully', {
        service: serviceName,
        sagaType,
        compensationStep,
        sagaId,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      sagaCompensationTotal.inc({
        service: serviceName,
        saga_type: sagaType,
        compensation_step: compensationStep,
        status: 'error'
      });

      logger.error('Saga compensation failed', error as Error, {
        service: serviceName,
        sagaType,
        compensationStep,
        sagaId,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }
}

// CQRS Instrumentation
export class CQRSInstrumentation {
  static async instrumentCommand<T>(
    serviceName: string,
    commandType: string,
    correlationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const timer = commandExecutionDuration.startTimer({
      service: serviceName,
      command_type: commandType,
      status: 'success'
    });

    try {
      logger.info('Executing command', {
        service: serviceName,
        commandType,
        correlationId,
        timestamp: new Date().toISOString()
      });

      const result = await operation();

      timer({ status: 'success' });
      commandExecutionTotal.inc({
        service: serviceName,
        command_type: commandType,
        status: 'success'
      });

      logger.info('Command executed successfully', {
        service: serviceName,
        commandType,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      timer({ status: 'error' });
      commandExecutionTotal.inc({
        service: serviceName,
        command_type: commandType,
        status: 'error'
      });

      logger.error('Command execution failed', error as Error, {
        service: serviceName,
        commandType,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  static async instrumentQuery<T>(
    serviceName: string,
    queryType: string,
    correlationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const timer = queryExecutionDuration.startTimer({
      service: serviceName,
      query_type: queryType,
      status: 'success'
    });

    try {
      logger.info('Executing query', {
        service: serviceName,
        queryType,
        correlationId,
        timestamp: new Date().toISOString()
      });

      const result = await operation();

      timer({ status: 'success' });
      queryExecutionTotal.inc({
        service: serviceName,
        query_type: queryType,
        status: 'success'
      });

      logger.info('Query executed successfully', {
        service: serviceName,
        queryType,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      timer({ status: 'error' });
      queryExecutionTotal.inc({
        service: serviceName,
        query_type: queryType,
        status: 'error'
      });

      logger.error('Query execution failed', error as Error, {
        service: serviceName,
        queryType,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  static async instrumentProjectionUpdate<T>(
    serviceName: string,
    projectionType: string,
    correlationId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const timer = projectionUpdateDuration.startTimer({
      service: serviceName,
      projection_type: projectionType,
      status: 'success'
    });

    try {
      logger.info('Updating projection', {
        service: serviceName,
        projectionType,
        correlationId,
        timestamp: new Date().toISOString()
      });

      const result = await operation();

      timer({ status: 'success' });
      projectionUpdateTotal.inc({
        service: serviceName,
        projection_type: projectionType,
        status: 'success'
      });

      logger.info('Projection updated successfully', {
        service: serviceName,
        projectionType,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      timer({ status: 'error' });
      projectionUpdateTotal.inc({
        service: serviceName,
        projection_type: projectionType,
        status: 'error'
      });

      logger.error('Projection update failed', error as Error, {
        service: serviceName,
        projectionType,
        correlationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }
}