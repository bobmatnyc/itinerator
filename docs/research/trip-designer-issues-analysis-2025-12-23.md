# Trip Designer Issues Analysis

**Date:** December 23, 2025
**Researcher:** Research Agent
**Context:** Investigation of two issues affecting Trip Designer functionality

---

## Executive Summary

Two critical issues were identified in the Trip Designer implementation:

1. **View Not Updating When Itinerary Changes**: The UI does not automatically switch from helper view to itinerary detail view when destinations/dates are set via `update_itinerary` tool
2. **Date Awareness Missing**: The AI lacks current date context, leading to suggestions for dates already in the past

Both issues have clear root causes with straightforward fixes.

---

## Issue 1: View Not Updating When Itinerary Changes

### Problem Description

When the AI calls `update_itinerary` tool to set destinations or dates, the UI should switch from the "new trip helper" view to the "itinerary detail" view. Currently, this transition does not happen automatically - users must manually trigger a view refresh.

### Root Cause Analysis

The issue stems from **incomplete itinerary refresh logic** after tool execution:

#### How It Currently Works

1. **Tool Execution** (`src/services/trip-designer/tool-executor.ts:246-317`)
   - `handleUpdateItinerary()` updates the itinerary metadata (title, dates, destinations)
   - Returns `{ success: true, updated: Object.keys(updates) }`
   - **Problem**: Does NOT set `segmentId` in result metadata

2. **Itinerary Updated Flag** (`src/services/trip-designer/trip-designer.service.ts:965`)
   ```typescript
   yield {
     type: 'done',
     itineraryUpdated: segmentsModified.length > 0,  // ❌ Only true if segments modified
     segmentsModified,
   };
   ```
   - `itineraryUpdated` is ONLY set to `true` when `segmentsModified.length > 0`
   - `segmentsModified` is populated when tools return `metadata.segmentId`
   - **Problem**: `update_itinerary` doesn't return `segmentId`, so flag stays `false`

3. **UI Refresh Logic** (`viewer-svelte/src/lib/stores/chat.ts:483-484`)
   ```typescript
   didUpdateItinerary = event.itineraryUpdated;
   itineraryUpdated.set(event.itineraryUpdated);
   ```
   - Store receives `false` for itinerary metadata updates
   - ChatPanel effect never triggers reload

4. **View Switch Logic** (`viewer-svelte/src/routes/itineraries/+page.svelte:185-196`)
   ```typescript
   $effect(() => {
     if (mainView === 'new-trip-helper' && $selectedItinerary) {
       const hasContent = hasItineraryContent($selectedItinerary);
       if (hasContent) {
         console.log('[Auto-switch] Switching from helper to itinerary-detail');
         mainView = 'itinerary-detail';
       }
     }
   });
   ```
   - Checks if `$selectedItinerary` has content (destinations or dates)
   - **Problem**: `$selectedItinerary` is never refreshed, so old data persists

#### Why Segment Tools Work

Tools like `add_flight`, `add_hotel`, `add_activity` correctly trigger UI refresh because:

```typescript
// src/services/trip-designer/tool-executor.ts (segment tools)
return {
  toolCallId: toolCall.id,
  success: true,
  result,
  metadata: {
    segmentId: newSegment.id,  // ✅ Sets segmentId
    executionTimeMs: Date.now() - startTime,
  },
};
```

This populates `segmentsModified[]`, which sets `itineraryUpdated: true`, triggering the UI refresh.

### File References

**Key Files:**
1. `/Users/masa/Projects/itinerator/src/services/trip-designer/tool-executor.ts`
   - Lines 246-317: `handleUpdateItinerary()` - does not set metadata.segmentId
   - Lines 114-120: Segment tool handlers - correctly set metadata.segmentId

2. `/Users/masa/Projects/itinerator/src/services/trip-designer/trip-designer.service.ts`
   - Line 451: `itineraryUpdated: segmentsModified.length > 0` (non-streaming)
   - Line 965: Same logic in streaming (chatStream)
   - Lines 804-807: Where segmentsModified is populated from metadata.segmentId

3. `/Users/masa/Projects/itinerator/viewer-svelte/src/lib/stores/chat.ts`
   - Lines 483-484: Where `itineraryUpdated` store is set from done event
   - Lines 422-506: Full done event handling

