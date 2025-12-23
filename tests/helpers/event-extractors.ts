/**
 * Event extraction utilities for E2E tests
 * Extracts structured data from SSE event streams
 */

import type { SSEEvent } from './sse-parser.js';
import type { StructuredQuestion } from '../../src/domain/types/trip-designer.js';

/**
 * Extract all structured questions from SSE events
 * Returns flat array of all questions across all question events
 */
export function extractQuestionsFromEvents(events: SSEEvent[]): StructuredQuestion[] {
  const questions: StructuredQuestion[] = [];

  for (const event of events) {
    if (event.type === 'structured_questions') {
      questions.push(...event.questions);
    }
  }

  return questions;
}

/**
 * Extract and concatenate all text content from events
 */
export function extractTextFromEvents(events: SSEEvent[]): string {
  let text = '';

  for (const event of events) {
    if (event.type === 'text') {
      text += event.content;
    }
  }

  return text;
}

/**
 * Extract all tool calls from events
 */
export function extractToolCallsFromEvents(events: SSEEvent[]): Array<{ name: string; arguments: Record<string, unknown> }> {
  const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

  for (const event of events) {
    if (event.type === 'tool_call') {
      toolCalls.push({
        name: event.name,
        arguments: event.arguments,
      });
    }
  }

  return toolCalls;
}

/**
 * Extract all tool results from events
 */
export function extractToolResultsFromEvents(events: SSEEvent[]): Array<{ name: string; result: unknown; success: boolean }> {
  const results: Array<{ name: string; result: unknown; success: boolean }> = [];

  for (const event of events) {
    if (event.type === 'tool_result') {
      results.push({
        name: event.name,
        result: event.result,
        success: event.success,
      });
    }
  }

  return results;
}

/**
 * Get done event metadata if present
 */
export function getDoneEventMetadata(events: SSEEvent[]): {
  itineraryUpdated: boolean;
  segmentsModified?: string[];
  tokens?: { input: number; output: number; total: number };
  cost?: { input: number; output: number; total: number };
} | null {
  const doneEvent = events.find(e => e.type === 'done');

  if (!doneEvent || doneEvent.type !== 'done') {
    return null;
  }

  return {
    itineraryUpdated: doneEvent.itineraryUpdated,
    segmentsModified: doneEvent.segmentsModified,
    tokens: doneEvent.tokens,
    cost: doneEvent.cost,
  };
}

/**
 * Check if events contain any tool call with specific name
 */
export function hasToolCall(events: SSEEvent[], toolName: string): boolean {
  return events.some(e => e.type === 'tool_call' && e.name === toolName);
}

/**
 * Count specific event type occurrences
 */
export function countEventType(events: SSEEvent[], eventType: SSEEvent['type']): number {
  return events.filter(e => e.type === eventType).length;
}

/**
 * Extract error messages from events
 */
export function extractErrorMessages(events: SSEEvent[]): string[] {
  const errors: string[] = [];

  for (const event of events) {
    if (event.type === 'error') {
      errors.push(event.message);
    }
  }

  return errors;
}

/**
 * Extract all location mentions from tool results
 * Useful for testing visualization triggers
 */
export function extractLocationsFromEvents(events: SSEEvent[]): Array<{ name: string; coordinates?: [number, number] }> {
  const locations: Array<{ name: string; coordinates?: [number, number] }> = [];

  for (const event of events) {
    if (event.type === 'tool_result' && event.success && event.result) {
      // Check if result has location data
      const result = event.result as Record<string, unknown>;

      // Single location
      if (result.location && typeof result.location === 'object') {
        const loc = result.location as Record<string, unknown>;
        if (loc.name && typeof loc.name === 'string') {
          locations.push({
            name: loc.name,
            coordinates: loc.coordinates as [number, number] | undefined,
          });
        }
      }

      // Array of locations
      if (Array.isArray(result.locations)) {
        for (const loc of result.locations) {
          if (loc && typeof loc === 'object' && 'name' in loc) {
            const location = loc as Record<string, unknown>;
            if (typeof location.name === 'string') {
              locations.push({
                name: location.name,
                coordinates: location.coordinates as [number, number] | undefined,
              });
            }
          }
        }
      }
    }
  }

  return locations;
}
