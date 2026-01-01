# Itinerary UI Refresh Fix

## Problem
After Trip Designer adds segments via tool calls (flights, hotels, etc.), the UI shows stale segment count. For example:
- Storage: 5 segments (2 flights, 1 hotel, 2 dinners)
- UI: Shows "3 SEGMENTS"

## Root Cause
The `itineraryUpdated` flag wasn't being set to `true` after tool calls because the Trip Designer service couldn't track which segments were modified.

### Data Flow Analysis

1. **Tool Handler** (`tool-executor.ts` line 662):
   ```typescript
   return { success: true, segmentId: segment.id };
   ```
   Returns segmentId in the result object.

2. **Tool Executor Return** (`tool-executor.ts` line 231-238) - **BUG**:
   ```typescript
   return {
     toolCallId: toolCall.id,
     success: true,
     result,  // Contains { success: true, segmentId: ... }
     metadata: {
       executionTimeMs: Date.now() - startTime,
       // ❌ segmentId NOT in metadata!
     },
   };
   ```

3. **Trip Designer Service** (`trip-designer.service.ts` line 829-831):
   ```typescript
   if (result.success && result.metadata?.segmentId) {
     segmentsModified.push(result.metadata.segmentId);
   }
   ```
   Checks for `result.metadata.segmentId`, but it's in `result.result.segmentId`!

4. **Done Event** (`trip-designer.service.ts` line 1000):
   ```typescript
   itineraryUpdated: segmentsModified.length > 0 || itineraryMetadataChanged
   ```
   Since `segmentsModified` is empty, `itineraryUpdated` is always `false`.

## Solution
Extract `segmentId` from the tool result and add it to the metadata object in `tool-executor.ts`:

```typescript
// Extract segmentId from result if present (for tracking modified segments)
const metadata: Record<string, unknown> = {
  executionTimeMs: Date.now() - startTime,
};

if (result && typeof result === 'object' && 'segmentId' in result) {
  metadata.segmentId = result.segmentId;
}

return {
  toolCallId: toolCall.id,
  success: true,
  result,
  metadata,
};
```

## Impact
- ✅ `segmentsModified` array now properly tracks added/updated segments
- ✅ `itineraryUpdated` flag is set to `true` when segments change
- ✅ SSE `done` event includes `itineraryUpdated: true`
- ✅ ChatPanel's `$effect` triggers and calls `loadItinerary()`
- ✅ UI refreshes with latest segment count and data

## Testing
1. Start chat session in Trip Designer
2. Ask agent to add a flight
3. Verify UI segment count updates immediately after tool completes
4. Verify segment appears in the list without manual refresh

## Files Changed
- `src/services/trip-designer/tool-executor.ts` - Extract segmentId to metadata

## Related Code
- `src/services/trip-designer/trip-designer.service.ts` (lines 829-831, 1000) - Checks metadata.segmentId
- `viewer-svelte/src/lib/stores/chat.svelte.ts` (line 265) - Sets itineraryUpdated flag
- `viewer-svelte/src/lib/components/ChatPanel.svelte` (lines 405-423) - Reactive effect that triggers refresh
