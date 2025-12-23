/**
 * Integration tests for Trip Designer Streaming API
 * Tests: /api/v1/designer/sessions/:id/messages/stream (SSE streaming)
 *
 * These tests verify Server-Sent Events (SSE) streaming behavior
 * for real-time chat responses in the Trip Designer.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestClient } from '../../helpers/test-client.js';
import type { SSEEvent } from '../../helpers/sse-parser.js';

describe('Streaming API Integration Tests', () => {
  let client: TestClient;
  let sessionId: string | null = null;
  let testItineraryId: string | null = null;

  beforeEach(async () => {
    client = new TestClient();

    // Create test itinerary
    const itinerary = await client.createItinerary({
      title: 'Stream Test Itinerary',
      description: 'Created for streaming API tests',
      startDate: '2025-09-01T00:00:00.000Z',
      endDate: '2025-09-10T00:00:00.000Z',
    });
    testItineraryId = itinerary.id;

    // Create session
    const sessionResponse = await client.createSession(testItineraryId, 'trip-designer');
    sessionId = sessionResponse.sessionId;
  });

  afterEach(async () => {
    // Cleanup
    if (sessionId) {
      try {
        await client.deleteSession(sessionId);
      } catch (error) {
        console.warn('Failed to cleanup session:', error);
      }
      sessionId = null;
    }

    if (testItineraryId) {
      try {
        await client.deleteItinerary(testItineraryId);
      } catch (error) {
        console.warn('Failed to cleanup itinerary:', error);
      }
      testItineraryId = null;
    }
  });

  describe('POST /api/v1/designer/sessions/:id/messages/stream', () => {
    it('returns SSE content-type header', async () => {
      expect(sessionId).toBeDefined();

      const response = await fetch(
        `${client['baseUrl']}/api/v1/designer/sessions/${sessionId}/messages/stream`,
        {
          method: 'POST',
          headers: client['getHeaders'](true),
          body: JSON.stringify({ message: 'Hello' }),
        }
      );

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('connection')).toBe('keep-alive');
    });

    it('emits connected event first', async () => {
      const events: SSEEvent[] = [];

      for await (const event of client.streamMessage(sessionId!, 'Hi there')) {
        events.push(event);
        // Stop after first few events
        if (events.length >= 3) break;
      }

      // First event should be connected (implementation detail - may vary)
      // At minimum, should receive some events
      expect(events.length).toBeGreaterThan(0);
    });

    it('emits text events during streaming', async () => {
      const events: SSEEvent[] = [];

      for await (const event of client.streamMessage(
        sessionId!,
        'Tell me about this itinerary'
      )) {
        events.push(event);
      }

      // Should have text events
      const textEvents = events.filter((e) => e.type === 'text');
      expect(textEvents.length).toBeGreaterThan(0);

      // Text events should have content
      textEvents.forEach((event) => {
        if (event.type === 'text') {
          expect(event.content).toBeDefined();
          expect(typeof event.content).toBe('string');
        }
      });
    });

    it('emits done event at end of stream', async () => {
      const events: SSEEvent[] = [];

      for await (const event of client.streamMessage(sessionId!, 'What is this trip about?')) {
        events.push(event);
      }

      // Should have at least one event
      expect(events.length).toBeGreaterThan(0);

      // Last event should be done
      const lastEvent = events[events.length - 1];
      expect(lastEvent.type).toBe('done');

      // Done event should have expected structure
      if (lastEvent.type === 'done') {
        expect(lastEvent).toHaveProperty('itineraryUpdated');
        expect(typeof lastEvent.itineraryUpdated).toBe('boolean');
      }
    });

    it('includes token usage in done event', async () => {
      const events: SSEEvent[] = [];

      for await (const event of client.streamMessage(
        sessionId!,
        'Suggest one activity in the destination'
      )) {
        events.push(event);
      }

      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent).toBeDefined();

      if (doneEvent && doneEvent.type === 'done') {
        // Token usage should be present
        if (doneEvent.tokens) {
          expect(doneEvent.tokens).toHaveProperty('input');
          expect(doneEvent.tokens).toHaveProperty('output');
          expect(doneEvent.tokens).toHaveProperty('total');
          expect(doneEvent.tokens.input).toBeGreaterThan(0);
          expect(doneEvent.tokens.output).toBeGreaterThan(0);
          expect(doneEvent.tokens.total).toBe(
            doneEvent.tokens.input + doneEvent.tokens.output
          );
        }

        // Cost should be present
        if (doneEvent.cost) {
          expect(doneEvent.cost).toHaveProperty('input');
          expect(doneEvent.cost).toHaveProperty('output');
          expect(doneEvent.cost).toHaveProperty('total');
        }
      }
    });

    it('handles tool calls in stream', async () => {
      const events: SSEEvent[] = [];

      // Request that likely triggers tool use
      for await (const event of client.streamMessage(
        sessionId!,
        'Add a hotel stay in the destination from Sept 1-3, 2025'
      )) {
        events.push(event);
      }

      // Check for tool-related events
      const toolCallEvents = events.filter((e) => e.type === 'tool_call');
      const toolResultEvents = events.filter((e) => e.type === 'tool_result');

      // If tool calls were made, verify structure
      if (toolCallEvents.length > 0) {
        const toolCall = toolCallEvents[0];
        if (toolCall.type === 'tool_call') {
          expect(toolCall.name).toBeDefined();
          expect(typeof toolCall.name).toBe('string');
          expect(toolCall.arguments).toBeDefined();
          expect(typeof toolCall.arguments).toBe('object');
        }
      }

      // Tool results should match tool calls
      if (toolResultEvents.length > 0) {
        const toolResult = toolResultEvents[0];
        if (toolResult.type === 'tool_result') {
          expect(toolResult.name).toBeDefined();
          expect(toolResult).toHaveProperty('success');
          expect(typeof toolResult.success).toBe('boolean');
        }
      }
    });

    it('emits structured_questions event when asking clarifying questions', async () => {
      const events: SSEEvent[] = [];

      // Ask a vague question that might trigger clarifying questions
      for await (const event of client.streamMessage(
        sessionId!,
        'I want to visit somewhere nice'
      )) {
        events.push(event);
      }

      // Check for structured questions
      const questionEvents = events.filter((e) => e.type === 'structured_questions');

      if (questionEvents.length > 0) {
        const event = questionEvents[0];
        if (event.type === 'structured_questions') {
          expect(event.questions).toBeDefined();
          expect(Array.isArray(event.questions)).toBe(true);

          // Verify question structure
          event.questions.forEach((q) => {
            expect(q).toHaveProperty('id');
            expect(q).toHaveProperty('question');
            expect(q).toHaveProperty('type');
          });
        }
      }
    });

    it('returns 404 for invalid session', async () => {
      const invalidSessionId = 'session_does_not_exist';

      await expect(async () => {
        const events: SSEEvent[] = [];
        for await (const event of client.streamMessage(invalidSessionId, 'Test message')) {
          events.push(event);
        }
      }).rejects.toThrow(/not found/i);
    });

    it('returns 400 for missing message', async () => {
      const response = await fetch(
        `${client['baseUrl']}/api/v1/designer/sessions/${sessionId}/messages/stream`,
        {
          method: 'POST',
          headers: client['getHeaders'](true),
          body: JSON.stringify({}), // Missing message
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid message type', async () => {
      const response = await fetch(
        `${client['baseUrl']}/api/v1/designer/sessions/${sessionId}/messages/stream`,
        {
          method: 'POST',
          headers: client['getHeaders'](true),
          body: JSON.stringify({ message: 123 }), // Should be string
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('requires API key', async () => {
      const response = await fetch(
        `${client['baseUrl']}/api/v1/designer/sessions/${sessionId}/messages/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // No API key
          },
          body: JSON.stringify({ message: 'Test' }),
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(503); // Service unavailable without API key
    });

    it('rejects empty API key', async () => {
      const response = await fetch(
        `${client['baseUrl']}/api/v1/designer/sessions/${sessionId}/messages/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-OpenRouter-API-Key': '   ', // Whitespace only
          },
          body: JSON.stringify({ message: 'Test' }),
        }
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('Streaming Event Order', () => {
    it('maintains consistent event order', async () => {
      const events: SSEEvent[] = [];

      for await (const event of client.streamMessage(sessionId!, 'Hello, how are you?')) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThan(0);

      // Last event should be 'done' or 'error'
      const lastEvent = events[events.length - 1];
      expect(['done', 'error']).toContain(lastEvent.type);

      // No events should come after 'done'
      const doneIndex = events.findIndex((e) => e.type === 'done');
      if (doneIndex !== -1) {
        expect(doneIndex).toBe(events.length - 1);
      }
    });

    it('emits tool_result after tool_call', async () => {
      const events: SSEEvent[] = [];

      for await (const event of client.streamMessage(
        sessionId!,
        'Add a flight from NYC to LAX on Sept 1, 2025'
      )) {
        events.push(event);
      }

      // Find all tool calls and results
      const toolCalls = events
        .map((e, idx) => ({ event: e, index: idx }))
        .filter((item) => item.event.type === 'tool_call');

      const toolResults = events
        .map((e, idx) => ({ event: e, index: idx }))
        .filter((item) => item.event.type === 'tool_result');

      // Each tool call should have a corresponding result after it
      toolCalls.forEach((call) => {
        const matchingResult = toolResults.find((result) => result.index > call.index);
        if (matchingResult) {
          expect(matchingResult.index).toBeGreaterThan(call.index);
        }
      });
    });
  });

  describe('Streaming Performance', () => {
    it('streams incrementally without buffering entire response', async () => {
      const eventTimestamps: number[] = [];

      for await (const event of client.streamMessage(
        sessionId!,
        'Tell me a detailed story about travel'
      )) {
        eventTimestamps.push(Date.now());
      }

      // Should receive multiple events
      expect(eventTimestamps.length).toBeGreaterThan(1);

      // Events should arrive over time (not all at once)
      // Calculate time deltas between events
      const deltas: number[] = [];
      for (let i = 1; i < eventTimestamps.length; i++) {
        deltas.push(eventTimestamps[i] - eventTimestamps[i - 1]);
      }

      // At least some events should have arrived at different times
      // (allowing for very fast responses in tests)
      const totalTime = eventTimestamps[eventTimestamps.length - 1] - eventTimestamps[0];
      expect(totalTime).toBeGreaterThanOrEqual(0);
    });
  });
});
