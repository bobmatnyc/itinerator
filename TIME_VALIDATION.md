# Time Validation System

## Overview

The time validation system automatically detects and flags unrealistic segment times in itineraries. It provides visual warnings in the UI and offers automatic corrections based on reasonable business hours and typical activity patterns.

## Problem Solved

When Trip Designer creates segments, it sometimes generates unrealistic times like:
- 4:00 AM for tourist attractions (should be 9 AM - 10 AM)
- 2:00 AM for dining (restaurants are typically closed)
- Midnight for business meetings (should be business hours)

The validation system catches these issues and helps users correct them.

## Components

### 1. Core Validation Utility (`src/utils/time-validator.ts`)

**Functions:**
- `validateSegmentTime(segment)` - Validates a single segment
- `validateItineraryTimes(segments)` - Validates all segments
- `getTimeValidationSummary(issues)` - Gets summary statistics
- `applyTimeFix(segment, suggestedTime)` - Applies suggested fix

**Types:**
- `TimeValidationResult` - Validation result with issue and suggestion
- `SegmentTimeIssue` - Segment with validation issue
- `TimeIssueSeverity` - INFO, WARNING, ERROR

### 2. UI Components

**TimeValidationBadge.svelte**
- Visual badge showing time validation issues
- Tooltip with issue description
- "Fix" button to apply suggested correction
- Color-coded by severity (blue = info, amber = warning, red = error)

**SegmentCard.svelte (updated)**
- Automatically validates segment time on render
- Shows TimeValidationBadge for invalid times
- Handles time fix callback

### 3. API Endpoint

**GET `/api/v1/itineraries/[id]/validate-times`**
- Returns all time validation issues for an itinerary
- Includes summary statistics by severity and category

**POST `/api/v1/itineraries/[id]/validate-times`**
- Applies suggested time fixes to segments
- Body: `{ segmentIds?: string[], applyAll?: boolean }`
- Returns count of fixed segments

## Validation Rules

### Activity Segments

#### General Activities (attractions, tours, museums)
- **Valid**: 8 AM - 10 PM
- **Warning**: 6 AM - 8 AM (early), 10 PM - midnight (late)
- **Error**: 4 AM - 6 AM (too early), midnight - 4 AM (overnight)
- **Suggestion**: 9:00 AM for early times, 2:00 PM for late times

#### Dining Activities (restaurants, food)
- **Breakfast**: 6 AM - 10 AM (warning if before 7 AM)
- **Lunch**: 11 AM - 3 PM (valid)
- **Dinner**: 5 PM - 11 PM (valid)
- **Error**: 2 AM - 6 AM (restaurants closed)
- **Warning**: After 11 PM (most restaurants closed)

### Flight Segments
- **Valid**: All times (24/7 operation)
- **Info**: 1 AM - 5 AM (red-eye flights, verify time)

### Hotel Segments
- **Valid**: Noon - 11 PM
- **Warning**: Before noon (early check-in, may need fee)
- **Warning**: After 11 PM (verify 24-hour reception)
- **Suggestion**: 3:00 PM (standard check-in)

### Transfer Segments
- **Valid**: All times
- **Info**: 1 AM - 5 AM (overnight transfer, verify availability)

### Meeting & Custom Segments
- No automatic validation (business context varies)

## Usage Examples

### Automatic Validation in UI

```svelte
<!-- SegmentCard automatically validates and shows badge -->
<SegmentCard
  {segment}
  onTimeFix={async (fixedSegment) => {
    await updateSegment(itinerary.id, segment.id, fixedSegment);
  }}
/>
```

The badge appears automatically if time is invalid:
```
⚡ Time issue
   "Too early for most attractions (gardens, museums typically open 9 AM)"
   [Fix to 9:00 AM]
```

### Programmatic Validation

```typescript
import { validateSegmentTime, applyTimeFix } from '$lib/types/time-validator';

// Validate single segment
const segment = getSegment();
const validation = validateSegmentTime(segment);

if (!validation.isValid) {
  console.log(validation.issue);
  console.log('Suggested time:', validation.suggestedTime);

  // Apply fix
  if (validation.suggestedTime) {
    const fixed = applyTimeFix(segment, validation.suggestedTime);
    await updateSegment(itinerary.id, segment.id, fixed);
  }
}
```

### Batch Validation via API

```typescript
// Get all validation issues
const response = await fetch(`/api/v1/itineraries/${id}/validate-times`);
const { issues, summary } = await response.json();

console.log(`Found ${summary.total} issues:`);
console.log(`- Errors: ${summary.bySeverity.error}`);
console.log(`- Warnings: ${summary.bySeverity.warning}`);
console.log(`- Info: ${summary.bySeverity.info}`);

// Fix all issues
const fixResponse = await fetch(`/api/v1/itineraries/${id}/validate-times`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ applyAll: true })
});

const { fixed, total } = await fixResponse.json();
console.log(`Fixed ${fixed} of ${total} segments`);
```

### Batch Validation in TypeScript

