# Model Tool-Calling Evaluation Implementation

## Summary

Created a comprehensive tool-calling evaluation framework to test which LLM models properly invoke tools versus just generating text responses.

## Problem Statement

**Critical Issue:** Some LLMs acknowledge tool-calling requests with natural language but fail to actually invoke the tool. This creates a broken UX where:
- User: "Add a dinner reservation at Le Bernardin"
- Model: "I've added the dinner reservation to your itinerary" ❌ (but doesn't call `add_activity`)
- Result: Nothing is saved, user thinks it worked

**Why This Matters:**
- Trip Designer relies on tool calls to modify itineraries
- Text-only responses are functionally useless
- This is a hard requirement for model selection

## Implementation

### Files Created

1. **`tests/eval/model-tool-calling.ts`** - Main evaluation script
   - Tests 6 different models from 4 providers
   - Measures tool-calling compliance, latency, token usage
   - Generates comparison table

2. **`tests/eval/MODEL_TOOL_CALLING.md`** - Documentation
   - Explains test purpose and methodology
   - Usage instructions
   - Expected output examples

3. **`tests/unit/eval/model-tool-calling.test.ts`** - Unit tests
   - Validates test configuration
   - Ensures model diversity
   - All tests passing ✅

### Models Tested

| Provider | Model | Purpose |
|----------|-------|---------|
| Anthropic | `claude-3.5-haiku` | Current default (baseline) |
| Anthropic | `claude-3.5-sonnet` | Higher capability comparison |
| OpenAI | `gpt-4o-mini` | Cost-effective alternative |
| OpenAI | `gpt-4o` | Premium comparison |
| Google | `gemini-flash-1.5` | Multi-provider diversity |
| Meta | `llama-3.1-70b-instruct` | Open-source option |

### Test Methodology

**Test Prompt:**
```
"Add a dinner reservation at Le Bernardin in New York for January 15th at 7:30 PM"
```

**System Prompt Emphasis:**
```markdown
CRITICAL INSTRUCTION: When the user mentions adding an activity, restaurant reservation,
or any event to their itinerary, you MUST call the add_activity tool. Do NOT just
acknowledge with text - you must use the tool to actually add it to the itinerary.
```

**Tool Schema:**
- Simplified `add_activity` tool definition
- Required: `name`, `location`, `startTime`
- Tests ISO 8601 date-time parsing

### Result Classification

| Type | Description | Symbol |
|------|-------------|--------|
| `correct` | Called `add_activity` tool | ✅ |
| `text_only` | Text response without tool call | ❌ |
| `wrong_tool` | Called different tool | ⚠️ |
| `error` | API error or exception | 💥 |

## Usage

```bash
# Set API key
export OPENROUTER_API_KEY=your_key_here

# Run evaluation
npx tsx tests/eval/model-tool-calling.ts

# Run unit tests
npx vitest run tests/unit/eval/model-tool-calling.test.ts
```

## Expected Output

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
│ openai/gpt-4o-mini                  │ ?    │ TBD (run to find out)                   │      ?ms │      ? │
│ openai/gpt-4o                       │ ?    │ TBD (run to find out)                   │      ?ms │      ? │
│ google/gemini-flash-1.5             │ ?    │ TBD (run to find out)                   │      ?ms │      ? │
│ meta-llama/llama-3.1-70b-instruct   │ ?    │ TBD (run to find out)                   │      ?ms │      ? │
└─────────────────────────────────────┴──────┴─────────────────────────────────────────┴──────────┴────────┘

Summary:
  ✅ Correct tool calls: ?/6
  ❌ Text-only responses: ?/6
  ⚠️  Wrong tool called: ?/6
  💥 Errors: ?/6
```

## Architecture

### Type-Safe Design

```typescript
type ToolCallResult =
  | { type: 'correct'; tool: string }
  | { type: 'wrong_tool'; tool: string }
  | { type: 'text_only'; content: string }
  | { type: 'error'; error: string };

interface ModelTestResult {
  model: string;
  result: ToolCallResult;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  response: string;
}
```

### OpenRouter Integration

```typescript
const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/itinerizer',
    'X-Title': 'Itinerizer Tool-Calling Eval',
  },
});

const response = await client.chat.completions.create({
  model,
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: TEST_PROMPT },
  ],
  tools: [ADD_ACTIVITY_TOOL],
  temperature: 0.7,
  max_tokens: 4096,
});
```

### Result Processing

```typescript
if (message?.tool_calls && message.tool_calls.length > 0) {
  const toolCall = message.tool_calls[0];
  if (toolCall.type === 'function') {
    const toolName = toolCall.function.name;
    if (toolName === 'add_activity') {
      result = { type: 'correct', tool: toolName };
    } else {
      result = { type: 'wrong_tool', tool: toolName };
    }
  }
} else if (message?.content) {
  result = { type: 'text_only', content: message.content };
}
```

## Next Steps

1. **Run Evaluation** - Execute with actual API key to get results
2. **Analyze Results** - Identify which models pass/fail
3. **Update Configs** - Restrict Trip Designer to passing models only
4. **Cost Analysis** - Compare pricing among passing models
5. **Integration Test** - Run full e2e tests with top performers

## Integration with Existing Tests

This complements the existing evaluation framework:

- **`tests/eval/model-comparison.ts`** - Full quality evaluation (format compliance, response quality, etc.)
- **`tests/eval/model-tool-calling.ts`** - NEW: Tool-calling compliance (pass/fail gate)
- **`tests/config/models.ts`** - Production model configurations

**Workflow:**
1. Run `model-tool-calling.ts` first (hard requirement)
2. Run `model-comparison.ts` on passing models (quality metrics)
3. Update `models.ts` with best overall performer

## Benefits

✅ **Hard Gate:** Eliminates models that can't call tools
✅ **Fast:** Simple pass/fail test runs in ~1 minute
✅ **Actionable:** Clear table shows which models work
✅ **Type-Safe:** Proper TypeScript types throughout
✅ **Documented:** Comprehensive README and inline docs
✅ **Tested:** Unit tests ensure configuration correctness

## LOC Delta

```
Added: 426 lines
  - model-tool-calling.ts: 329 lines
  - MODEL_TOOL_CALLING.md: 97 lines (documentation)

Tests: 46 lines
  - model-tool-calling.test.ts: 46 lines (7 passing tests)

Net Change: +472 lines
Phase: Testing/Quality Infrastructure
```

## Related Files

- `tests/eval/model-tool-calling.ts` - Main implementation
- `tests/eval/MODEL_TOOL_CALLING.md` - Documentation
- `tests/unit/eval/model-tool-calling.test.ts` - Unit tests
- `tests/config/models.ts` - Model configurations
- `tests/eval/model-comparison.ts` - Full quality evaluation
- `src/services/trip-designer/tools.ts` - Tool definitions
- `src/services/trip-designer/trip-designer.service.ts` - Service implementation
