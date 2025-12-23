/**
 * E2E Test Setup
 *
 * Validates test environment before running E2E tests:
 * - Checks for required API key
 * - Verifies test server is running
 * - Exports global test utilities
 */

import { beforeAll } from 'vitest';

const TEST_BASE_URL =
  process.env.ITINERIZER_TEST_BASE_URL || 'http://localhost:5176';
const TEST_API_KEY = process.env.ITINERIZER_TEST_API_KEY;

/**
 * Check if test server is running
 */
async function checkServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${TEST_BASE_URL}/api/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
  // Check for API key
  if (!TEST_API_KEY) {
    throw new Error(
      'ITINERIZER_TEST_API_KEY environment variable is required for E2E tests.\n' +
        'Create .env.test from .env.test.example and set your OpenRouter API key.'
    );
  }

  // Check server is running
  const isRunning = await checkServerRunning();
  if (!isRunning) {
    throw new Error(
      `Test server is not running at ${TEST_BASE_URL}.\n` +
        'Start the server with: cd viewer-svelte && npm run dev'
    );
  }

  console.log('✓ E2E test environment ready');
  console.log(`  Base URL: ${TEST_BASE_URL}`);
  console.log(`  API Key: ${TEST_API_KEY.slice(0, 10)}...`);
});

/**
 * Global test utilities
 */
export const testConfig = {
  baseUrl: TEST_BASE_URL,
  apiKey: TEST_API_KEY,
  timeout: {
    short: 10000, // 10s for simple requests
    medium: 30000, // 30s for LLM responses
    long: 60000, // 60s for complex multi-turn interactions
  },
};

/**
 * Helper: Wait for condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 100
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
}

/**
 * Helper: Create unique test user ID
 */
export function createTestUserId(): string {
  return `test-user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Helper: Clean up test data after tests
 */
export async function cleanupTestItineraries(userId: string): Promise<void> {
  try {
    const response = await fetch(`${TEST_BASE_URL}/api/v1/itineraries`, {
      method: 'GET',
      headers: {
        'x-user-id': userId,
      },
    });

    if (!response.ok) return;

    const itineraries = await response.json();
    await Promise.all(
      itineraries.map((itin: { id: string }) =>
        fetch(`${TEST_BASE_URL}/api/v1/itineraries/${itin.id}`, {
          method: 'DELETE',
          headers: {
            'x-user-id': userId,
          },
        })
      )
    );
  } catch (error) {
    console.warn('Failed to cleanup test itineraries:', error);
  }
}
