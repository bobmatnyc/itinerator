# Itinerary Rules - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     SegmentService                          │
│  (Orchestrates CRUD operations with validation)            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ uses
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  ItineraryRuleEngine                        │
│  (Orchestrates rule evaluation)                             │
│                                                              │
│  - validateAdd()                                            │
│  - validateUpdate()                                         │
│  - validateDelete()                                         │
│  - validateAll()                                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ evaluates
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Core Rules                              │
│  (Individual validation rules)                              │
│                                                              │
│  [ERROR]                                                    │
│  ├─ NO_FLIGHT_OVERLAP                                       │
│  ├─ NO_HOTEL_OVERLAP                                        │
│  ├─ SEGMENT_WITHIN_TRIP_DATES                               │
│  └─ CHRONOLOGICAL_ORDER                                     │
│                                                              │
│  [WARNING]                                                  │
│  ├─ ACTIVITY_REQUIRES_TRANSFER                              │
│  └─ REASONABLE_DURATION                                     │
│                                                              │
│  [INFO]                                                     │
│  ├─ GEOGRAPHIC_CONTINUITY                                   │
│  └─ HOTEL_ACTIVITY_OVERLAP_ALLOWED                          │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Adding a Segment

```
User Request
    │
    ├─> SegmentService.add(itineraryId, segment)
    │       │
    │       ├─> Load itinerary from storage
    │       │
    │       ├─> Generate segment ID if needed
    │       │
    │       ├─> RuleEngine.validateAdd(itinerary, segment)
    │       │       │
    │       │       ├─> For each enabled rule:
    │       │       │   ├─> Check if rule applies
    │       │       │   ├─> Execute rule.validate(context)
    │       │       │   └─> Collect errors/warnings/info
    │       │       │
    │       │       └─> Return ValidationResult
    │       │               { valid, errors, warnings, info }
    │       │
    │       ├─> If !valid: Return error
    │       │
    │       ├─> Legacy duplicate check (for now)
    │       │
    │       ├─> Add segment to itinerary
    │       │
    │       ├─> Save to storage
    │       │
    │       └─> Attach warnings to metadata if any
    │
    └─> Return Result<Itinerary>
```

## Rule Evaluation Flow

```
RuleEngine.validate(context)
    │
    ├─> For each registered rule:
    │   │
    │   ├─> Is rule enabled? ─── No ──> Skip
    │   │       │
    │   │      Yes
    │   │       ▼
    │   ├─> Is rule in disabledRules config? ─── Yes ──> Skip
    │   │       │
    │   │      No
    │   │       ▼
    │   ├─> Check severity filters:
    │   │   ├─> warning && !enableWarnings? ─── Yes ──> Skip
    │   │   └─> info && !enableInfo? ─── Yes ──> Skip
    │   │       │
    │   │      No
    │   │       ▼
    │   ├─> Does segmentTypes match? ─── No ──> Skip
    │   │       │
    │   │      Yes
    │   │       ▼
    │   ├─> Execute rule.validate(context)
    │   │       │
    │   │       └─> Return RuleResult
    │   │           { passed, message, suggestion, ... }
    │   │
    │   └─> Collect by severity:
    │       ├─> error → errors[]
    │       ├─> warning → warnings[]
    │       └─> info → info[]
    │
    └─> Return ValidationResult
        { valid: errors.length === 0, errors, warnings, info }
```

## Rule Context Structure

```
RuleContext (passed to each rule)
    │
    ├─ segment: Segment          // The segment being validated
    │   ├─ id
    │   ├─ type
    │   ├─ startDatetime
    │   ├─ endDatetime
    │   └─ ... (type-specific fields)
    │
    ├─ itinerary: Itinerary      // Full itinerary context
    │   ├─ id
    │   ├─ startDate
    │   ├─ endDate
    │   ├─ segments[]
    │   └─ ...
    │
    ├─ allSegments: Segment[]    // All segments (including new/updated)
    │   └─ Used for overlap/gap detection
    │
    └─ operation: 'add' | 'update' | 'delete'
        └─ What operation is being performed
```

## Validation Result Structure

```
ValidationResult
    │
    ├─ valid: boolean
    │   └─ true if no error-level rules failed
    │
    ├─ errors: RuleResult[]      // Blocks operation
    │   ├─ ruleId: string
    │   ├─ ruleName: string
    │   ├─ passed: false
    │   ├─ message: string
    │   ├─ suggestion?: string
    │   ├─ relatedSegmentIds?: string[]
    │   └─ confidence?: number
    │
    ├─ warnings: RuleResult[]    // Allows operation
    │   └─ (same structure)
    │
    └─ info: RuleResult[]        // Informational only
        └─ (same structure)
```

