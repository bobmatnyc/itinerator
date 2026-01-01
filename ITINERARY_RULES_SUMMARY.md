# Itinerary Business Rules - Implementation Summary

## Overview

Created a centralized business rules model for itinerary validation that consolidates all validation logic in one place. The system is explicit, testable, configurable, and provides clear error messages with suggestions.

## Files Created

```
src/domain/rules/
├── itinerary-rules.ts          # Core types and interfaces
├── core-rules.ts               # Implementation of 8 core validation rules
├── rule-engine.ts              # Rule orchestration engine
├── index.ts                    # Public API exports
├── examples.ts                 # Usage examples (documentation)
└── README.md                   # Comprehensive documentation

tests/unit/domain/rules/
└── core-rules.test.ts          # Unit tests (10 tests, all passing)
```

## Files Modified

```
src/services/segment.service.ts
- Added rule engine integration
- Updated add() method to use rule-based validation
- Updated update() method to use rule-based validation
- Validation errors now include rule ID, suggestions, and related segments
- Warnings are attached to successful results in metadata
```

## Core Rules Implemented

### Error-Level Rules (Block Operations)

1. **NO_FLIGHT_OVERLAP** - Flights cannot overlap with each other or hotels
2. **NO_HOTEL_OVERLAP** - Hotels cannot overlap with other hotels
3. **SEGMENT_WITHIN_TRIP_DATES** - Segments must fall within trip dates
4. **CHRONOLOGICAL_ORDER** - Start time must be before end time

### Warning-Level Rules (Allow But Warn)

5. **ACTIVITY_REQUIRES_TRANSFER** - Activities at different locations need transfers
6. **REASONABLE_DURATION** - Warn on unrealistic durations (30-min flight, 10-hr dinner)

### Info-Level Rules (Informational)

7. **GEOGRAPHIC_CONTINUITY** - Suggest transfers for location changes
8. **HOTEL_ACTIVITY_OVERLAP_ALLOWED** - Informational (expected behavior)

## API Usage

### Basic Validation

```typescript
import { createRuleEngine } from '@/domain/rules';

const ruleEngine = createRuleEngine({
  enableWarnings: true,
  enableInfo: false,
});

const result = ruleEngine.validateAdd(itinerary, newSegment);

if (!result.valid) {
  console.error(result.errors[0].message);
  console.error('Suggestion:', result.errors[0].suggestion);
}
```

### Custom Rules

```typescript
const customRule: SegmentRule = {
  id: 'my-rule',
  name: 'My Custom Rule',
  description: 'Custom validation logic',
  severity: 'warning',
  enabled: true,
  validate: (context) => ({
    passed: true,
    message: 'Validation result',
  }),
};

ruleEngine.registerRule(customRule);
```

### Service Integration

The SegmentService automatically validates all add/update operations:

```typescript
const result = await segmentService.add(itineraryId, segment);

if (!result.success && result.error.code === 'CONSTRAINT_VIOLATION') {
  console.log('Rule:', result.error.details.ruleId);
  console.log('Fix:', result.error.details.suggestion);
}

// Warnings are in metadata
if (result.success && result.value.metadata.validationWarnings) {
  console.warn(result.value.metadata.validationWarnings);
}
```

## Key Features

### 1. Explicit Rules
All business logic is visible in one place (`core-rules.ts`), making it easy to understand what validation occurs.

### 2. Testable
Each rule can be tested independently with simple unit tests.

### 3. Configurable
- Enable/disable specific rules
- Control warning and info levels
- Per-itinerary configuration possible

### 4. Rich Error Messages
- Clear error message
- Actionable suggestion
- Related segment IDs
- Confidence scores for soft rules

### 5. Helper Functions
Provided helpers for common validation tasks:
- `datesOverlap()` - Day-based overlap check
- `datetimesOverlap()` - Time-based overlap check
- `isSameLocation()` - Location comparison
- `getDurationMinutes()` - Duration calculation
- `hasOvernightGap()` - Overnight gap detection (>4 hours)

## Migration Strategy

### Consolidated Validation
Previously scattered validation logic has been centralized:

**Before:**
- Date range checks in `SegmentService.add()`
- Chronological checks in `SegmentService.add()`
- Date range checks in `SegmentService.update()`
- Duplicate detection in separate method

**After:**
- All validation rules in `core-rules.ts`
- Orchestrated by `ItineraryRuleEngine`
- Duplicate detection kept separate (can migrate to rule later)

### Backward Compatibility
- Legacy duplicate detection still runs (can migrate to rule)
- All existing validation preserved
- New validation adds stricter checks (overlap detection, etc.)

## Test Results

```
✓ tests/unit/domain/rules/core-rules.test.ts (10 tests) 12ms
  ✓ noFlightOverlapRule (3 tests)
    ✓ should pass when flights do not overlap
    ✓ should fail when flights overlap
    ✓ should fail when flight overlaps with hotel
  ✓ noHotelOverlapRule (2 tests)
    ✓ should pass when hotels do not overlap
    ✓ should fail when hotels overlap
  ✓ chronologicalOrderRule (2 tests)
    ✓ should pass when start is before end
    ✓ should fail when start is after end
  ✓ segmentWithinTripDatesRule (3 tests)
    ✓ should pass when segment is within trip dates
    ✓ should fail when segment is outside trip dates
    ✓ should pass when itinerary has no dates set

Test Files  1 passed (1)
     Tests  10 passed (10)
```

## Future Enhancements

The system is designed to be extended with additional rules:

### Suggested Rules
1. **Duplicate Detection** - Move `findDuplicateSegment()` to a rule
2. **Hotel Night Validation** - Check-in/out dates match segment dates
3. **Flight Duration** - Validate duration matches route
4. **Transfer Requirements** - Auto-suggest airport/hotel transfers
5. **Daily Activity Limits** - Warn if too many activities in one day
6. **Meal Coverage** - Suggest dining activities
7. **Dependency Validation** - Check for circular dependencies

### Performance Optimization
- Rule result caching
- Parallel rule evaluation
- Incremental validation (only validate changed segments)

## LOC Delta

```
Lines Added: ~800 lines
Lines Removed: ~80 lines (from segment.service.ts - replaced with rule calls)
Net Change: +720 lines

Files Created: 5 new files
Files Modified: 1 file
Tests Added: 10 unit tests
```

## Documentation

Comprehensive documentation provided:
- **README.md** - Full API documentation with examples
- **examples.ts** - 9 practical usage examples
- **Inline comments** - All code extensively documented
- **Type definitions** - Full TypeScript types with JSDoc

## Benefits

1. **Maintainability** - All rules in one place, easy to update
2. **Testability** - Each rule independently testable
3. **Clarity** - Explicit rules vs. implicit validation
4. **Flexibility** - Rules can be enabled/disabled per itinerary
5. **User Experience** - Clear error messages with suggestions
6. **Developer Experience** - Simple API, great TypeScript support
7. **Extensibility** - Easy to add custom rules
8. **Consistency** - Same validation everywhere

## Next Steps

1. **Add More Rules** - Implement suggested future rules
2. **Migrate Duplicate Detection** - Move to rule-based system
3. **Add API Endpoint** - Expose validation endpoint for frontend
4. **Add UI Integration** - Show validation errors/warnings in UI
5. **Performance Optimization** - Add caching if needed
6. **Analytics** - Track which rules fail most often
