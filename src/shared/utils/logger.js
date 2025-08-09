// Simple logger wrapper for compatibility
// Using a basic console logger when compiled logging isn't available

// Create a simple logger implementation
const createSimpleLogger = (serviceName) => {
  const timestamp = () => new Date().toISOString();
  
  return {
    info: (message, ...args) => {
      console.log(`{"timestamp":"${timestamp()}","level":"INFO","service":"${serviceName}","message":"${message}"}`, ...args);
    },
    error: (message, error, ...args) => {
      const errorDetails = error ? { error: { message: error.message, stack: error.stack } } : {};
      console.error(`{"timestamp":"${timestamp()}","level":"ERROR","service":"${serviceName}","message":"${message}","context":${JSON.stringify(errorDetails)}}`, ...args);
    },
    warn: (message, ...args) => {
      console.warn(`{"timestamp":"${timestamp()}","level":"WARN","service":"${serviceName}","message":"${message}"}`, ...args);
    },
    debug: (message, ...args) => {
      console.debug(`{"timestamp":"${timestamp()}","level":"DEBUG","service":"${serviceName}","message":"${message}"}`, ...args);
    }
  };
};

// Create a default logger
const logger = createSimpleLogger('default');

// Export the logger with common methods for backwards compatibility
module.exports = {
  info: (message, ...args) => logger.info(message, ...args),
  error: (message, ...args) => logger.error(message, ...args),
  warn: (message, ...args) => logger.warn(message, ...args),
  debug: (message, ...args) => logger.debug(message, ...args),
  log: (message, ...args) => logger.info(message, ...args)
};
