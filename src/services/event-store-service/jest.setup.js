// Jest setup file for event-store-service

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock Prisma client
jest.mock('@shared/infrastructure/database', () => ({
  databaseManager: {
    getClient: jest.fn(() => ({
      eventStore: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn()
      },
      $transaction: jest.fn()
    })),
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    disconnect: jest.fn()
  },
  createHealthRoutes: jest.fn(() => jest.fn())
}));

// Mock Redis
jest.mock('@shared/infrastructure/caching', () => ({
  redisClient: {
    connect: jest.fn(),
    disconnect: jest.fn()
  },
  CacheService: jest.fn()
}));

// Mock metrics
jest.mock('@shared/infrastructure/metrics', () => ({
  register: {
    contentType: 'text/plain',
    metrics: jest.fn(() => Promise.resolve(''))
  },
  metricsMiddleware: jest.fn(() => (req, res, next) => next()),
  collectSystemMetrics: jest.fn()
}));

// Mock HTTP middleware
jest.mock('@shared/infrastructure/http', () => ({
  requestLogger: (req, res, next) => next()
}));