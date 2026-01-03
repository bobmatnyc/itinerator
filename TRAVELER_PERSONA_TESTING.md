# Traveler Persona Agent - E2E Testing Framework

**Autonomous AI-powered testing for Trip Designer using realistic traveler personas**

## What Is This?

A sophisticated end-to-end testing framework that simulates real travelers interacting with your Trip Designer service. Instead of writing scripted tests, you define traveler personas, and an AI agent conducts natural conversations to plan trips—then validates the results.

### Why Use Persona Testing?

**Traditional E2E Testing:**
```typescript
// Scripted, rigid
await client.sendMessage("I want to go to Italy");
expect(response).toContain("When would you like to travel?");
await client.sendMessage("June 15-22");
// Breaks if response changes
```

**Persona-Based Testing:**
```typescript
// Natural, adaptive
const persona = {
  name: 'Sarah & Michael',
  type: 'couple',
  trip: 'LAX → Italy (anniversary)',
  style: 'romantic, luxury, detail-oriented'
};

const agent = new TravelerPersonaAgent(persona);
const result = await agent.runConversation();
// Validates outcomes, not conversation flow
```

**Benefits:**
- ✅ Tests real user journeys, not just API contracts
- ✅ Adapts to conversation changes automatically
- ✅ Validates business logic and user experience
- ✅ Discovers edge cases organically
- ✅ Self-documenting through persona definitions

## Quick Start

### 1. Prerequisites

```bash
# Install dependencies (if not done)
npm install

# Set OpenRouter API key
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"  # pragma: allowlist secret

# Start API server
cd viewer-svelte && npm run dev
```

### 2. Run Your First Test

```bash
# Test a single persona
npx tsx tests/e2e/traveler-persona-agent.ts --persona romantic-couple
```

**Expected Output:**
```
🧪 Starting Traveler Persona E2E Tests

================================================================================
🧑 Testing persona: Sarah & Michael (couple)
================================================================================

🎭 Sarah & Michael - Creating itinerary...
✅ Itinerary created: 08d10489-69bc-41e0-aeff-59abd3491e31

👤 Sarah & Michael: Hi! We're planning our anniversary trip to Italy...

🤖 Trip Designer: How wonderful! Congratulations on your anniversary...

✅ Conversation complete!

📊 Test Result: ✅ PASS
Score: 92/100
Turns: 8
Duration: 45.32s
```

### 3. Run Full Test Suite

```bash
# Test all 8 personas
npm run test:persona

# Test specific types
npm run test:persona:family   # Family travelers
npm run test:persona:couple   # Couples
npm run test:persona:solo     # Solo travelers
```

## What Gets Tested?

### 8 Comprehensive Personas

1. **Solo Backpacker** - Budget traveler, cultural immersion, 3 weeks in SE Asia
2. **Romantic Couple** - Luxury anniversary, boutique hotels, Italy
3. **Family Vacation** - 4 people (2 kids), theme parks, Orlando
4. **Business Traveler** - Efficiency-focused, business amenities, Tokyo
5. **Luxury Retirees** - Accessibility needs, guided tours, Mediterranean
6. **Adventure Group** - 4 friends, outdoor activities, Costa Rica
7. **Budget Student** - Strict budget ($50/day), multi-city Europe
8. **Open-Ended** - No destination, seeks recommendations

### Full User Journey

```
Create Itinerary → Start Session → Initial Request
    ↓
Trip Designer Asks Questions
    ↓
Persona Responds (via LLM)
    ↓
Trip Designer Makes Tool Calls (add_flight, add_hotel, etc.)
    ↓
Conversation Continues Until Complete
    ↓
Validate Final Itinerary Against Expectations
    ↓
Generate Report
```

### Validation Criteria

