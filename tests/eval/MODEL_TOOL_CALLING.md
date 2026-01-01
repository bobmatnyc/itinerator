# Model Tool-Calling Evaluation

## Overview

This test evaluates which LLM models properly call tools versus just generating text responses when given an explicit instruction to add an item to an itinerary.

## Purpose

The Trip Designer agent relies on tool calls (like `add_activity`, `add_hotel`, etc.) to actually modify the itinerary. Models that only respond with text acknowledgment fail to perform the actual work.

**Test Scenario:**
- **Prompt:** "Add a dinner reservation at Le Bernardin in New York for January 15th at 7:30 PM"
- **Expected:** Model calls `add_activity` tool with proper parameters
- **Failure:** Model responds with text like "I've added the dinner reservation..." but doesn't call the tool

## Models Tested

1. `anthropic/claude-3.5-haiku` (current default)
2. `anthropic/claude-3.5-sonnet`
3. `openai/gpt-4o-mini`
4. `openai/gpt-4o`
5. `google/gemini-flash-1.5`
6. `meta-llama/llama-3.1-70b-instruct`

## Running the Test

```bash
# Ensure OPENROUTER_API_KEY is set
export OPENROUTER_API_KEY=your_key_here

# Run the evaluation
npx tsx tests/eval/model-tool-calling.ts
```

## Expected Output

The test will:
1. Call each model with the same test prompt
2. Check if the model called the `add_activity` tool
3. Generate a comparison table

**Example Output:**
```
====================================================================================================
MODEL TOOL-CALLING COMPARISON
====================================================================================================
Test Prompt: "Add a dinner reservation at Le Bernardin in New York for January 15th at 7:30 PM"

┌─────────────────────────────────────┬──────┬─────────────────────────────────────────┬──────────┬────────┐
│ Model                               │ Pass │ Result                                  │ Latency  │ Tokens │
├─────────────────────────────────────┼──────┼─────────────────────────────────────────┼──────────┼────────┤
│ anthropic/claude-3.5-haiku          │ ✅   │ Called add_activity                     │   1234ms │    456 │
│ anthropic/claude-3.5-sonnet         │ ✅   │ Called add_activity                     │   2345ms │    512 │
│ openai/gpt-4o-mini                  │ ❌   │ Text response only (no tool call)       │   1567ms │    389 │
│ openai/gpt-4o                       │ ✅   │ Called add_activity                     │   2789ms │    523 │
│ google/gemini-flash-1.5             │ ❌   │ Text response only (no tool call)       │   1890ms │    401 │
│ meta-llama/llama-3.1-70b-instruct   │ ❌   │ Text response only (no tool call)       │   3456ms │    678 │
└─────────────────────────────────────┴──────┴─────────────────────────────────────────┴──────────┴────────┘

Summary:
  ✅ Correct tool calls: 3/6
  ❌ Text-only responses: 3/6
  ⚠️  Wrong tool called: 0/6
  💥 Errors: 0/6
```

## Result Types

| Symbol | Result Type | Description |
|--------|-------------|-------------|
| ✅ | `correct` | Model called `add_activity` tool correctly |
| ❌ | `text_only` | Model responded with text but didn't call tool |
| ⚠️ | `wrong_tool` | Model called a different tool |
| 💥 | `error` | API error or exception occurred |

## Why This Matters

**Critical for Trip Designer:**
- Without tool calls, the itinerary is NOT modified
- Users see acknowledgment text but nothing is saved
- This creates a broken UX where the agent "pretends" to work

**Model Selection Criteria:**
- Tool-calling compliance is a hard requirement
- Models that fail this test should NOT be used for Trip Designer
- Even high-quality text generation is useless without tool calls

## Implementation Details

**System Prompt:**
```markdown
You are a trip planning assistant. Help users plan their travel itineraries.

CRITICAL INSTRUCTION: When the user mentions adding an activity, restaurant reservation,
or any event to their itinerary, you MUST call the add_activity tool. Do NOT just
acknowledge with text - you must use the tool to actually add it to the itinerary.
```

**Tool Definition:**
- Uses simplified `add_activity` tool schema
- Required fields: `name`, `location`, `startTime`
- Tests ISO 8601 date-time parsing

## Next Steps

After running this evaluation:

1. **Update model configs** - Use only models that passed
2. **Document failures** - Note which models don't support tool-calling
3. **Cost analysis** - Compare pricing among passing models
4. **Integration test** - Run full Trip Designer e2e tests with top performers

## Related Files

- `tests/config/models.ts` - Production model configurations
- `tests/eval/model-comparison.ts` - Full quality evaluation suite
- `src/services/trip-designer/tools.ts` - Complete tool definitions
- `src/services/trip-designer/trip-designer.service.ts` - Service implementation
