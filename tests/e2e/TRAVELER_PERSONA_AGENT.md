# Traveler Persona Agent - E2E Testing Guide

Autonomous agent-based testing that simulates realistic travelers interacting with Trip Designer.

## Overview

The Traveler Persona Agent is a sophisticated E2E testing framework that:

1. **Generates realistic conversations** - Uses LLM to create natural user messages matching specific traveler profiles
2. **Tests complete workflows** - Exercises full API → Service → Data pipeline end-to-end
3. **Validates outcomes** - Ensures itineraries match persona expectations and requirements
4. **Produces detailed reports** - Generates JSON and Markdown reports with metrics and analysis

## Quick Start

```bash
# Set API key
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"  # pragma: allowlist secret

# Start local API server
cd viewer-svelte && npm run dev

# In another terminal, run tests
npx tsx tests/e2e/traveler-persona-agent.ts

# Test a specific persona
npx tsx tests/e2e/traveler-persona-agent.ts --persona romantic-couple

# Test all family travelers
npx tsx tests/e2e/traveler-persona-agent.ts --type family
```

## How It Works

### 1. Persona Definition
Each persona represents a realistic traveler type with:
- Demographics (age, group composition)
- Preferences (budget, pace, accommodation style)
- Trip requirements (origin, destination, duration)
- Communication style (how they naturally speak)
- Validation expectations (what to check in results)

### 2. Conversation Generation
The agent uses an LLM to:
- Generate initial trip request in persona's voice
- Respond to Trip Designer questions naturally
- Stay in character throughout conversation
- Provide relevant details when asked

### 3. API Interaction
Tests the full stack:
```
Persona Agent → API /itineraries → Create Itinerary
            → API /designer/sessions → Create Session
            → API /designer/sessions/{id}/messages/stream → SSE Stream
            → Parse Events → Extract Responses
            → Generate Follow-up → Repeat
            → GET /itineraries/{id} → Validate Result
```

### 4. Validation
Checks resulting itinerary for:
- Minimum segment count
- Expected segment types (flights, hotels, activities)
- Required keywords (persona-specific)
- Forbidden elements (inappropriate for persona)
- Budget compliance (if specified)

## Available Personas

### Solo Travelers

#### Alex the Backpacker (`solo-backpacker`)
```typescript
{
  type: 'solo',
  budget: 'budget',
  trip: 'NYC → Southeast Asia (3 weeks)',
  style: 'casual, enthusiastic, values authenticity',
  expectations: {
    accommodation: 'hostel',
    activities: ['street food', 'temple', 'hiking'],
    avoid: ['luxury', 'resort', 'fine dining']
  }
}
```

**Tests**: Budget-conscious routing, cultural immersion, solo traveler safety

#### Curious Traveler (`open-ended`)
```typescript
{
  type: 'solo',
  budget: 'moderate',
  trip: 'Seattle → Surprise me (1 week)',
  style: 'open-minded, exploratory, trusts recommendations',
  expectations: {
    destination: undefined, // Should prompt for preferences
    activities: ['unique', 'local', 'off the beaten path']
  }
}
```

**Tests**: Open-ended planning, recommendation quality, destination suggestion

### Couples

#### Sarah & Michael (`romantic-couple`)
```typescript
{
  type: 'couple',
  budget: 'luxury',
  trip: 'LAX → Italy, Amalfi Coast (10 days)',
  style: 'polite, detail-oriented, romantic',
  occasion: 'anniversary trip',
  expectations: {
    accommodation: 'boutique',
    activities: ['wine tasting', 'romantic views', 'sunset'],
    avoid: ['budget', 'family-friendly', 'group tours']
  }
}
```

**Tests**: Luxury filtering, romantic activities, couple-oriented experiences, special occasions

#### The Hendersons (`luxury-retirees`)
```typescript
{
  type: 'senior',
  budget: 'luxury',
  trip: 'Miami → Mediterranean cruise (2 weeks)',
  style: 'thoughtful, experienced, values comfort',
  needs: ['limited walking', 'prefer elevators'],
  expectations: {
    activities: ['guided tour', 'history', 'art'],
    accessibility: true,
    avoid: ['hiking', 'adventure', 'budget']
  }
}
```

**Tests**: Accessibility requirements, senior-friendly activities, luxury accommodations, mobility considerations

### Families

#### The Johnson Family (`family-vacation`)
```typescript
{
  type: 'family',
  travelers: [
    { name: 'David', age: 42 },
    { name: 'Lisa', age: 40 },
    { name: 'Emma', age: 12 },
    { name: 'Jake', age: 8 }
  ],
  budget: 'moderate',
  trip: 'Chicago → Orlando (June 15-22)',
  style: 'practical, safety-conscious, kid-focused',
  restrictions: ['nut allergy'],
  expectations: {
    accommodation: 'resort',
    activities: ['Disney', 'Universal', 'pool'],
    avoid: ['nightclub', 'bar crawl', 'adults-only']
  }
}
```

