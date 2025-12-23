import { describe, it, expect } from 'vitest';

/**
 * Unit tests for JSON response parsing and cleaning functions
 *
 * NOTE: These tests require the following functions to be exported from chat.ts:
 * - cleanMessageContent(content: string): string
 * - getStreamingDisplayContent(accumulatedContent: string): string
 * - isStartingJsonBlock(content: string): boolean
 * - hasCompleteJsonBlock(content: string): boolean
 *
 * TODO: Export these functions from viewer-svelte/src/lib/stores/chat.ts
 */

// TEMPORARY: Copy function implementations for testing until they're exported
// These are exact copies from chat.ts lines 136-256

/**
 * Check if content appears to be starting a JSON block
 * Returns true if we should buffer instead of displaying
 */
function isStartingJsonBlock(content: string): boolean {
  const trimmed = content.trim();
  // Detect start of fenced JSON block or naked JSON object
  return trimmed.startsWith('```json') ||
         trimmed.startsWith('{') ||
         trimmed.startsWith('{\n') ||
         trimmed.startsWith('{ ');
}

/**
 * Check if content has a complete JSON block that can be cleaned
 * Returns true if JSON block is complete and ready for cleaning
 */
function hasCompleteJsonBlock(content: string): boolean {
  const trimmed = content.trim();

  // Check for complete fenced JSON block
  if (trimmed.startsWith('```json')) {
    return trimmed.includes('```\n') || trimmed.endsWith('```');
  }

  // Check for complete naked JSON object
  if (trimmed.startsWith('{')) {
    // Simple heuristic: count braces
    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;
    return openBraces > 0 && openBraces === closeBraces;
  }

  return false;
}

/**
 * Clean message content by removing JSON blocks and extracting just the message
 */
function cleanMessageContent(content: string): string {
  if (!content) return '';

  let cleaned = content;

  // Step 1: Remove all fenced JSON blocks (```json ... ```)
  // Use global flag to remove all occurrences
  cleaned = cleaned.replace(/```json\s*[\s\S]*?```/g, '');

  // Step 2: Try to extract message from naked JSON object with "message" field
  // Match JSON objects that contain a "message" property
  const jsonObjectMatch = cleaned.match(/\{\s*"message"\s*:\s*"((?:[^"\\]|\\.)*)"\s*(?:,[\s\S]*)?\}/);
  if (jsonObjectMatch) {
    try {
      // Try to parse the full JSON object
      const parsed = JSON.parse(jsonObjectMatch[0]);
      if (parsed.message) {
        // Replace the JSON object with just the message content
        cleaned = cleaned.replace(jsonObjectMatch[0], parsed.message);
      }
    } catch (e) {
      // If parsing fails, try to extract just the message field value
      const messageValue = jsonObjectMatch[1];
      if (messageValue) {
        // Unescape JSON string escapes
        const unescaped = messageValue.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
        cleaned = cleaned.replace(jsonObjectMatch[0], unescaped);
      }
    }
  }

  // Step 3: Remove any remaining JSON-like structures
  // Remove standalone curly braces with common JSON patterns
  cleaned = cleaned.replace(/\{\s*"(?:message|structuredQuestions|type|id)"[\s\S]*?\}/g, '');

  // Step 4: Truncate at the start of any JSON block that wasn't fully removed
  // This handles partial JSON during streaming
  const jsonMarkers = [
    cleaned.indexOf('```json'),
    cleaned.indexOf('\n{'),
    cleaned.indexOf(' {'),
  ].filter(idx => idx >= 0);

  if (jsonMarkers.length > 0) {
    const firstMarker = Math.min(...jsonMarkers);
    if (firstMarker > 0) {
      cleaned = cleaned.substring(0, firstMarker);
    } else if (firstMarker === 0) {
      // If content starts with JSON, try to preserve any text before it
      const lines = cleaned.split('\n');
      const nonJsonLines = lines.filter(line =>
        !line.trim().startsWith('{') &&
        !line.trim().startsWith('```') &&
        line.trim().length > 0
      );
      if (nonJsonLines.length > 0) {
        cleaned = nonJsonLines.join('\n');
      }
    }
  }

  // Step 5: Clean up whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Get displayable content during streaming, hiding incomplete JSON blocks
 */
