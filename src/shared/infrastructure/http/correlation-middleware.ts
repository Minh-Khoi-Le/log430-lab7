import { Request, Response, NextFunction } from 'express';
import { CorrelationContextManager } from '../logging/correlation-context';

/**
 * Middleware to extract and set correlation context from HTTP headers
 */
export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Extract correlation context from headers
  const context = CorrelationContextManager.fromHttpHeaders(req.headers);
  
  // Set correlation context for the request
  CorrelationContextManager.setContext(context);
  
  // Add correlation headers to response
  const responseHeaders = CorrelationContextManager.toHttpHeaders(context);
  Object.entries(responseHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  next();
};

/**
 * Middleware to add correlation context to outgoing HTTP requests
 */
export const addCorrelationHeaders = (headers: Record<string, string> = {}): Record<string, string> => {
  const correlationHeaders = CorrelationContextManager.toHttpHeaders();
  return {
    ...headers,
    ...correlationHeaders
  };
};