**Tests**: Multi-traveler booking, age-appropriate activities, dietary restrictions, family safety

### Groups

#### Adventure Squad (`adventure-group`)
```typescript
{
  type: 'adventure',
  travelers: 4 adults,
  budget: 'moderate',
  trip: 'Denver → Costa Rica (10 days)',
  style: 'energetic, adventurous, seeks thrills',
  interests: ['zip-lining', 'rainforest hike', 'wildlife'],
  expectations: {
    accommodation: 'airbnb',
    activities: ['adventure', 'hiking', 'rafting'],
    avoid: ['spa', 'relaxation', 'shopping']
  }
}
```

**Tests**: Group booking, adventure activities, shared accommodations, group dynamics

### Business Travelers

#### Jennifer Chen (`business-traveler`)
```typescript
{
  type: 'business',
  budget: 'moderate',
  trip: 'SFO → Tokyo (5 days)',
  style: 'direct, time-conscious, efficiency-focused',
  needs: ['meetings in Shibuya', 'reliable wifi', 'business hotels'],
  expectations: {
    accommodation: 'business hotel',
    amenities: ['wifi', 'central location'],
    avoid: ['beach', 'resort', 'leisure activities']
  }
}
```

**Tests**: Business amenities, efficient routing, meeting locations, time optimization

### Budget Travelers

#### Jordan (`budget-student`)
```typescript
{
  type: 'budget',
  budget: 'budget',
  trip: 'Boston → Europe (2 weeks, under $50/day)',
  style: 'budget-conscious, flexible, student mindset',
  interests: ['free museums', 'walking tours', 'street food'],
  expectations: {
    accommodation: 'hostel',
    activities: ['free', 'walking', 'budget'],
    budget: { max: 700 }, // $50/day × 14 days
    avoid: ['luxury', 'michelin', 'five-star']
  }
}
```

**Tests**: Strict budget adherence, free/cheap options, multi-city routing, student travel patterns

## CLI Usage

### Basic Commands

```bash
# Run all personas
npx tsx tests/e2e/traveler-persona-agent.ts

# Test specific persona by ID
npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker

# Test all personas of a type
npx tsx tests/e2e/traveler-persona-agent.ts --type couple

# Use different model
npx tsx tests/e2e/traveler-persona-agent.ts --model gpt-4o

# Test against production
npx tsx tests/e2e/traveler-persona-agent.ts --api https://itinerator.vercel.app/api/v1

# Set max conversation turns
npx tsx tests/e2e/traveler-persona-agent.ts --max-turns 15
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--persona <id>` | Test a specific persona by ID | All personas |
| `--type <type>` | Test all personas of a type | All personas |
| `--model <model>` | OpenRouter model for persona responses | `anthropic/claude-sonnet-4` |
| `--api <url>` | API base URL | `http://localhost:5176/api/v1` |
| `--max-turns <n>` | Maximum conversation turns | `20` |
| `--help` | Show help message | - |

### Available Persona IDs

- `solo-backpacker`
- `romantic-couple`
- `family-vacation`
- `business-traveler`
- `luxury-retirees`
- `adventure-group`
- `budget-student`
- `open-ended`

### Available Types

- `solo`
- `couple`
- `family`
- `business`
- `luxury`
- `budget`
- `adventure`
- `senior`

## Test Output

### Console Output

```
🧪 Starting Traveler Persona E2E Tests

Model: anthropic/claude-sonnet-4
API: http://localhost:5176/api/v1
Max turns: 20

================================================================================
🧑 Testing persona: Sarah & Michael (couple)
================================================================================

🎭 Sarah & Michael - Creating itinerary...
✅ Itinerary created: 08d10489-69bc-41e0-aeff-59abd3491e31
🎭 Creating Trip Designer session...
✅ Session created: session_1704153600000_abc123

👤 Sarah & Michael: Hi! We're planning our anniversary trip to Italy...

🤖 Trip Designer: How wonderful! Congratulations on your anniversary...
🔧 Tool calls: get_itinerary

👤 Sarah & Michael: We'd love to stay on the Amalfi Coast...

🤖 Trip Designer: Perfect! Let me add a beautiful boutique hotel...
🔧 Tool calls: add_hotel

✅ Conversation complete!

📊 Test Result: ✅ PASS
Score: 92/100
Turns: 8
Duration: 45.32s
```

### JSON Report

Saved to `tests/e2e/results/persona-test-{timestamp}.json`:

