# Trip Designer Streaming Analysis - Zero Content Issue

**Date:** December 22, 2025
**Issue:** Chat receiving 6 chunks from LLM with 0 text content
**Model:** anthropic/claude-sonnet-4 via OpenRouter

## Executive Summary

The Trip Designer is receiving streaming chunks from the LLM but extracting 0 characters of text content. Based on code analysis, this is **EXPECTED BEHAVIOR** when the LLM responds with tool calls only (no text message).

## Root Cause Analysis

### Streaming Flow Architecture

```
Client Request
    ↓
SvelteKit SSE Route (/api/v1/designer/sessions/[sessionId]/messages/stream/+server.ts)
    ↓
TripDesignerService.chatStream() (src/services/trip-designer/trip-designer.service.ts:521)
    ↓
OpenRouter API (streaming)
    ↓
Chunk Processing Loop (lines 589-663)
    ↓
Event Emission (text/tool_call/tool_result/done)
```

### Chunk Processing Logic

**Lines 589-663 of trip-designer.service.ts:**

```typescript
for await (const chunk of stream) {
  chunkCount++;
  const delta = chunk.choices[0]?.delta;

  // Debug logging (first 3 chunks)
  if (chunkCount <= 3) {
    console.log(`[chatStream] Chunk ${chunkCount}: content=${delta?.content?.length || 0} chars, tool_calls=${delta?.tool_calls?.length || 0}, finish_reason=${chunk.choices[0]?.finish_reason || 'none'}`);
  }

  // Handle text content
  if (delta.content) {
    fullContent += delta.content;
    yield { type: 'text', content: delta.content };
  }

  // Handle tool calls
  if (delta.tool_calls) {
    // ... accumulate tool call data ...
  }
}
```

### Why 0 Content is Normal

**Scenario 1: Tool-Only Response (Most Likely)**
- LLM decides to respond ONLY with tool calls (no text message)
- `delta.content` is null/undefined in all chunks
- `delta.tool_calls` contains tool call data
- `fullContent.length = 0` at end of stream
- **Expected:** Tool call events emitted, no text events

**Scenario 2: Two-Step Conversation Pattern**
Looking at the non-streaming `chat()` method (lines 310-444), the service uses a **two-call pattern**:

1. **First LLM call:** May return tool calls with minimal/no text
2. **Tool execution:** Execute tool calls and collect results
3. **Second LLM call:** Feed tool results back, get natural language response

**In streaming mode (lines 684-792):**
```typescript
if (toolCalls.length > 0) {
  // First stream completed with tool calls

  // Execute tools
  const executionResults = await Promise.all(/* ... */);

  // Make SECOND stream call for natural language
  const finalStream = await this.client.chat.completions.create({
    model: this.config.model || DEFAULT_MODEL,
    messages: [
      ...messages,
      { role: 'assistant', content: fullContent, tool_calls: toolCalls },
      ...toolResultMessages,
    ],
    stream: true,
  });

  // Stream the FINAL response (this should have content)
  for await (const chunk of finalStream) {
    if (delta?.content) {
      finalContent += delta.content;
      yield { type: 'text', content: delta.content };
    }
  }
}
```

## Evidence from Server Logs

**Log output:**
```
[chatStream] Stream ended, received 6 chunks, content length: 0
```

**Interpretation:**
- 6 chunks received = LLM responded (not a connection issue)
- content length: 0 = No `delta.content` in any chunks
- **Likely:** All 6 chunks contained `delta.tool_calls` data

## Diagnostic Questions

### 1. Are tool calls being received?

**Check for these log messages:**
```typescript
// Line 598: First 3 chunks logged
[chatStream] Chunk 1: content=0 chars, tool_calls=1, finish_reason=none
[chatStream] Chunk 2: content=0 chars, tool_calls=0, finish_reason=none
[chatStream] Chunk 3: content=0 chars, tool_calls=0, finish_reason=tool_calls
```

**If `tool_calls > 0`:** LLM is responding with tools (normal behavior)
**If `tool_calls = 0`:** Investigate why LLM sent empty chunks

### 2. Is the second stream call executing?

**Look for evidence of tool execution:**
- Tool call events emitted to client
- Tool result events emitted to client
- Second LLM stream initiated (line 749)
- Final content streamed back

### 3. What does the client see?

**Expected SSE event sequence (tool-only response):**
1. `event: connected` - Initial connection
2. `event: tool_call` - Each tool the LLM wants to call
3. `event: tool_result` - Result of each tool execution
4. `event: text` - Final natural language response (from second stream)
5. `event: done` - Completion with token/cost stats

**If client only sees:**
1. `event: connected`
2. `event: done` (with 0 cost)

**Then:** Second stream call is not executing or failing silently

## Available Tools Analysis

