# Model Evaluation Suite

Comprehensive evaluation framework for Trip Designer LLM performance.

## Available Evaluations

### 1. Trip Designer Comprehensive Eval
**File**: `trip-designer-eval.ts`
**Command**: `npm run eval:trip-designer`

Tests instruction adherence and tool usage accuracy across 18 scenarios:
- **10 Tool Usage Tests** - Correct tool calls with valid parameters
- **8 Instruction Tests** - Critical system prompt rule compliance

**Metrics**:
- Tool Accuracy (%)
- Instruction Adherence (%)
- Avg Latency (ms)
- Cost per 1k interactions ($)

**Output**:
- JSON: `results/trip-designer-comprehensive-eval-{timestamp}.json`
- Markdown: `results/trip-designer-comprehensive-eval-{timestamp}.md`

**Guide**: See [TRIP_DESIGNER_EVAL_GUIDE.md](./TRIP_DESIGNER_EVAL_GUIDE.md)

### 2. Model Comparison
**File**: `model-comparison.ts`
**Command**: `npm run eval`

Compare multiple models across:
- Format compliance (JSON structure)
- ONE question rule adherence
- Tool usage patterns
- Response quality (LLM-as-judge)

### 3. Example Evaluation
**File**: `example.ts`
**Command**: `npm run eval:example`

Basic example of evaluation framework usage.

### 4. Promptfoo Integration
**Files**: `../evals/promptfoo.yaml`
**Commands**:
- `npm run eval:promptfoo` - Run evaluation
- `npm run eval:promptfoo:view` - View results
- `npm run eval:compare` - Run and view

External evaluation framework with UI.

## Quick Start

```bash
# Run Trip Designer evaluation
npm run eval:trip-designer

# Test specific models
npx tsx tests/eval/trip-designer-eval.ts --models=haiku,sonnet

# Test only tool usage scenarios
npx tsx tests/eval/trip-designer-eval.ts --scenarios=tool-usage

# Test only instruction adherence
npx tsx tests/eval/trip-designer-eval.ts --scenarios=instruction-adherence
```

## Directory Structure

```
tests/eval/
├── README.md                           # This file
├── TRIP_DESIGNER_EVAL_GUIDE.md        # Detailed guide
├── trip-designer-eval.ts              # Comprehensive evaluation
├── model-comparison.ts                # Model comparison
├── model-tool-calling.ts              # Tool calling test
├── example.ts                         # Basic example
├── test-prompts.ts                    # Test scenarios
├── types.ts                           # Type definitions
├── metrics/
│   ├── cost-calculator.ts            # Cost estimation
│   ├── evaluator.ts                  # Evaluation logic
│   ├── quality-judge.ts              # LLM-as-judge
│   └── format-compliance.ts          # Format validation
├── scenarios/
│   └── index.ts                      # Test scenarios
└── results/
    ├── trip-designer-comprehensive-eval-*.json
    └── trip-designer-comprehensive-eval-*.md
```

## Environment Variables

```bash
# Required
export OPENROUTER_API_KEY="your-key-here"

# Optional (for specific features)
export SERPAPI_KEY="your-serpapi-key"  # For travel search
```

## Cost Management

Evaluation runs can be expensive. Tips:

1. **Test cheap models first**:
   ```bash
   npx tsx tests/eval/trip-designer-eval.ts --models=gemini-2.0-flash
   ```

2. **Test single scenario type**:
   ```bash
   npx tsx tests/eval/trip-designer-eval.ts --scenarios=tool-usage
   ```

3. **Use local cache** (not implemented yet):
   - Results are saved to JSON
   - Future: Add cache to avoid re-running identical scenarios

## Expected Costs

Per full evaluation (7 models × 18 scenarios = 126 requests):

| Model | Est. Cost/Run | Notes |
|-------|---------------|-------|
| gemini-2.0-flash | $0.05 | Cheapest |
| gpt-4o-mini | $0.10 | Good value |
| claude-3.5-haiku | $0.50 | Current default |
| gpt-4o | $1.50 | Premium |
| claude-3.5-sonnet | $1.80 | High quality |
| claude-sonnet-4 | $2.00 | Latest |
| gemini-pro-1.5 | $0.75 | Mid-tier |

**Total for all models**: ~$7.00

## Interpreting Results

### Tool Accuracy
- **90%+**: Production-ready
- **80-90%**: Good, minor issues
- **70-80%**: Acceptable with monitoring
- **<70%**: Not recommended

### Instruction Adherence
- **90%+**: Reliably follows rules
- **80-90%**: Good, occasional violations
- **70-80%**: Concerning
- **<70%**: Unsuitable

### Recommendations
Look for models that:
1. Score 85%+ on both metrics
2. Have acceptable latency (<3s)
3. Fit your cost budget

## Adding New Tests

### 1. Tool Usage Test
```typescript
{
  type: 'tool-usage',
  prompt: 'Add a hotel in Tokyo',
  expectedTool: 'add_hotel',
  requiredParams: ['property', 'location', 'checkInDate', 'checkOutDate'],
  description: 'Hotel booking',
}
```

### 2. Instruction Test
```typescript
{
  type: 'instruction-adherence',
  prompt: 'I want to go to Japan',
  criticalRule: 'ONE_QUESTION_RULE',
  validationFn: (response) => {
    const questionCount = (response.message?.content || '').match(/\?/g)?.length || 0;
    return questionCount <= 1;
  },
  description: 'Should ask one question',
}
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Model Evaluation

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
  workflow_dispatch:

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Run Trip Designer Eval
        run: npm run eval:trip-designer -- --models=haiku
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
      - uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: tests/eval/results/
```

## Best Practices

1. **Baseline First**: Establish baseline with current model
2. **Incremental Testing**: Test new models one at a time
3. **Version Control**: Commit results to track degradation
4. **Cost Awareness**: Monitor spending, use cheap models for development
5. **Real-world Validation**: Supplement with manual testing
6. **Regular Cadence**: Re-run after system prompt changes

## Troubleshooting

### Rate Limiting
Evaluation includes 1s delay between requests. If you hit limits:
- Increase delay in code
- Use fewer models
- Split into batches

### High Token Usage
If prompts are too long:
- Use `systemMinimal` instead of full system prompt
- Reduce context in instruction scenarios
- Test with smaller tool subsets

### Model Errors
If specific model fails:
- Check OpenRouter model availability
- Verify pricing data in `cost-calculator.ts`
- Check model supports tool calling

## Related Documentation

- [Trip Designer Eval Guide](./TRIP_DESIGNER_EVAL_GUIDE.md)
- [Tool Definitions](../../src/services/trip-designer/tools.ts)
- [System Prompt](../../src/prompts/trip-designer/system.md)
- [Cost Calculator](./metrics/cost-calculator.ts)

## Support

For issues or questions:
1. Check the guides in this directory
2. Review existing results in `results/`
3. Examine test implementation in source files
4. Create an issue with evaluation output
