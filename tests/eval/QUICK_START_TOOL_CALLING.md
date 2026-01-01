# Quick Start: Model Tool-Calling Evaluation

## TL;DR

Test which LLMs actually call tools vs. just pretending to:

```bash
export OPENROUTER_API_KEY=your_key_here
npx tsx tests/eval/model-tool-calling.ts
```

## What This Tests

**Prompt:** "Add a dinner reservation at Le Bernardin in New York for January 15th at 7:30 PM"

**Expected:** Model calls `add_activity` tool ✅
**Failure:** Model responds "I've added it!" but doesn't call tool ❌

## Why It Matters

Without tool calls, the Trip Designer is broken:
- Nothing gets saved to the itinerary
- User sees acknowledgment but data is lost
- This is a HARD requirement for any model

## Interpret Results

| Symbol | What Happened | Use This Model? |
|--------|---------------|-----------------|
| ✅ | Called `add_activity` correctly | YES |
| ❌ | Text-only response | NO |
| ⚠️ | Called wrong tool | NO |
| 💥 | API error | INVESTIGATE |

## Example Output

```
┌─────────────────────────────────────┬──────┬─────────────────────────────────────────┐
│ Model                               │ Pass │ Result                                  │
├─────────────────────────────────────┼──────┼─────────────────────────────────────────┤
│ anthropic/claude-3.5-haiku          │ ✅   │ Called add_activity                     │
│ anthropic/claude-3.5-sonnet         │ ✅   │ Called add_activity                     │
│ openai/gpt-4o-mini                  │ ❌   │ Text response only (no tool call)       │
└─────────────────────────────────────┴──────┴─────────────────────────────────────────┘
```

## What To Do With Results

### If Model PASSES (✅)
→ Safe to use for Trip Designer
→ Run full quality eval: `npx tsx tests/eval/model-comparison.ts --models <model>`

### If Model FAILS (❌)
→ DO NOT use for Trip Designer
→ Model fundamentally incompatible with tool-calling workflow

## Next Steps

1. Run this evaluation first (hard gate)
2. Use only passing models for quality evaluation
3. Update `tests/config/models.ts` with best performer

## Full Documentation

See `tests/eval/MODEL_TOOL_CALLING.md` for complete details.