```json
[
  {
    "persona": "romantic-couple",
    "success": true,
    "conversationTurns": 8,
    "itinerary": {
      "id": "08d10489-69bc-41e0-aeff-59abd3491e31",
      "title": "Sarah & Michael's Trip",
      "segments": [
        {
          "type": "FLIGHT",
          "airline": { "name": "United Airlines", "code": "UA" },
          "origin": { "code": "LAX", "city": "Los Angeles" },
          "destination": { "code": "NAP", "city": "Naples" }
        },
        {
          "type": "HOTEL",
          "property": { "name": "Hotel Caruso" },
          "location": { "city": "Ravello", "country": "Italy" }
        }
      ]
    },
    "validation": {
      "valid": true,
      "score": 92,
      "issues": [
        {
          "severity": "warning",
          "category": "keywords",
          "message": "Missing expected keyword: sunset",
          "expected": ["romantic", "wine", "sunset"],
          "actual": ["romantic", "wine"]
        }
      ],
      "metrics": {
        "segmentCount": 12,
        "segmentTypesCovered": ["FLIGHT", "HOTEL", "ACTIVITY", "TRANSFER"],
        "keywordsFound": ["romantic", "wine"],
        "forbiddenFound": [],
        "budgetCompliance": true
      }
    },
    "errors": [],
    "duration": 45320,
    "cost": 0.12
  }
]
```

### Markdown Report

Saved to `tests/e2e/results/persona-test-{timestamp}.md`:

````markdown
# Traveler Persona E2E Test Results

**Date**: 2025-01-01T12:00:00.000Z
**Model**: anthropic/claude-sonnet-4
**API**: http://localhost:5176/api/v1

## Summary

- **Total Tests**: 8
- **Passed**: 7
- **Failed**: 1
- **Pass Rate**: 87.5%

## Results by Persona

| Persona | Type | Result | Score | Turns | Duration | Issues |
|---------|------|--------|-------|-------|----------|--------|
| Sarah & Michael | couple | ✅ PASS | 92/100 | 8 | 45.3s | 1 |
| Alex the Backpacker | solo | ✅ PASS | 88/100 | 12 | 62.1s | 2 |
| ...

## Detailed Results

### Sarah & Michael

**Status**: ✅ PASS
**Score**: 92/100
**Conversation Turns**: 8
**Duration**: 45.32s

**Metrics**:
- Segments: 12
- Segment Types: FLIGHT, HOTEL, ACTIVITY, TRANSFER
- Keywords Found: romantic, wine
- Forbidden Found: none

**Issues**:

- **[warning]** keywords: Missing expected keyword: sunset

---
````

## Scoring System

Tests are scored 0-100 based on:

| Criteria | Points | Description |
|----------|--------|-------------|
| **Segment Count** | 30 | Meeting minimum segment requirements |
| **Segment Types** | 20 | Having all expected segment types |
| **Keywords** | 20 | Presence of expected keywords |
| **Forbidden Elements** | 15 | Absence of inappropriate content |
| **Budget Compliance** | 15 | Staying within budget range |

**Pass Threshold**: 60+ points with no error-level issues

## Validation Details

### Segment Count Validation
```typescript
if (segmentCount < minSegments) {
  score -= 30; // Major issue - incomplete itinerary
}
```

### Segment Types Validation
```typescript
const missingTypes = expected.filter(t => !actual.has(t));
score -= 10 * missingTypes.length; // -10 per missing type
```

### Keywords Validation
```typescript
const missing = shouldInclude.filter(k => !found.has(k));
score -= 5 * missing.length; // -5 per missing keyword
```

### Forbidden Elements Validation
```typescript
const forbidden = shouldNotInclude.filter(k => found.has(k));
score -= 15 * forbidden.length; // -15 per forbidden element (major issue)
```

## Extending the Framework

### Adding New Personas

Edit `tests/e2e/traveler-persona-agent.ts`:

```typescript
const PERSONAS: TravelerPersona[] = [
  // ... existing personas ...

  {
    id: 'digital-nomad',
    name: 'Alex Remote',
    type: 'business', // Or create new type
    travelers: [{ name: 'Alex', type: 'adult', age: 32 }],
    preferences: {
      budget: 'moderate',
      pace: 'relaxed',
      accommodation: 'airbnb',
      interests: ['coworking spaces', 'reliable wifi', 'local cafes', 'expat community'],
    },
    tripRequest: {
      origin: 'San Francisco',
      destination: 'Lisbon',
      duration: '3 months',
      specialRequests: ['need monthly accommodation', 'strong internet essential']
    },
    expectations: {
      minSegments: 6,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
      shouldInclude: ['wifi', 'coworking', 'long-term'],
      shouldNotInclude: ['hotel per night', 'tourist', 'short-term'],
      budgetRange: { min: 3000, max: 5000 }
    },
    communicationStyle: 'tech-savvy, location-independent, values community and infrastructure'
  }
];
```