Each test validates:
- ✅ **Segment Count** - Minimum segments created
- ✅ **Segment Types** - Expected types present (flights, hotels, activities)
- ✅ **Keywords** - Persona-specific terms found
- ✅ **Forbidden Elements** - Inappropriate content absent
- ✅ **Budget Compliance** - Price within expected range
- ✅ **Error-Free Execution** - No API or runtime errors

## Architecture

### High-Level Overview

```
┌──────────────────┐
│  Persona Agent   │  Orchestrates test
└────────┬─────────┘
         │
         ├─▶ OpenRouter (Generate natural user messages)
         │
         ├─▶ API /itineraries (Create itinerary)
         │
         ├─▶ API /designer/sessions (Start conversation)
         │
         ├─▶ API /messages/stream (SSE conversation)
         │   │
         │   ├── Parse events
         │   ├── Extract responses
         │   └── Generate follow-ups
         │
         ├─▶ API /itineraries/{id} (Get final result)
         │
         └─▶ Validation Engine (Score 0-100)
             │
             └─▶ Report Generator (JSON + Markdown)
```

### Key Components

1. **TravelerPersonaAgent** - Main orchestrator class
2. **Message Generator** - Uses LLM to create natural user responses
3. **API Client** - Interacts with Trip Designer API
4. **SSE Parser** - Processes streaming responses
5. **Conversation Manager** - Tracks history and completion
6. **Validation Engine** - Scores results against expectations
7. **Report Generator** - Produces JSON and Markdown reports

## Files Delivered

### Core Implementation

| File | Purpose | Lines |
|------|---------|-------|
| `tests/e2e/traveler-persona-agent.ts` | Main agent implementation | 1,172 |
| `tests/e2e/example-persona-test.ts` | Usage examples | 356 |
| `tests/e2e/results/README.md` | Results directory | - |

### Documentation

| File | Purpose | Lines |
|------|---------|-------|
| `tests/e2e/TRAVELER_PERSONA_AGENT.md` | Complete usage guide | 682 |
| `tests/e2e/SUMMARY.md` | Implementation summary | 471 |
| `tests/e2e/QUICK_START_PERSONA_AGENT.md` | Quick reference | 160 |
| `TRAVELER_PERSONA_TESTING.md` | This file | - |

**Total: ~2,841 lines of code and documentation**

### Configuration

- `package.json` - Added npm scripts (`test:persona`, `test:persona:solo`, etc.)
- `.gitignore` - Excludes test results from version control

## Usage Examples

### Example 1: Test Single Persona

```bash
npx tsx tests/e2e/traveler-persona-agent.ts --persona family-vacation
```

### Example 2: Test All Couples

```bash
npm run test:persona:couple
```

### Example 3: Custom Persona

```typescript
import { TravelerPersonaAgent } from './tests/e2e/traveler-persona-agent.js';

const wellness = {
  id: 'wellness-retreat',
  name: 'Emma Wellness',
  type: 'solo',
  travelers: [{ name: 'Emma', type: 'adult', age: 38 }],
  preferences: {
    budget: 'luxury',
    pace: 'relaxed',
    accommodation: 'resort',
    interests: ['yoga', 'meditation', 'spa']
  },
  tripRequest: {
    origin: 'NYC',
    destination: 'Bali',
    duration: '2 weeks'
  },
  expectations: {
    minSegments: 6,
    expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
    shouldInclude: ['yoga', 'spa', 'wellness']
  }
};

const agent = new TravelerPersonaAgent(wellness, { verbose: true });
const result = await agent.runConversation();
console.log(`Valid: ${result.valid}, Score: ${result.validation.score}/100`);
```

### Example 4: Compare Multiple Personas

```bash
# Run examples
npx tsx tests/e2e/example-persona-test.ts 3
```

See `tests/e2e/example-persona-test.ts` for 5 complete examples.

## Understanding Results

### Scoring System (0-100 Points)

