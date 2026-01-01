# Itinerary Business Rules

This module provides a centralized, composable business rules system for validating itinerary segments.

## Overview

All itinerary validation logic is defined as explicit, testable rules that can be enabled/disabled and configured per itinerary. This approach provides:

- **Explicitness**: All business rules are visible in one place
- **Testability**: Each rule can be tested independently
- **Composability**: Rules can be combined and configured
- **Flexibility**: Rules can be enabled/disabled or customized per itinerary
- **Clarity**: Error messages include suggestions for resolution

## Architecture

```
domain/rules/
├── itinerary-rules.ts    # Core types and interfaces
├── core-rules.ts          # Implementation of core validation rules
├── rule-engine.ts         # Rule orchestration engine
└── index.ts               # Public API exports
```

## Core Rules

### Error-Level Rules (Block Operations)

1. **NO_FLIGHT_OVERLAP**
   - Flights cannot overlap with each other or with hotels
   - Example: Can't have two flights at the same time

2. **NO_HOTEL_OVERLAP**
   - Hotels cannot overlap with other hotels
   - Note: Hotels CAN overlap with activities (you're staying there while doing activities)

3. **SEGMENT_WITHIN_TRIP_DATES**
   - All segments must fall within itinerary start/end dates
   - Only enforced if itinerary has dates set

4. **CHRONOLOGICAL_ORDER**
   - Segment end time must be after start time

### Warning-Level Rules (Allow But Warn)

5. **ACTIVITY_REQUIRES_TRANSFER**
   - Activities at different locations should have transfer segments
   - Exception: Back-to-back at same location OR overnight gap

6. **REASONABLE_DURATION**
   - Warn if segments have unrealistic durations
   - Examples: 10-hour dinner, 30-min flight, 40-day hotel stay

### Info-Level Rules (Informational)

7. **GEOGRAPHIC_CONTINUITY**
   - Segments should flow geographically
   - Gaps should trigger transfer suggestions

8. **HOTEL_ACTIVITY_OVERLAP_ALLOWED**
   - Hotels CAN overlap with activities (expected behavior)
   - Informational only

## Usage

### Basic Validation

```typescript
import { createRuleEngine } from '@/domain/rules';

// Create engine with default configuration
const ruleEngine = createRuleEngine({
  enableWarnings: true,
  enableInfo: false,
});

// Validate adding a segment
const result = ruleEngine.validateAdd(itinerary, newSegment);

if (!result.valid) {
  console.error('Validation failed:', result.errors);
  // result.errors[0].message - Error message
  // result.errors[0].suggestion - How to fix
  // result.errors[0].relatedSegmentIds - Related segments
}

// Check warnings even if valid
if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

### Custom Configuration

```typescript
import { createRuleEngine, RuleId } from '@/domain/rules';

// Disable specific rules
const ruleEngine = createRuleEngine({
  disabledRules: [RuleId.REASONABLE_DURATION],
  enableWarnings: true,
  enableInfo: true,
});
```

### Custom Rules

```typescript
import { ItineraryRuleEngine } from '@/domain/rules';
import type { SegmentRule } from '@/domain/rules';

const customRule: SegmentRule = {
  id: 'my-custom-rule',
  name: 'My Custom Rule',
  description: 'Validates custom business logic',
  severity: 'warning',
  segmentTypes: ['ACTIVITY'],
  enabled: true,
  validate: (context) => {
    // Your validation logic
    return {
      passed: true,
      message: 'Validation passed',
    };
  },
};

const ruleEngine = createRuleEngine();
ruleEngine.registerRule(customRule);
```

### Integration with SegmentService

The `SegmentService` automatically uses the rule engine for all add/update operations:

```typescript
// Automatically validates using rule engine
const result = await segmentService.add(itineraryId, newSegment);

if (!result.success) {
  // Check if it's a validation error
  if (result.error.code === 'CONSTRAINT_VIOLATION') {
    console.log('Rule ID:', result.error.details?.ruleId);
    console.log('Suggestion:', result.error.details?.suggestion);
    console.log('All errors:', result.error.details?.allErrors);
  }
}

// Warnings are attached to successful results
if (result.success && result.value.metadata.validationWarnings) {
  console.warn('Warnings:', result.value.metadata.validationWarnings);
}
```

## Rule Definition

Each rule must implement the `SegmentRule` interface:

```typescript
interface SegmentRule {
  id: string;                    // Unique identifier
  name: string;                  // Human-readable name
  description: string;           // Detailed description
  severity: 'error' | 'warning' | 'info';
  segmentTypes?: SegmentType[];  // Which types this applies to
  enabled: boolean;              // Default enabled state
  validate: (context: RuleContext) => RuleResult;
}
```

### Rule Context

Rules receive full context for validation:

```typescript
interface RuleContext {
  segment: Segment;       // The segment being validated
  itinerary: Itinerary;   // Full itinerary for context
  allSegments: Segment[]; // All segments (including new one)
  operation: 'add' | 'update' | 'delete';
}
```

### Rule Result

Rules return detailed results:

```typescript
interface RuleResult {
  passed: boolean;              // Did the rule pass?
  message?: string;             // Error/warning message
  suggestion?: string;          // How to fix the issue
  relatedSegmentIds?: SegmentId[]; // Related segments
  confidence?: number;          // Confidence score (0-1)
}
```

## Helper Functions

The module provides helpers for common validation tasks:

```typescript
import {
  datesOverlap,
  datetimesOverlap,
  isSameLocation,
  getDurationMinutes,
  hasOvernightGap,
} from '@/domain/rules';

// Check if date ranges overlap (day-based)
const overlaps = datesOverlap(
  hotel1.checkInDate,
  hotel1.checkOutDate,
  hotel2.checkInDate,
  hotel2.checkOutDate
);

// Check if datetime ranges overlap (time-based)
const overlaps = datetimesOverlap(
  flight1.startDatetime,
  flight1.endDatetime,
  flight2.startDatetime,
  flight2.endDatetime
);

// Check if segments are at same location
const sameLocation = isSameLocation(segment1, segment2);

// Get duration in minutes
const duration = getDurationMinutes(segment.startDatetime, segment.endDatetime);

// Check for overnight gap (>4 hours)
const overnight = hasOvernightGap(segment1.endDatetime, segment2.startDatetime);
```

## Testing

Rules are designed to be easily testable in isolation:

```typescript
import { myRule } from './my-rules';
import type { RuleContext } from '@/domain/rules';

describe('myRule', () => {
  it('should pass when conditions are met', () => {
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

See `core-rules.test.ts` for examples.

## Migration Notes

### From Legacy Validation

The rule engine consolidates validation that was previously scattered across:
- `SegmentService.add()` - Date range checks, chronological order
- `SegmentService.update()` - Date range checks
- `SegmentService.findDuplicateSegment()` - Duplicate detection (kept separate for now)

### Gradual Migration

You can gradually migrate validation:
1. Keep existing validation alongside rule engine
2. Add new validation as rules
3. Incrementally move legacy validation to rules
4. Remove legacy validation once rules are verified

## Future Enhancements

Potential improvements:

1. **Duplicate Detection Rule**
   - Move `findDuplicateSegment()` logic to a rule
   - Make fuzzy matching configurable

2. **Hotel-Specific Rules**
   - `HOTEL_NIGHTS_MATCH_DATES`: Validate check-in/out dates match segment dates
   - `HOTEL_ROOM_COUNT_MATCHES_TRAVELERS`: Warn if room count seems wrong

3. **Flight-Specific Rules**
   - `FLIGHT_DURATION_REASONABLE`: Validate flight duration matches route
   - `FLIGHT_CONNECTION_TIME`: Validate minimum connection times

4. **Transfer Rules**
   - `TRANSFER_BETWEEN_HOTELS`: Auto-suggest transfers when changing hotels
   - `AIRPORT_TRANSFER_REQUIRED`: Suggest transfer from airport to hotel

5. **Business Logic Rules**
   - `MAX_DAILY_ACTIVITIES`: Warn if too many activities in one day
   - `MEAL_COVERAGE`: Suggest dining activities for uncovered meals

6. **Dependency Rules**
   - `NO_CIRCULAR_DEPENDENCIES`: Detect circular segment dependencies
   - `VALID_DEPENDENCIES`: Ensure all dependsOn references exist

## Performance

- Rules are evaluated lazily (only when needed)
- Rule results can be cached per operation
- Batch validation available for bulk operations
- Disabled rules are not evaluated

## API Reference

See type definitions in `itinerary-rules.ts` for complete API documentation.
