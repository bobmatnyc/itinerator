# Agent Memory: qa
<!-- Last Updated: 2026-01-04 -->

## Testing Framework Overview

### Test Types and Commands
```bash
# Unit Tests - Fast, isolated service/utility tests
make test-unit

# Integration Tests - Service + storage integration
make test-integration

# E2E Tests - Full user flows with browser automation
make test-e2e

# Persona Tests - AI-driven realistic user testing
make test-persona

# Model Evaluation - LLM performance benchmarking
make test-eval

# All tests
make test

# With coverage
make test-coverage
```

## Traveler Persona Testing

### Overview
Traveler persona tests simulate realistic users interacting with the Trip Designer through full conversation flows. Each persona has unique travel preferences, budgets, and expectations.

### Persona Types

#### Solo Backpacker
- Budget: budget
- Pace: moderate to packed
- Interests: adventure, culture, nightlife
- Accommodation: hostels, budget hotels
- Min segments: 8 (flights, lodging, activities)
- Run: `npm run test:persona:solo`

#### Romantic Couple
- Budget: moderate to luxury
- Pace: relaxed
- Interests: romance, dining, scenic views
- Accommodation: boutique hotels, resorts
- Min segments: 6 (flights, hotel, romantic activities)
- Run: `npm run test:persona:couple`

#### Family with Kids
- Budget: moderate
- Pace: relaxed
- Interests: family-friendly activities, safety
- Accommodation: family hotels, resorts
- Special: dietary restrictions, mobility needs
- Min segments: 10 (flights, lodging, kid activities, meals)
- Run: `npm run test:persona:family`

### Persona Test Workflow

1. **Create session** - Initialize Trip Designer session
2. **Send initial request** - Natural language trip request matching persona
3. **Multi-turn conversation** - Refine itinerary with follow-up questions
4. **Extract itinerary** - Parse final itinerary from conversation
5. **Validate structure** - Check segment types, counts, required fields
6. **Validate quality** - Verify persona preferences are met

### Validation Criteria

#### Structure Validation
- Itinerary has valid ID and metadata
- All segments have required fields (type, title, startDate, endDate)
- Segment types are valid: flight, lodging, activity, dining, transport
- Date ranges are consistent and non-overlapping
- Location data is present and valid

#### Quality Validation (Persona-Specific)
- Min segment count met
- Budget level matches persona
- Interests reflected in activities
- Accommodation type matches preferences
- Special requirements addressed (dietary, mobility)

### Common Persona Test Issues

#### Low Segment Count
- Issue: LLM returns too few segments
- Fix: Add explicit requirements to system prompt
- Example: "Include at least 3 activities per day"

#### Missing Required Segments
- Issue: No flights or lodging segments
- Fix: Use tool calling patterns for flights/hotels
- Verify: Check session messages for tool calls

#### Quality Mismatch
- Issue: Activities don't match persona interests
- Fix: Emphasize persona traits in request
- Example: "Family with young kids (ages 5, 8)"

#### Date/Time Consistency
- Issue: Overlapping segments or gaps
- Fix: Validate date ranges in quality check
- Verify: Sort segments by startDate and check gaps

## E2E Testing with Playwright

### Browser Automation Patterns

```typescript
import { test, expect } from '@playwright/test';

test('create itinerary flow', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:5176');

  // Click create button
  await page.click('[data-testid="create-itinerary"]');

  // Fill form
  await page.fill('[name="title"]', 'My Trip');
  await page.fill('[name="destination"]', 'Tokyo');

  // Submit and verify
  await page.click('[type="submit"]');
  await expect(page.locator('.itinerary-card')).toBeVisible();
});
```

### API Testing Patterns

```typescript
import { test, expect } from 'vitest';
import request from 'supertest';

test('GET /api/v1/itineraries returns list', async () => {
  const response = await request('http://localhost:5176')
    .get('/api/v1/itineraries')
    .set('x-user-id', 'test-user')
    .expect(200);

  expect(response.body).toHaveProperty('itineraries');
  expect(Array.isArray(response.body.itineraries)).toBe(true);
});
```

## Model Evaluation Testing

### Evaluation Metrics

#### Quality Score (0-100)
- Completeness: All required fields present
- Accuracy: Data matches request
- Structure: Proper segment types and ordering
- Relevance: Activities match interests

#### Performance Metrics
- Latency: Response time (p50, p95, p99)
- Cost: Tokens used × model pricing
- Success rate: % of successful responses
- Tool calling accuracy: % of correct tool usage

### Running Evaluations

