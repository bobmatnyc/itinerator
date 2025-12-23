/**
 * Test helpers - Re-exports for clean imports
 * @module tests/helpers
 */

// Test client
export { TestClient, createTestClient } from './test-client.js';
export type { CreateSessionResponse, TestClientConfig } from './test-client.js';

// SSE parser
export {
  parseSSEStream,
  collectSSEEvents,
  collectTextContent,
  waitForEvent,
  countEventsByType,
} from './sse-parser.js';
export type { SSEEvent, TokenUsage, CostData } from './sse-parser.js';

// Fixtures
export {
  loadItinerary,
  loadPersona,
  clearFixtureCache,
  createMinimalItinerary,
  createMinimalPersona,
} from './fixtures.js';
export type { Persona, ItineraryFixtureName, PersonaFixtureName } from './fixtures.js';

// Assertions
export {
  assertValidItinerary,
  assertValidSession,
  assertHasStructuredQuestions,
  assertOneQuestionOnly,
  assertValidToolCall,
  assertValidVisualizationTrigger,
  assertValidSegment,
  assertHasError,
  assertNoErrors,
  assertStreamCompleted,
  assertItineraryUpdated,
} from './assertions.js';

// Event extractors
export {
  extractQuestionsFromEvents,
  extractTextFromEvents,
  extractToolCallsFromEvents,
  extractToolResultsFromEvents,
  getDoneEventMetadata,
  hasToolCall,
  countEventType,
  extractErrorMessages,
  extractLocationsFromEvents,
} from './event-extractors.js';
