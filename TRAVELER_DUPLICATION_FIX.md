# Traveler Duplication Bug Fix

## Problem

Trip Designer was creating duplicate travelers when `add_traveler` tool was called multiple times during a conversation:

- **Adventure Squad**: 4 expected → 24 actual (6x duplication)
- **Hendersons**: 2 expected → 6 actual (3x duplication)

## Root Cause

In `/Users/masa/Projects/itinerator/src/services/trip-designer/tool-executor.ts`, the `handleAddTraveler` function always created a new traveler and pushed it to the array without checking if a traveler with the same name already existed.

## Fix Implemented

### 1. Duplicate Detection (Lines 577-584)

Before creating a new traveler, the function now checks for an existing traveler with the same `firstName` and `lastName` (case-insensitive):

```typescript
const normalizedFirstName = params.firstName.toLowerCase().trim();
const normalizedLastName = lastName.toLowerCase().trim();

const existingTraveler = itinerary.travelers.find(t =>
  t.firstName.toLowerCase().trim() === normalizedFirstName &&
  t.lastName.toLowerCase().trim() === normalizedLastName
);
```

### 2. Update Existing Traveler (Lines 586-630)

If a duplicate is found, the function updates the existing traveler instead of creating a new one:

```typescript
if (existingTraveler) {
  // Update existing traveler fields
  existingTraveler.type = typeMap[params.type] || TravelerType.ADULT;
  existingTraveler.middleName = params.middleName;
  existingTraveler.email = params.email;
  existingTraveler.phone = params.phone;
  existingTraveler.metadata = {
    relationship: params.relationship,
    isPrimary: params.isPrimary || false,
    age: params.age,
  };

  // ... save and return updated traveler
  return {
    success: true,
    travelerId: existingTraveler.id,
    travelerName,
    message: `Updated existing traveler ${travelerName}...`,
    action: 'updated',
    itineraryChanged: true,
  };
}
```

### 3. Safety Limit (Lines 554-558)

Added a maximum travelers limit (20) to prevent runaway duplication:

```typescript
const MAX_TRAVELERS = 20;
if (itinerary.travelers.length >= MAX_TRAVELERS) {
  throw new Error(`Maximum number of travelers (${MAX_TRAVELERS}) reached...`);
}
```

### 4. Action Indicator

The response now includes an `action` field indicating whether the traveler was:
- `"created"` - New traveler added
- `"updated"` - Existing traveler updated

## Behavior Changes

### Before Fix
```
add_traveler("John", "Doe")  → Creates traveler (ID: abc123)
add_traveler("John", "Doe")  → Creates DUPLICATE (ID: def456)
add_traveler("John", "Doe")  → Creates DUPLICATE (ID: ghi789)
Result: 3 travelers with same name
```

### After Fix
```
add_traveler("John", "Doe")  → Creates traveler (ID: abc123)
add_traveler("John", "Doe")  → Updates existing (ID: abc123)
add_traveler("John", "Doe")  → Updates existing (ID: abc123)
Result: 1 traveler with latest data
```

## Testing

Build verification:
```bash
npm run build  # ✅ SUCCESS - No TypeScript errors
```

## Files Modified

1. `/Users/masa/Projects/itinerator/src/services/trip-designer/tool-executor.ts`
   - Modified `handleAddTraveler` method (lines 529-683)
   - Added duplicate detection logic
   - Added update path for existing travelers
   - Added MAX_TRAVELERS safety limit

## LOC Delta

- **Added**: 58 lines (duplicate detection + update logic)
- **Removed**: 0 lines
- **Net Change**: +58 lines
- **Phase**: Bug Fix

## Migration Notes

- No breaking changes
- Existing itineraries with duplicate travelers will not be automatically cleaned up
- New conversations will prevent further duplicates from being created
- Consider adding a data migration script to clean up existing duplicates if needed

## Future Enhancements

1. **Data Migration**: Script to identify and merge duplicate travelers in existing itineraries
2. **Email-based Matching**: Consider matching on email address in addition to name
3. **User Confirmation**: For ambiguous cases, ask user to confirm update vs. new traveler
4. **Analytics**: Track how often duplicates are prevented to validate fix effectiveness