### Customizing Validation

Add custom validation logic in `TravelerPersonaAgent.validateItinerary()`:

```typescript
// Example: Validate accessibility for senior personas
if (this.persona.preferences.mobilityNeeds) {
  const hasAccessibleHotels = itinerary.segments
    .filter(s => s.type === 'HOTEL')
    .some(s => s.notes?.toLowerCase().includes('accessible'));

  if (!hasAccessibleHotels) {
    issues.push({
      severity: 'error',
      category: 'accessibility',
      message: 'No accessible hotels found for traveler with mobility needs'
    });
    score -= 25;
  }
}
```

## Best Practices

### 1. Development Workflow

```bash
# During development: Test one persona at a time
npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker

# Review transcript to understand conversation flow
cat tests/e2e/results/persona-test-*.json | \
  jq '.[] | select(.persona == "solo-backpacker") | .transcript'

# Iterate on persona definition or validation logic
```

### 2. Cost Management

```bash
# Test cheap personas first (fewer turns expected)
npx tsx tests/e2e/traveler-persona-agent.ts --persona business-traveler

# Use lower max-turns during development
npx tsx tests/e2e/traveler-persona-agent.ts --max-turns 10
```

### 3. Debugging Failed Tests

```bash
# Run single persona with verbose output
npx tsx tests/e2e/traveler-persona-agent.ts --persona family-vacation

# Check the conversation transcript in results JSON
# Look for:
# - Where conversation went off-track
# - Missing tool calls
# - Unexpected responses
```

### 4. CI/CD Integration

```yaml
# .github/workflows/e2e-personas.yml
name: E2E Persona Tests

on:
  schedule:
    - cron: '0 2 * * 1' # Weekly on Mondays at 2 AM
  workflow_dispatch: # Manual trigger

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Start API server
        run: |
          cd viewer-svelte
          npm run dev &
          sleep 10

      - name: Run persona tests
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx tsx tests/e2e/traveler-persona-agent.ts

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: tests/e2e/results/
```

## Troubleshooting

### Issue: Conversations Don't Complete

**Symptoms**: Tests timeout, score is 0, few segments created

**Solutions**:
1. Increase max turns: `--max-turns 30`
2. Check completion detection logic in `isConversationComplete()`
3. Review transcript to see where conversation stalled
4. Adjust persona communication style to be more direct

### Issue: Persona Generates Off-Topic Messages

**Symptoms**: Conversation wanders, unexpected topics discussed

**Solutions**:
1. Refine `communicationStyle` to be more specific
2. Add more details to persona preferences
3. Review LLM prompt in `generateUserMessage()`
4. Consider using more constrained model

### Issue: Validation Failures

**Symptoms**: Test passes but validation score is low

**Solutions**:
1. Review validation expectations - may be too strict
2. Check if Trip Designer is creating appropriate segments
3. Verify keywords are realistic for persona
4. Adjust budget ranges if needed

### Issue: SSE Parsing Errors

**Symptoms**: `Failed to parse SSE event`, empty responses

**Solutions**:
1. Check API server is running and accessible
2. Verify SSE format in API response
3. Add debug logging in `sendMessage()` method
4. Test API endpoint directly with `curl`

## Cost Estimation

### Per-Test Costs

| Persona | Avg Turns | Cost Estimate |
|---------|-----------|---------------|
| Solo Backpacker | 10-15 | $0.08 - $0.12 |
| Romantic Couple | 8-12 | $0.06 - $0.10 |
| Family Vacation | 6-10 | $0.05 - $0.08 |
| Business Traveler | 5-8 | $0.04 - $0.07 |
| Luxury Retirees | 6-10 | $0.05 - $0.08 |
| Adventure Group | 12-18 | $0.10 - $0.15 |
| Budget Student | 10-15 | $0.08 - $0.12 |
| Open-Ended | 15-20 | $0.12 - $0.18 |

**Full Suite**: ~$0.60 - $1.00

### Monthly Development

- Daily testing (2-3 personas): ~$0.50/day = $15/month
- Weekly full suite: ~$4/month
- **Total**: ~$20/month for active development

## Related Documentation

- [E2E Tests README](./README.md) - General E2E testing guide
- [Test Helpers](../helpers/README.md) - Utility functions and assertions
- [Trip Designer Service](../../src/services/trip-designer/) - Service implementation
- [API Documentation](../../viewer-svelte/src/routes/api/) - API endpoints