4. `/Users/masa/Projects/itinerator/viewer-svelte/src/lib/components/ChatPanel.svelte`
   - Lines 299-313: Effect that reloads itinerary when `$itineraryUpdated` is true

5. `/Users/masa/Projects/itinerator/viewer-svelte/src/routes/itineraries/+page.svelte`
   - Lines 147-153: `hasItineraryContent()` - checks for destinations/dates
   - Lines 185-196: Effect that switches to detail view when content detected

### Recommended Fix

**Option 1: Track itinerary metadata changes (Recommended)**

Modify the `done` event logic to detect itinerary changes beyond just segments:

```typescript
// In trip-designer.service.ts chatStream method
let itineraryMetadataChanged = false;

// After tool execution loop
for (const result of executionResults) {
  if (result.success && result.metadata?.segmentId) {
    segmentsModified.push(result.metadata.segmentId);
  }
  // NEW: Check if update_itinerary or similar metadata tools were called
  if (result.success && result.metadata?.itineraryChanged) {
    itineraryMetadataChanged = true;
  }
}

// In done event
yield {
  type: 'done',
  itineraryUpdated: segmentsModified.length > 0 || itineraryMetadataChanged,
  segmentsModified,
};
```

Then in `tool-executor.ts`, modify `handleUpdateItinerary()`:

```typescript
return {
  toolCallId: toolCall.id,
  success: true,
  result: { success: true, updated: Object.keys(updates) },
  metadata: {
    itineraryChanged: true,  // NEW flag
    executionTimeMs: Date.now() - startTime,
  },
};
```

**Option 2: Always reload after any tool execution**

Less precise but simpler - always set `itineraryUpdated: true` if any tools were executed:

```typescript
yield {
  type: 'done',
  itineraryUpdated: executionResults.length > 0,  // Any tool execution
  segmentsModified,
};
```

---

## Issue 2: Date Awareness Missing

### Problem Description

The AI suggested dates Dec 19-26, 2025 when today is December 23, 2025. The AI lacks awareness of the current date and cannot validate that suggested dates are in the future.

### Root Cause Analysis

The system prompt does **not include the current date**.

#### Current System Prompt Generation

**File:** `/Users/masa/Projects/itinerator/src/services/trip-designer/trip-designer.service.ts`
**Lines:** 1343-1421

```typescript
private async buildMessages(
  session: TripDesignerSession,
  options?: { useMinimalPrompt?: boolean }
): Promise<ChatCompletionMessageParam[]> {
  let systemPrompt = this.getSystemPromptForMode(session.agentMode);

  // ... adds itinerary context if exists ...

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemPrompt,  // ❌ No date context
    },
  ];

  return messages;
}
```

#### System Prompt Content

**File:** `/Users/masa/Projects/itinerator/src/prompts/trip-designer/system.md`
**Lines:** 1-659

The entire 659-line system prompt contains:
- Personality and capabilities (lines 1-169)
- Seasonal awareness instructions (lines 170-236)
- Discovery phase questions (lines 240-306)
- Planning phase guidance (lines 328-339)
- Tool usage guidelines (lines 341-375)
- Examples (lines 464-598)

**But nowhere does it mention:**
- Today's date
- Current year
- Instruction to avoid past dates

### Recommended Fix

**Option 1: Inject current date into system prompt (Recommended)**

Modify `buildMessages()` to prepend date context:

```typescript
private async buildMessages(
  session: TripDesignerSession,
  options?: { useMinimalPrompt?: boolean }
): Promise<ChatCompletionMessageParam[]> {
  let systemPrompt = this.getSystemPromptForMode(session.agentMode);

  // NEW: Add current date context
  const today = new Date();
  const dateContext = `## Current Date Context

Today's date: ${today.toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})} (${today.toISOString().split('T')[0]})

IMPORTANT: When suggesting dates for trips, ensure all dates are in the FUTURE.
Never suggest dates that have already passed.

`;

  systemPrompt = dateContext + systemPrompt;

  // ... rest of existing logic ...
}
```

**Option 2: Add to base system prompt**

Add a date placeholder to `system.md` that gets replaced at runtime:

```markdown
## Current Date

Today is {{CURRENT_DATE}}. All trip dates you suggest must be in the future.
```

Then in code:

```typescript
const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
systemPrompt = systemPrompt.replace('{{CURRENT_DATE}}', today);
```

**Option 3: Add as first user message**