| Criteria | Points | Deduction Logic |
|----------|--------|-----------------|
| Segment Count | 30 | -30 if below minimum |
| Segment Types | 20 | -10 per missing type |
| Keywords | 20 | -5 per missing keyword |
| Forbidden Elements | 15 | -15 per forbidden term found |
| Budget Compliance | 15 | -20 if out of range |

**Pass Threshold**: 60+ points with no error-level issues

### Report Files

After running tests, check:

```bash
tests/e2e/results/
├── persona-test-2025-01-01T12-00-00.json  # Machine-readable
└── persona-test-2025-01-01T12-00-00.md    # Human-readable
```

**JSON Structure:**
```json
{
  "persona": "romantic-couple",
  "success": true,
  "conversationTurns": 8,
  "validation": {
    "valid": true,
    "score": 92,
    "issues": [...],
    "metrics": {
      "segmentCount": 12,
      "segmentTypesCovered": ["FLIGHT", "HOTEL", "ACTIVITY"],
      "keywordsFound": ["romantic", "wine"],
      "forbiddenFound": []
    }
  },
  "duration": 45320,
  "cost": 0.12
}
```

**Markdown Report:**
- Summary table (pass/fail by persona)
- Detailed results per persona
- Metrics and validation issues
- Recommendations

## CLI Options

```bash
npx tsx tests/e2e/traveler-persona-agent.ts [OPTIONS]

Options:
  --persona <id>       Test specific persona (e.g., romantic-couple)
  --type <type>        Test all personas of type (e.g., family)
  --model <model>      OpenRouter model for persona (default: claude-sonnet-4)
  --api <url>          API base URL (default: http://localhost:5176/api/v1)
  --max-turns <n>      Maximum conversation turns (default: 20)
  --help               Show help message

Examples:
  npm run test:persona
  npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker
  npx tsx tests/e2e/traveler-persona-agent.ts --type couple --max-turns 15
```

## Cost Management

### Estimated Costs (OpenRouter API)

- **Single Persona**: $0.04 - $0.18 per test
- **Full Suite (8)**: $0.60 - $1.00 per run
- **Daily Development**: ~$0.50/day (2-3 personas)
- **Monthly**: ~$20 for active development

### Cost Optimization

1. **Test selectively** - Run single personas during development
2. **Use max-turns** - Limit conversation length with `--max-turns 10`
3. **Sequential execution** - Tests already run one at a time
4. **Monitor usage** - Check OpenRouter dashboard regularly

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Persona Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Mondays

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm ci
      - run: cd viewer-svelte && npm run dev &
      - run: sleep 10  # Wait for server

      - name: Run persona tests
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npm run test:persona

      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: tests/e2e/results/
```

## Development Workflow

### Iterative Testing

```bash
# 1. Develop feature
# 2. Test with one persona
npx tsx tests/e2e/traveler-persona-agent.ts --persona business-traveler

# 3. Review transcript
cat tests/e2e/results/persona-test-*.json | \
  jq '.[] | select(.persona == "business-traveler") | .transcript'

# 4. Adjust code or persona expectations
# 5. Re-test
# 6. Once passing, run full suite
npm run test:persona
```

### Regression Testing

```bash
# Before deployment
npm run test:persona

# Check pass rate
grep "Pass Rate" tests/e2e/results/persona-test-*.md | tail -1
```

### Production Validation

```bash
# Test against production API
npx tsx tests/e2e/traveler-persona-agent.ts \
  --api https://itinerator.vercel.app/api/v1 \
  --persona romantic-couple
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "OPENROUTER_API_KEY is required" | `export OPENROUTER_API_KEY="..."` |
| "Failed to connect to API" | Start server: `cd viewer-svelte && npm run dev` |
| "Test timeout exceeded" | Increase: `--max-turns 25` |
| Conversation doesn't complete | Check `isConversationComplete()` logic |
| Low validation scores | Adjust persona expectations |
| Off-topic messages | Refine `communicationStyle` |
| SSE parsing errors | Verify API SSE format |

### Debug Mode

