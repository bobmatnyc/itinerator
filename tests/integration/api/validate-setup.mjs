#!/usr/bin/env node
/**
 * Validation script for API integration test setup
 * Checks environment variables and server availability
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI colors
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function check(condition, successMsg, failMsg) {
  if (condition) {
    log(`✓ ${successMsg}`, 'green');
    return true;
  } else {
    log(`✗ ${failMsg}`, 'red');
    return false;
  }
}

async function validateSetup() {
  log('\n=== API Integration Test Setup Validation ===\n', 'blue');

  let allChecks = true;

  // Check environment variables
  log('Environment Variables:', 'yellow');

  const apiKey = process.env.ITINERIZER_TEST_API_KEY;
  allChecks &= check(
    apiKey && apiKey.length > 0,
    'ITINERIZER_TEST_API_KEY is set',
    'ITINERIZER_TEST_API_KEY is missing or empty'
  );

  const userEmail = process.env.ITINERIZER_TEST_USER_EMAIL;
  allChecks &= check(
    userEmail && userEmail.length > 0,
    `ITINERIZER_TEST_USER_EMAIL is set: ${userEmail}`,
    'ITINERIZER_TEST_USER_EMAIL is missing or empty'
  );

  const apiUrl = process.env.VITE_API_URL || 'http://localhost:5176';
  log(`  VITE_API_URL: ${apiUrl}`, 'blue');

  // Check server availability
  log('\nServer Availability:', 'yellow');

  try {
    const response = await fetch(`${apiUrl}/api/v1/itineraries`, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail || 'test@example.com',
      },
    });

    allChecks &= check(
      response.ok || response.status === 401 || response.status === 403,
      `SvelteKit server is reachable at ${apiUrl}`,
      `SvelteKit server is not reachable at ${apiUrl}`
    );

    if (response.ok) {
      const data = await response.json();
      log(`  Server returned ${Array.isArray(data) ? data.length : 0} itineraries`, 'blue');
    }
  } catch (error) {
    allChecks = false;
    log(`✗ Cannot connect to server at ${apiUrl}`, 'red');
    log(`  Error: ${error.message}`, 'red');
    log('  Make sure the SvelteKit dev server is running:', 'yellow');
    log('    cd viewer-svelte && npm run dev', 'yellow');
  }

  // Check test dependencies
  log('\nTest Dependencies:', 'yellow');

  try {
    const { TestClient } = await import('../../helpers/test-client.js');
    allChecks &= check(
      TestClient !== undefined,
      'TestClient helper is available',
      'TestClient helper is missing'
    );
  } catch (error) {
    allChecks = false;
    log(`✗ Failed to load TestClient: ${error.message}`, 'red');
  }

  try {
    const { parseSSEStream } = await import('../../helpers/sse-parser.js');
    allChecks &= check(
      parseSSEStream !== undefined,
      'SSE parser is available',
      'SSE parser is missing'
    );
  } catch (error) {
    allChecks = false;
    log(`✗ Failed to load SSE parser: ${error.message}`, 'red');
  }

  // Summary
  log('\n=== Validation Summary ===\n', 'blue');

  if (allChecks) {
    log('✓ All checks passed! Ready to run integration tests.', 'green');
    log('\nRun tests with:', 'yellow');
    log('  npx vitest tests/integration/api/', 'blue');
    process.exit(0);
  } else {
    log('✗ Some checks failed. Please fix the issues above.', 'red');
    log('\nQuick setup:', 'yellow');
    log('  1. export ITINERIZER_TEST_API_KEY="sk-or-v1-..."', 'blue');
    log('  2. export ITINERIZER_TEST_USER_EMAIL="test@example.com"', 'blue');
    log('  3. cd viewer-svelte && npm run dev', 'blue');
    process.exit(1);
  }
}

validateSetup().catch((error) => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});
