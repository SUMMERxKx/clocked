import { beforeAll, afterAll } from '@jest/globals';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/clocked_test';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379';
});

afterAll(async () => {
  // Clean up any global resources
  // Database cleanup is handled in individual test files
});
