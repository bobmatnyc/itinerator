# LLM Evaluation Metrics

This directory contains evaluation frameworks and metrics for assessing Trip Designer LLM performance.

## Evaluation Types

### 1. Accuracy Metrics
- **Destination Matching**: Does the suggested itinerary match the requested destination?
- **Date Adherence**: Are dates within the specified range?
- **Traveler Count**: Does the plan accommodate the correct number of travelers?
- **Budget Alignment**: Do suggestions fit within budget constraints?

### 2. Quality Metrics
- **Logical Flow**: Are activities in a sensible order?
- **Geographic Coherence**: Are nearby attractions grouped together?
- **Time Feasibility**: Is there enough time between segments?
- **Completeness**: Are all necessary segments included (flights, hotels, activities)?

### 3. Persona Alignment
- **Interest Matching**: Do activities align with stated interests?
- **Style Consistency**: Does the trip match the travel style (luxury/budget/moderate)?
- **Pace Appropriateness**: Is the daily pacing suitable for the traveler type?
- **Avoidance Respect**: Are stated avoidances honored?

### 4. Safety & Practicality
- **Valid Locations**: Are all locations real and correctly identified?
- **Realistic Timing**: Are flight/transfer durations plausible?
- **Proper Sequencing**: Do segments follow logical order?
- **No Conflicts**: Are there overlapping segments?

## Evaluation Framework

```typescript
interface EvaluationResult {
  testId: string;
  persona: string;
  prompt: string;
  response: any;
  metrics: {
    accuracy: number;      // 0-1 score
    quality: number;       // 0-1 score
    personaAlignment: number;  // 0-1 score
    safety: number;        // 0-1 score
  };
  passed: boolean;
  issues: string[];
  recommendations: string[];
}
```

## Running Evaluations

```bash
# Run all evaluations
npm run test:eval

# Run specific persona evaluations
npm run test:eval -- --persona=solo-traveler

# Run with detailed output
npm run test:eval -- --verbose

# Generate evaluation report
npm run test:eval:report
```

## Adding New Evaluations

1. Create a new test file in `tests/eval/`
2. Use persona fixtures and evaluation helpers
3. Define clear pass/fail criteria
4. Document expected behavior

Example:
```typescript
import { loadPersonaFixture } from '../helpers/fixture-loader';
import { evaluateResponse } from './metrics/evaluator';

test('Solo traveler receives appropriate recommendations', async () => {
  const persona = loadPersonaFixture('solo-traveler');
  const response = await tripDesigner.generate(persona, 'Plan a week in Thailand');
  
  const evaluation = evaluateResponse(response, {
    expectedDestination: 'Thailand',
    expectedDuration: 7,
    personaAlignment: persona,
  });
  
  expect(evaluation.passed).toBe(true);
  expect(evaluation.metrics.personaAlignment).toBeGreaterThan(0.8);
});
```
