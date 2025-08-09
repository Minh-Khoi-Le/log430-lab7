// Prometheus metrics compatibility wrapper

/**
 * Create Prometheus metrics for a service (compatibility function)
 */
function createPrometheusMetrics(serviceName) {
  // Create a simple metrics register for compatibility
  const register = {
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
    metrics: async () => {
      // Return empty metrics for now to prevent crashes
      return `# HELP ${serviceName}_info Service information\n# TYPE ${serviceName}_info gauge\n${serviceName}_info 1\n`;
    }
  };

  return {
    register,
    serviceName
  };
}

module.exports = {
  createPrometheusMetrics
};