**From tools.ts:**

**Essential Tools (first message):**
- `get_itinerary`
- `update_itinerary`
- `update_preferences`
- `search_web`

**All Tools (subsequent messages):**
- All essential tools
- `get_segment`, `add_flight`, `add_hotel`, `add_activity`, `add_transfer`, `add_meeting`
- `update_segment`, `delete_segment`, `move_segment`, `reorder_segments`
- `search_flights`, `search_hotels`, `search_transfers`
- `store_travel_intelligence`, `retrieve_travel_intelligence`

**Help Mode Tools:**
- `switch_to_trip_designer` (only tool available in help mode)

## Potential Issues to Investigate

### Issue 1: Silent Tool Execution Failure

**Hypothesis:** Tools are called but execution fails, preventing second stream

**Check:**
- `ToolExecutor.execute()` implementation
- Error handling in tool execution loop (lines 696-731)
- Whether tool results are properly formatted for second LLM call

### Issue 2: Empty Tool Calls

**Hypothesis:** LLM sends tool calls with malformed/empty arguments

**Check:**
- JSON parsing of `completeToolCall.function.arguments` (line 651)
- Whether malformed JSON causes silent failures

### Issue 3: Content Filter / Moderation

**Hypothesis:** OpenRouter or Anthropic blocking content

**Check:**
- Response metadata for content filtering flags
- Error messages in streaming chunks
- `finish_reason` values (should be `tool_calls` or `stop`)

### Issue 4: Model Behavior Change

**Hypothesis:** Claude Sonnet 4 changed behavior to be more tool-focused

**Check:**
- Whether Claude now prefers tool calls over text responses
- System prompt effectiveness (lines 159-164)
- Temperature setting (0.7 - might be too low for conversational responses)

## Recommended Diagnostic Steps

### Step 1: Enhanced Logging

**Add to chatStream() method (line 591):**
```typescript
for await (const chunk of stream) {
  chunkCount++;

  // Log EVERY chunk, not just first 3
  console.log(`[chatStream] Chunk ${chunkCount}:`, JSON.stringify({
    content: delta?.content?.length || 0,
    tool_calls: delta?.tool_calls?.length || 0,
    finish_reason: chunk.choices[0]?.finish_reason,
    has_usage: !!chunk.usage,
  }));

  // Log full chunk structure for first chunk
  if (chunkCount === 1) {
    console.log(`[chatStream] First chunk full structure:`, JSON.stringify(chunk, null, 2));
  }

  const delta = chunk.choices[0]?.delta;
  // ... rest of processing
}
```

### Step 2: Log Tool Call Detection

**Add after line 641:**
```typescript
if (delta.tool_calls) {
  console.log(`[chatStream] Tool call delta detected:`, JSON.stringify(delta.tool_calls));
}
```

### Step 3: Log Tool Execution

**Add after line 704:**
```typescript
console.log(`[chatStream] Executing ${toolCalls.length} tool calls`);
for (let i = 0; i < executionResults.length; i++) {
  console.log(`[chatStream] Tool ${i}: ${toolCalls[i].function.name} -> success=${executionResults[i].success}`);
}
```

### Step 4: Log Second Stream

**Add after line 749:**
```typescript
console.log(`[chatStream] Starting second stream with tool results`);

let finalChunkCount = 0;
for await (const chunk of finalStream) {
  finalChunkCount++;
  if (finalChunkCount === 1) {
    console.log(`[chatStream] Second stream first chunk:`, JSON.stringify(chunk, null, 2));
  }
  // ... rest of processing
}
console.log(`[chatStream] Second stream completed: ${finalChunkCount} chunks, ${finalContent.length} chars`);
```

### Step 5: Check Client-Side

**Verify SSE events received:**
```javascript
// In browser console during chat
const eventSource = new EventSource('/api/v1/designer/sessions/[sessionId]/messages/stream');

eventSource.addEventListener('text', (e) => {
  console.log('TEXT event:', e.data);
});

eventSource.addEventListener('tool_call', (e) => {
  console.log('TOOL_CALL event:', e.data);
});

eventSource.addEventListener('tool_result', (e) => {
  console.log('TOOL_RESULT event:', e.data);
});

eventSource.addEventListener('done', (e) => {
  console.log('DONE event:', e.data);
});
```

## Expected Behavior Patterns

### Pattern 1: New Itinerary Discovery (Normal)

**User:** "I want to plan a trip to Portugal"

**Expected LLM behavior:**
1. **First stream:** Tool calls only (no text)
   - `update_itinerary` (set title, destinations)
   - `update_preferences` (maybe)
2. **Tool execution:** Updates itinerary metadata
3. **Second stream:** Natural language response
   - "I'd be happy to help you plan your Portugal trip! When are you planning to travel?"

