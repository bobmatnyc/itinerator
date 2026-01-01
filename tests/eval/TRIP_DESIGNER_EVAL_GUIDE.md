# Trip Designer Comprehensive Evaluation Guide

## Overview

The Trip Designer evaluation suite tests LLM performance across two critical dimensions:

1. **Tool Usage Accuracy** - Does the model call the correct tools with valid parameters?
2. **Instruction Adherence** - Does the model follow critical system prompt instructions?

## Quick Start

```bash
# Run full evaluation (all models, all scenarios)
npm run eval:trip-designer

# Or use tsx directly
npx tsx tests/eval/trip-designer-eval.ts

# Test specific models
npx tsx tests/eval/trip-designer-eval.ts --models=haiku,sonnet

# Test specific scenario types
npx tsx tests/eval/trip-designer-eval.ts --scenarios=tool-usage
npx tsx tests/eval/trip-designer-eval.ts --scenarios=instruction-adherence
```

## Test Scenarios

### Tool Usage Scenarios (10 tests)

Tests if the model calls the CORRECT tool with VALID parameters:

| Scenario | Expected Tool | Description |
|----------|---------------|-------------|
| "Add a dinner reservation at Le Bernardin..." | `add_activity` | Dining reservation |
| "Add a flight from JFK to LAX..." | `add_flight` | Flight with complete details |
| "Add 3 nights at the Four Seasons Tokyo..." | `add_hotel` | Hotel booking with duration |
| "Schedule a meeting with John Smith..." | `add_meeting` | Business meeting |
| "Add an airport transfer from LAX..." | `add_transfer` | Ground transfer |
| "Delete the dinner reservation..." | `delete_segment` | Delete segment |
| "Move the hotel check-in to next day" | `update_segment` | Update segment timing |
| "Find flights from SFO to Tokyo..." | `search_flights` | Flight search |
| "Search for hotels near Shibuya..." | `search_hotels` | Hotel search |
| "What's on my itinerary so far?" | `get_itinerary` | Retrieve itinerary |

### Instruction Adherence Scenarios (8 tests)

Tests critical instructions from the system prompt:

| Rule | Scenario | Validation |
|------|----------|------------|
| ONE_QUESTION_RULE | "I want to plan a trip to Japan" | Should ask ≤ 1 question |
| MUST_CALL_TOOL | "Add a lunch at Nobu Malibu..." | Must call tool, not just text |
| USE_SEARCH_NOT_HALLUCINATE | "What are the best restaurants in Paris?" | Should use search_web |
| ASK_BEFORE_ASSUMING | "Add a flight" | Should ask for missing details |
| ACKNOWLEDGE_EXISTING_BOOKINGS | "Help me plan my flights" (with existing booking) | Should mention existing flight |
| SAVE_DATA_WITH_TOOLS | "I want to go to Croatia from April 14-21" | Must call update_itinerary |
| HOTEL_MENTIONED_CALL_TOOL | "We're staying at Hotel L'Esplanade" | Must call add_hotel |
| BOOKINGS_ARE_GROUND_TRUTH | "What trip am I planning?" (with conflicting title) | Infer from bookings, not title |

## Scoring System

Each scenario receives:

### Tool Usage Score (0-1)
- **0.33** - Tool call attempted (vs text-only response)
- **0.33** - Correct tool called
- **0.34** - Required parameters present

### Instruction Score (0-1)
- **1.0** - Critical rule followed
- **0.0** - Rule violated

### Overall Score
- Average of tool accuracy and instruction adherence
- Weighted by number of scenarios in each category

## Output Format

The evaluation generates two files:

### JSON Results
```
tests/eval/results/trip-designer-comprehensive-eval-{timestamp}.json
```

Contains full details:
- All scenario results
- Token usage per scenario
- Response objects for debugging
- Validation details for failures

### Markdown Report
```
tests/eval/results/trip-designer-comprehensive-eval-{timestamp}.md
```

