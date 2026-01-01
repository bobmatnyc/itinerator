# Date Pre-population Fix

## Issue
When clicking "Edit Details" on an itinerary, the date inputs were not showing existing dates (e.g., 1/8/2026 - 1/15/2026). Users had to re-enter dates even though they were already set.

## Root Cause
The date values were stored as ISO 8601 strings (e.g., `"2026-01-08T00:00:00.000Z"`), but HTML `<input type="date">` requires the format `YYYY-MM-DD`.

When setting:
```typescript
editedStartDate = itinerary.startDate || '';
```

The value would be `"2026-01-08T00:00:00.000Z"` instead of `"2026-01-08"`, which the date input cannot interpret.

## Solution
Extract just the date portion using `.split('T')[0]` before setting the state variables:

```typescript
editedStartDate = itinerary.startDate ? itinerary.startDate.split('T')[0] : '';
editedEndDate = itinerary.endDate ? itinerary.endDate.split('T')[0] : '';
```

## Changes Made

### File: `viewer-svelte/src/lib/components/ItineraryDetail.svelte`

**Lines 34-35** (Initial state):
```typescript
// Before
let editedStartDate = $state(itinerary.startDate || '');
let editedEndDate = $state(itinerary.endDate || '');

// After
let editedStartDate = $state(itinerary.startDate ? itinerary.startDate.split('T')[0] : '');
let editedEndDate = $state(itinerary.endDate ? itinerary.endDate.split('T')[0] : '');
```

**Lines 54-55** (startEditingMetadata function):
```typescript
// Before
editedStartDate = itinerary.startDate || '';
editedEndDate = itinerary.endDate || '';

// After
editedStartDate = itinerary.startDate ? itinerary.startDate.split('T')[0] : '';
editedEndDate = itinerary.endDate ? itinerary.endDate.split('T')[0] : '';
```

## Testing

### Build Verification
✅ Build completed successfully with `npm run build`

### Expected Behavior
1. Navigate to an itinerary with dates set
2. Click "Edit Details" button
3. Start Date field should show: `2026-01-08`
4. End Date field should show: `2026-01-15`
5. User can modify or keep existing dates

### Edge Cases Handled
- ✅ Empty dates (`null` or `undefined`) remain empty
- ✅ Invalid dates won't cause errors (conditional check)
- ✅ Format is compatible with HTML date inputs

## Related Code

The `EditItineraryModal.svelte` component already had this fix implemented correctly (lines 25-26), but `ItineraryDetail.svelte` was missing it.

## Notes

The Svelte compiler warning about "captures the initial value of `itinerary`" is expected and safe. These state variables are:
1. Initialized with the prop values when the component mounts
2. Updated explicitly when `startEditingMetadata()` is called
3. Not meant to be reactive to prop changes (they're local editing state)

This is the correct pattern for edit forms in Svelte 5.