Less ideal but works - inject date as a system context message when session starts:

```typescript
// In createChatSession or first message
await this.sessionManager.addMessage(sessionId, {
  role: 'system',
  content: `Current date: ${new Date().toISOString().split('T')[0]}`
});
```

---

## Implementation Priority

### High Priority (Issue 1)
The view not updating is a UX blocker - users must manually refresh to see their itinerary after setting dates/destinations. This breaks the conversational flow.

**Recommendation:** Implement Option 1 (metadata tracking) for precision and clarity.

### High Priority (Issue 2)
Suggesting past dates is a critical logic error that undermines user trust. This should be fixed immediately.

**Recommendation:** Implement Option 1 (inject into buildMessages) for consistency and maintainability.

---

## Testing Recommendations

### Issue 1 Tests

1. **Basic flow test:**
   - User: "Plan a trip to Portugal in January"
   - AI calls `update_itinerary` with title and dates
   - **Expected:** View switches from helper to itinerary detail
   - **Verify:** `$selectedItinerary` has updated dates/destinations

2. **Edge case test:**
   - Start with empty itinerary
   - AI updates only title (no dates/destinations)
   - **Expected:** View stays on helper (no content yet)
   - AI then updates dates
   - **Expected:** View switches to itinerary detail

### Issue 2 Tests

1. **Date validation test:**
   - Today: December 23, 2025
   - User: "Plan a 5-day trip starting next week"
   - **Expected:** AI suggests dates starting December 30, 2025 or later
   - **Verify:** No dates before December 23, 2025

2. **Relative date test:**
   - User: "I want to travel in January"
   - **Expected:** AI suggests January 2026 (future), not January 2025 (past)

3. **Explicit past date detection:**
   - User: "Plan a trip from December 19-26"
   - **Expected:** AI recognizes Dec 19 is in the past and asks for clarification

---

## Additional Observations

### Positive Patterns

1. **Segment modification tracking works well**
   - Tools like `add_flight`, `add_hotel` correctly populate `segmentsModified[]`
   - UI refresh logic is solid when triggered

2. **View switching logic is sound**
   - `hasItineraryContent()` correctly checks for destinations/dates
   - Effect-based view switching is reactive and clean

### Areas for Improvement

1. **Inconsistent metadata patterns**
   - Segment tools return `metadata.segmentId`
   - Itinerary tools don't return equivalent metadata
   - **Suggestion:** Standardize metadata schema across all tools

2. **No validation of tool parameters**
   - `update_itinerary` accepts any date without validation
   - Consider adding date validation in tool executor before calling service

3. **System prompt maintenance**
   - 659-line markdown file is hard to maintain
   - Consider splitting into modules (discovery, planning, tools, examples)

---

## Conclusion

Both issues have clear root causes and straightforward fixes:

1. **View update issue:** Missing `itineraryChanged` flag in tool metadata
2. **Date awareness issue:** Missing current date context in system prompt

Implementing the recommended fixes will restore expected behavior with minimal risk of regression.

---

## Appendix: Code References

### Issue 1 - Itinerary Update Flow

```
User Message
    ↓
TripDesignerService.chatStream()
    ↓
LLM calls update_itinerary tool
    ↓
ToolExecutor.handleUpdateItinerary()  [PROBLEM: No metadata.itineraryChanged]
    ↓
Returns to chatStream
    ↓
Emits 'done' event with itineraryUpdated: false  [PROBLEM: segmentsModified is empty]
    ↓
API route streams done event to client
    ↓
chat.ts sets itineraryUpdated.set(false)  [PROBLEM: Flag not set]
    ↓
ChatPanel effect doesn't trigger  [PROBLEM: No reload]
    ↓
+page.svelte checks hasItineraryContent($selectedItinerary)  [PROBLEM: Stale data]
    ↓
View doesn't switch  [USER SEES OUTDATED VIEW]
```

### Issue 2 - System Prompt Flow

```
ChatSession Created
    ↓
TripDesignerService.buildMessages()
    ↓
Loads system prompt from TRIP_DESIGNER_SYSTEM_PROMPT  [PROBLEM: No date]
    ↓
Adds itinerary context if exists
    ↓
Returns messages array with system prompt  [PROBLEM: No current date]
    ↓
LLM receives messages
    ↓
LLM has NO knowledge of current date  [PROBLEM: Can suggest past dates]
```
