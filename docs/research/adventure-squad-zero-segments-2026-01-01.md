# Adventure Squad 0 Segments Investigation

**Date**: 2026-01-01
**Issue**: Adventure Squad persona gets 0 segments in E2E tests despite tool calls being made
**Test File**: `tests/e2e/traveler-persona-agent.ts`

## Summary

The Adventure Squad persona test shows keywords found ("adventure", "zip") indicating the model IS responding correctly, but 0 segments are created despite 4 travelers being added and itinerary version reaching 16.

## Key Findings

### 1. Segments Are NOT Being Created
**Evidence from test results** (`persona-test-2026-01-02T01-02-20-493Z.json`):
- ✅ **4 travelers added** (Mike, Sara, Tom, Anna)
- ✅ **Itinerary version: 33** (meaning 33 updates occurred)
- ✅ **Keywords found**: "adventure", "zip" (model understood the request)
- ❌ **Segments created**: 0
- ❌ **Expected minimum**: 6 segments

### 2. Tool Call Recording Issue
**Location**: `tests/e2e/traveler-persona-agent.ts:855-856`

```typescript
if (parsed.name) {
  toolCalls.push(parsed.name);
}
```

**Problem**: The test looks for `parsed.name` in ALL SSE data payloads, not just `tool_call` events. This might miss tool calls or record incorrect data.

**SSE Event Format** (`viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/messages/stream/+server.ts:75-77`):
```typescript
case 'tool_call':
  writeEvent('tool_call', { name: event.name, arguments: event.arguments });
```

### 3. Segment Counting Works Correctly
**Location**: `tests/e2e/traveler-persona-agent.ts:1175`

```typescript
segmentCount: itinerary.segments.length
```

The test correctly counts segments from the final itinerary. This is not a counting bug.

### 4. Segment Creation Flow
**Tool Executor** (`src/services/trip-designer/tool-executor.ts:746-747`):

All `add_*` tool handlers correctly return:
```typescript
return { success: true, segmentId: addedSegment.id };
```

**Segment Service** (`src/services/segment.service.ts:100-122`):

The service correctly:
1. Adds segment to array: `segments: [...existing.segments, segmentWithId]`
2. Increments version: `version: existing.version + 1`
3. Saves to storage: `await this.storage.save(updated)`

### 5. Duplicate Detection Could Be Blocking
**Location**: `src/services/segment.service.ts:384-458`

The `isDuplicateSegment()` method blocks creation if:
- **ACTIVITY**: Same name + same date
- **HOTEL**: Same property + overlapping dates
- **FLIGHT**: Same flight number + same date

**Hypothesis**: If Adventure Squad activities have the same name (e.g., "Zip-lining Tour") and same start date, duplicates would be rejected silently.

**Problem**: Duplicate errors are returned via Result pattern, but might not surface in the E2E test logs.

### 6. No Errors Logged
**Test Results**: `errors: []`

Despite 0 segments being created, NO errors are recorded in the test results. This suggests:
- Tool calls might not be happening at all, OR
- Errors are being swallowed somewhere, OR
- Tool execution is failing silently

## Potential Root Causes

### Hypothesis 1: Duplicate Detection Silently Rejecting Segments ⭐ MOST LIKELY
**Evidence**:
- 4 travelers added successfully (version 33 reached)
- Keywords found ("adventure", "zip")
- 0 segments created
- NO errors logged

**Theory**:
1. Model makes tool calls for activities
2. Activities have similar names (e.g., "Zip-lining", "Zip-line tour")
3. Duplicate detection rejects them
4. Error is returned via Result pattern but not surfaced to user
5. Test sees 0 segments

**How to verify**:
- Add logging in `SegmentService.add()` before duplicate check
- Log all rejected duplicates
- Check if Adventure Squad activities are being rejected

### Hypothesis 2: Tool Calls Not Being Made
**Evidence**:
- `toolCalls: []` in transcript
- But travelers WERE added (version 33)

