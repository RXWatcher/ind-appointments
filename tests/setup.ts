/**
 * Vitest test setup file
 * Runs before all tests
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-minimum-32-chars';
process.env.BASE_URL = 'http://localhost:3000';

// Mock logger to prevent console output during tests
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock database for unit tests
vi.mock('@/lib/database', () => ({
  db: {
    query: vi.fn().mockResolvedValue([]),
    run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    transaction: vi.fn((fn: Function) => fn()),
  },
}));
