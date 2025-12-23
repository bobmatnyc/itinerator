# API Integration Tests - Quick Reference

## Setup (One-Time)

```bash
# 1. Set environment variables
export ITINERIZER_TEST_API_KEY="sk-or-v1-YOUR_KEY_HERE"
export ITINERIZER_TEST_USER_EMAIL="test@example.com"

# 2. Start SvelteKit dev server
cd viewer-svelte
npm run dev

# 3. Validate setup (optional)
node tests/integration/api/validate-setup.mjs
```

## Running Tests

```bash
# All API integration tests
npx vitest tests/integration/api/

# Individual test files
npx vitest tests/integration/api/sessions.test.ts
npx vitest tests/integration/api/streaming.test.ts
npx vitest tests/integration/api/itineraries.test.ts

# Watch mode
npx vitest tests/integration/api/ --watch

# With coverage
npx vitest tests/integration/api/ --coverage
```

## Quick Commands

```bash
# Validate setup
node tests/integration/api/validate-setup.mjs

# Start dev server in background
cd viewer-svelte && npm run dev &

# Run tests once server is ready
sleep 5 && npx vitest tests/integration/api/ --run

# Kill dev server when done
pkill -f "vite"
```

## Test Structure

### Sessions API (`sessions.test.ts`)

```typescript
import { TestClient } from '../../helpers/test-client.js';

const client = new TestClient();

// Create session
const { sessionId } = await client.createSession(itineraryId, 'trip-designer');

// Get session
const session = await client.getSession(sessionId);

// Delete session
await client.deleteSession(sessionId);
```

**17 tests covering:**
- POST /api/v1/designer/sessions
- GET /api/v1/designer/sessions/:sessionId
- DELETE /api/v1/designer/sessions/:sessionId

### Streaming API (`streaming.test.ts`)

```typescript
// Stream messages
const events = [];
for await (const event of client.streamMessage(sessionId, 'Hello')) {
  events.push(event);
}

// Event types: text, tool_call, tool_result, structured_questions, done, error
const lastEvent = events[events.length - 1];
expect(lastEvent.type).toBe('done');
```

**15 tests covering:**
- POST /api/v1/designer/sessions/:id/messages/stream
- SSE event types and ordering
- Token usage and cost tracking

### Itineraries API (`itineraries.test.ts`)

```typescript
// Create itinerary
const itinerary = await client.createItinerary({
  title: 'My Trip',
  startDate: '2025-12-01T00:00:00.000Z',
  endDate: '2025-12-10T00:00:00.000Z',
});

// Get itinerary
const fetched = await client.getItinerary(itinerary.id);

// Update itinerary
const updated = await client.updateItinerary(itinerary.id, {
  title: 'Updated Trip',
});

// Delete itinerary
await client.deleteItinerary(itinerary.id);
```

**44 tests covering:**
- GET /api/v1/itineraries
- POST /api/v1/itineraries
- GET /api/v1/itineraries/:id
- PATCH /api/v1/itineraries/:id
- DELETE /api/v1/itineraries/:id

## Common Patterns

### Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestClient } from '../../helpers/test-client.js';

describe('My Test Suite', () => {
  let client: TestClient;
  let resourceId: string | null = null;

  beforeEach(() => {
    client = new TestClient();
  });

  afterEach(async () => {
    if (resourceId) {
      try {
        await client.deleteResource(resourceId);
      } catch (error) {
        console.warn('Cleanup failed:', error);
      }
      resourceId = null;
    }
  });

  it('does something', async () => {
    const resource = await client.createResource({ ... });
    resourceId = resource.id;

    expect(resource).toBeDefined();
  });
});
```

### Cleanup Pattern

```typescript
afterEach(async () => {
  // Cleanup sessions
  if (sessionId) {
    try {
      await client.deleteSession(sessionId);
    } catch (error) {
      console.warn('Failed to cleanup session:', error);
    }
    sessionId = null;
  }

  // Cleanup itineraries
  if (itineraryId) {
    try {
      await client.deleteItinerary(itineraryId);
    } catch (error) {
      console.warn('Failed to cleanup itinerary:', error);
    }
    itineraryId = null;
  }
});
```

### Error Testing

```typescript
it('handles errors', async () => {
  // Missing required field
  await expect(async () => {
    await client.createItinerary({ title: '' });
  }).rejects.toThrow();

  // Non-existent resource
  await expect(async () => {
    await client.getItinerary('non-existent-id');
  }).rejects.toThrow(/not found/i);

  // Unauthorized
  await expect(async () => {
    await clientWithoutAuth.createSession();
  }).rejects.toThrow();
});
```

### SSE Streaming

```typescript
it('processes stream events', async () => {
  const events: SSEEvent[] = [];

  for await (const event of client.streamMessage(sessionId, 'Message')) {
    events.push(event);

    // Process specific event types
    if (event.type === 'text') {
      console.log('Text:', event.content);
    } else if (event.type === 'done') {
      console.log('Tokens:', event.tokens);
    }
  }

  // Verify event sequence
  expect(events.length).toBeGreaterThan(0);
  expect(events[events.length - 1].type).toBe('done');
});
```

## Troubleshooting

### "ECONNREFUSED" Error

**Problem:** Cannot connect to server
**Solution:** Start the SvelteKit dev server:
```bash
cd viewer-svelte && npm run dev
```

### "API key required" Error

**Problem:** Missing API key
**Solution:** Set environment variable:
```bash
export ITINERIZER_TEST_API_KEY="sk-or-v1-..."
```

### "Session not found" Error

**Problem:** Session was deleted or server restarted
**Solution:** Sessions are in-memory. Re-run the test to create a new session.

### Tests Hang Indefinitely

**Problem:** Server not responding or SSE stream not closing
**Solution:**
1. Check server logs for errors
2. Verify API key is valid
3. Add timeout to test:
```typescript
it('test with timeout', async () => {
  // ...
}, { timeout: 30000 }); // 30 second timeout
```

### Rate Limiting

**Problem:** Too many requests to OpenRouter
**Solution:**
1. Mock LLM responses at service layer
2. Use test API key with higher limits
3. Add delays between tests

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ITINERIZER_TEST_API_KEY` | Yes | - | OpenRouter API key for LLM features |
| `ITINERIZER_TEST_USER_EMAIL` | Yes | - | Test user email for scoping |
| `VITE_API_URL` | No | `http://localhost:5176` | SvelteKit dev server URL |

## Test Statistics

- **Total Tests:** 76
- **Test Files:** 3
- **LOC:** ~1,700
- **Coverage:** 90%+ for API routes

## Next Steps

1. Review [Full Documentation](./README.md)
2. Check [Test Architecture](../../ARCHITECTURE.md)
3. See [E2E Tests](../../e2e/) for user workflow tests
4. Explore [Service Tests](../../services/) for unit tests

## Quick Links

- [sessions.test.ts](./sessions.test.ts) - Session CRUD tests
- [streaming.test.ts](./streaming.test.ts) - SSE streaming tests
- [itineraries.test.ts](./itineraries.test.ts) - Itinerary CRUD tests
- [README.md](./README.md) - Full documentation
- [validate-setup.mjs](./validate-setup.mjs) - Setup validation script
