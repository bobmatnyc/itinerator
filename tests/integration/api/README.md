# SvelteKit API Integration Tests

Integration tests for the Itinerizer SvelteKit API endpoints. These tests verify the actual HTTP API behavior against a running SvelteKit dev server.

## Overview

These tests cover the production API routes in `viewer-svelte/src/routes/api/v1/`:

| Test File | Endpoints Tested | Description |
|-----------|------------------|-------------|
| `sessions.test.ts` | `/api/v1/designer/sessions/*` | Trip Designer session CRUD operations |
| `streaming.test.ts` | `/api/v1/designer/sessions/:id/messages/stream` | SSE streaming for real-time chat |
| `itineraries.test.ts` | `/api/v1/itineraries/*` | Itinerary CRUD operations |

## Prerequisites

### Environment Variables

Required for all tests:

```bash
# OpenRouter API key for LLM features
export ITINERIZER_TEST_API_KEY="sk-or-v1-..."

# Test user email for user scoping
export ITINERIZER_TEST_USER_EMAIL="test@example.com"

# SvelteKit dev server URL (optional, defaults to http://localhost:5176)
export VITE_API_URL="http://localhost:5176"
```

### Running the Test Server

The tests require the SvelteKit dev server to be running:

```bash
cd viewer-svelte
npm run dev
```

This starts the server on `http://localhost:5176` by default.

## Running Tests

### All API Integration Tests

```bash
# From project root
npm run test:integration:api

# Or with Vitest directly
npx vitest tests/integration/api/
```

### Individual Test Files

```bash
# Session tests only
npx vitest tests/integration/api/sessions.test.ts

# Streaming tests only
npx vitest tests/integration/api/streaming.test.ts

# Itinerary tests only
npx vitest tests/integration/api/itineraries.test.ts
```

### Watch Mode

```bash
npx vitest tests/integration/api/ --watch
```

## Test Structure

### TestClient Helper

All tests use the `TestClient` helper from `tests/helpers/test-client.ts`:

```typescript
import { TestClient } from '../../helpers/test-client.js';

const client = new TestClient();

// Session operations
const session = await client.createSession(itineraryId, 'trip-designer');
const details = await client.getSession(session.sessionId);
await client.deleteSession(session.sessionId);

// Streaming
for await (const event of client.streamMessage(sessionId, 'Hello')) {
  console.log(event);
}

// Itinerary operations
const itinerary = await client.createItinerary({ title: 'Trip', ... });
await client.updateItinerary(itinerary.id, { title: 'Updated' });
await client.deleteItinerary(itinerary.id);
```

### Cleanup Pattern

All tests follow this cleanup pattern:

```typescript
let createdResourceId: string | null = null;

afterEach(async () => {
  if (createdResourceId) {
    try {
      await client.deleteResource(createdResourceId);
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
    createdResourceId = null;
  }
});
```

## Test Coverage

### sessions.test.ts

**POST /api/v1/designer/sessions**
- ✅ Creates help mode session without itinerary
- ✅ Creates trip-designer session with itinerary context
- ✅ Returns valid session ID
- ✅ Rejects missing/empty API key
- ✅ Requires itineraryId for trip-designer mode
- ✅ Rejects non-existent itinerary
- ✅ Returns 201 status code

**GET /api/v1/designer/sessions/:sessionId**
- ✅ Returns session details
- ✅ Includes message history
- ✅ Includes metadata fields
- ✅ Returns 404 for invalid session
- ✅ Requires API key

**DELETE /api/v1/designer/sessions/:sessionId**
- ✅ Deletes session successfully
- ✅ Returns 204 No Content
- ✅ Returns 404 for non-existent session
- ✅ Handles double deletion gracefully

**Session Lifecycle**
- ✅ Full CRUD lifecycle
- ✅ Multiple independent sessions

### streaming.test.ts

**POST /api/v1/designer/sessions/:id/messages/stream**
- ✅ Returns SSE content-type header
- ✅ Emits connected event first
- ✅ Emits text events during streaming
- ✅ Emits done event at end
- ✅ Includes token usage in done event
- ✅ Handles tool calls in stream
- ✅ Emits structured_questions event
- ✅ Returns 404 for invalid session
- ✅ Returns 400 for missing/invalid message
- ✅ Requires API key