## Error Propagation

```
Rule fails with error severity
    │
    └─> ValidationResult.valid = false
        │
        └─> SegmentService returns err()
            │
            ├─ code: 'CONSTRAINT_VIOLATION'
            ├─ message: error.message
            ├─ field: error.ruleId
            └─ details:
                ├─ ruleId
                ├─ ruleName
                ├─ suggestion
                ├─ relatedSegmentIds
                ├─ allErrors[]
                └─ warnings[]
```

## Warning Propagation

```
Rule fails with warning severity
    │
    └─> ValidationResult.valid = true (allows operation)
        │
        └─> SegmentService continues
            │
            ├─> Save segment
            │
            └─> Return ok() with warnings in metadata:
                itinerary.metadata.validationWarnings
```

## Module Structure

```
src/domain/rules/
│
├── itinerary-rules.ts       # Core types and interfaces
│   ├─ RuleSeverity
│   ├─ RuleContext
│   ├─ RuleResult
│   ├─ SegmentRule
│   ├─ ValidationResult
│   ├─ RuleId constants
│   └─ Helper functions
│
├── core-rules.ts            # Core rule implementations
│   ├─ noFlightOverlapRule
│   ├─ noHotelOverlapRule
│   ├─ chronologicalOrderRule
│   ├─ segmentWithinTripDatesRule
│   ├─ activityRequiresTransferRule
│   ├─ reasonableDurationRule
│   ├─ geographicContinuityRule
│   ├─ hotelActivityOverlapAllowedRule
│   └─ CORE_RULES array
│
├── rule-engine.ts           # Rule orchestration
│   └─ ItineraryRuleEngine
│       ├─ registerRule()
│       ├─ unregisterRule()
│       ├─ getRule()
│       ├─ getAllRules()
│       ├─ getRulesForType()
│       ├─ validate()
│       ├─ validateAdd()
│       ├─ validateUpdate()
│       ├─ validateDelete()
│       ├─ validateAll()
│       ├─ summarize()
│       ├─ updateConfig()
│       └─ getConfig()
│
├── index.ts                 # Public API exports
│
├── examples.ts              # Usage examples
│
├── README.md                # Full documentation
│
├── QUICK_REFERENCE.md       # Quick reference guide
│
└── ARCHITECTURE.md          # This file
```

## Extensibility Points

### 1. Custom Rules

```typescript
const customRule: SegmentRule = {
  id: 'custom-rule',
  name: 'Custom Rule',
  description: '...',
  severity: 'warning',
  enabled: true,
  validate: (context) => {
    // Custom validation logic
    return { passed: true };
  },
};

ruleEngine.registerRule(customRule);
```

### 2. Dynamic Configuration

```typescript
ruleEngine.updateConfig({
  disabledRules: [RuleId.REASONABLE_DURATION],
  enableWarnings: false,
});
```

### 3. Rule Override

```typescript
// Unregister default rule
ruleEngine.unregisterRule(RuleId.NO_FLIGHT_OVERLAP);

// Register custom version
ruleEngine.registerRule(myCustomFlightOverlapRule);
```

## Performance Considerations

### Current Implementation
- Rules evaluated sequentially
- All applicable rules run on each validation
- No caching (stateless)

### Optimization Opportunities
1. **Rule Result Caching**
   - Cache results per segment/operation
   - Invalidate on segment change

2. **Parallel Evaluation**
   - Rules are independent
   - Can run in parallel with Promise.all()

3. **Incremental Validation**
   - Only re-validate affected segments
   - Track dependencies between segments

4. **Early Exit**
   - Stop on first error (optional)
   - Skip remaining rules if error found

## Testing Strategy

### Unit Tests
- Test each rule independently
- Mock RuleContext
- Verify all edge cases

### Integration Tests
- Test RuleEngine with multiple rules
- Test SegmentService integration
- Test configuration changes

### Example Test Structure
```typescript
describe('Rule Name', () => {
  it('passes when conditions met', () => { ... });
  it('fails when conditions not met', () => { ... });
  it('provides helpful error message', () => { ... });
  it('includes related segments', () => { ... });
  it('applies only to correct segment types', () => { ... });
});
```

## Design Principles

1. **Separation of Concerns**
   - Rules define validation logic
   - Engine orchestrates evaluation
   - Service handles business operations

2. **Open/Closed Principle**
   - Open for extension (custom rules)
   - Closed for modification (core rules stable)

3. **Single Responsibility**
   - Each rule validates one thing
   - Engine coordinates, doesn't validate

4. **Dependency Inversion**
   - Service depends on abstractions (interfaces)
   - Not on concrete rule implementations

5. **Explicit Over Implicit**
   - All rules visible and documented
   - No hidden validation logic
