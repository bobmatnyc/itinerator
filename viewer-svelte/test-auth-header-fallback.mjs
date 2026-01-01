#!/usr/bin/env node
/**
 * Test script to verify X-User-Email header fallback
 *
 * This script tests that:
 * 1. Server accepts X-User-Email header when cookie is missing
 * 2. Cookie takes precedence when both are present
 * 3. Auth still required (session cookie must be valid)
 */

const API_BASE = 'http://localhost:5176/api/v1';
const SESSION_COOKIE = 'itinerator_session=authenticated';
const TEST_EMAIL = 'test@example.com';

async function testHeaderFallback() {
  console.log('Testing X-User-Email header fallback...\n');

  // Test 1: No email at all (should work but userEmail will be null)
  console.log('Test 1: No email provided');
  try {
    const response = await fetch(`${API_BASE}/itineraries`, {
      headers: {
        'Cookie': SESSION_COOKIE,
      },
    });
    console.log(`✓ Status: ${response.status} (userEmail will be null)`);
  } catch (error) {
    console.error('✗ Failed:', error.message);
  }

  // Test 2: Only X-User-Email header (no cookie)
  console.log('\nTest 2: Only X-User-Email header (no cookie)');
  try {
    const response = await fetch(`${API_BASE}/itineraries`, {
      headers: {
        'Cookie': SESSION_COOKIE,
        'X-User-Email': TEST_EMAIL,
      },
    });
    console.log(`✓ Status: ${response.status} (should accept header)`);

    // Check server logs for the header being used
    console.log('  Check server console for: "[hooks] Using X-User-Email header"');
  } catch (error) {
    console.error('✗ Failed:', error.message);
  }

  // Test 3: Both cookie and header (cookie should win)
  console.log('\nTest 3: Both cookie and header (cookie should take precedence)');
  try {
    const response = await fetch(`${API_BASE}/itineraries`, {
      headers: {
        'Cookie': `${SESSION_COOKIE}; itinerator_user_email=${TEST_EMAIL}`,
        'X-User-Email': 'different@example.com',
      },
    });
    console.log(`✓ Status: ${response.status} (cookie should be used)`);
    console.log('  Check server console - should NOT see "Using X-User-Email header"');
  } catch (error) {
    console.error('✗ Failed:', error.message);
  }

  // Test 4: No session (should fail with 401)
  console.log('\nTest 4: No session cookie (should fail with 401)');
  try {
    const response = await fetch(`${API_BASE}/itineraries`, {
      headers: {
        'X-User-Email': TEST_EMAIL,
      },
    });
    console.log(`${response.status === 401 ? '✓' : '✗'} Status: ${response.status} (expected 401)`);
  } catch (error) {
    console.error('✗ Failed:', error.message);
  }

  console.log('\n✅ All tests completed. Check server console for detailed logs.');
  console.log('\nExpected behavior:');
  console.log('- Test 2 should show "[hooks] Using X-User-Email header" in server logs');
  console.log('- Test 3 should NOT show that message (cookie takes precedence)');
  console.log('- Test 4 should fail (session required regardless of email header)');
}

// Run tests
testHeaderFallback().catch(console.error);
