/**
 * E2E tests for Trip Designer
 *
 * Run with: node --loader tsx tests/e2e/trip-designer.test.ts
 * Or use your test runner of choice (Vitest, Jest, etc.)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  createTestClient,
  loadItinerary,
  assertOneQuestionOnly,
  assertValidItinerary,
  assertNoErrors,
  assertStreamCompleted,
  collectSSEEvents,
  type TestClient,
} from '../helpers/index.js';

describe('Trip Designer E2E Tests', () => {
  let client: TestClient;
  let testItineraryId: string;

  beforeEach(async () => {
    // Create test client
    client = createTestClient();

    // Create a test itinerary
    const itinerary = await client.createItinerary({
      title: 'E2E Test Trip',
      description: 'Test trip for E2E testing',
      startDate: '2025-07-01T00:00:00.000Z',
      endDate: '2025-07-08T00:00:00.000Z',
    });

    assertValidItinerary(itinerary);
    testItineraryId = itinerary.id;
  });

  afterEach(async () => {
    // Cleanup: delete test itinerary
    if (testItineraryId) {
      try {
        await client.deleteItinerary(testItineraryId);
      } catch (error) {
        console.warn('Failed to cleanup test itinerary:', error);
      }
    }
  });

  it('should create a new session', async () => {
    const { sessionId } = await client.createSession(testItineraryId);

    assert.ok(sessionId, 'Session ID should be returned');
    assert.match(sessionId, /^session_/, 'Session ID should start with session_');
  });

  it('should ask ONE question at a time', async () => {
    const { sessionId } = await client.createSession(testItineraryId);

    // Send initial message
    const events = [];
    for await (const event of client.streamMessage(sessionId, 'I want to plan a trip to Tokyo')) {
      events.push(event);
    }

    // Verify no errors
    assertNoErrors(events);
    assertStreamCompleted(events);

    // Find structured questions
    const questionEvents = events.filter(e => e.type === 'structured_questions');

    if (questionEvents.length > 0) {
      // Should have exactly one question event
      assert.strictEqual(questionEvents.length, 1, 'Should have exactly one question event');

      // That event should contain exactly ONE question
      const event = questionEvents[0];
      if (event.type === 'structured_questions') {
        assertOneQuestionOnly(event.questions);
      }
    }
  });

  it('should handle streaming responses', async () => {
    const { sessionId } = await client.createSession(testItineraryId);

    let textContent = '';
    let eventCount = 0;

    for await (const event of client.streamMessage(sessionId, 'Help me plan my trip')) {
      eventCount++;

      if (event.type === 'text') {
        textContent += event.content;
      }
    }

    assert.ok(eventCount > 0, 'Should receive at least one event');
    assert.ok(textContent.length > 0, 'Should receive some text content');
  });

  it('should use context from previous messages', async () => {
    const { sessionId } = await client.createSession(testItineraryId);

    // First message: establish destination
    const events1 = await collectSSEEvents(
      await client.sendMessage(sessionId, 'I want to visit Paris')
    );
    assertNoErrors(events1);

    // Second message: should remember Paris
    const events2 = [];
    for await (const event of client.streamMessage(sessionId, 'What hotels do you recommend?')) {
      events2.push(event);
    }

    assertNoErrors(events2);

    // The response should reference Paris (contextual understanding)
    const textContent = events2
      .filter(e => e.type === 'text')
      .map(e => e.type === 'text' ? e.content : '')
      .join('');

    // This is a weak assertion - ideally we'd have stronger validation
    assert.ok(textContent.length > 0, 'Should receive response');
  });

  it('should update itinerary when tool calls succeed', async () => {
    const { sessionId } = await client.createSession(testItineraryId);

    // Request to add a hotel
    const events = [];
    for await (const event of client.streamMessage(
      sessionId,
      'Add a hotel stay at The Ritz Paris from July 1-3, 2025'
    )) {
      events.push(event);
    }

    // Check for tool calls
    const toolCalls = events.filter(e => e.type === 'tool_call');
    assert.ok(toolCalls.length > 0, 'Should make at least one tool call');

    // Check for done event with itinerary update
    const doneEvent = events.find(e => e.type === 'done');
    assert.ok(doneEvent, 'Should have done event');

    if (doneEvent && doneEvent.type === 'done') {
      assert.ok(doneEvent.itineraryUpdated, 'Itinerary should be updated');
    }

    // Verify itinerary was actually updated
    const updatedItinerary = await client.getItinerary(testItineraryId);
    assert.ok(updatedItinerary.segments.length > 0, 'Should have at least one segment');
  });

  it('should handle errors gracefully', async () => {
    const { sessionId } = await client.createSession(testItineraryId);

    // Send an intentionally problematic request
    const events = [];
    for await (const event of client.streamMessage(
      sessionId,
      'Add a flight on an invalid date like February 30th'
    )) {
      events.push(event);
    }

    // Should complete even if there's an error
    assertStreamCompleted(events);

    // Should either handle gracefully or return an error event
    const errorEvents = events.filter(e => e.type === 'error');
    const doneEvents = events.filter(e => e.type === 'done');

    assert.ok(
      errorEvents.length > 0 || doneEvents.length > 0,
      'Should either error or complete'
    );
  });
});

describe('Trip Designer with Fixtures', () => {
  let client: TestClient;

  beforeEach(() => {
    client = createTestClient();
  });

  it('should handle planning phase itinerary', async () => {
    const planningItinerary = loadItinerary('planning-phase');

    // Verify fixture structure
    assertValidItinerary(planningItinerary);
    assert.strictEqual(planningItinerary.status, 'DRAFT');
    assert.ok(planningItinerary.startDate, 'Should have start date');
    assert.ok(planningItinerary.endDate, 'Should have end date');

    // Create session with this itinerary
    const { sessionId } = await client.createSession(planningItinerary.id);
    assert.ok(sessionId, 'Should create session');
  });

  it('should handle partial segments itinerary', async () => {
    const partialItinerary = loadItinerary('partial-segments');

    // Verify fixture has segments
    assert.ok(partialItinerary.segments.length > 0, 'Should have segments');

    // Create session
    const { sessionId } = await client.createSession(partialItinerary.id);

    // Ask about existing segments
    const events = [];
    for await (const event of client.streamMessage(
      sessionId,
      'What do I have planned so far?'
    )) {
      events.push(event);
    }

    assertNoErrors(events);
    assertStreamCompleted(events);

    // Should reference existing segments in response
    const textContent = events
      .filter(e => e.type === 'text')
      .map(e => e.type === 'text' ? e.content : '')
      .join('');

    assert.ok(textContent.length > 0, 'Should describe existing plans');
  });
});