```bash
# Compare all models
make test-eval

# Run specific evaluation
npm run eval:trip-designer

# View results with promptfoo
npm run eval:promptfoo:view

# Compare with promptfoo config
npm run eval:compare
```

### Promptfoo Integration

Located in `evals/promptfoo.yaml`:
- Test cases: Different trip scenarios
- Models: OpenAI, Anthropic, Google, Meta
- Assertions: Quality checks, performance thresholds
- Output: Comparison dashboard

### Model Comparison Results

Track in memory:
- **Best quality**: [Model name] - [Score]
- **Best latency**: [Model name] - [p95 ms]
- **Best cost**: [Model name] - [$/request]
- **Best tool calling**: [Model name] - [accuracy %]

## Test Data Management

### Fixtures
- Located in `tests/fixtures/`
- Sample itineraries for different scenarios
- Mock API responses
- Persona configurations

### Test Itineraries
- Create test data in `data/itineraries/test-*.json`
- Use test user IDs: `test-user-1`, `test-user-2`
- Clean up after tests: `rm data/itineraries/test-*.json`

### Environment Variables for Testing
```bash
# Set in tests/setup.ts or .env.test
OPENROUTER_API_KEY=test-key-or-real
VITE_API_URL=http://localhost:5176
```

## Quality Assurance Checklist

### Before Merging PR

- [ ] All unit tests pass: `make test-unit`
- [ ] Integration tests pass: `make test-integration`
- [ ] E2E tests pass: `make test-e2e`
- [ ] Persona tests pass: `make test-persona`
- [ ] Code coverage > 90%: `make test-coverage`
- [ ] No linting errors: `make lint`
- [ ] Type checking passes: `make typecheck`

### For AI Features

- [ ] Persona tests validate itinerary quality
- [ ] Model evaluation shows no regressions
- [ ] Tool calling patterns work correctly
- [ ] Session state persists across requests
- [ ] Error handling covers LLM failures

### For API Changes

- [ ] API routes tested with supertest
- [ ] Response schemas validated with Zod
- [ ] Error responses tested (404, 500, etc.)
- [ ] Authentication/authorization tested

## Common Testing Patterns

### Mock Storage for Unit Tests
```typescript
import { InMemoryItineraryStorage } from '../storage/in-memory';

const storage = new InMemoryItineraryStorage();
const service = new ItineraryService(storage);
```

### Mock API Responses
```typescript
vi.mock('$lib/api', () => ({
  getItineraries: vi.fn().mockResolvedValue(ok(mockItineraries))
}));
```

### Wait for Async Operations
```typescript
// Playwright
await page.waitForSelector('[data-testid="itinerary-loaded"]');

// Vitest
await vi.waitFor(() => {
  expect(result.isOk()).toBe(true);
});
```

### Test Streaming Responses
```typescript
const stream = await fetch('/api/v1/designer/sessions/123/messages/stream');
const reader = stream.body.getReader();
const chunks = [];

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(new TextDecoder().decode(value));
}
```

## Known Testing Issues

### Flaky Persona Tests
- **Issue**: LLM non-determinism causes occasional failures
- **Mitigation**: Use temperature=0 for consistent responses
- **Retry**: Run persona tests 2-3 times before reporting failure

### Slow E2E Tests
- **Issue**: Browser automation is slow
- **Optimization**: Run in headless mode
- **Parallel**: Use `--workers=4` for faster execution

### API Key Limits
- **Issue**: Rate limiting on OpenRouter during eval
- **Solution**: Space out requests with delays
- **Alternative**: Use cached responses for development

## Debugging Test Failures

### Unit Test Failures
1. Check test output for error message
2. Add `console.log` or `console.dir` for inspection
3. Use `.only` to focus on failing test
4. Verify mock data matches expected structure

### Persona Test Failures
1. Check session messages in test output
2. Verify LLM tool calls were made correctly
3. Validate itinerary structure manually
4. Adjust persona expectations if needed

### E2E Test Failures
1. Run with headed browser: `npx playwright test --headed`
2. Use `page.pause()` to debug interactively
3. Check screenshot on failure (saved automatically)
4. Verify API server is running on correct port

## Test Maintenance

### Update Fixtures
- When schema changes, update fixtures
- Run validation script: `npx tsx scripts/validate-itineraries.ts`
- Normalize if needed: `npx tsx scripts/normalize-existing.ts`

### Update Persona Expectations
- Review persona test results quarterly
- Adjust min segment counts based on LLM performance
- Update quality criteria as features evolve

### Update Evaluations
- Add new test cases for new features
- Update model list when new models available
- Adjust performance thresholds based on benchmarks