Formatted report with:
- Overall results table
- Detailed breakdown per model
- Failed scenarios with reasons
- Recommendations (best overall, cheapest, fastest)

## Example Output

```
| Model | Tool Accuracy | Instruction Adherence | Avg Latency | Cost/1k | Overall |
|-------|---------------|----------------------|-------------|---------|---------|
| anthropic/claude-3.5-haiku | 90% | 88% | 1200ms | $0.80 | 89% |
| anthropic/claude-3.5-sonnet | 100% | 100% | 2500ms | $3.00 | 100% |
| openai/gpt-4o-mini | 80% | 75% | 900ms | $0.15 | 78% |
```

## Models Tested

Default models (7 total):
- `anthropic/claude-3.5-haiku` - Current default (cost-effective)
- `anthropic/claude-3.5-sonnet` - Higher capability
- `anthropic/claude-sonnet-4` - Latest Sonnet
- `openai/gpt-4o-mini` - Cost-effective OpenAI
- `openai/gpt-4o` - Flagship OpenAI
- `google/gemini-2.0-flash` - Very cheap Google
- `google/gemini-pro-1.5` - Google flagship

## Interpreting Results

### Tool Accuracy
- **90%+** - Excellent tool usage, follows instructions well
- **80-90%** - Good, may have minor edge cases
- **70-80%** - Acceptable, some tool confusion
- **<70%** - Poor, frequent tool misuse

### Instruction Adherence
- **90%+** - Reliably follows critical rules
- **80-90%** - Good, occasional rule violations
- **70-80%** - Concerning, frequent violations
- **<70%** - Unsuitable for production use

### Cost/1k Interactions
- **<$1.00** - Very cost-effective
- **$1.00-$3.00** - Moderate cost
- **$3.00-$5.00** - Premium pricing
- **>$5.00** - Expensive for high-volume use

## Adding New Scenarios

### Tool Usage Scenario
```typescript
{
  type: 'tool-usage',
  prompt: 'Your test prompt here',
  expectedTool: 'tool_name',
  requiredParams: ['param1', 'param2'],
  description: 'Brief description',
}
```

### Instruction Scenario
```typescript
{
  type: 'instruction-adherence',
  prompt: 'Your test prompt',
  criticalRule: 'RULE_NAME',
  validationFn: (response) => {
    // Return true if rule followed, false otherwise
    return response.message?.content.includes('expected text');
  },
  description: 'Brief description',
  context: {
    // Optional: provide itinerary context
    segments: [{ type: 'FLIGHT', ... }],
    title: 'Trip title',
  },
}
```

## Troubleshooting

### "OPENROUTER_API_KEY not set"
```bash
export OPENROUTER_API_KEY="your-key-here"
```

### Rate limiting errors
- Evaluation includes 1s delay between requests
- For more aggressive rate limiting, increase delay in code

### Model not found
- Ensure model ID matches OpenRouter naming
- Check https://openrouter.ai/models for available models

### High costs
- Test with cheaper models first (gemini-2.0-flash, gpt-4o-mini)
- Use `--models=haiku` to test single model
- Use `--scenarios=tool-usage` to reduce test count

## Best Practices

1. **Baseline First** - Run with current default model to establish baseline
2. **Compare Incrementally** - Test new models one at a time
3. **Cost vs Quality** - Balance accuracy with cost/1k
4. **Real-world Validation** - Supplement with manual testing
5. **Track Over Time** - Re-run after system prompt changes

## CI/CD Integration

Add to GitHub Actions:
```yaml
- name: Run Trip Designer Evaluation
  run: npm run eval:trip-designer -- --models=haiku
  env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
```

## Related Files

- **Evaluation Script**: `tests/eval/trip-designer-eval.ts`
- **Tool Definitions**: `src/services/trip-designer/tools.ts`
- **System Prompt**: `src/prompts/trip-designer/system.md`
- **Cost Calculator**: `tests/eval/metrics/cost-calculator.ts`
- **Results**: `tests/eval/results/trip-designer-comprehensive-eval-*.{json,md}`