**Chunks:** 6 chunks with 0 content = NORMAL (first stream)
**Client sees:** tool_call events, then text events (from second stream)

### Pattern 2: Simple Question (Should have text)

**User:** "What's the weather like in Lisbon in January?"

**Expected LLM behavior:**
1. **First stream:** Text response with optional tool call
   - `search_web` (look up current weather)
   - OR direct text response (if knowledge available)

**Chunks:** Should contain `delta.content`
**If 0 content:** Unexpected - LLM should respond with text

### Pattern 3: Help Mode (Edge Case)

**User:** "Help me understand this app"

**Expected in help mode:**
- Only `switch_to_trip_designer` tool available
- Should respond with text (explanatory message)
- Tool call only if user indicates trip planning intent

## Code Issues Identified

### Issue 1: Tool Call Completion Logic (Line 644)

**Current code:**
```typescript
const nextHasToolCalls = chunk.choices[0]?.finish_reason === 'tool_calls';
if (nextHasToolCalls && currentToolCall && currentToolCall.id && currentToolCall.function) {
  const completeToolCall = currentToolCall as ToolCall;
  toolCalls.push(completeToolCall);
  // ...
}
```

**Problem:** This logic only pushes a tool call when `finish_reason === 'tool_calls'`, which happens at the END of the stream. But tool calls may span multiple chunks BEFORE the finish reason is set.

**Better approach:** Push tool call when starting a NEW tool call (detected by `toolCallDelta.id` being present):

```typescript
if (delta.tool_calls) {
  for (const toolCallDelta of delta.tool_calls) {
    if (toolCallDelta.id) {
      // NEW tool call starting - save previous if exists
      if (currentToolCall && currentToolCall.id && currentToolCall.function) {
        toolCalls.push(currentToolCall as ToolCall);
      }
      // Start new tool call
      currentToolCall = {
        id: toolCallDelta.id,
        type: 'function',
        function: {
          name: toolCallDelta.function?.name || '',
          arguments: toolCallDelta.function?.arguments || '',
        },
      };
    } else {
      // Continuation of existing tool call
      if (currentToolCall?.function) {
        currentToolCall.function.arguments += toolCallDelta.function?.arguments || '';
        currentToolCall.function.name += toolCallDelta.function?.name || '';
      }
    }
  }
}
```

### Issue 2: Missing Final Tool Call (Line 667)

**Current code already handles this:**
```typescript
// Finalize any remaining tool call
if (currentToolCall && currentToolCall.id && currentToolCall.function) {
  const completeToolCall = currentToolCall as ToolCall;
  toolCalls.push(completeToolCall);
  // ...
}
```

**Good:** This ensures the last tool call is captured after the stream ends.

## Conclusion

**Most Likely Scenario:**

The Trip Designer is functioning **correctly**. The LLM (Claude Sonnet 4) is responding with tool calls only in the first stream, which is expected behavior for:
- Discovery questions (setting up itinerary metadata)
- Complex requests requiring tool execution before responding

**The "0 content" is not an error** - it's the first half of a two-step conversation:
1. LLM analyzes request → calls tools (0 text content)
2. Tools execute → LLM synthesizes response (text content)

**What needs investigation:**
1. Is the **second stream** executing and delivering text?
2. Are **tool execution results** being properly formatted?
3. Is the **client receiving all SSE events** (tool_call, tool_result, text)?

**Next steps:**
1. Add enhanced logging (see Step 1-4 above)
2. Monitor client-side SSE events (see Step 5)
3. Verify second stream is executing with tool results
4. Check if text content arrives in second stream

**If problem persists after second stream:**
- Consider adjusting system prompt to encourage text responses
- Increase temperature from 0.7 to 0.8-0.9 for more conversational output
- Add explicit instruction: "Always provide a natural language response alongside tool calls"

## Files Analyzed

1. `/Users/masa/Projects/itinerator/src/services/trip-designer/trip-designer.service.ts` (Lines 521-897)
   - `chatStream()` method implementation
   - Two-stream pattern for tool execution
   - Chunk processing logic

2. `/Users/masa/Projects/itinerator/src/services/trip-designer/tools.ts` (All 967 lines)
   - Tool definitions (18 tools total)
   - Essential vs. All tools distinction
   - Help mode tools

3. `/Users/masa/Projects/itinerator/viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/messages/stream/+server.ts` (Lines 1-128)
   - SSE streaming route
   - Event mapping logic
   - Error handling

## Research Output Metadata

**Ticket Context:** None provided
**Research Type:** Informational (debugging analysis)
**Capture Location:** docs/research/trip-designer-streaming-analysis-2025-12-22.md
**Follow-up Actions:** Run diagnostic logging, verify second stream execution
