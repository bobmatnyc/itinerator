import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for E2E tests
 *
 * Features:
 * - Longer timeouts for LLM API calls
 * - Sequential execution to avoid rate limits
 * - Separate test environment from unit/integration tests
 * - Requires ITINERIZER_TEST_API_KEY environment variable
 */
export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.e2e.test.ts'],
    testTimeout: 60000, // 60 seconds per test for LLM calls
    hookTimeout: 30000, // 30 seconds for setup/teardown
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Sequential execution to avoid rate limits
      },
    },
    setupFiles: ['./tests/setup-e2e.ts'],
    env: {
      NODE_ENV: 'test',
    },
    // Fail fast on first error to save API calls
    bail: 1,
    // More verbose output for debugging LLM interactions
    reporters: ['verbose'],
    // Disable coverage for E2E (focus on unit tests for coverage)
    coverage: {
      enabled: false,
    },
  },
});
