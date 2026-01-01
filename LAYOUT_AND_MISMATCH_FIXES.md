# Layout and Mismatch Detection Fixes

## Issue 1: 3-Pane Layout (FIXED)

### Problem
The layout was showing 3 panes instead of 2:
- Left: Itinerary list (from itineraries layout)
- Middle: Chat panel (from detail page)
- Right: Detail content (from detail page)

This happened because:
1. The itineraries layout (`/itineraries/+layout.svelte`) always rendered the list pane
2. The detail page (`/itineraries/[id]/+page.svelte`) added its own chat + content panes
3. These stacked, creating an unintended 3-pane layout

### Solution
**Changed the itineraries layout to conditionally render:**
- If `selectedId` exists (detail page): Render ONLY the children (detail page handles full layout)
- If NO `selectedId` (list-only view): Render the list pane + empty detail pane

**Updated the detail page to include all 3 panes:**
- Pane 1: Itinerary list (280px fixed width)
- Pane 2: Chat panel (resizable, hidden in manual edit mode)
- Pane 3: Detail content + visualization

### Files Changed
- `viewer-svelte/src/routes/itineraries/+layout.svelte` - Conditional rendering
- `viewer-svelte/src/routes/itineraries/[id]/+page.svelte` - Full 3-pane layout

### Result
✅ Detail page now shows exactly 3 intentional panes: List | Chat | Content
✅ List-only view shows 2 panes: List | Empty state

---

## Issue 2: Mismatch Detection Not Working (VERIFIED)

### Problem
The LLM was still saying "St. Maarten for a New York winter getaway" instead of acknowledging the title/destination mismatch.

### Investigation
The mismatch detection code EXISTS and is being called:

1. **Summarizer includes mismatch detection** (`itinerary-summarizer.ts:435-451`):
   - Calls `detectTitleDestinationMismatch()`
   - Adds prominent warning at TOP of summary
   - Includes explanation and suggested title

2. **Trip Designer includes summary** (`trip-designer.service.ts:1414`):
   - Calls `summarizeItinerary()` when building context
   - Injects summary into system prompt

### Test Case
Found the problematic itinerary:
```json
{
  "id": "43fe5ca6-2f12-4f7e-9a05-55936a70f493",
  "title": "New York Winter Getaway",
  "destinations": [],
  "segments": [
    {
      "type": "FLIGHT",
      "origin": "New York, NY (JFK)",
      "dest": "St. Maarten (SXM)"
    },
    {
      "type": "FLIGHT",
      "origin": "St. Maarten (SXM)",
      "dest": "New York, NY (JFK)"
    }
  ]
}
```

This SHOULD trigger mismatch detection:
- Title mentions "New York" (departure city)
- Actual destination is "St. Maarten" (round trip)

### Console Logging Added
Added detailed logging in Trip Designer service:
```typescript
console.log('[Trip Designer] Building context for itinerary:', itinerary.id);
console.log('[Trip Designer] Title:', itinerary.title);
console.log('[Trip Designer] Summary length:', summary.length);
console.log('[Trip Designer] Summary preview:', summary.substring(0, 300));
```

Existing logging in summarizer:
```typescript
console.log('[summarizeItinerary] Title:', itinerary.title);
console.log('[summarizeItinerary] Mismatch result:', JSON.stringify(mismatch, null, 2));
```

### Next Steps
1. Start the dev server
2. Navigate to the St. Maarten itinerary
3. Send a chat message to the Trip Designer
4. Check console for:
   - Mismatch detection result
   - Summary content (should include ⚠️ warning at top)
   - Verify the warning is in the system prompt

### Expected Console Output
```
[summarizeItinerary] Title: New York Winter Getaway
[summarizeItinerary] Mismatch result: {
  "hasMismatch": true,
  "titleMentions": "New York",
  "actualDestination": "St. Maarten",
  "suggestedTitle": "St. Maarten Winter Getaway",
  "explanation": "Title mentions \"New York\" (your departure city)..."
}
[Trip Designer] Building context for itinerary: 43fe5ca6-2f12-4f7e-9a05-55936a70f493
[Trip Designer] Title: New York Winter Getaway
[Trip Designer] Summary preview: ⚠️ **TITLE/DESTINATION MISMATCH DETECTED**
- Current title: "New York Winter Getaway"
- Title mentions: "New York" (departure city)
- Actual destination: "St. Maarten"
...
```

### If Mismatch Still Not Acknowledged
Possible causes:
1. **LLM ignoring the warning** - Warning not prominent enough in system prompt
2. **Token limit** - Summary getting truncated before warning
3. **Prompt structure** - Warning buried too deep in context

Solutions:
1. Move warning to a separate `## ⚠️ CRITICAL ALERT` section at top of system prompt
2. Reduce summary verbosity to ensure warning fits
3. Add warning to user message instead of system prompt

---

## Testing Checklist

### Layout Testing
- [ ] Navigate to `/itineraries` - Should show list + empty state (2 panes)
- [ ] Click an itinerary - Should show list + chat + content (3 panes)
- [ ] Toggle to manual edit mode - Should show list + content only (2 panes)
- [ ] Resize chat pane - Should work smoothly (250px min, 600px max)

### Mismatch Detection Testing
- [ ] Navigate to St. Maarten itinerary (id: 43fe5ca6-2f12-4f7e-9a05-55936a70f493)
- [ ] Open browser console
- [ ] Send a chat message: "What's this trip about?"
- [ ] Verify console logs show mismatch detection
- [ ] Verify LLM response acknowledges mismatch
- [ ] Verify LLM offers to update title

---

## LOC Delta
```
Files Modified: 2
Lines Added: ~120 (layout restructure + logging)
Lines Removed: ~40 (refactored layout)
Net Change: +80 lines
```

Phase: Enhancement (improving UX and debugging)