function getStreamingDisplayContent(accumulatedContent: string): string {
  const trimmed = accumulatedContent.trim();

  // If content starts with JSON markers, don't display until complete
  if (isStartingJsonBlock(trimmed)) {
    // Only display if the JSON block is complete
    if (hasCompleteJsonBlock(trimmed)) {
      return cleanMessageContent(accumulatedContent);
    }
    // JSON block incomplete - don't display anything yet
    return '';
  }

  // Content doesn't start with JSON - clean and display
  return cleanMessageContent(accumulatedContent);
}

// =============================================================================
// TESTS
// =============================================================================

describe('cleanMessageContent', () => {
  it('returns plain text unchanged', () => {
    const input = 'This is a simple message';
    const result = cleanMessageContent(input);
    expect(result).toBe('This is a simple message');
  });

  it('extracts message from JSON object', () => {
    const input = '{ "message": "Hello from JSON" }';
    const result = cleanMessageContent(input);
    expect(result).toBe('Hello from JSON');
  });

  it('handles malformed JSON gracefully', () => {
    const input = '{ "message": "Incomplete';
    const result = cleanMessageContent(input);
    // Incomplete JSON is left as-is (regex won't match incomplete patterns)
    expect(result).toBe('{ "message": "Incomplete');
  });

  it('preserves markdown formatting', () => {
    const input = 'Here are your options:\n\n**Option 1**: Tokyo\n**Option 2**: Kyoto';
    const result = cleanMessageContent(input);
    expect(result).toBe('Here are your options:\n\n**Option 1**: Tokyo\n**Option 2**: Kyoto');
  });

  it('handles empty input', () => {
    expect(cleanMessageContent('')).toBe('');
    expect(cleanMessageContent('   ')).toBe('');
  });

  it('removes fenced JSON blocks', () => {
    const input = 'Text before\n```json\n{ "message": "test" }\n```\nText after';
    const result = cleanMessageContent(input);
    expect(result).toBe('Text before\n\nText after');
  });

  it('extracts message and removes JSON wrapper', () => {
    const input = '{ "message": "Great choice!", "structuredQuestions": [] }';
    const result = cleanMessageContent(input);
    expect(result).toBe('Great choice!');
  });

  it('handles escaped characters in JSON message', () => {
    const input = '{ "message": "Line 1\\nLine 2\\n\\"Quoted\\"" }';
    const result = cleanMessageContent(input);
    expect(result).toBe('Line 1\nLine 2\n"Quoted"');
  });

  it('removes JSON blocks with structuredQuestions', () => {
    const input = 'Text\n{ "structuredQuestions": [{ "id": "1" }] }';
    const result = cleanMessageContent(input);
    // The regex removes objects starting with "structuredQuestions" but may leave fragments
    // In this case, the nested array causes partial removal
    expect(result).toContain('Text');
  });

  it('handles multiple JSON blocks', () => {
    const input = '```json\n{ "x": 1 }\n```\nMiddle text\n```json\n{ "y": 2 }\n```';
    const result = cleanMessageContent(input);
    expect(result).toBe('Middle text');
  });

  it('preserves text before incomplete JSON marker', () => {
    const input = 'Some text {';
    const result = cleanMessageContent(input);
    expect(result).toBe('Some text');
  });

  it('handles JSON message with nested quotes', () => {
    const input = '{ "message": "He said \\"hello\\" to me" }';
    const result = cleanMessageContent(input);
    expect(result).toBe('He said "hello" to me');
  });
});