**Streaming Event Order**
- ✅ Maintains consistent event order
- ✅ Emits tool_result after tool_call

**Streaming Performance**
- ✅ Streams incrementally without buffering

### itineraries.test.ts

**GET /api/v1/itineraries**
- ✅ Returns array of itineraries
- ✅ Returns only current user itineraries
- ✅ Excludes example itineraries
- ✅ Returns empty array for logged out user

**POST /api/v1/itineraries**
- ✅ Creates new itinerary
- ✅ Returns created itinerary with ID
- ✅ Validates required fields
- ✅ Sets createdBy to current user
- ✅ Supports optional draft flag
- ✅ Returns 201 status code
- ✅ Requires user to be logged in

**GET /api/v1/itineraries/:id**
- ✅ Returns single itinerary by ID
- ✅ Includes all itinerary fields
- ✅ Includes segments array
- ✅ Returns 404 for non-existent itinerary
- ✅ Returns 403 for different user's itinerary

**PATCH /api/v1/itineraries/:id**
- ✅ Updates title, description, dates
- ✅ Preserves unmodified fields
- ✅ Updates updatedAt timestamp
- ✅ Supports updating status, tags, tripType
- ✅ Returns 404 for non-existent itinerary
- ✅ Returns 403 for different user's itinerary

**DELETE /api/v1/itineraries/:id**
- ✅ Deletes itinerary successfully
- ✅ Returns 204 No Content
- ✅ Returns 404 for non-existent itinerary
- ✅ Handles double deletion gracefully
- ✅ Returns 403 for different user's itinerary

**Itinerary Lifecycle**
- ✅ Full CRUD lifecycle
- ✅ Data integrity through updates

## Common Test Scenarios

### Testing with User Scoping

```typescript
it('filters by user', async () => {
  const itineraries = await client.getItineraries();

  const testUserEmail = process.env.ITINERIZER_TEST_USER_EMAIL;
  itineraries.forEach((itin) => {
    expect(itin.createdBy?.toLowerCase()).toBe(testUserEmail.toLowerCase());
  });
});
```

### Testing SSE Streams

```typescript
it('collects stream events', async () => {
  const events: SSEEvent[] = [];

  for await (const event of client.streamMessage(sessionId, 'Hello')) {
    events.push(event);
  }

  expect(events.length).toBeGreaterThan(0);
  expect(events[events.length - 1].type).toBe('done');
});
```

### Testing Error Cases

```typescript
it('handles errors', async () => {
  await expect(async () => {
    await client.getItinerary('non-existent-id');
  }).rejects.toThrow(/not found/i);
});
```

## Mocking Strategy

These are **integration tests** that hit actual API endpoints. However:

- **LLM responses** may be mocked at the service layer (not HTTP layer)
- **External APIs** (SerpAPI, etc.) should be mocked to avoid rate limits
- **Storage** uses the configured backend (JSON or Blob)

For fully isolated unit tests, see `tests/services/` instead.

## Troubleshooting

### Tests Failing with "ECONNREFUSED"

The SvelteKit dev server is not running. Start it:

```bash
cd viewer-svelte
npm run dev
```

### Tests Failing with "API key required"

Set the environment variable:

```bash
export ITINERIZER_TEST_API_KEY="sk-or-v1-..."
```

### Tests Failing with "Session not found"

Sessions are ephemeral and stored in memory. If the server restarts, sessions are lost. Re-run the test.

### Rate Limiting from OpenRouter

If you hit rate limits during test development:

1. Mock the LLM service layer
2. Use a test API key with higher limits
3. Add delays between tests

## Best Practices

1. **Always cleanup resources** in `afterEach` hooks
2. **Use unique test data** to avoid conflicts
3. **Test both success and error cases**
4. **Verify response structure** with type assertions
5. **Check HTTP status codes** explicitly when needed
6. **Test ownership and scoping** for multi-user features

## Related Documentation

- [SvelteKit API Routes](../../../viewer-svelte/src/routes/api/v1/)
- [Test Helpers](../../helpers/)
- [E2E Tests](../../e2e/)
- [Service Tests](../../services/)
