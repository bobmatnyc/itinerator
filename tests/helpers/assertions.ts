/**
 * Custom assertions for Itinerizer E2E tests
 * Provides type-safe validation helpers
 */

import type { Itinerary, Segment, Location } from '../../src/domain/types/index.js';
import type { TripDesignerSession, StructuredQuestion } from '../../src/domain/types/trip-designer.js';
import type { SSEEvent } from './sse-parser.js';

/**
 * Assert that an object is a valid Itinerary
 */
export function assertValidItinerary(obj: unknown): asserts obj is Itinerary {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Expected Itinerary object');
  }

  const itinerary = obj as Partial<Itinerary>;

  // Required fields
  if (!itinerary.id || typeof itinerary.id !== 'string') {
    throw new Error('Itinerary must have string id');
  }
  if (!itinerary.title || typeof itinerary.title !== 'string') {
    throw new Error('Itinerary must have string title');
  }
  if (!itinerary.status) {
    throw new Error('Itinerary must have status');
  }
  if (!Array.isArray(itinerary.segments)) {
    throw new Error('Itinerary must have segments array');
  }
  if (!Array.isArray(itinerary.destinations)) {
    throw new Error('Itinerary must have destinations array');
  }
  if (!Array.isArray(itinerary.tags)) {
    throw new Error('Itinerary must have tags array');
  }
  if (!itinerary.createdAt) {
    throw new Error('Itinerary must have createdAt timestamp');
  }
  if (!itinerary.updatedAt) {
    throw new Error('Itinerary must have updatedAt timestamp');
  }
}

/**
 * Assert that an object is a valid Session
 */
export function assertValidSession(obj: unknown): asserts obj is TripDesignerSession {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Expected Session object');
  }

  const session = obj as Partial<TripDesignerSession>;

  if (!session.id || typeof session.id !== 'string') {
    throw new Error('Session must have string id');
  }
  if (!session.itineraryId || typeof session.itineraryId !== 'string') {
    throw new Error('Session must have string itineraryId');
  }
  if (!Array.isArray(session.messages)) {
    throw new Error('Session must have messages array');
  }
  if (!session.createdAt || !(session.createdAt instanceof Date)) {
    throw new Error('Session must have createdAt Date');
  }
  if (!session.lastActiveAt || !(session.lastActiveAt instanceof Date)) {
    throw new Error('Session must have lastActiveAt Date');
  }
  if (!session.metadata || typeof session.metadata !== 'object') {
    throw new Error('Session must have metadata object');
  }
}

/**
 * Check if SSE event contains structured questions
 */
export function assertHasStructuredQuestions(event: SSEEvent): boolean {
  return event.type === 'structured_questions' && Array.isArray(event.questions) && event.questions.length > 0;
}

/**
 * Assert that structured questions array contains exactly ONE question
 * This enforces the design principle of asking one question at a time
 */
export function assertOneQuestionOnly(questions: StructuredQuestion[]): void {
  if (!Array.isArray(questions)) {
    throw new Error('Expected questions to be an array');
  }

  if (questions.length === 0) {
    throw new Error('Expected at least one question, got zero');
  }

  if (questions.length > 1) {
    throw new Error(
      `Expected exactly ONE question, got ${questions.length}:\n` +
      questions.map((q, i) => `  ${i + 1}. ${q.question}`).join('\n')
    );
  }

  // Validate the single question structure
  const question = questions[0];
  if (!question.id || typeof question.id !== 'string') {
    throw new Error('Question must have string id');
  }
  if (!question.type) {
    throw new Error('Question must have type');
  }
  if (!question.question || typeof question.question !== 'string') {
    throw new Error('Question must have question text');
  }
}

/**
 * Assert that SSE event is a valid tool call
 */
export function assertValidToolCall(event: SSEEvent, expectedTool?: string): void {
  if (event.type !== 'tool_call') {
    throw new Error(`Expected tool_call event, got ${event.type}`);
  }

  if (!event.name || typeof event.name !== 'string') {
    throw new Error('Tool call must have name');
  }

  if (!event.arguments || typeof event.arguments !== 'object') {
    throw new Error('Tool call must have arguments object');
  }

  if (expectedTool && event.name !== expectedTool) {
    throw new Error(`Expected tool ${expectedTool}, got ${event.name}`);
  }
}

/**
 * Extract location markers from SSE events for map visualization
 * Returns array of locations detected in the conversation
 */
export function assertValidVisualizationTrigger(events: SSEEvent[]): Location[] {
  const locations: Location[] = [];

  for (const event of events) {
    // Look for tool calls that might contain location data
    if (event.type === 'tool_result' && event.result && typeof event.result === 'object') {
      const result = event.result as Record<string, unknown>;

      // Check for location in result
      if (result.location && typeof result.location === 'object') {
        const loc = result.location as Partial<Location>;
        if (loc.name && typeof loc.name === 'string') {
          locations.push({
            name: loc.name,
            city: loc.city,
            country: loc.country,
            type: loc.type || 'OTHER',
            coordinates: loc.coordinates,
          });
        }
      }

      // Check for array of locations
      if (Array.isArray(result.locations)) {
        for (const loc of result.locations) {
          if (loc && typeof loc === 'object' && 'name' in loc) {
            const location = loc as Partial<Location>;
            if (location.name && typeof location.name === 'string') {
              locations.push({
                name: location.name,
                city: location.city,
                country: location.country,
                type: location.type || 'OTHER',
                coordinates: location.coordinates,
              });
            }
          }
        }
      }
    }
  }

  return locations;
}

/**
 * Assert that a segment is valid
 */
export function assertValidSegment(obj: unknown): asserts obj is Segment {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Expected Segment object');
  }

  const segment = obj as Partial<Segment>;

  if (!segment.id || typeof segment.id !== 'string') {
    throw new Error('Segment must have string id');
  }
  if (!segment.type) {
    throw new Error('Segment must have type');
  }
  if (!segment.status) {
    throw new Error('Segment must have status');
  }
  if (!segment.startDatetime) {
    throw new Error('Segment must have startDatetime');
  }
  if (!segment.endDatetime) {
    throw new Error('Segment must have endDatetime');
  }
  if (!Array.isArray(segment.travelerIds)) {
    throw new Error('Segment must have travelerIds array');
  }
}

/**
 * Assert that events contain at least one error
 */
export function assertHasError(events: SSEEvent[]): void {
  const hasError = events.some(event => event.type === 'error');
  if (!hasError) {
    throw new Error('Expected at least one error event in stream');
  }
}

/**
 * Assert that events do NOT contain any errors
 */
export function assertNoErrors(events: SSEEvent[]): void {
  const errorEvents = events.filter(event => event.type === 'error');
  if (errorEvents.length > 0) {
    const messages = errorEvents.map(e => e.type === 'error' ? e.message : 'Unknown error');
    throw new Error(`Expected no errors, but found ${errorEvents.length}:\n${messages.join('\n')}`);
  }
}

/**
 * Assert that stream completed successfully
 */
export function assertStreamCompleted(events: SSEEvent[]): void {
  const doneEvent = events.find(event => event.type === 'done');
  if (!doneEvent) {
    throw new Error('Expected stream to complete with done event');
  }
}

/**
 * Assert that itinerary was updated during stream
 */
export function assertItineraryUpdated(events: SSEEvent[]): void {
  const doneEvent = events.find(event => event.type === 'done');
  if (!doneEvent) {
    throw new Error('Expected done event in stream');
  }

  if (doneEvent.type === 'done' && !doneEvent.itineraryUpdated) {
    throw new Error('Expected itinerary to be updated');
  }
}
