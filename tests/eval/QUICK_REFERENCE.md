# Model Evaluation - Quick Reference

## Commands

```bash
# Run full evaluation
npm run eval

# Specific agent
npm run eval -- --agent trip-designer

# Specific models
npm run eval -- --models claude-sonnet-4,gpt-4o

# Skip quality judge (faster, cheaper)
npm run eval -- --no-judge

# Run example/demo
npm run eval:example

# Help
npm run eval -- --help
```

## Metrics

| Metric | Weight | What It Measures |
|--------|--------|------------------|
| Format Compliance | 20% | JSON structure, markdown quality |
| One Question Rule | 30% | Exactly ONE question asked |
| Response Quality | 30% | LLM-as-judge (relevance, helpfulness, clarity) |
| Cost Efficiency | 10% | Cost per 1k interactions |
| Latency | 10% | Response time |

## Score Interpretation

- **≥ 0.8**: Excellent - Production ready
- **0.6-0.8**: Good - Consider for production
- **< 0.6**: Poor - Not recommended

## Output Files

- `results/eval-TIMESTAMP.json` - Raw data
- `results/eval-TIMESTAMP.md` - Detailed report
- `results/recommendations.md` - Best models per agent

## Available Models

```typescript
EVAL_MODELS = [
  'anthropic/claude-sonnet-4',    // Balanced ($9/1k)
  'anthropic/claude-3-haiku',     // Fast + cheap ($0.75/1k)
  'anthropic/claude-opus-4',      // Most capable ($45/1k)
  'openai/gpt-4o',                // OpenAI flagship ($6.25/1k)
  'google/gemini-2.0-flash',      // Very cheap ($0.19/1k)
]
```

## Test Agents

- **trip-designer**: 10 test prompts (discovery, refinement, tool use)
- **help**: 7 test prompts (features, handoffs, troubleshooting)
- **travel-agent**: 7 test prompts (search, refinement, synthesis)

## Typical Costs

| Configuration | Cost |
|--------------|------|
| All agents + all models + judge | $2-5 |
| Single agent + single model (no judge) | ~$0.10 |
| All agents + all models (no judge) | $1-2 |

## Example Output

```
AGENT: TRIP-DESIGNER
Model                          Overall  Format  1Q Rule  Quality  Latency  Cost/1k
claude-sonnet-4               0.874    0.92    0.95     0.88     1234ms   $9.00
claude-3-haiku                0.781    0.85    0.90     0.72     567ms    $0.75
gpt-4o                        0.843    0.88    0.92     0.85     1456ms   $6.25

RECOMMENDATION: claude-sonnet-4
Reason: Best excellent overall performance, strong format compliance, high quality responses
```

## Programmatic Usage

```typescript
import { evaluateFormatCompliance, calculateCost } from './tests/eval';

// Evaluate format
const result = evaluateFormatCompliance(response);
console.log('One question compliance:', result.oneQuestionCompliance);

// Calculate cost
const cost = calculateCost('anthropic/claude-sonnet-4', 500, 300);
console.log('Cost:', cost);
```

## Adding New Models

1. Add to `tests/config/models.ts`:
   ```typescript
   export const EVAL_MODELS = [
     'your/new-model',
     // ...
   ] as const;
   ```

2. Add pricing to `metrics/cost-calculator.ts`:
   ```typescript
   export const MODEL_PRICING = {
     'your/new-model': { input: X, output: Y },
   };
   ```

3. Run evaluation:
   ```bash
   npm run eval
   ```

## Adding Test Prompts

Edit `test-prompts.ts`:

```typescript
{
  agent: 'trip-designer',
  prompts: [
    {
      prompt: 'Your test prompt',
      expectedBehavior: 'What agent should do',
      category: 'discovery', // or 'refinement', 'tool-use', 'general'
    },
  ],
}
```

## Environment Setup

```bash
# Required
export OPENROUTER_API_KEY="your-key-here"

# Run evaluation
npm run eval
```

## Tips

### For Development
- Use `--no-judge` for faster iteration
- Start with single agent: `--agent trip-designer`
- Test with 1-2 models first

### For Production
- Run full evaluation monthly
- Compare against baseline before model changes
- Focus on "Overall" and "One Question Compliance" scores

### For Cost Optimization
- Use `--no-judge` (saves ~50% cost)
- Test with fewer prompts initially
- Consider Haiku for high-volume agents

## Common Issues

### API Rate Limits
- Built-in 1s delay between requests
- Increase in config if needed

### Out of Memory
- Reduce `samplesPerAgent` in script
- Run single agent at a time

### Missing Pricing
- Add to `MODEL_PRICING` in cost-calculator.ts
- Script logs warning but continues

## What Gets Evaluated

✅ Format compliance (JSON, markdown)
✅ One question rule adherence
✅ Response quality (LLM-as-judge)
✅ Cost per 1k interactions
✅ Response latency

⏳ Tool use accuracy (TODO)
⏳ Multi-turn conversations (TODO)

## Files Structure

```
tests/eval/
├── model-comparison.ts    # Main script
├── example.ts             # Demo
├── test-prompts.ts        # Test cases
├── metrics/               # Evaluation metrics
│   ├── format-compliance.ts
│   ├── quality-judge.ts
│   └── cost-calculator.ts
└── results/               # Generated reports
```

---

**See README.md for detailed documentation**
