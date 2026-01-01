# Auto-Initialize Trip Designer with Itinerary Context

## Summary
Fixed the AI edit mode to automatically load the current itinerary context when activated. The Trip Designer now greets users with knowledge of their trip instead of requiring manual description.

## Problem
When toggling to AI edit mode on `/itineraries/[id]`, the ChatPanel appeared but the Trip Designer had no context about the current itinerary. Users had to manually describe what they were working on.

## Solution
Pass the `itineraryId` prop to ChatPanel so it can automatically initialize the Trip Designer session with full itinerary context.

## Changes Made

### File: `viewer-svelte/src/routes/itineraries/[id]/+page.svelte`

**Before**:
```svelte
<ChatPanel
  mode={agentConfig.mode}
  placeholderText={agentConfig.placeholderText}
  showTokenStats={agentConfig.showTokenStats}
/>
```

**After**:
```svelte
<ChatPanel
  bind:agent={agentConfig}
  itineraryId={itineraryId}
/>
```

## How It Works

### 1. ChatPanel Receives Context
- `itineraryId` prop passed when rendering in AI mode
- ChatPanel already had support for this prop (line 49-57)

### 2. Session Auto-Initialization (onMount)
- When `mode === 'trip-designer'` and `itineraryId` is present
- Creates session: `await createChatSession(itineraryId, 'trip-designer')`
- Sends initial context: `await sendInitialContext()`

### 3. Context Building (sendInitialContext)
Builds rich context message with:
- User's preferred name (for personalization)
- Today's date (temporal awareness)
- Home airport (from profile)
- Itinerary title and description
- Trip dates and duration
- Destinations (explicit or inferred from title)
- Segment count ("5 segments planned" or "empty and ready to plan")
- Past dates warning (if applicable)

### 4. Backend Context Injection
When `TripDesignerService.createSession(itineraryId)` is called:
- Loads itinerary from storage
- If has content, generates summary via `summarizeItinerary()`
- Checks for booking mismatches via `generateMismatchWarning()`
- Injects summary as system message
- Adds instruction to skip redundant questions

### 5. LLM Response
- Receives full context about trip
- Greets user by name
- Acknowledges trip details
- Offers relevant assistance

## Example Flow

```
User: [Toggles to AI mode on "Croatia Business Trip"]
  ↓
ChatPanel: Creates session with itineraryId
  ↓
ChatPanel: Sends context message (hidden from user):
  "Context: User's name is Masa. Today is December 31, 2025.
   Working on itinerary: 'Croatia Business Trip'.
   Trip dates: May 15-22, 2025 (7 days).
   Current itinerary has 5 segments planned."
  ↓
LLM: "Hi Masa! I can see you're working on your Croatia Business
     Trip scheduled for May 15-22, 2025. You currently have 5 segments
     planned. Would you like me to help refine your itinerary, add
     activities, or make any changes?"
```

## Key Features

### Destination Inference
If explicit destinations aren't set, infers from title:
- "Croatia Business Trip" → "Croatia"
- "Trip to Paris" → "Paris"
- "Hawaii Vacation" → "Hawaii"

### Mismatch Warning Integration
If itinerary has luxury bookings:
```
"⚠️ EXISTING BOOKINGS show luxury/premium preference.
DO NOT ask about budget - infer luxury preference from bookings."
```

### Past Dates Handling
If trip dates are in the past:
- Modal appears with options
- "Update to next year" (auto-calculates)
- "Choose different dates"
- "Cancel planning"

### Session Cleanup
- Old session deleted when switching itineraries
- Prevents context leakage
- `pendingPrompt` preserved across resets

## Testing

### Quick Manual Test
1. Navigate to an existing itinerary with segments
2. Toggle to AI mode
3. Verify LLM greets with trip knowledge

### Verify Context Includes
- Your name (if set in profile)
- Trip title and dates
- Number of segments
- Destinations (explicit or inferred)

### Edge Cases Covered
- Empty itinerary (no segments)
- Missing destinations (infers from title)
- Past dates (triggers modal)
- Luxury bookings (includes mismatch warning)
- No API key (shows error)

## Files Involved

| File | Role |
|------|------|
| `viewer-svelte/src/routes/itineraries/[id]/+page.svelte` | Passes `itineraryId` to ChatPanel |
| `viewer-svelte/src/lib/components/ChatPanel.svelte` | Receives prop, creates session, sends context |
| `viewer-svelte/src/lib/stores/chat.svelte.ts` | Session management and messaging |
| `src/services/trip-designer/trip-designer.service.ts` | Session creation with itinerary context |
| `src/services/trip-designer/itinerary-summarizer.ts` | Generates context summaries |
| `src/services/trip-designer/session.ts` | Session storage and lifecycle |

## Acceptance Criteria ✅

- [x] Session auto-initializes when toggling to AI mode
- [x] Trip Designer receives itinerary summary as context
- [x] Mismatch warnings included in context (if applicable)
- [x] LLM's first response acknowledges trip context
- [x] No duplicate context on repeated toggles
- [x] Clean session handling when switching itineraries

## Benefits

1. **Better UX**: No need to describe trip details manually
2. **Smarter Responses**: LLM is context-aware from the start
3. **No Redundant Questions**: Already knows dates, destinations, etc.
4. **Seamless Editing**: Switch between manual/AI without friction
5. **Mismatch Awareness**: Understands existing booking quality level

## LOC Delta

**Added**: 0 lines (used existing ChatPanel prop)
**Removed**: 3 lines (simplified prop passing)
**Net Change**: -3 lines

## Related Documentation
- `AI_EDIT_MODE_AUTO_INIT.md` - Detailed implementation guide
- `AI_EDIT_MODE_TEST_PLAN.md` - Comprehensive test scenarios
