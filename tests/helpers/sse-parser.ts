/**
 * SSE (Server-Sent Events) stream parser for tests
 * Handles parsing of streaming responses from the Trip Designer API
 */

import type { StructuredQuestion } from '../../src/domain/types/trip-designer.js';

/**
 * Token usage data from stream
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * Cost data from stream
 */
export interface CostData {
  input: number;
  output: number;
  total: number;
}

/**
 * SSE event types emitted by the Trip Designer
 */
export type SSEEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: unknown; success: boolean }
  | { type: 'structured_questions'; questions: StructuredQuestion[] }
  | { type: 'done'; itineraryUpdated: boolean; segmentsModified?: string[]; tokens?: TokenUsage; cost?: CostData }
  | { type: 'error'; message: string; retryable?: boolean };

/**
 * Parse SSE stream from Response
 */
export async function* parseSSEStream(response: Response): AsyncGenerator<SSEEvent> {
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Append new data to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      let currentEvent: string | null = null;
      let currentData: string | null = null;

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6).trim();
        } else if (line === '' && currentEvent && currentData) {
          // Complete event received
          try {
            const data = JSON.parse(currentData);
            yield { type: currentEvent, ...data } as SSEEvent;
          } catch (e) {
            console.error('Failed to parse SSE data:', currentData, e);
            // Yield as error event
            yield {
              type: 'error',
              message: `Failed to parse SSE data: ${e instanceof Error ? e.message : String(e)}`,
            };
          }
          currentEvent = null;
          currentData = null;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Collect all events from SSE stream into an array
 * Useful for tests that need to examine the full event sequence
 */
export async function collectSSEEvents(response: Response): Promise<SSEEvent[]> {
  const events: SSEEvent[] = [];
  for await (const event of parseSSEStream(response)) {
    events.push(event);
  }
  return events;
}

/**
 * Collect only text content from SSE stream
 */
export async function collectTextContent(response: Response): Promise<string> {
  let text = '';
  for await (const event of parseSSEStream(response)) {
    if (event.type === 'text') {
      text += event.content;
    }
  }
  return text;
}

/**
 * Wait for specific event type in stream
 */
export async function waitForEvent<T extends SSEEvent['type']>(
  response: Response,
  eventType: T
): Promise<Extract<SSEEvent, { type: T }> | null> {
  for await (const event of parseSSEStream(response)) {
    if (event.type === eventType) {
      return event as Extract<SSEEvent, { type: T }>;
    }
  }
  return null;
}

/**
 * Count events by type
 */
export async function countEventsByType(response: Response): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for await (const event of parseSSEStream(response)) {
    counts[event.type] = (counts[event.type] || 0) + 1;
  }
  return counts;
}
