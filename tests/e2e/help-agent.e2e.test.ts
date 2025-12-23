/**
 * Help Agent E2E Tests
 *
 * REAL LLM API TESTS - These make actual calls to OpenRouter
 *
 * Run with: npm run test:e2e
 * Requires: ITINERIZER_TEST_API_KEY environment variable
 *
 * Features tested:
 * - App-related question answering
 * - Mode switching to Trip Designer
 * - Helpful guidance without tool calls
 * - Feature explanations
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  TestClient,
  collectSSEEvents,
  assertNoErrors,
  assertStreamCompleted,
  extractTextFromEvents,
  extractToolCallsFromEvents,
  hasToolCall,
} from '../helpers/index.js';

describe('Help Agent E2E - App Questions', () => {
  let client: TestClient;
  let sessionId: string | null = null;
  let itineraryId: string | null = null;

  beforeAll(() => {
    client = new TestClient();
  });

  afterEach(async () => {
    if (itineraryId) {
      await client.deleteItinerary(itineraryId).catch(() => {});
      itineraryId = null;
    }
    sessionId = null;
  });

  describe('Answering App Questions', () => {
    it('answers questions about app features without tools', async () => {
      // Create session in help mode
      const itinerary = await client.createItinerary({
        title: 'Help Mode Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId, 'help');
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(sessionId, 'How do I add a flight?')
      );

      assertNoErrors(events);
      assertStreamCompleted(events);

      // Should respond with helpful text
      const textContent = extractTextFromEvents(events);
      expect(textContent.length).toBeGreaterThan(0);

      // Should NOT make tool calls for app questions
      const toolCalls = extractToolCallsFromEvents(events);
      expect(toolCalls.length).toBe(0);

      // Should mention flights or adding segments
      const hasRelevantInfo =
        textContent.toLowerCase().includes('flight') &&
        (textContent.toLowerCase().includes('add') ||
         textContent.toLowerCase().includes('create'));

      expect(hasRelevantInfo).toBe(true);
    }, 60000);

    it('explains app features clearly', async () => {
      const itinerary = await client.createItinerary({
        title: 'Feature Explanation Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId, 'help');
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(sessionId, 'What is Trip Designer?')
      );

      assertNoErrors(events);

      const textContent = extractTextFromEvents(events);

      // Should explain Trip Designer
      const mentionsDesigner =
        textContent.toLowerCase().includes('trip designer') ||
        textContent.toLowerCase().includes('plan');

      expect(mentionsDesigner).toBe(true);
      expect(textContent.length).toBeGreaterThan(50); // Substantial explanation
    }, 60000);

    it('provides helpful guidance for common tasks', async () => {
      const itinerary = await client.createItinerary({
        title: 'Guidance Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId, 'help');
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(sessionId, 'How do I organize my trip?')
      );

      assertNoErrors(events);

      const textContent = extractTextFromEvents(events);

      // Should provide actionable guidance
      expect(textContent.length).toBeGreaterThan(50);

      // Should not make tool calls
      const toolCalls = extractToolCallsFromEvents(events);
      expect(toolCalls.length).toBe(0);
    }, 60000);
  });

  describe('Mode Switching', () => {
    it('switches to trip designer when planning intent detected', async () => {
      const itinerary = await client.createItinerary({
        title: 'Mode Switch Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId, 'help');
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'I want to plan a trip to Paris'
        )
      );

      assertNoErrors(events);

      // Should call switch_to_trip_designer tool
      expect(hasToolCall(events, 'switch_to_trip_designer')).toBe(true);

      const textContent = extractTextFromEvents(events);

      // Should acknowledge the switch
      const acknowledgesSwitch =
        textContent.toLowerCase().includes('trip designer') ||
        textContent.toLowerCase().includes('planning') ||
        textContent.toLowerCase().includes('paris');

      expect(acknowledgesSwitch).toBe(true);
    }, 60000);

    it('calls switch_to_trip_designer tool with context', async () => {
      const itinerary = await client.createItinerary({
        title: 'Context Switch Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId, 'help');
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Help me plan a beach vacation in Thailand'
        )
      );

      assertNoErrors(events);

      // Should switch modes
      const toolCalls = extractToolCallsFromEvents(events);
      const switchCall = toolCalls.find(tc => tc.name === 'switch_to_trip_designer');

      expect(switchCall).toBeDefined();

      // Should pass context to Trip Designer
      if (switchCall) {
        expect(switchCall.arguments.context).toBeTruthy();
        const context = switchCall.arguments.context as string;

        // Should include destination info
        expect(context.toLowerCase()).toContain('thailand');
      }
    }, 60000);

    it('stays in help mode for app questions', async () => {
      const itinerary = await client.createItinerary({
        title: 'Stay in Help Mode Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId, 'help');
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'How do I export my itinerary?'
        )
      );

      assertNoErrors(events);

      // Should NOT switch modes for app questions
      expect(hasToolCall(events, 'switch_to_trip_designer')).toBe(false);

      // Should answer the question
      const textContent = extractTextFromEvents(events);
      expect(textContent.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Help Quality', () => {
    it('provides step-by-step instructions when appropriate', async () => {
      const itinerary = await client.createItinerary({
        title: 'Instructions Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId, 'help');
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'How do I share my itinerary with friends?'
        )
      );

      assertNoErrors(events);

      const textContent = extractTextFromEvents(events);

      // Should provide substantial guidance
      expect(textContent.length).toBeGreaterThan(50);

      // Should mention sharing or export
      const hasRelevantInfo =
        textContent.toLowerCase().includes('share') ||
        textContent.toLowerCase().includes('export') ||
        textContent.toLowerCase().includes('send');

      expect(hasRelevantInfo).toBe(true);
    }, 60000);

    it('clarifies ambiguous questions', async () => {
      const itinerary = await client.createItinerary({
        title: 'Clarification Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId, 'help');
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(sessionId, 'How does it work?')
      );

      assertNoErrors(events);

      const textContent = extractTextFromEvents(events);

      // Should ask for clarification or provide general overview
      const isHelpful =
        textContent.length > 50 &&
        (textContent.toLowerCase().includes('?') || // Asks clarifying question
         textContent.toLowerCase().includes('can') ||
         textContent.toLowerCase().includes('help'));

      expect(isHelpful).toBe(true);
    }, 60000);
  });

  describe('Error Handling in Help Mode', () => {
    it('handles unclear questions gracefully', async () => {
      const itinerary = await client.createItinerary({
        title: 'Unclear Question Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId, 'help');
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(sessionId, 'huh?')
      );

      // Should complete without errors
      assertNoErrors(events);
      assertStreamCompleted(events);

      const textContent = extractTextFromEvents(events);

      // Should provide some helpful response
      expect(textContent.length).toBeGreaterThan(0);
    }, 60000);

    it('redirects off-topic questions politely', async () => {
      const itinerary = await client.createItinerary({
        title: 'Off-topic Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId, 'help');
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'What is the capital of France?'
        )
      );

      assertNoErrors(events);

      const textContent = extractTextFromEvents(events);

      // Should either answer briefly or redirect to trip planning
      expect(textContent.length).toBeGreaterThan(0);

      // Might mention Paris or redirect to planning
      const isRelevant =
        textContent.toLowerCase().includes('paris') ||
        textContent.toLowerCase().includes('trip') ||
        textContent.toLowerCase().includes('help') ||
        textContent.toLowerCase().includes('plan');

      expect(isRelevant).toBe(true);
    }, 60000);
  });
});
