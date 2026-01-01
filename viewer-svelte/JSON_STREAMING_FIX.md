# JSON Streaming Flash Fix

## Problem
During streaming responses, raw JSON like `{"message": "...", "structuredQuestions": [...]}` would briefly flash on screen before being cleaned. This happened because the `cleanMessageContent` function was designed to work on **complete** content, but during streaming it received **partial** content.

## Root Cause
When the LLM output starts with `{`, the partial JSON `{` or `{"message` would be passed to `cleanMessageContent()` immediately, which couldn't clean it properly since it was incomplete. This caused the JSON to be displayed briefly until more content arrived.

## Solution
Implemented a **buffering strategy** that detects JSON blocks and delays display until they're complete:

### New Helper Functions

1. **`isStartingJsonBlock(content: string)`**: Detects if content starts with JSON markers
   - Checks for ````json`, `{`, `{\n`, `{ `
   - Returns `true` if we should buffer instead of displaying

2. **`hasCompleteJsonBlock(content: string)`**: Checks if JSON block is complete
   - For fenced blocks: looks for closing ` ``` `
   - For naked JSON: counts opening `{` and closing `}` braces
   - Returns `true` when JSON is ready to be cleaned

3. **`getStreamingDisplayContent(accumulatedContent: string)`**: Smart display logic
   - If content starts with JSON markers:
     - If complete: clean and display
     - If incomplete: return empty string (hide until complete)
   - If content doesn't start with JSON: clean and display immediately

### Changes Made

**File**: `/Users/masa/Projects/itinerator/viewer-svelte/src/lib/stores/chat.ts`

1. Added three new helper functions before `cleanMessageContent()`
2. Updated `sendMessageStreaming()` line 396:
   ```typescript
   // Before
   streamingContent.set(cleanMessageContent(accumulatedContent));

   // After
   streamingContent.set(getStreamingDisplayContent(accumulatedContent));
   ```

3. Updated `sendContextMessage()` line 549 with the same change

## How It Works

### Streaming Flow:
1. **First chunk arrives**: `{`
   - `isStartingJsonBlock()` → `true`
   - `hasCompleteJsonBlock()` → `false` (only opening brace)
   - Display: `` (empty - nothing shown)

2. **More chunks arrive**: `{"message": "Hello`
   - Still incomplete JSON
   - Display: `` (still nothing shown)

3. **Final chunks arrive**: `{"message": "Hello world", "structuredQuestions": [...]}`
   - `hasCompleteJsonBlock()` → `true` (matching braces)
   - `cleanMessageContent()` extracts "Hello world"
   - Display: `Hello world` (clean message appears)

### Regular Text Flow:
1. **First chunk**: `Hello`
   - `isStartingJsonBlock()` → `false`
   - `cleanMessageContent()` → `Hello`
   - Display: `Hello` (streams normally)

2. **More chunks**: `Hello world`
   - Still doesn't start with JSON
   - Display: `Hello world` (continues streaming)

## Benefits

1. **No JSON Flash**: Users never see raw JSON during streaming
2. **Smooth Experience**: Content appears clean from the start
3. **Works with Both Formats**: Handles fenced JSON blocks and naked JSON objects
4. **Performance**: Minimal overhead - just string checks
5. **Backward Compatible**: Final messages still use `cleanMessageContent()` for complete content

## Testing

To verify the fix:
1. Start a chat session
2. Send a message that triggers a JSON response
3. Watch the streaming output - should never show `{`, `"message"`, or `"structuredQuestions"`
4. Only the clean message content should appear

## Edge Cases Handled

- Empty content: Returns empty string
- Partial JSON: Waits for completion
- Mixed content: If text comes before JSON, displays text immediately
- Malformed JSON: Falls back to existing `cleanMessageContent()` logic
- Nested JSON: Brace counting handles nested objects

## Code Location

- **File**: `viewer-svelte/src/lib/stores/chat.ts`
- **Lines Added**: ~55 lines (3 new functions)
- **Lines Modified**: 2 (streaming display calls)
- **Functions Updated**: `sendMessageStreaming()`, `sendContextMessage()`

## Related Files

- Backup created at: `viewer-svelte/src/lib/stores/chat.ts.backup`
- Original issue: JSON flashing during streaming
- Original cleanup: `cleanMessageContent()` function (still used for final messages)
