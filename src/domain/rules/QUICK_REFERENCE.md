# Itinerary Rules - Quick Reference

## Import

```typescript
import { createRuleEngine, RuleId } from '@/domain/rules';
```

## Create Engine

```typescript
const ruleEngine = createRuleEngine({
  enableWarnings: true,  // Show warnings
  enableInfo: false,     // Hide info messages
  disabledRules: [],     // No rules disabled
});
```

## Validate Operations

```typescript
// Validate adding a segment
const result = ruleEngine.validateAdd(itinerary, newSegment);

// Validate updating a segment
const result = ruleEngine.validateUpdate(itinerary, updatedSegment);

// Validate deleting a segment
const result = ruleEngine.validateDelete(itinerary, segment);

// Validate all segments
const results = ruleEngine.validateAll(itinerary);
```

## Check Results

```typescript
if (!result.valid) {
  // Hard errors - operation blocked
  console.error(result.errors[0].message);
  console.error(result.errors[0].suggestion);
  console.error(result.errors[0].relatedSegmentIds);
}

if (result.warnings.length > 0) {
  // Warnings - operation allowed
  result.warnings.forEach(w => console.warn(w.message));
}
```

## Rule IDs

```typescript
RuleId.NO_FLIGHT_OVERLAP           // Flights can't overlap
RuleId.NO_HOTEL_OVERLAP            // Hotels can't overlap
RuleId.SEGMENT_WITHIN_TRIP_DATES   // Segments must fit in trip
RuleId.CHRONOLOGICAL_ORDER         // Start < End
RuleId.ACTIVITY_REQUIRES_TRANSFER  // Different locations need transfer
RuleId.REASONABLE_DURATION         // Duration should be realistic
RuleId.GEOGRAPHIC_CONTINUITY       // Suggest transfers
```

## Custom Rules

```typescript
const customRule: SegmentRule = {
  id: 'my-rule',
  name: 'My Rule',
  description: 'Description',
  severity: 'warning',
  segmentTypes: [SegmentType.ACTIVITY],
  enabled: true,
  validate: (context) => ({
    passed: context.segment.type === SegmentType.ACTIVITY,
    message: 'Error message',
    suggestion: 'How to fix',
  }),
};

ruleEngine.registerRule(customRule);
```

## Disable Rules

```typescript
const ruleEngine = createRuleEngine({
  disabledRules: [
    RuleId.REASONABLE_DURATION,
    RuleId.GEOGRAPHIC_CONTINUITY,
  ],
});
```

## Helper Functions

```typescript
import {
  datesOverlap,
  datetimesOverlap,
  isSameLocation,
  getDurationMinutes,
  hasOvernightGap,
} from '@/domain/rules';

// Day-based overlap (ignores time)
datesOverlap(start1, end1, start2, end2);

// Time-based overlap (includes time)
datetimesOverlap(start1, end1, start2, end2);

// Same location
isSameLocation(segment1, segment2);

// Duration in minutes
getDurationMinutes(startDate, endDate);

// Overnight gap (>4 hours)
hasOvernightGap(end1, start2);
```

## Validation Result Structure

```typescript
interface ValidationResult {
  valid: boolean;
  errors: Array<{
    ruleId: RuleId;
    ruleName: string;
    passed: boolean;
    message?: string;
    suggestion?: string;
    relatedSegmentIds?: SegmentId[];
    confidence?: number;
  }>;
  warnings: Array<{ /* same */ }>;
  info: Array<{ /* same */ }>;
}
```

## Service Integration

```typescript
// SegmentService automatically validates
const result = await segmentService.add(itineraryId, segment);

if (!result.success) {
  // Check if it's a validation error
  if (result.error.code === 'CONSTRAINT_VIOLATION') {
    const { ruleId, suggestion, relatedSegmentIds } = result.error.details;
  }
}

// Warnings are in metadata
if (result.success) {
  const warnings = result.value.metadata.validationWarnings;
}
```

## Rule Severity Levels

| Severity | Behavior | Use Case |
|----------|----------|----------|
| `error` | Blocks operation | Hard constraints (overlaps, invalid data) |
| `warning` | Allows operation | Soft constraints (missing transfers, unusual duration) |
| `info` | Informational only | Suggestions (add dining, optimize route) |

## Common Patterns

### Business Trip Validation
```typescript
if (itinerary.tripType === 'BUSINESS') {
  ruleEngine.updateConfig({ enableWarnings: true });
}
```

### Batch Validation
```typescript
const results = ruleEngine.validateAll(itinerary);
const hasErrors = Array.from(results.values()).some(r => !r.valid);
```

### Get Summary
```typescript
const summary = ruleEngine.summarize(result);
// "Validation passed" or "Validation failed: 2 error(s), 1 warning(s)"
```

## Testing

```typescript
import { myRule } from './my-rules';

describe('myRule', () => {
  it('should validate correctly', () => {
    const context: RuleContext = {
      segment: createTestSegment(),
      itinerary: createTestItinerary(),
      allSegments: [],
      operation: 'add',
    };

    const result = myRule.validate(context);
    expect(result.passed).toBe(true);
  });
});
```
