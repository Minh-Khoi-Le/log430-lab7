module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'domain/**/*.ts',
    'application/**/*.ts',
    'infrastructure/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  moduleNameMapping: {
    '^@shared/(.*)$': '<rootDir>/../../shared/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};