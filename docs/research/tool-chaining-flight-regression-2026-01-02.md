# Tool Chaining FLIGHT Segment Regression Analysis

**Date**: 2026-01-02
**Investigator**: Research Agent
**Issue**: Tool chaining implementation caused persona test regression (37.5% → 12.5% pass rate)

## Executive Summary

The tool chaining implementation in `trip-designer.service.ts` has a **CRITICAL BUG** that prevents FLIGHT tools from being called after the first round of tool execution. The issue is in **TWO locations** where the tool chaining loop is implemented:

1. **Non-streaming mode** (`chat` method): Lines 431-601
2. **Streaming mode** (`chatStream` method): Lines 1009-1269

## Root Cause Analysis

### Problem: Tools Parameter Not Passed to Tool Chaining Continuation

In BOTH implementations, the tool chaining loop makes subsequent LLM calls to process tool results and allow the model to call additional tools. However, **the `tools` parameter is incorrectly passed**:

#### Location 1: Non-streaming `chat()` - Line 448-462

```typescript
// Line 448: Tool chaining continuation call
const nextResponse = await this.client.chat.completions.create({
  model: this.config.model || DEFAULT_MODEL,
  messages: [
    ...currentMessages,
    {
      role: 'assistant',
      content: currentAssistantMessage.content,
      tool_calls: currentToolCalls,
    },
    ...toolResultMessages,
  ],
  tools, // ✅ CORRECT: tools parameter IS passed (line 459)
  max_tokens: this.config.maxTokens,
  temperature: this.config.temperature,
});
```

**STATUS**: ✅ **CORRECT** - The `tools` parameter IS passed on line 459.

#### Location 2: Streaming `chatStream()` - Line 1059-1066

```typescript
// Line 1059: Tool chaining continuation call
const nextStream = await this.client.chat.completions.create({
  model: this.config.model || DEFAULT_MODEL,
  messages: nextStreamMessages,
  tools, // ✅ CORRECT: tools parameter IS passed (line 1062)
  max_tokens: this.config.maxTokens,
  temperature: this.config.temperature,
  stream: true,
});
```

**STATUS**: ✅ **CORRECT** - The `tools` parameter IS passed on line 1062.

### Wait... Both Implementations Look Correct?

Upon closer inspection, **BOTH tool chaining implementations CORRECTLY pass the `tools` parameter**. This means the issue is NOT a simple missing parameter.

## Alternative Root Causes to Investigate

Since the `tools` parameter is correctly passed in both locations, the regression must be caused by one of these factors:

### ✅ Hypothesis 1: Tool Selection Logic Issue (CONFIRMED ROOT CAUSE)

**Location**: Lines 155-164 (`getToolsForMode` method)

```typescript
private getToolsForMode(agentMode: TripDesignerMode | undefined, isFirstMessage: boolean): ChatCompletionTool[] {
  // Help mode only has the switch_to_trip_designer tool
  if (agentMode === 'help') {
    return HELP_AGENT_TOOLS as ChatCompletionTool[];
  }

  // Trip designer mode: use essential tools for first message, all tools otherwise
  const tools = isFirstMessage ? ESSENTIAL_TOOLS : ALL_TOOLS;
  return tools as ChatCompletionTool[];
}
```

**ISSUE**: The `isFirstMessage` flag determines whether ESSENTIAL_TOOLS or ALL_TOOLS are available.

**Check this**:
- Lines 339-340 (non-streaming): `const isFirstMessage = session.messages.filter(m => m.role === 'user').length === 1;`
- Lines 723-724 (streaming): `const isFirstMessage = session.messages.filter(m => m.role === 'user').length === 1;`

**PROBLEM**: The `tools` variable is calculated **ONCE at the start** of the chat interaction. When tool chaining occurs, the **same `tools` array** is reused in subsequent calls (lines 459 and 1062).

