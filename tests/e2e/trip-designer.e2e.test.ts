/**
 * Trip Designer E2E Tests
 *
 * REAL LLM API TESTS - These make actual calls to OpenRouter
 *
 * Run with: npm run test:e2e
 * Requires: ITINERIZER_TEST_API_KEY environment variable
 *
 * Features tested:
 * - New trip discovery flow
 * - ONE question at a time enforcement
 * - Context awareness from existing itineraries
 * - Tool execution (flights, hotels, activities)
 * - Session management and cleanup
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  TestClient,
  loadItinerary,
  collectSSEEvents,
  assertOneQuestionOnly,
  assertNoErrors,
  assertStreamCompleted,
  assertItineraryUpdated,
  extractQuestionsFromEvents,
  extractTextFromEvents,
  extractToolCallsFromEvents,
  hasToolCall,
} from '../helpers/index.js';

describe('Trip Designer E2E - New Trip Flow', () => {
  let client: TestClient;
  let sessionId: string | null = null;
  let itineraryId: string | null = null;

  beforeAll(() => {
    client = new TestClient();
  });

  afterEach(async () => {
    // Cleanup resources
    if (itineraryId) {
      await client.deleteItinerary(itineraryId).catch(() => {});
      itineraryId = null;
    }
    sessionId = null;
  });

  describe('First Message - New Trip Discovery', () => {
    it('asks ONE structured question on initial message', async () => {
      // Create fresh itinerary
      const itinerary = await client.createItinerary({
        title: 'E2E New Trip Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      // Create session
      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      // First message: vague planning intent
      const events = await collectSSEEvents(
        await client.sendMessage(sessionId, 'I want to plan a trip')
      );

      // Verify stream completed successfully
      assertNoErrors(events);
      assertStreamCompleted(events);

      // Extract structured questions
      const questions = extractQuestionsFromEvents(events);

      // CRITICAL: Should ask exactly ONE question
      assertOneQuestionOnly(questions);

      // Verify question structure
      const question = questions[0];
      expect(question.id).toBeTruthy();
      expect(question.type).toBeTruthy();
      expect(question.question).toBeTruthy();
      expect(question.question.length).toBeGreaterThan(0);
    }, 60000);

    it('asks NEXT question after receiving answer (no repeat)', async () => {
      const itinerary = await client.createItinerary({
        title: 'E2E Sequential Questions Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      // First message
      const events1 = await collectSSEEvents(
        await client.sendMessage(sessionId, 'I want to plan a trip')
      );
      assertNoErrors(events1);

      const question1 = extractQuestionsFromEvents(events1)[0];
      const firstQuestionText = question1?.question.toLowerCase() || '';

      // Answer the first question
      const events2 = await collectSSEEvents(
        await client.sendMessage(sessionId, 'I want to go to Japan')
      );
      assertNoErrors(events2);
      assertStreamCompleted(events2);

      // Should ask a DIFFERENT question
      const questions2 = extractQuestionsFromEvents(events2);
      if (questions2.length > 0) {
        assertOneQuestionOnly(questions2);

        const secondQuestionText = questions2[0].question.toLowerCase();

        // Should NOT be the same question
        expect(secondQuestionText).not.toBe(firstQuestionText);

        // If first question was about destination, second should be about something else
        if (firstQuestionText.includes('where') || firstQuestionText.includes('destination')) {
          expect(secondQuestionText).not.toContain('where');
          expect(secondQuestionText).not.toContain('destination');
        }
      }
    }, 60000);
  });

  describe('Existing Itinerary Context', () => {
    it('acknowledges existing content and skips redundant questions', async () => {
      // Use planning-phase fixture (has destination and dates set)
      const itinerary = loadItinerary('planning-phase');

      // Create session with existing context
      const session = await client.createSession(itinerary.id);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(sessionId, 'Help me plan my trip')
      );

      assertNoErrors(events);
      assertStreamCompleted(events);

      const textContent = extractTextFromEvents(events);

      // Should acknowledge existing trip details
      expect(textContent.toLowerCase()).toContain('tokyo');

      // Should NOT ask about already-known information
      const questions = extractQuestionsFromEvents(events);
      if (questions.length > 0) {
        const questionTexts = questions.map(q => q.question.toLowerCase()).join(' ');

        // Should not ask about destination again
        expect(questionTexts).not.toMatch(/where.*want.*go|destination/);
      }
    }, 60000);

    it('uses existing trip preferences in responses', async () => {
      const itinerary = loadItinerary('planning-phase');

      const session = await client.createSession(itinerary.id);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(sessionId, 'What should I do in Tokyo?')
      );

      assertNoErrors(events);

      const textContent = extractTextFromEvents(events);

      // Should reference existing preferences (culture, food, technology)
      const hasRelevantContent =
        textContent.toLowerCase().includes('culture') ||
        textContent.toLowerCase().includes('food') ||
        textContent.toLowerCase().includes('technology') ||
        textContent.toLowerCase().includes('museum') ||
        textContent.toLowerCase().includes('restaurant');

      expect(hasRelevantContent).toBe(true);
    }, 60000);
  });

  describe('Tool Execution - Flights', () => {
    it('calls add_flight when flight details provided', async () => {
      const itinerary = await client.createItinerary({
        title: 'E2E Flight Test',
        startDate: '2025-07-15T00:00:00.000Z',
        endDate: '2025-07-25T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Add a flight from SFO to NRT on July 15, 2025 at 1:00 PM'
        )
      );

      assertNoErrors(events);
      assertStreamCompleted(events);

      // Should call add_flight tool
      expect(hasToolCall(events, 'add_flight')).toBe(true);

      // Verify tool call arguments
      const toolCalls = extractToolCallsFromEvents(events);
      const addFlightCall = toolCalls.find(tc => tc.name === 'add_flight');

      expect(addFlightCall).toBeDefined();
      expect(addFlightCall?.arguments.origin).toBeTruthy();
      expect(addFlightCall?.arguments.destination).toBeTruthy();
      expect(addFlightCall?.arguments.departureTime).toBeTruthy();
    }, 60000);

    it('updates itinerary after successful flight addition', async () => {
      const itinerary = await client.createItinerary({
        title: 'E2E Flight Update Test',
        startDate: '2025-07-15T00:00:00.000Z',
        endDate: '2025-07-25T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Add a flight from LAX to Paris CDG on July 15, 2025'
        )
      );

      assertNoErrors(events);
      assertItineraryUpdated(events);

      // Verify actual itinerary was updated
      const updated = await client.getItinerary(itineraryId);
      expect(updated.segments.length).toBeGreaterThan(0);

      const flightSegment = updated.segments.find(s => s.type === 'FLIGHT');
      expect(flightSegment).toBeDefined();
    }, 60000);
  });

  describe('Tool Execution - Hotels', () => {
    it('calls add_hotel when hotel details provided', async () => {
      const itinerary = await client.createItinerary({
        title: 'E2E Hotel Test',
        startDate: '2025-07-15T00:00:00.000Z',
        endDate: '2025-07-25T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Book a hotel in Paris from July 16-20, 2025'
        )
      );

      assertNoErrors(events);
      assertStreamCompleted(events);

      // Should call add_hotel or update_itinerary
      const toolCalls = extractToolCallsFromEvents(events);
      const hasHotelTool = toolCalls.some(tc =>
        tc.name === 'add_hotel' ||
        tc.name === 'add_accommodation' ||
        tc.name === 'update_itinerary'
      );

      expect(hasHotelTool).toBe(true);
    }, 60000);
  });

  describe('Tool Execution - Activities', () => {
    it('calls add_activity when activity mentioned', async () => {
      const itinerary = loadItinerary('planning-phase');

      const session = await client.createSession(itinerary.id);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Add a visit to TeamLab Borderless museum on June 16 at 2 PM'
        )
      );

      assertNoErrors(events);

      // Should call add_activity or update_itinerary
      const toolCalls = extractToolCallsFromEvents(events);
      const hasActivityTool = toolCalls.some(tc =>
        tc.name === 'add_activity' ||
        tc.name === 'update_itinerary'
      );

      expect(hasActivityTool).toBe(true);
    }, 60000);
  });

  describe('Error Handling', () => {
    it('handles invalid dates gracefully', async () => {
      const itinerary = await client.createItinerary({
        title: 'E2E Error Test',
        startDate: '2025-07-15T00:00:00.000Z',
        endDate: '2025-07-25T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Add a flight on February 30th, 2025'
        )
      );

      // Stream should complete (even with error)
      assertStreamCompleted(events);

      // Should either handle gracefully in text or emit error event
      const textContent = extractTextFromEvents(events);
      const hasErrorEvent = events.some(e => e.type === 'error');
      const mentionsInvalid = textContent.toLowerCase().includes('invalid') ||
                               textContent.toLowerCase().includes('not valid');

      expect(hasErrorEvent || mentionsInvalid).toBe(true);
    }, 60000);

    it('recovers from tool execution failures', async () => {
      const itinerary = await client.createItinerary({
        title: 'E2E Tool Failure Test',
        startDate: '2025-07-15T00:00:00.000Z',
        endDate: '2025-07-25T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      // Send incomplete request (missing critical info)
      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Add a flight'
        )
      );

      // Should complete successfully
      assertStreamCompleted(events);

      // Should ask for missing information
      const questions = extractQuestionsFromEvents(events);
      const textContent = extractTextFromEvents(events);

      const asksForInfo =
        questions.length > 0 ||
        textContent.toLowerCase().includes('where') ||
        textContent.toLowerCase().includes('when') ||
        textContent.toLowerCase().includes('need');

      expect(asksForInfo).toBe(true);
    }, 60000);
  });

  describe('Multi-turn Conversation', () => {
    it('maintains context across multiple messages', async () => {
      const itinerary = await client.createItinerary({
        title: 'E2E Context Test',
        startDate: '2025-07-15T00:00:00.000Z',
        endDate: '2025-07-25T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      // Message 1: Set destination
      await collectSSEEvents(
        await client.sendMessage(sessionId, 'I want to go to Rome')
      );

      // Message 2: Reference should be remembered
      const events2 = await collectSSEEvents(
        await client.sendMessage(sessionId, 'What are the best hotels there?')
      );

      assertNoErrors(events2);

      const textContent = extractTextFromEvents(events2);

      // Should reference Rome in response
      expect(textContent.toLowerCase()).toContain('rome');
    }, 60000);

    it('builds on previous answers progressively', async () => {
      const itinerary = await client.createItinerary({
        title: 'E2E Progressive Test',
        startDate: '2025-07-15T00:00:00.000Z',
        endDate: '2025-07-25T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      // Message 1
      await collectSSEEvents(
        await client.sendMessage(sessionId, 'I want to visit Barcelona')
      );

      // Message 2
      await collectSSEEvents(
        await client.sendMessage(sessionId, 'I love art and architecture')
      );

      // Message 3: Should consider both previous answers
      const events3 = await collectSSEEvents(
        await client.sendMessage(sessionId, 'What should I see?')
      );

      assertNoErrors(events3);

      const textContent = extractTextFromEvents(events3);

      // Should mention art/architecture attractions in Barcelona
      const hasRelevantContent =
        textContent.toLowerCase().includes('gaud') ||
        textContent.toLowerCase().includes('sagrada') ||
        textContent.toLowerCase().includes('museum') ||
        textContent.toLowerCase().includes('architecture');

      expect(hasRelevantContent).toBe(true);
    }, 60000);
  });
});