**Theory**:
- Tool calls ARE being made (travelers prove it)
- Test isn't capturing tool calls correctly from SSE stream
- Need to check if test is missing `tool_call` events

### Hypothesis 3: Group Size Causing Issues
**Evidence**:
- Adventure Squad has 4 travelers (largest group in tests)
- Other personas might have different results

**Theory**:
- Something about group size breaks segment creation
- Could be related to `travelerIds` field in segments

## Investigation Steps

### Step 1: Check if tool calls are recorded for other personas ✅
```bash
cat tests/e2e/results/persona-test-*.json | \
  python3 -c "import json, sys; ..."
```

### Step 2: Add debug logging to SegmentService.add()
```typescript
// src/services/segment.service.ts:89-98
const duplicateCheck = this.findDuplicateSegment(existing.segments, segmentWithId);
if (duplicateCheck) {
  console.error('[SegmentService] DUPLICATE REJECTED:', {
    type: segmentWithId.type,
    name: (segmentWithId as any).name,
    message: duplicateCheck.message
  });
  return err(...);
}
```

### Step 3: Check SSE stream parsing in test
Verify that `tool_call` events are being captured:
```typescript
// tests/e2e/traveler-persona-agent.ts:841-860
if (line.startsWith('event: ')) {
  const event = line.substring(7).trim();
  // TODO: Store event type
}

if (line.startsWith('data: ')) {
  const data = line.substring(6).trim();
  const parsed = JSON.parse(data);

  // ISSUE: Should check event type here!
  if (parsed.name) {  // This doesn't check event type
    toolCalls.push(parsed.name);
  }
}
```

### Step 4: Run Adventure Squad test with verbose logging
```bash
npx tsx tests/e2e/traveler-persona-agent.ts --persona adventure-group --verbose 2>&1 | \
  grep -E "tool|segment|duplicate" | tee adventure-debug.log
```

### Step 5: Check if timing issue with persistence
**Location**: `tests/e2e/traveler-persona-agent.ts:1001-1004`

```typescript
// Get updated itinerary periodically
if (result.itineraryUpdated || turns % 3 === 0) {
  itinerary = await this.getItinerary();
}
```

**Issue**: Test only fetches itinerary every 3 turns OR when `itineraryUpdated` is true. If segments are created but `itineraryUpdated` flag isn't set, test might miss them.

## Code Locations

### Critical Files
1. **Test**: `tests/e2e/traveler-persona-agent.ts`
   - Line 325-364: Adventure Squad persona definition
   - Line 855-856: Tool call recording (potential bug)
   - Line 1175: Segment counting (correct)

2. **Tool Executor**: `src/services/trip-designer/tool-executor.ts`
   - Line 746-747: add_flight returns segmentId
   - Line 814-815: add_hotel returns segmentId
   - Line 878-879: add_activity returns segmentId

3. **Segment Service**: `src/services/segment.service.ts`
   - Line 37-123: add() method
   - Line 89-98: Duplicate check (potential blocker)
   - Line 384-458: isDuplicateSegment() logic

4. **SSE Stream**: `viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/messages/stream/+server.ts`
   - Line 75-77: tool_call event emission

## Recommendations

### Immediate Actions
1. ✅ Add logging to SegmentService.add() before duplicate check
2. ✅ Log all duplicate rejections with full context
3. ✅ Fix SSE event parsing in test to track event types
4. ✅ Run Adventure Squad test with full debug logging

### Short-term Fixes
1. Make duplicate detection errors surface in test results
2. Add tool call execution logging to trip-designer service
3. Return tool execution errors in SSE stream
4. Improve test to capture tool call failures

### Long-term Improvements
1. Add integration tests specifically for segment creation
2. Add metrics for tool call success/failure rates
3. Make duplicate detection more lenient (fuzzy matching threshold)
4. Surface duplicate warnings to user instead of silent rejection
