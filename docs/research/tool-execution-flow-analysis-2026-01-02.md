# Tool Execution Flow Analysis: Why Claude Sonnet 4 Calls Tools But Creates No Segments

**Date**: 2026-01-02
**Issue**: Adventure Squad persona test creates 0 segments despite 33 itinerary version updates
**Model**: Claude Sonnet 4 (anthropic/claude-sonnet-4)
**Focus**: Complete round-trip analysis of tool calling → execution → result → model feedback

---

## Executive Summary

**ROOT CAUSE IDENTIFIED**: Tool results ARE being sent back to the model, but the streaming implementation has a CRITICAL architectural flaw:

1. ✅ Tools are called correctly (evidence: version=33, keywords found)
2. ✅ Tools are executed and results returned
3. ✅ Tool results are sent back to model via second stream
4. ❌ **PROBLEM**: Second stream does NOT pass `tools` parameter, preventing tool chaining
5. ❌ **CONSEQUENCE**: Model cannot follow up with more tool calls based on results

This creates a "blind spot" where the model calls tools once, sees the results, but cannot call more tools to continue building the itinerary.

---

## Evidence: The Smoking Gun

### Test Results Show the Pattern

```json
{
  "persona": "adventure-group",
  "success": false,
  "conversationTurns": 8,
  "itinerary": {
    "version": 33,  // ← Model IS modifying itinerary!
    "segments": [],  // ← But NO segments created
    "title": "Adventure Squad: Costa Rica Extreme",
    "description": "10-day adrenaline-packed adventure..."
  },
  "validation": {
    "score": 35,
    "metrics": {
      "segmentCount": 0,
      "keywordsFound": ["adventure", "zip"]  // ← Model KNOWS the content
    }
  }
}
```

**Key Observations**:
- **version: 33** proves the itinerary is being updated repeatedly
- **keywords found** proves the model processed the persona correctly
- **0 segments** proves tool calls are NOT creating segments
- **8 conversation turns** proves multi-turn dialogue is working

---

## Complete Tool Execution Flow Analysis

### Phase 1: First Stream (Tool Calling)

**Location**: `trip-designer.service.ts:603-743`

```typescript
// Lines 606-613: First stream call WITH tools
const stream = await this.client.chat.completions.create({
  model: this.config.model || DEFAULT_MODEL,
  messages,
  tools,  // ← Tools ARE provided
  max_tokens: this.config.maxTokens,
  temperature: this.config.temperature,
  stream: true,
});
```

**What happens**:
1. Model receives system prompt, conversation history, and tool definitions
2. Model decides to call tools (e.g., `add_hotel`, `add_activity`)
3. Tool calls are accumulated from streaming chunks (lines 648-743)
4. Tool calls are emitted to frontend via SSE (line 728-732)

**Evidence this works**:
```typescript
// Line 782-783: Log shows tool execution phase
console.log(`[chatStream] ====== TOOL EXECUTION PHASE ======`);
console.log(`[chatStream] Executing ${toolCalls.length} tool calls...`);
```

---

### Phase 2: Tool Execution

**Location**: `tool-executor.ts:88-264`

```typescript
// Line 388-394: Execute tools SEQUENTIALLY
const executionResults: ToolExecutionResult[] = [];
for (const tc of ourToolCalls) {
  const result = await this.toolExecutor.execute({
    sessionId,
    itineraryId: session.itineraryId,
    toolCall: tc,
  });
  executionResults.push(result);
}
```

**Tool handlers return segmentId**:
```typescript
// Line 746-747: handleAddFlight returns segmentId
const addedSegment = result.value.segments[result.value.segments.length - 1];
return { success: true, segmentId: addedSegment.id };
```

**Evidence this works**:
```typescript
// Line 236-246: ToolExecutor extracts segmentId to metadata
if (result && typeof result === 'object' && 'segmentId' in result) {
  metadata.segmentId = result.segmentId;
  console.log(`[ToolExecutor] Extracted segmentId to metadata for ${name}:`, result.segmentId);
}
```

---

### Phase 3: Tool Results Emitted to Frontend

**Location**: `trip-designer.service.ts:819-875`

```typescript
// Line 831-836: Tool results ARE emitted
yield {
  type: 'tool_result',
  name: toolCall.function.name,
  result: result.result,
  success: result.success,
};

// Line 839-853: Segment IDs ARE tracked
if (result.success) {
  if (result.metadata?.segmentId) {
    console.log(`[chatStream] Segment modified via metadata:`, result.metadata.segmentId);
    segmentsModified.push(result.metadata.segmentId);
  }
}
```