```bash
# Verbose output
npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker

# Check API logs
cd viewer-svelte && npm run dev  # Watch console

# Review conversation
cat tests/e2e/results/persona-test-*.json | jq '.[] | .transcript'
```

## Extending the Framework

### Add New Persona

Edit `tests/e2e/traveler-persona-agent.ts`:

```typescript
const PERSONAS: TravelerPersona[] = [
  // ... existing personas ...
  {
    id: 'digital-nomad',
    name: 'Remote Worker',
    type: 'business',
    travelers: [{ name: 'Alex', type: 'adult', age: 32 }],
    preferences: {
      budget: 'moderate',
      pace: 'relaxed',
      accommodation: 'airbnb',
      interests: ['coworking', 'wifi', 'cafes', 'expat community']
    },
    tripRequest: {
      origin: 'San Francisco',
      destination: 'Lisbon',
      duration: '3 months'
    },
    expectations: {
      minSegments: 6,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
      shouldInclude: ['wifi', 'coworking', 'long-term'],
      budgetRange: { min: 3000, max: 5000 }
    },
    communicationStyle: 'tech-savvy, location-independent, values infrastructure'
  }
];
```

### Custom Validation

Add logic in `TravelerPersonaAgent.validateItinerary()`:

```typescript
// Example: Validate accessibility for seniors
if (this.persona.preferences.mobilityNeeds) {
  const accessible = itinerary.segments
    .filter(s => s.type === 'HOTEL')
    .some(s => s.notes?.includes('accessible'));

  if (!accessible) {
    issues.push({
      severity: 'error',
      category: 'accessibility',
      message: 'No accessible hotels for traveler with mobility needs'
    });
    score -= 25;
  }
}
```

## Comparison with Other Testing

| Aspect | Unit Tests | E2E Tests | Persona Agent |
|--------|------------|-----------|---------------|
| **Scope** | Functions | Specific flows | Complete journeys |
| **Speed** | Fast (<1s) | Medium (5-10s) | Slow (30-60s) |
| **Cost** | Free | Free | $0.04-$0.18 |
| **Realism** | Mocked | Scripted | Natural |
| **Coverage** | Code paths | Features | User scenarios |
| **Maintenance** | Low | Medium | Low |
| **Flexibility** | Low | Low | High |

## Best Practices

1. ✅ **Start with one persona** during feature development
2. ✅ **Review transcripts** to understand conversation quality
3. ✅ **Adjust expectations** based on real Trip Designer capabilities
4. ✅ **Monitor costs** using OpenRouter dashboard
5. ✅ **Version control summaries** to track regressions
6. ✅ **Run full suite** before major releases
7. ✅ **Document persona changes** when updating requirements

## Performance

- **Time**: 30-60s per persona, 4-8 minutes for full suite
- **Memory**: ~100MB per agent instance
- **Network**: ~500KB per conversation (SSE streams)
- **Storage**: ~50KB per test result (JSON + Markdown)

## Documentation Index

1. **[Quick Start](./tests/e2e/QUICK_START_PERSONA_AGENT.md)** - Get running in 5 minutes
2. **[Full Guide](./tests/e2e/TRAVELER_PERSONA_AGENT.md)** - Complete usage documentation
3. **[Summary](./tests/e2e/SUMMARY.md)** - Implementation details and architecture
4. **[Examples](./tests/e2e/example-persona-test.ts)** - Programmatic usage patterns
5. **[E2E Tests](./tests/e2e/README.md)** - General E2E testing guide

## Support

- 📧 Issues: Open GitHub issue
- 📚 Docs: See documentation index above
- 💬 Examples: Run `npx tsx tests/e2e/example-persona-test.ts`

## License

MIT - Same as parent project

---

**Built with:**
- TypeScript 5.7
- OpenAI SDK (OpenRouter)
- SvelteKit API
- Node.js 20+

**Last Updated:** 2026-01-01
