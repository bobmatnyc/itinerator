# Model Evaluation Framework

Automated framework for comparing different LLM models across different agent types.

## Overview

This framework evaluates models on multiple dimensions:

- **Format Compliance** (20%): JSON structure, markdown quality
- **One Question Rule** (30%): Adherence to ONE question constraint
- **Response Quality** (30%): LLM-as-judge evaluation
- **Cost Efficiency** (10%): Cost per 1k interactions
- **Latency** (10%): Response time

## Quick Start

### Prerequisites

```bash
# Set OpenRouter API key
export OPENROUTER_API_KEY="your-key-here"
```

### Run Full Evaluation

```bash
# Evaluate all agents with all models
npx tsx tests/eval/model-comparison.ts

# Evaluate specific agent
npx tsx tests/eval/model-comparison.ts --agent trip-designer

# Evaluate specific models only
npx tsx tests/eval/model-comparison.ts --models claude-sonnet-4,gpt-4o

# Skip quality judge (faster, cheaper)
npx tsx tests/eval/model-comparison.ts --no-judge
```

## Directory Structure

```
tests/eval/
├── model-comparison.ts       # Main evaluation script
├── test-prompts.ts            # Test prompts for each agent
├── types.ts                   # Type definitions
├── report-generator.ts        # Report generation
├── metrics/
│   ├── format-compliance.ts   # Format evaluation
│   ├── quality-judge.ts       # LLM-as-judge
│   └── cost-calculator.ts     # Cost estimation
└── results/
    ├── eval-TIMESTAMP.json    # Raw results
    ├── eval-TIMESTAMP.md      # Markdown report
    └── recommendations.md     # Model recommendations
```

## Metrics Explained

### Format Compliance (0-1)

Evaluates:
- Valid JSON structure when expected
- Proper markdown formatting
- Code blocks with language tags
- Heading hierarchy

**Weight**: 20% of overall score

### One Question Compliance (0-1)

Evaluates adherence to the ONE question rule:
- `1.0` = Exactly one question OR no questions
- `0.0` = Multiple questions (violation)

**Weight**: 30% of overall score

### Response Quality (0-1)

LLM-as-judge evaluation using Claude Haiku:
- **Relevance**: Addresses user's prompt
- **Helpfulness**: Provides actionable information
- **Clarity**: Well-structured and understandable
- **Correctness**: Factually accurate

**Weight**: 30% of overall score

### Cost Efficiency (normalized)

- Based on estimated cost per 1k interactions
- Lower cost = higher score
- Normalized: $2/1k = 0.0, $0/1k = 1.0

**Weight**: 10% of overall score

### Latency (normalized)

- Average response time in milliseconds
- Lower latency = higher score
- Normalized: 5000ms = 0.0, 0ms = 1.0

**Weight**: 10% of overall score

## Test Prompts

Each agent has test prompts covering:

### Trip Designer
- **Discovery**: Initial planning questions
- **Refinement**: Follow-up questions
- **Tool Use**: Adding/removing segments
- **General**: Viewing itineraries

### Help Agent
- **Feature Questions**: How to use app
- **Handoff Detection**: When to transfer to other agents
- **Troubleshooting**: Common issues

### Travel Agent
- **Search Queries**: Hotels, flights, restaurants
- **Refinement**: Clarifying search parameters
- **Synthesis**: Comparing and recommending options

## Output Files

### Raw Results (`eval-TIMESTAMP.json`)

Complete evaluation data including:
- All samples with prompts and responses
- Token counts and latencies
- Individual scores per metric
- Quality judge reasoning

### Markdown Report (`eval-TIMESTAMP.md`)

Human-readable report with:
- Performance comparison tables
- Model recommendations per agent
- Detailed analysis of top models
- Cost comparison table

### Recommendations (`recommendations.md`)

Concise recommendations for each agent:
- Best model based on evaluation
- Rationale for recommendation
- Key metrics summary
- Alternative options

## Extending the Framework

### Add New Test Prompts

Edit `test-prompts.ts`:

```typescript
{
  agent: 'trip-designer',
  prompts: [
    {
      prompt: 'Your test prompt here',
      expectedBehavior: 'What the agent should do',
      category: 'discovery', // or 'refinement', 'tool-use', 'general'
    },
  ],
}
```

### Add New Metrics

1. Create file in `metrics/` directory
2. Export evaluation function
3. Import in `model-comparison.ts`
4. Add to `calculateMetrics()` function

### Add New Models

Edit `tests/config/models.ts`:

```typescript
export const EVAL_MODELS = [
  'anthropic/claude-sonnet-4',
  'your/new-model',
  // ...
] as const;
```

Add pricing in `metrics/cost-calculator.ts`:

```typescript
export const MODEL_PRICING = {
  'your/new-model': { input: X, output: Y },
  // ...
};
```

## Best Practices

### Running Evaluations

1. **Start Small**: Test with one agent/model first
2. **Use --no-judge**: For faster iteration during development
3. **Rate Limiting**: Built-in 1s delay between requests
4. **Cost Awareness**: Quality judge uses Haiku (cheap but adds cost)

### Interpreting Results

- **Overall Score ≥ 0.8**: Excellent performance
- **Overall Score 0.6-0.8**: Good performance
- **Overall Score < 0.6**: Poor performance

Focus on:
- **One Question Compliance**: Critical for UX
- **Response Quality**: Most important for user satisfaction
- **Cost**: Matters for production scaling

### Continuous Evaluation

Run evaluations:
- Before changing agent prompts
- When considering new models
- After OpenRouter adds new models
- Monthly for production model validation

## Troubleshooting

### API Errors

```bash
# Check API key
echo $OPENROUTER_API_KEY

# Test connectivity
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### Rate Limiting

Increase delay between requests:

```typescript
delayBetweenRequests: 2000, // 2 seconds
```

### Out of Memory

Reduce samples per agent:

```typescript
samplesPerAgent: 5, // Default is 10
```

## Cost Estimation

Typical costs for full evaluation:

| Configuration | Estimated Cost |
|---------------|----------------|
| All agents, all models, with judge | ~$2-5 |
| Single agent, single model, no judge | ~$0.10 |
| All agents, all models, no judge | ~$1-2 |

Costs depend on:
- Number of test prompts
- Response length
- Model pricing
- Quality judge enabled/disabled

## Future Enhancements

- [ ] Tool use accuracy evaluation
- [ ] Multi-turn conversation evaluation
- [ ] A/B testing framework
- [ ] Automated model selection
- [ ] Integration with CI/CD
- [ ] Slack/Discord notifications
- [ ] Historical trend tracking
- [ ] Performance regression detection