```typescript
import { validateItineraryTimes, getTimeValidationSummary } from '../utils/time-validator';

const itinerary = await getItinerary(id);
const issues = validateItineraryTimes(itinerary.segments);
const summary = getTimeValidationSummary(issues);

// Filter by severity
const errors = issues.filter(i => i.validation.severity === 'error');
const warnings = issues.filter(i => i.validation.severity === 'warning');

// Group by category
const tooEarly = issues.filter(i => i.validation.category === 'too_early');
const mealTiming = issues.filter(i => i.validation.category === 'meal_timing');
```

## Severity Levels

### ERROR (Red Badge)
- Very likely incorrect
- Should be fixed before finalizing itinerary
- Examples: 4 AM tourist attraction, 2 AM dining

### WARNING (Amber Badge)
- Likely incorrect or unusual
- Review and verify correctness
- Examples: 6 AM activity, 11 PM restaurant

### INFO (Blue Badge)
- Potentially valid but unusual
- Verify the time is intentional
- Examples: Red-eye flight, overnight transfer

## Issue Categories

- `too_early` - Segment too early in the day
- `too_late` - Segment too late in the day
- `meal_timing` - Unusual meal time
- `business_hours` - Outside typical business hours
- `unusual` - Other unusual timing

## Visual Design

### Badge Appearance
```
⚠️ Time issue       (ERROR - red)
⚡ Time issue       (WARNING - amber)
ℹ️ Time issue       (INFO - blue)
```

### Tooltip
```
┌─────────────────────────────────┐
│ Time Validation Issue           │
│                                 │
│ Too early for most attractions  │
│ (gardens, museums typically     │
│ open 9 AM)                      │
│                                 │
│ ┌──────────────────────────┐   │
│ │   Fix to 09:00           │   │
│ └──────────────────────────┘   │
└─────────────────────────────────┘
```

## Testing

### Unit Tests (`tests/unit/utils/time-validator.test.ts`)
- 25 test cases covering all segment types
- Validates all severity levels and categories
- Tests time fix application and duration preservation

**Run tests:**
```bash
npm test -- tests/unit/utils/time-validator.test.ts
```

### Manual Testing Scenarios

1. **Create segment with 4 AM time**
   - Should show red error badge
   - Tooltip suggests 9:00 AM
   - Fix button updates time correctly

2. **Create dining at 2 AM**
   - Should show red error badge
   - Suggests breakfast time (8:00 AM)

3. **Create hotel check-in at 8 AM**
   - Should show amber warning badge
   - Suggests standard check-in (3:00 PM)

4. **Create red-eye flight at 2 AM**
   - Should show blue info badge
   - No fix suggested (valid but unusual)

## Integration Points

### Trip Designer Service
The Trip Designer should ideally generate realistic times, but this validation system serves as a safety net.

**Recommended enhancement:**
Add validation to `trip-designer/tool-executor.ts` to warn LLM when generated times fail validation.

### Import Service
When importing from PDFs/emails, validate times and flag suspicious entries for user review.

### Segment Editor
Could add real-time validation feedback when user manually edits segment times.

## Future Enhancements

### 1. Context-Aware Validation
- Use location timezone for more accurate validation
- Check actual business hours for specific venues (via Google Places API)
- Validate based on local customs (e.g., late dining in Spain)

### 2. Seasonal Adjustments
- Summer vs. winter opening hours
- Holiday schedules
- Special events

### 3. Smart Suggestions
- Suggest times based on previous segments (logical flow)
- Consider travel time between locations
- Optimize itinerary timing

### 4. Bulk Operations
- "Fix All Issues" button in itinerary header
- Show validation summary count in header
- Batch review and approve interface

### 5. Learning System
- Track which suggestions users accept/reject
- Improve validation rules over time
- Personalize based on user preferences

## Performance Considerations

- Validation is O(n) where n = number of segments
- Runs on every segment render (cached via `$derived`)
- No network calls required for validation
- API endpoints available for batch operations

## Accessibility

- Color-coded badges also use icons (⚠️ ⚡ ℹ️)
- Tooltip text is screen-reader friendly
- Fix button has clear label
- Keyboard navigation supported

## Maintenance

### Adding New Rules
1. Add validation logic to `validateSegmentTime()` in `time-validator.ts`
2. Add test cases to `time-validator.test.ts`
3. Update this documentation

### Modifying Severity Levels
1. Update rules in `validateActivityTime()` or relevant function
2. Ensure tests cover new severity assignments
3. Update visual design if needed

### Changing Suggested Times
1. Modify `suggestedTime` in validation result
2. Update tests to match new suggestions
3. Document rationale in code comments

## Known Limitations

1. **No timezone awareness**: Validates in local time, not destination timezone
2. **No venue-specific hours**: Uses general rules, not actual business hours
3. **No context understanding**: Can't detect valid reasons for unusual times
4. **Manual fixes only**: No automatic reordering of itinerary

## Resources

- **Time Validator**: `src/utils/time-validator.ts`
- **UI Component**: `viewer-svelte/src/lib/components/TimeValidationBadge.svelte`
- **API Routes**: `viewer-svelte/src/routes/api/v1/itineraries/[id]/validate-times/+server.ts`
- **Tests**: `tests/unit/utils/time-validator.test.ts`
- **Types**: `viewer-svelte/src/lib/types/time-validator.ts`
