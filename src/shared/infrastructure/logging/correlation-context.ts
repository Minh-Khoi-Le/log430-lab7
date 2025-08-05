import { AsyncLocalStorage } from 'async_hooks';

// Correlation context interface
export interface CorrelationContext {
  correlationId: string;
  causationId?: string;
  userId?: string;
  sagaId?: string;
  eventType?: string;
  timestamp: string;
}

// Async local storage for correlation context
const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Correlation context manager for distributed tracing
 */
export class CorrelationContextManager {
  /**
   * Get the current correlation context
   */
  static getContext(): CorrelationContext | undefined {
    return correlationStorage.getStore();
  }

  /**
   * Set correlation context for the current execution
   */
  static setContext(context: CorrelationContext): void {
    correlationStorage.enterWith(context);
  }

  /**
   * Run a function with a specific correlation context
   */
  static runWithContext<T>(context: CorrelationContext, fn: () => T): T {
    return correlationStorage.run(context, fn);
  }

  /**
   * Run a function with a new correlation context
   */
  static runWithNewContext<T>(
    correlationId: string,
    additionalContext: Partial<CorrelationContext>,
    fn: () => T
  ): T {
    const context: CorrelationContext = {
      correlationId,
      timestamp: new Date().toISOString(),
      ...additionalContext
    };
    return correlationStorage.run(context, fn);
  }

  /**
   * Generate a new correlation ID
   */
  static generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a child context with a new causation ID
   */
  static createChildContext(causationId: string, additionalContext?: Partial<CorrelationContext>): CorrelationContext {
    const currentContext = this.getContext();
    return {
      correlationId: currentContext?.correlationId || this.generateCorrelationId(),
      causationId,
      timestamp: new Date().toISOString(),
      ...currentContext,
      ...additionalContext
    };
  }

  /**
   * Extract correlation context from event metadata
   */
  static fromEventMetadata(metadata: any): CorrelationContext {
    return {
      correlationId: metadata.correlationId || this.generateCorrelationId(),
      causationId: metadata.causationId,
      userId: metadata.userId,
      sagaId: metadata.sagaId,
      eventType: metadata.eventType,
      timestamp: metadata.timestamp || new Date().toISOString()
    };
  }

  /**
   * Extract correlation context from HTTP headers
   */
  static fromHttpHeaders(headers: Record<string, string | string[] | undefined>): CorrelationContext {
    const correlationId = Array.isArray(headers['x-correlation-id']) 
      ? headers['x-correlation-id'][0] 
      : headers['x-correlation-id'] || this.generateCorrelationId();
    
    const causationId = Array.isArray(headers['x-causation-id']) 
      ? headers['x-causation-id'][0] 
      : headers['x-causation-id'];
    
    const userId = Array.isArray(headers['x-user-id']) 
      ? headers['x-user-id'][0] 
      : headers['x-user-id'];

    return {
      correlationId,
      causationId,
      userId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Convert context to HTTP headers
   */
  static toHttpHeaders(context?: CorrelationContext): Record<string, string> {
    const ctx = context || this.getContext();
    if (!ctx) return {};

    const headers: Record<string, string> = {
      'x-correlation-id': ctx.correlationId,
      'x-timestamp': ctx.timestamp
    };

    if (ctx.causationId) headers['x-causation-id'] = ctx.causationId;
    if (ctx.userId) headers['x-user-id'] = ctx.userId;
    if (ctx.sagaId) headers['x-saga-id'] = ctx.sagaId;
    if (ctx.eventType) headers['x-event-type'] = ctx.eventType;

    return headers;
  }
}

export { correlationStorage };