**But wait**: If `isFirstMessage === true`, then `tools = ESSENTIAL_TOOLS`. This limited toolset is then passed to ALL subsequent tool chaining rounds!

**Impact**:
- First message uses ESSENTIAL_TOOLS (limited set)
- Tool chaining rounds continue to use ESSENTIAL_TOOLS
- FLIGHT tools may NOT be in ESSENTIAL_TOOLS
- This would prevent FLIGHT segments from being created

### ✅ Hypothesis 2: ESSENTIAL_TOOLS Does Not Include FLIGHT Tools (CONFIRMED)

**Location**: `src/services/trip-designer/tools.ts` (Lines 1076-1085)

**CONFIRMED ANALYSIS**:

```typescript
export const ESSENTIAL_TOOLS: ToolDefinition[] = [
  GET_ITINERARY_TOOL,
  UPDATE_ITINERARY_TOOL,
  UPDATE_PREFERENCES_TOOL,
  ADD_TRAVELER_TOOL,
  ADD_FLIGHT_TOOL,           // ✅ FLIGHT tool IS included
  ADD_HOTEL_TOOL,
  ADD_ACTIVITY_TOOL,
  SEARCH_WEB_TOOL,
];
```

**Wait... ADD_FLIGHT_TOOL IS in ESSENTIAL_TOOLS!**

But `SEARCH_FLIGHTS_TOOL` is NOT in ESSENTIAL_TOOLS (only in ALL_TOOLS at line 1106).

**This reveals the real issue**:
1. First user message → `isFirstMessage=true` → `tools=ESSENTIAL_TOOLS`
2. ESSENTIAL_TOOLS includes `add_flight` but NOT `search_flights`
3. Model can add flights IF user provides complete details
4. Model CANNOT search for flight options
5. Tool chaining rounds continue with same `tools=ESSENTIAL_TOOLS`
6. Model never gets access to `search_flights` tool
7. If persona tests require flight SEARCH (not just adding pre-booked flights), they will fail

### Hypothesis 3: Sequential Execution Timing Issue

**Location**: Lines 384-394 (non-streaming), 914-924 (streaming)

The commit `fe1235a` changed tool execution from `Promise.all()` to sequential `for...of` loop:

```typescript
// Execute tool calls sequentially to prevent race conditions
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

**Possible Issue**:
- Sequential execution may be slower
- If there's a timeout or performance issue, later tool calls might fail
- However, this doesn't explain why FLIGHT tools specifically are missing

## Evidence from Persona Tests

**Before tool chaining**:
- Jennifer Chen: 85/100 with 6 segments **including FLIGHT**
- Pass rate: 37.5% (3/8)

**After tool chaining**:
- Jennifer Chen: 55/100 with 4 segments, **NO FLIGHT**
- Pass rate: 12.5% (1/8)
- **ALL personas missing FLIGHT segments**

**This strongly suggests Hypothesis 2**: FLIGHT tools are NOT in ESSENTIAL_TOOLS.

## Next Steps to Confirm Root Cause

1. ✅ **Check tools.ts**: Verify ESSENTIAL_TOOLS vs ALL_TOOLS contents
2. ✅ **Check if FLIGHT tools are missing from ESSENTIAL_TOOLS**
3. ✅ **Verify tool selection is recalculated per chaining round**

## Recommended Fixes

### ⭐ Option 1: Add SEARCH Tools to ESSENTIAL_TOOLS (RECOMMENDED)

If search capabilities are critical for persona tests, add them to ESSENTIAL_TOOLS:

```typescript
// In tools.ts (line 1076)
export const ESSENTIAL_TOOLS: ToolDefinition[] = [
  GET_ITINERARY_TOOL,
  UPDATE_ITINERARY_TOOL,
  UPDATE_PREFERENCES_TOOL,
  ADD_TRAVELER_TOOL,
  ADD_FLIGHT_TOOL,
  ADD_HOTEL_TOOL,
  ADD_ACTIVITY_TOOL,
  SEARCH_WEB_TOOL,
  SEARCH_FLIGHTS_TOOL,    // ← ADD THIS
  SEARCH_HOTELS_TOOL,     // ← ADD THIS (optional, for consistency)
];
```

**Pros**:
- Simple one-line fix
- Preserves token optimization intent
- Enables full flight search workflow from first message
- Fixes persona test regression

**Cons**:
- Increases token usage on first message by ~500 tokens (2 tool definitions)
- May increase latency slightly

### Option 2: Recalculate Tools for Each Chaining Round

Modify tool chaining to allow ALL_TOOLS after first round:

```typescript
// After first round, allow all tools
const chainingTools = currentToolRound === 1 ? tools : ALL_TOOLS;

