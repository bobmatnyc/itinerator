# Itinerizer Test Suite

Comprehensive testing framework for the Itinerizer project, including unit, integration, E2E, and LLM evaluation tests.

## Directory Structure

```
tests/
├── fixtures/           # Test data (itineraries, personas)
│   ├── itineraries/    # Sample itinerary data at various stages
│   └── personas/       # User personas for different traveler types
├── unit/               # Unit tests for individual functions/classes
├── integration/        # Integration tests for API endpoints and services
│   └── api/            # API integration tests
├── e2e/                # End-to-end tests for user workflows
├── eval/               # LLM evaluation tests and metrics
│   └── metrics/        # Evaluation frameworks and scoring
├── helpers/            # Test utilities and helpers
│   ├── fixture-loader.ts
│   └── api-client.ts
└── config/             # Test configuration
    └── test-config.ts
```

## Test Types

### Unit Tests (`unit/`)
Test individual functions, classes, and utilities in isolation.

```bash
npm run test:unit
```

**Coverage areas:**
- Domain type validation
- Business logic functions
- Utility functions
- Data transformation

### Integration Tests (`integration/`)
Test API endpoints and service interactions.

```bash
npm run test:integration
```

**Coverage areas:**
- REST API endpoints
- Service layer integration
- Storage layer integration
- External API mocking

### E2E Tests (`e2e/`)
Test complete user workflows through the UI.

```bash
npm run test:e2e
```

**Coverage areas:**
- User authentication flow
- Itinerary creation and editing
- Trip Designer conversations
- Import/export workflows

### LLM Evaluation (`eval/`)
Evaluate Trip Designer LLM responses for quality and accuracy.

```bash
npm run test:eval
```

**Coverage areas:**
- Persona-based response quality
- Accuracy metrics (destinations, dates, budgets)
- Logical flow and completeness
- Safety checks (no conflicts, valid data)

## Fixtures

### Itineraries
- `empty-new.json` - Brand new empty itinerary
- `planning-phase.json` - Itinerary with dates/destinations but no segments
- `partial-segments.json` - Partially-complete itinerary
- `complete-trip.json` - Fully-planned itinerary
- `past-trip.json` - Completed historical itinerary

### Personas
- `solo-traveler.json` - Solo traveler, flexible budget
- `family-vacation.json` - Family of 4 with children
- `business-trip.json` - Business executive, premium preferences
- `group-adventure.json` - Group of 6 friends, adventure focus

See [fixtures/README.md](./fixtures/README.md) for detailed fixture documentation.

## Test Helpers

### Fixture Loader (`helpers/fixture-loader.ts`)
```typescript
import { loadItineraryFixture, loadPersonaFixture } from './helpers/fixture-loader';

const completeTrip = loadItineraryFixture('complete-trip');
const soloTraveler = loadPersonaFixture('solo-traveler');
```

### API Client (`helpers/api-client.ts`)
```typescript
import { createTestApiClient } from './helpers/api-client';

const api = createTestApiClient();
const itinerary = await api.createItinerary(data, userId);
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Types
```bash
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests only
npm run test:eval           # LLM evaluation tests only
```

### Watch Mode
```bash
npm run test:watch          # Run tests in watch mode
```

### Coverage
```bash
npm run test:coverage       # Generate coverage report
```

### CI Mode
```bash
CI=true npm test            # CI-safe mode (no watch, no interactive)
```

## Writing Tests

### Unit Test Example
```typescript
import { describe, test, expect } from 'vitest';
import { calculateTripDuration } from '../src/utils/trip-utils';

describe('calculateTripDuration', () => {
  test('calculates duration correctly', () => {
    const start = new Date('2025-01-01');
    const end = new Date('2025-01-08');
    expect(calculateTripDuration(start, end)).toBe(7);
  });
});
```

### Integration Test Example
```typescript
import { describe, test, expect } from 'vitest';
import { createTestApiClient } from './helpers/api-client';
import { loadItineraryFixture } from './helpers/fixture-loader';

describe('Itinerary API', () => {
  const api = createTestApiClient();
  const userId = 'test-user-001';

  test('creates itinerary successfully', async () => {
    const fixture = loadItineraryFixture('empty-new');
    const result = await api.createItinerary(fixture, userId);
    expect(result.id).toBeDefined();
  });
});
```

### E2E Test Example
```typescript
import { test, expect } from '@playwright/test';

test('user can create new itinerary', async ({ page }) => {
  await page.goto('/itineraries');
  await page.click('button:has-text("New Trip")');
  await page.fill('input[name="title"]', 'My Test Trip');
  await page.click('button:has-text("Create")');
  await expect(page.locator('h1')).toContainText('My Test Trip');
});
```

### Evaluation Test Example
```typescript
import { test, expect } from 'vitest';
import { loadPersonaFixture } from './helpers/fixture-loader';
import { evaluateResponse } from './eval/metrics/evaluator';

test('generates appropriate itinerary for solo traveler', async () => {
  const persona = loadPersonaFixture('solo-traveler');
  const response = await tripDesigner.generate(persona, 'Plan a week in Thailand');
  
  const evaluation = evaluateResponse(response, {
    expectedDestination: 'Thailand',
    expectedDuration: 7,
    personaAlignment: persona,
  });
  
  expect(evaluation.passed).toBe(true);
  expect(evaluation.score).toBeGreaterThan(0.8);
});
```

## Best Practices

### Test Organization
- Group related tests in `describe` blocks
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Keep tests focused and isolated

### Fixture Usage
- Use fixtures for consistent test data
- Clone fixtures if mutation is needed
- Document fixture purpose and use cases
- Keep fixtures realistic and up-to-date

### Mocking
- Mock external APIs (OpenRouter, SerpAPI)
- Mock storage in unit tests
- Use real services in integration tests
- Document mock behavior and assumptions

### CI/CD Integration
- All tests must pass before merge
- Use `CI=true` environment variable
- Generate coverage reports
- Run E2E tests on preview deployments

## Debugging Tests

### View Test Output
```bash
npm run test -- --reporter=verbose
```

### Debug Specific Test
```bash
npm run test -- --grep="test name pattern"
```

### E2E Debug Mode
```bash
npm run test:e2e -- --headed --debug
```

### Coverage Analysis
```bash
npm run test:coverage -- --reporter=html
open coverage/index.html
```

## Contributing

When adding new features:
1. Write unit tests for business logic
2. Add integration tests for API endpoints
3. Create E2E tests for user workflows
4. Add evaluation tests for LLM features
5. Update fixtures as needed
6. Maintain 90%+ code coverage

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Fixture Documentation](./fixtures/README.md)
- [Evaluation Metrics](./eval/metrics/README.md)
