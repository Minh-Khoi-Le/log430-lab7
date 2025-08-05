/**
 * Shared Logger Service
 * 
 * Provides standardized logging functionality across all microservices.
 * Supports different log levels (INFO, WARN, ERROR) and adds contextual
 * information like timestamps, service names, and correlation IDs for distributed tracing.
 */

import { CorrelationContextManager } from './correlation-context';

// Log levels enum
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// Logger configuration options
export interface LoggerOptions {
  serviceName: string;
  enableConsole?: boolean;
  minLevel?: LogLevel;
}

// Default options
const DEFAULT_OPTIONS: Partial<LoggerOptions> = {
  enableConsole: true,
  minLevel: LogLevel.INFO,
};

/**
 * Logger class that provides consistent logging across services
 */
export class Logger {
  private readonly options: LoggerOptions;

  constructor(options: LoggerOptions) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Log an informational message
   * @param message The message to log
   * @param context Optional context object to include in the log
   */
  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param context Optional context object to include in the log
   */
  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param error Optional Error object
   * @param context Optional context object to include in the log
   */
  public error(message: string, error?: Error, context?: Record<string, any>): void {
    const errorContext = error ? {
      ...context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    } : context;

    this.log(LogLevel.ERROR, message, errorContext);
  }

  /**
   * Internal method to handle logging based on level
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // Skip if below minimum log level
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const correlationContext = CorrelationContextManager.getContext();
    
    const logEntry = {
      timestamp,
      level,
      service: this.options.serviceName,
      message,
      // Include correlation context for distributed tracing
      ...(correlationContext ? {
        correlationId: correlationContext.correlationId,
        causationId: correlationContext.causationId,
        userId: correlationContext.userId,
        sagaId: correlationContext.sagaId,
        eventType: correlationContext.eventType
      } : {}),
      ...(context ? { context } : {}),
    };

    // Log to console if enabled
    if (this.options.enableConsole) {
      this.logToConsole(level, logEntry);
    }

    // Here you could add other log targets like files or external services
    // For example: this.logToFile(level, logEntry);
  }

  /**
   * Determine if a message should be logged based on minimum level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    const minLevelIndex = levels.indexOf(this.options.minLevel || LogLevel.INFO);
    const currentLevelIndex = levels.indexOf(level);
    
    return currentLevelIndex >= minLevelIndex;
  }

  /**
   * Output the log entry to the console with appropriate formatting
   */
  private logToConsole(level: LogLevel, logEntry: any): void {
    // Create structured JSON log for better parsing and correlation
    const structuredLog = {
      timestamp: logEntry.timestamp,
      level: level,
      service: logEntry.service,
      message: logEntry.message,
      ...(logEntry.correlationId ? { correlationId: logEntry.correlationId } : {}),
      ...(logEntry.causationId ? { causationId: logEntry.causationId } : {}),
      ...(logEntry.userId ? { userId: logEntry.userId } : {}),
      ...(logEntry.sagaId ? { sagaId: logEntry.sagaId } : {}),
      ...(logEntry.eventType ? { eventType: logEntry.eventType } : {}),
      ...(logEntry.context ? { context: logEntry.context } : {})
    };

    // Output as JSON for structured logging
    const jsonLog = JSON.stringify(structuredLog);
    
    switch (level) {
      case LogLevel.INFO:
        console.log(jsonLog);
        break;
      case LogLevel.WARN:
        console.warn(jsonLog);
        break;
      case LogLevel.ERROR:
        console.error(jsonLog);
        break;
    }
  }
}

/**
 * Create a logger instance for a service
 * 
 * @param serviceName The name of the service using the logger
 * @param options Additional logger options
 * @returns A configured logger instance
 * 
 * @example
 * // Create a logger for the user service
 * const logger = createLogger('user-service');
 * 
 * // Log messages
 * logger.info('User service started');
 * logger.warn('Rate limit approaching', { userId: 123, requestCount: 95 });
 * logger.error('Failed to authenticate user', new Error('Invalid token'), { userId: 123 });
 */
export function createLogger(serviceName: string, options?: Partial<LoggerOptions>): Logger {
  return new Logger({
    serviceName,
    ...DEFAULT_OPTIONS,
    ...options,
  });
}

// Export a default logger for quick usage
export default createLogger('app');