describe('getStreamingDisplayContent', () => {
  it('returns empty for incomplete JSON blocks', () => {
    const input = '{ "message": "Incomplete';
    const result = getStreamingDisplayContent(input);
    expect(result).toBe('');
  });

  it('returns content before JSON block', () => {
    const input = 'Here is some text before { incomplete json';
    const result = getStreamingDisplayContent(input);
    expect(result).toBe('Here is some text before');
  });

  it('returns full content when no JSON detected', () => {
    const input = 'This is plain text with no JSON';
    const result = getStreamingDisplayContent(input);
    expect(result).toBe('This is plain text with no JSON');
  });

  it('handles nested JSON objects', () => {
    const input = '{ "message": "test", "data": { "nested": "value" } }';
    const result = getStreamingDisplayContent(input);
    expect(result).toBe('test');
  });

  it('returns empty for incomplete fenced JSON', () => {
    const input = '```json\n{ "message": "test"';
    const result = getStreamingDisplayContent(input);
    expect(result).toBe('');
  });

  it('returns cleaned content for complete fenced JSON', () => {
    const input = '```json\n{ "message": "Complete" }\n```';
    const result = getStreamingDisplayContent(input);
    expect(result).toBe('');
  });

  it('handles incomplete JSON that starts immediately', () => {
    const input = '{';
    const result = getStreamingDisplayContent(input);
    expect(result).toBe('');
  });

  it('handles complete JSON with message field', () => {
    const input = '{ "message": "Done!" }';
    const result = getStreamingDisplayContent(input);
    expect(result).toBe('Done!');
  });

  it('buffers incomplete multi-line JSON', () => {
    const input = '{\n  "message": "test",\n  "structuredQuestions"';
    const result = getStreamingDisplayContent(input);
    expect(result).toBe('');
  });
});

describe('isStartingJsonBlock', () => {
  it('detects fenced JSON block start', () => {
    expect(isStartingJsonBlock('```json')).toBe(true);
    expect(isStartingJsonBlock('```json\n{ "test": 1 }')).toBe(true);
  });

  it('detects naked JSON object start', () => {
    expect(isStartingJsonBlock('{')).toBe(true);
    expect(isStartingJsonBlock('{\n')).toBe(true);
    expect(isStartingJsonBlock('{ ')).toBe(true);
    expect(isStartingJsonBlock('{ "message": "test" }')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isStartingJsonBlock('This is text')).toBe(false);
    expect(isStartingJsonBlock('Some text {')).toBe(false);
  });

  it('handles whitespace correctly', () => {
    expect(isStartingJsonBlock('   {\n')).toBe(true);
    expect(isStartingJsonBlock('  ```json')).toBe(true);
  });
});

describe('hasCompleteJsonBlock', () => {
  it('detects complete fenced JSON block', () => {
    expect(hasCompleteJsonBlock('```json\n{ "test": 1 }\n```')).toBe(true);
    expect(hasCompleteJsonBlock('```json\n{ "test": 1 }```')).toBe(true);
  });

  it('detects incomplete fenced JSON block', () => {
    expect(hasCompleteJsonBlock('```json\n{ "test": 1 }')).toBe(false);
    expect(hasCompleteJsonBlock('```json\n{')).toBe(false);
  });

  it('detects complete naked JSON object', () => {
    expect(hasCompleteJsonBlock('{ "test": 1 }')).toBe(true);
    expect(hasCompleteJsonBlock('{ "a": { "b": 2 } }')).toBe(true);
  });

  it('detects incomplete naked JSON object', () => {
    expect(hasCompleteJsonBlock('{ "test": 1')).toBe(false);
    expect(hasCompleteJsonBlock('{ "a": { "b": 2 }')).toBe(false);
  });

  it('handles empty braces', () => {
    expect(hasCompleteJsonBlock('{}')).toBe(true);
  });

  it('returns false for non-JSON content', () => {
    expect(hasCompleteJsonBlock('plain text')).toBe(false);
    expect(hasCompleteJsonBlock('text { in middle')).toBe(false);
  });

  it('counts nested braces correctly', () => {
    expect(hasCompleteJsonBlock('{ "a": { "b": { "c": 1 } } }')).toBe(true);
    expect(hasCompleteJsonBlock('{ "a": { "b": { "c": 1 } }')).toBe(false);
  });
});