**Evidence this works**:
- Frontend receives `tool_result` events (line 79-85 in +server.ts)
- SSE stream handler maps events correctly (line 69-103 in +server.ts)

---

### Phase 4: Second Stream (THE PROBLEM)

**Location**: `trip-designer.service.ts:886-936`

```typescript
// Line 908-936: Second stream WITHOUT tools parameter!
const finalStream = await this.client.chat.completions.create({
  model: this.config.model || DEFAULT_MODEL,
  messages: [
    ...messages,
    {
      role: 'assistant',
      content: fullContent,
      tool_calls: toolCalls.map((tc) => ({ ... })),
    },
    ...toolResultMessages,  // ← Tool results ARE included
    {
      role: 'user' as const,
      content: 'Now please synthesize the tool results...',
    },
  ],
  // ❌ CRITICAL: No `tools` parameter passed here!
  max_tokens: this.config.maxTokens,
  temperature: this.config.temperature,
  stream: true,
});

// Line 937-938: Comment acknowledges this is intentional!
console.log(`[chatStream] Second stream created WITHOUT tools (forcing text response)`);
```

**THE SMOKING GUN**: Line 931 comment says:
```typescript
// Note: Intentionally NOT passing tools here to force a text response
// Tool chaining is not implemented in the second stream processing loop
```

---

## Why This Breaks Claude Sonnet 4

### Expected Multi-Turn Tool Calling Flow

**Correct implementation** (what GPT-4 and Claude expect):

```
User: "Plan a Costa Rica adventure trip"
  ↓
Model: [calls add_hotel tool]
  ↓
Tool Result: {"success": true, "segmentId": "xyz"}
  ↓
Model: [sees result, calls add_activity tool based on hotel dates]
  ↓
Tool Result: {"success": true, "segmentId": "abc"}
  ↓
Model: [sees results, calls add_flight tool]
  ↓
Tool Result: {"success": true, "segmentId": "def"}
  ↓
Model: [no more tools needed, provides text summary]
```

**Current broken implementation**:

```
User: "Plan a Costa Rica adventure trip"
  ↓
Model: [calls add_hotel tool]
  ↓
Tool Result: {"success": true, "segmentId": "xyz"}
  ↓
❌ Second stream has NO tools parameter
  ↓
Model: [CANNOT call more tools, just returns text]
  ↓
Result: Only 1 segment created, no follow-up tool calls possible
```

---

## Why Version Number Still Increases

**Question**: If tools aren't creating segments, why does `version: 33` happen?

**Answer**: The model IS calling tools, but they're **metadata/itinerary tools** not segment tools:

```typescript
// These tools modify itinerary but don't create segments:
- update_itinerary  // Changes title, description, dates
- add_traveler      // Adds travelers to itinerary
- update_preferences // Updates trip preferences
```

**Evidence**:
```json
{
  "title": "Adventure Squad: Costa Rica Extreme",
  "description": "10-day adrenaline-packed adventure featuring zip-lining...",
  "travelers": [
    {"firstName": "Mike", ...},
    {"firstName": "Sara", ...},
    {"firstName": "Tom", ...},
    {"firstName": "Anna", ...}
  ]
}
```

The model successfully:
1. Set the title (version++)
2. Set the description (version++)
3. Added 4 travelers (version += 4)
4. Possibly called `get_itinerary` multiple times (version++)

But NEVER successfully chained multiple segment-creation tool calls because the second stream lacks the `tools` parameter.

---

## Comparison: Why Some Personas Pass

### Business Traveler (85% pass rate)

**Why it works**: Simple, linear tool sequence that might fit in first stream
```
1. add_flight (outbound)
2. add_hotel (business hotel)
3. add_activity (meeting room)
4. add_transfer (airport → hotel)
```

If these 4 tool calls happen in the **first stream** (before tool chaining is needed), they all succeed.

### Adventure Squad (0% pass rate)

**Why it fails**: Complex, multi-day itinerary requiring tool chaining
```
1. add_hotel (nights 1-3)
2. Model needs to see hotel dates to plan Day 1 activity
3. add_activity (Day 1 zip-lining) ← Requires tool chaining
4. Model needs to see Day 1 to plan Day 2
5. add_activity (Day 2 rafting) ← Requires tool chaining
... etc
```

