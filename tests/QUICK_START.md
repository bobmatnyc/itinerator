# E2E Test Framework - Quick Start Guide

## Setup (30 seconds)

1. **Set your API key**:
```bash
export ITINERIZER_TEST_API_KEY="sk-or-v1-your-openrouter-key"
```

2. **Start the dev server**:
```bash
cd viewer-svelte && npm run dev
# Server runs on http://localhost:5176
```

3. **Run the example**:
```bash
npx tsx tests/examples/basic-usage.ts
```

## Write Your First Test

Create `tests/e2e/my-first-test.ts`:

```typescript
import { createTestClient, assertOneQuestionOnly } from '../helpers/index.js';

async function testOneQuestion() {
  const client = createTestClient();
  
  // Create itinerary
  const itinerary = await client.createItinerary({
    title: 'My Test Trip',
    startDate: '2025-09-01T00:00:00.000Z',
    endDate: '2025-09-07T00:00:00.000Z',
  });
  
  // Create session
  const { sessionId } = await client.createSession(itinerary.id);
  
  // Send message and collect events
  const events = [];
  for await (const event of client.streamMessage(sessionId, 'Plan my trip to Tokyo')) {
    events.push(event);
  }
  
  // Validate ONE question at a time
  const questionEvents = events.filter(e => e.type === 'structured_questions');
  if (questionEvents.length > 0 && questionEvents[0].type === 'structured_questions') {
    assertOneQuestionOnly(questionEvents[0].questions);
    console.log('✅ Asking ONE question at a time!');
  }
  
  // Cleanup
  await client.deleteItinerary(itinerary.id);
}

testOneQuestion().catch(console.error);
```

Run it:
```bash
npx tsx tests/e2e/my-first-test.ts
```

## Common Patterns

### Stream and Assert
```typescript
const events = [];
for await (const event of client.streamMessage(sessionId, 'message')) {
  events.push(event);
}

assertNoErrors(events);
assertStreamCompleted(events);
```

### Load Fixtures
```typescript
import { loadItinerary } from '../helpers/index.js';

const itinerary = loadItinerary('planning-phase');
// itinerary has dates, destinations, travelers pre-configured
```

### Validate Tool Calls
```typescript
const toolCalls = events.filter(e => e.type === 'tool_call');
for (const call of toolCalls) {
  assertValidToolCall(call, 'add_hotel'); // optional: check tool name
}
```

## Available Helpers

### TestClient
- `createSession(itineraryId)` - Start Trip Designer session
- `getSession(sessionId)` - Get session details
- `streamMessage(sessionId, message)` - Send message, stream response
- `createItinerary(data)` - Create test itinerary
- `getItinerary(id)` - Fetch itinerary
- `updateItinerary(id, data)` - Update itinerary
- `deleteItinerary(id)` - Delete itinerary

### Assertions
- `assertOneQuestionOnly(questions)` - Enforce ONE question principle ⭐
- `assertValidItinerary(obj)` - Validate itinerary structure
- `assertValidSession(obj)` - Validate session structure
- `assertNoErrors(events)` - No error events in stream
- `assertStreamCompleted(events)` - Stream has done event
- `assertItineraryUpdated(events)` - Itinerary was modified

### Fixtures
- `loadItinerary('empty-new')` - New itinerary
- `loadItinerary('planning-phase')` - Has dates and preferences
- `loadItinerary('partial-segments')` - Has flight and hotel
- `loadPersona('solo-traveler')` - Solo traveler profile
- `loadPersona('family-vacation')` - Family of 4 profile

### SSE Parser
- `parseSSEStream(response)` - Async generator for events
- `collectSSEEvents(response)` - Get all events as array
- `collectTextContent(response)` - Get only text
- `waitForEvent(response, 'done')` - Wait for specific event

## Event Types

```typescript
type SSEEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: unknown; success: boolean }
  | { type: 'structured_questions'; questions: StructuredQuestion[] }
  | { type: 'done'; itineraryUpdated: boolean; tokens?: TokenUsage }
  | { type: 'error'; message: string };
```

## Pro Tips

✅ **DO**:
- Use fixtures for consistent test data
- Assert ONE question at a time
- Clean up test itineraries
- Stream events properly with async generators

❌ **DON'T**:
- Use `.then()` on async generators (use `for await` instead)
- Create ad-hoc test data (use fixtures)
- Skip cleanup (always delete test itineraries)
- Ignore the ONE question principle

## Environment Variables

```bash
# Required
export ITINERIZER_TEST_API_KEY="sk-or-v1-..."

# Optional
export ITINERIZER_TEST_USER_EMAIL="test@example.com"
export VITE_API_URL="http://localhost:5176"
```

## Next Steps

- Read `tests/README.md` for detailed documentation
- Check `tests/examples/basic-usage.ts` for full example
- Review `tests/e2e/trip-designer.test.ts` for test patterns
- Create your own fixtures in `tests/fixtures/`

Happy testing! 🎉
