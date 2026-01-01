# AI Edit Mode Auto-Initialization

## Problem
When toggling to AI edit mode on an itinerary detail page, the Trip Designer had no context about the current itinerary. Users had to manually describe what they were looking at.

## Solution
Pass the `itineraryId` prop to ChatPanel so it can automatically initialize the Trip Designer session with itinerary context.

## Implementation

### Files Changed
1. `viewer-svelte/src/routes/itineraries/[id]/+page.svelte`
   - **Before**: ChatPanel rendered without `itineraryId` prop
   - **After**: ChatPanel receives `itineraryId={itineraryId}` prop

### How It Works

#### Flow on AI Mode Toggle
```
1. User clicks "AI" toggle on /itineraries/[id]
   ↓
2. ChatPanel receives itineraryId prop
   ↓
3. ChatPanel.onMount() creates session with itineraryId
   ↓
4. sendInitialContext() loads itinerary and builds context:
   - User's preferred name
   - Today's date
   - Home airport
   - Itinerary title, dates, type
   - Destinations (explicit or inferred from title)
   - Segment count
   - Mismatch warnings (if any)
   ↓
5. Context sent to Trip Designer as system message
   ↓
6. LLM greets user with knowledge of their trip
```

#### Context Injection Logic (ChatPanel.svelte lines 238-374)

The `sendInitialContext()` function builds a rich context message:

```typescript
// User context
"IMPORTANT: The user's preferred name is {name}..."
"Today's date is {date}."
"My home airport is {airport}."

// Itinerary context
"Working on itinerary: '{title}'."
"Destinations: {destinations}."  // or inferred from title
"Trip dates: {start} to {end} ({duration} days)."
"Current itinerary has {count} segments planned."
```

#### Destination Inference
If explicit destinations aren't set, the system infers from the title:
- "Croatia Business Trip" → "Croatia"
- "Trip to Paris" → "Paris"
- "Hawaii Vacation" → "Hawaii"

#### Backend Session Context (TripDesignerService)

When `createSession(itineraryId)` is called, the service:
1. Loads the itinerary from storage
2. If it has content, generates a detailed summary via `summarizeItinerary()`
3. Injects summary into session with:
   - Mismatch warnings (via `generateMismatchWarning()`)
   - Segment breakdown
   - Booking inference results
4. Adds instruction to skip redundant questions about existing data

### Key Files

#### ChatPanel Props
```typescript
// viewer-svelte/src/lib/components/ChatPanel.svelte
let {
  agent = $bindable<AgentConfig>({...}),
  itineraryId,              // ← NEW: Receives itinerary ID
  initialContent,
  disabled = false,
} = $props();
```

#### Session Creation Flow
```typescript
// ChatPanel.svelte onMount()
if (agent.mode === 'trip-designer' && itineraryId) {
  await createChatSession(itineraryId, agent.mode);
  await sendInitialContext();
}
```

#### Trip Designer Service
```typescript
// src/services/trip-designer/trip-designer.service.ts
async createSession(itineraryId?: ItineraryId, mode = 'trip-designer') {
  // If itinerary has content, inject summary
  if (hasContent) {
    const summary = summarizeItinerary(itinerary);
    const warning = generateMismatchWarning(itinerary);
    // Add system message with context...
  }
}
```

## Testing

### Manual Test Steps
1. **Navigate to existing itinerary**: `/itineraries/[id]`
2. **Toggle to AI mode**: Click "AI" in EditModeToggle
3. **Verify context loading**:
   - Chat panel appears
   - "Connected" indicator shows
   - LLM greets with trip knowledge
4. **Check greeting includes**:
   - Your name (if set in profile)
   - Trip title/destination
   - Current dates
   - Awareness of existing segments

### Example Expected Greeting
```
Hi [Name]! I can see you're working on your Croatia Business Trip
scheduled for May 15-22, 2025. You currently have 5 segments planned.
Would you like me to help refine your itinerary, add activities,
or make any changes?
```

### Edge Cases Handled
- **Empty itinerary**: Greeting without segment details
- **Past dates**: Prompts user to update dates
- **Missing destinations**: Infers from title or asks
- **Mismatch warnings**: Included in context for awareness

## Benefits
1. **No redundant questions**: LLM already knows trip details
2. **Context-aware suggestions**: Can reference existing segments
3. **Better UX**: Immediate, intelligent interaction
4. **Seamless editing**: Switch between manual/AI without losing context

## Acceptance Criteria
- [x] When toggling to AI mode, session auto-initializes
- [x] Trip Designer receives itinerary summary as context
- [x] Mismatch warnings (if any) are included in context
- [x] LLM's first response acknowledges the trip context
- [x] No duplicate context sending on repeated toggles

## Related Code
- **ChatPanel**: `viewer-svelte/src/lib/components/ChatPanel.svelte`
- **Chat Store**: `viewer-svelte/src/lib/stores/chat.svelte.ts`
- **Trip Designer**: `src/services/trip-designer/trip-designer.service.ts`
- **Summarizer**: `src/services/trip-designer/itinerary-summarizer.ts`
- **Session Manager**: `src/services/trip-designer/session.ts`

## Notes
- Context is sent via `sendContextMessage()` to keep it hidden from user
- Session is reset when switching between itineraries (prevents context leakage)
- Backend session is deleted on reset to prevent orphaned sessions
- `pendingPrompt` survives reset to preserve user intent from quick actions