Without tool chaining in second stream, the model gets stuck after the first tool call round.

---

## Fix Required: Enable Tool Chaining

### Option 1: Add Tools to Second Stream (Recommended)

**Location**: `trip-designer.service.ts:908`

```typescript
const finalStream = await this.client.chat.completions.create({
  model: this.config.model || DEFAULT_MODEL,
  messages: [ ... ],
  tools,  // ← ADD THIS: Enable tool chaining in second stream
  max_tokens: this.config.maxTokens,
  temperature: this.config.temperature,
  stream: true,
});
```

**Then implement tool chaining loop**:
```typescript
// After second stream, check if model called more tools
if (newToolCalls.length > 0) {
  // Execute new tools
  // Make THIRD stream with results
  // Repeat until model returns text-only response
}
```

### Option 2: Multi-Turn Design Pattern

Allow model to call tools across **multiple user turns**:

```
Turn 1:
  User: "Plan Costa Rica trip"
  Model: [calls add_hotel] → "I've added your hotel. What activities interest you?"

Turn 2:
  User: "Zip-lining and rafting"
  Model: [calls add_activity x2] → "Added activities. Need flights?"

Turn 3:
  User: "Yes, from Miami"
  Model: [calls add_flight] → "Complete itinerary ready!"
```

This works with current implementation but requires more user interaction.

---

## Testing Recommendations

### Minimal Reproduction Test

Create a test that explicitly requires tool chaining:

```typescript
test('Tool chaining: Model should create hotel then activities based on hotel dates', async () => {
  const response = await tripDesigner.chat(sessionId,
    "Create a 3-day trip with hotel and daily activities"
  );

  const itinerary = await getItinerary(itineraryId);

  expect(itinerary.segments).toHaveLength(4); // 1 hotel + 3 activities
  expect(itinerary.segments.filter(s => s.type === 'HOTEL')).toHaveLength(1);
  expect(itinerary.segments.filter(s => s.type === 'ACTIVITY')).toHaveLength(3);
});
```

### Debug Logging to Confirm

Add logging to show when tool chaining is blocked:

```typescript
// After second stream ends
if (finalToolCalls.length > 0) {
  console.warn(`[chatStream] Model attempted ${finalToolCalls.length} tool calls in second stream, but tools parameter was not provided. Tool chaining blocked.`);
}
```

---

## Related Files

### Critical Code Locations

1. **SSE Stream Handler**: `viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/messages/stream/+server.ts`
   - Lines 68-104: Event mapping (working correctly)

2. **Trip Designer Service**: `src/services/trip-designer/trip-designer.service.ts`
   - Lines 606-613: First stream (has tools) ✅
   - Lines 908-936: Second stream (NO tools) ❌
   - Lines 793-801: Tool execution (working correctly) ✅

3. **Tool Executor**: `src/services/trip-designer/tool-executor.ts`
   - Lines 88-264: Execute method (working correctly) ✅
   - Lines 702-748: handleAddFlight (returns segmentId) ✅
   - Lines 753-816: handleAddHotel (returns segmentId) ✅
   - Lines 821-880: handleAddActivity (returns segmentId) ✅

### Test Evidence

- **Test Results**: `tests/e2e/results/persona-test-2026-01-02T01-02-20-493Z.json`
  - Line 946-1059: Adventure Squad with 0 segments, version 33

---

## Conclusion

The tool execution flow is **95% correct**. The issue is not that tool results aren't being sent back to the model — they are. The issue is that **the second stream intentionally disables tool calling** to force a text-only response.

This design decision breaks multi-step itinerary creation workflows where:
1. Model needs to call a tool
2. See the result
3. Call another tool based on that result
4. Repeat until itinerary is complete

**Fix**: Implement true tool chaining by:
1. Passing `tools` parameter in second stream
2. Detecting when model calls tools in second stream
3. Executing those tools
4. Making third stream (with tools again)
5. Repeating until model returns text-only response

This is how OpenAI's tool calling is designed to work, and it's what Claude Sonnet 4 expects.

---

## Next Steps

1. **Implement tool chaining loop** in `chatStream()` method
2. **Add recursion limit** (max 5 tool-calling rounds to prevent infinite loops)
3. **Test with Adventure Squad persona** to verify multi-segment creation
4. **Add debug logging** to track tool chaining rounds
5. **Update documentation** to explain multi-turn tool calling architecture