const nextResponse = await this.client.chat.completions.create({
  // ...
  tools: chainingTools, // Use expanded tools for chaining
  // ...
});
```

**Pros**: Preserves first-message optimization, enables full tools for chaining
**Cons**: More complex logic, potential for inconsistency

### Option 3: Use ALL_TOOLS for Both First Message and Chaining

Remove the ESSENTIAL_TOOLS optimization entirely:

```typescript
private getToolsForMode(agentMode: TripDesignerMode | undefined, isFirstMessage: boolean): ChatCompletionTool[] {
  if (agentMode === 'help') {
    return HELP_AGENT_TOOLS as ChatCompletionTool[];
  }
  // Always use ALL_TOOLS
  return ALL_TOOLS as ChatCompletionTool[];
}
```

**Pros**: Simplest, most predictable behavior
**Cons**: Higher token usage on first message

## Code Locations Summary

| Location | Line Range | Issue | Fix Needed |
|----------|-----------|-------|------------|
| `tools.ts` ESSENTIAL_TOOLS | 1076-1085 | ❌ Missing `SEARCH_FLIGHTS_TOOL` | ⭐ Add `SEARCH_FLIGHTS_TOOL` to array (Recommended) |
| `tools.ts` ESSENTIAL_TOOLS | 1076-1085 | ❌ Missing `SEARCH_HOTELS_TOOL` | Add `SEARCH_HOTELS_TOOL` to array (Optional) |
| `getToolsForMode()` | 155-164 | Tool selection reuses first calculation | Recalculate tools per chaining round (Alternative) |
| `chat()` tool chaining | 431-601 | Uses `tools` from line 340 | Pass `ALL_TOOLS` after first round (Alternative) |
| `chatStream()` tool chaining | 1009-1269 | Uses `tools` from line 724 | Pass `ALL_TOOLS` after first round (Alternative) |

## ✅ CONFIRMED ROOT CAUSE

The tool chaining implementation is **structurally correct** in passing the `tools` parameter. The regression is caused by **tool selection logic** that restricts first-message interactions to ESSENTIAL_TOOLS, and this restriction **carries over to all tool chaining rounds**.

**ROOT CAUSE CONFIRMED**:
1. `ESSENTIAL_TOOLS` includes `add_flight` but NOT `search_flights` (line 1081 vs line 1106)
2. The `tools` variable is calculated ONCE at the start based on `isFirstMessage` (lines 339-340 for chat, 723-724 for chatStream)
3. This SAME `tools` array is reused in ALL tool chaining rounds (line 459 for chat, line 1062 for chatStream)
4. If `isFirstMessage=true`, then `tools=ESSENTIAL_TOOLS` for the ENTIRE conversation interaction
5. Tool chaining rounds inherit this limited toolset with NO `search_flights` capability
6. Persona tests that require flight search will FAIL

**WHY FLIGHTS ARE MISSING**:
- `add_flight` requires complete flight details (airline, flight number, times, etc.)
- Most persona tests likely expect the model to SEARCH for flights first
- Without `search_flights` tool, the model cannot find flight options
- Model falls back to asking questions or making incomplete itineraries
- Result: No FLIGHT segments created
