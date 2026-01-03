# Quick Start - Traveler Persona Agent

One-page guide to get started with persona-based E2E testing.

## Prerequisites

```bash
# Required environment variable
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"  # pragma: allowlist secret

# Start local API server
cd viewer-svelte && npm run dev
```

## Run Tests (3 Commands)

```bash
# 1. Test all personas (full suite)
npm run test:persona

# 2. Test specific persona
npx tsx tests/e2e/traveler-persona-agent.ts --persona romantic-couple

# 3. Test by type
npm run test:persona:family
```

## Available Personas

| ID | Name | Type | Trip |
|----|------|------|------|
| `solo-backpacker` | Alex | Solo, Budget | NYC → SE Asia (3 weeks) |
| `romantic-couple` | Sarah & Michael | Couple, Luxury | LAX → Italy (10 days) |
| `family-vacation` | Johnson Family | Family, Moderate | Chicago → Orlando (1 week) |
| `business-traveler` | Jennifer | Business | SFO → Tokyo (5 days) |
| `luxury-retirees` | Hendersons | Senior, Luxury | Miami → Med Cruise (2 weeks) |
| `adventure-group` | Adventure Squad | Group, Moderate | Denver → Costa Rica (10 days) |
| `budget-student` | Jordan | Solo, Budget | Boston → Europe (2 weeks) |
| `open-ended` | Pat | Solo, Moderate | Seattle → ? (1 week) |

## CLI Options

```bash
# All options
npx tsx tests/e2e/traveler-persona-agent.ts \
  --persona solo-backpacker \    # Test specific persona
  --type family \                # Or test all of type
  --model gpt-4o \               # Use different model
  --api http://localhost:5176 \  # API base URL
  --max-turns 15                 # Max conversation turns
```

## Understanding Results

### Console Output

```
✅ PASS - Test succeeded (score ≥60, no errors)
❌ FAIL - Test failed (score <60 or errors)
Score: 92/100 - Validation score
Turns: 8 - Conversation rounds
Duration: 45.3s - Total time
```

### Report Files

```
tests/e2e/results/
├── persona-test-2025-01-01.json  # Machine-readable
└── persona-test-2025-01-01.md    # Human-readable
```

## Scoring Guide

| Score | Status | Meaning |
|-------|--------|---------|
| 90-100 | Excellent | Meets all expectations |
| 70-89 | Good | Minor issues, mostly correct |
| 60-69 | Pass | Acceptable, some gaps |
| <60 | Fail | Significant issues |

## Common Issues

### "OPENROUTER_API_KEY is required"
```bash
export OPENROUTER_API_KEY="sk-or-v1-..."  # pragma: allowlist secret
```

### "Failed to connect to API"
```bash
# Start the server first
cd viewer-svelte && npm run dev
```

### "Test timeout"
```bash
# Increase max turns
npx tsx tests/e2e/traveler-persona-agent.ts --max-turns 25
```

## Cost Estimates

- **Single persona**: $0.04 - $0.18
- **Full suite (8)**: $0.60 - $1.00
- **Daily testing**: ~$0.50/day

## Custom Persona (Quick Example)

```typescript
import { TravelerPersonaAgent } from './traveler-persona-agent.js';

const myPersona = {
  id: 'custom-id',
  name: 'My Traveler',
  type: 'solo',
  travelers: [{ name: 'Alice', type: 'adult', age: 30 }],
  preferences: {
    budget: 'moderate',
    pace: 'relaxed',
    accommodation: 'hotel',
    interests: ['food', 'culture']
  },
  tripRequest: {
    origin: 'NYC',
    destination: 'Paris',
    duration: '1 week'
  },
  expectations: {
    minSegments: 5,
    expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
    shouldInclude: ['eiffel', 'louvre'],
    shouldNotInclude: ['disney']
  }
};

const agent = new TravelerPersonaAgent(myPersona, { verbose: true });
const result = await agent.runConversation();
console.log(`Score: ${result.validation.score}/100`);
```

## Next Steps

1. **Run your first test**: `npm run test:persona:solo`
2. **Review the report**: Check `tests/e2e/results/`
3. **Try custom persona**: See `example-persona-test.ts`
4. **Read full docs**: See `TRAVELER_PERSONA_AGENT.md`

## Help

```bash
# Show all available options
npx tsx tests/e2e/traveler-persona-agent.ts --help
```

## Documentation

- 📘 [Full Documentation](./TRAVELER_PERSONA_AGENT.md)
- 📊 [Implementation Summary](./SUMMARY.md)
- 💻 [Code Examples](./example-persona-test.ts)
- 🧪 [E2E Tests Guide](./README.md)
