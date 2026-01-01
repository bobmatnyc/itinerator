# Structured Questions Message Text Fix

## Problem

When the AI responded with structured questions, the message text portion was getting hidden or not displayed in the chat thread. Users would only see the structured question buttons without the AI's contextual message.

**Example of missing text:**
```
[Missing: "Great question! For your April 29th departure, what time preference works best?"]

[Button: Afternoon Departure]
[Button: Evening Departure]
```

## Root Cause

The streaming message handler in `src/lib/stores/chat.ts` had the following issues:

1. **Aggressive JSON stripping**: The `cleanMessageContent()` function was removing JSON blocks that contained structured questions
2. **Message discarded when empty**: When the cleaned content was empty, no message was added to the chat history
3. **No fallback extraction**: The code didn't try to extract the `message` field from the JSON before discarding it

**Flow:**
1. AI sends: `{"message": "Great question! ...", "structuredQuestions": [...]}`
2. `cleanMessageContent()` removes the entire JSON block
3. `cleanedContent` becomes empty string
4. Message is NOT added to `chatMessages` (failed the `if (cleanedContent)` check)
5. Only structured questions appear, with no context message

## Solution

Modified the `'done'` event handler in both `sendMessageStreaming()` and `sendContextMessage()` to:

1. **Extract message from JSON**: If `cleanedContent` is empty but we have structured questions, try to extract the `message` field from the JSON response
2. **Fallback to question text**: If no message field exists, use the first structured question's text as the message
3. **Always add message**: When structured questions are present, always add an assistant message (even if content is empty)

**Updated flow:**
1. AI sends: `{"message": "Great question! ...", "structuredQuestions": [...]}`
2. `cleanMessageContent()` removes the JSON block → empty
3. **NEW**: Detect empty content + structured questions → extract message from JSON
4. Message "Great question! ..." is added to `chatMessages`
5. Both message text AND structured question buttons appear

## Code Changes

**File**: `/Users/masa/Projects/itinerator/viewer-svelte/src/lib/stores/chat.ts`

### Before:
```typescript
case 'done':
  const cleanedContent = cleanMessageContent(accumulatedContent);
  if (cleanedContent) {
    chatMessages.update((messages) => [
      ...messages,
      { role: 'assistant', content: cleanedContent, timestamp: new Date() },
    ]);
  }
```

### After:
```typescript
case 'done':
  let cleanedContent = cleanMessageContent(accumulatedContent);

  // If content is empty but we have structured questions, extract message from JSON
  if (!cleanedContent && receivedStructuredQuestions && accumulatedContent) {
    // Try to extract message field from JSON
    const jsonMatch = accumulatedContent.match(/\{\s*"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (jsonMatch) {
      // Unescape JSON string
      cleanedContent = jsonMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\\\/g, '\\');
    } else {
      // Fall back to first structured question's text
      let currentQuestions: StructuredQuestion[] | null = null;
      structuredQuestions.subscribe(q => currentQuestions = q)();
      if (currentQuestions && currentQuestions.length > 0) {
        cleanedContent = currentQuestions[0].question;
      }
    }
  }

  // Always add assistant message if we have content OR structured questions
  if (cleanedContent || receivedStructuredQuestions) {
    const messageContent = cleanedContent || '';
    chatMessages.update((messages) => [
      ...messages,
      { role: 'assistant', content: messageContent, timestamp: new Date() },
    ]);
  }
```

## Expected Behavior

**Now when AI sends structured questions:**

1. ✅ AI's message text appears in the chat bubble
2. ✅ Structured question buttons appear below the message
3. ✅ Both are visible so user understands the context
4. ✅ Chat history shows the full conversation flow

**Example:**
```
AI: "Great question! For your April 29th departure, what time preference works best?"

[Button: Afternoon Departure]
[Button: Evening Departure]
```

## Testing

To verify the fix:

1. Start a chat session with an itinerary
2. Trigger a question that generates structured questions (e.g., ask about travel preferences)
3. Verify that BOTH the AI's message text AND the structured question buttons appear
4. Check that the message text provides context for the buttons

## Related Files

- `/Users/masa/Projects/itinerator/viewer-svelte/src/lib/stores/chat.ts` - Main fix location
- `/Users/masa/Projects/itinerator/viewer-svelte/src/lib/components/ChatPanel.svelte` - UI rendering (unchanged)
- `/Users/masa/Projects/itinerator/src/prompts/trip-designer/system.md` - Backend prompt defining JSON format

## Notes

- Applied to both `sendMessageStreaming()` and `sendContextMessage()` functions
- Maintains backward compatibility with responses that don't have structured questions
- Falls back gracefully if message extraction fails
- TypeScript compilation passes with no errors
