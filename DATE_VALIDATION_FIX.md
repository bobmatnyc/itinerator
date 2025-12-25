# Date Validation Fix - Summary

## Problem

Newly created itineraries without dates could not be loaded, resulting in 403 errors.

**Root Cause:**
- TypeScript `Itinerary` interface declared `startDate?: Date` and `endDate?: Date` as optional
- Zod `itinerarySchema` required these fields as non-nullable (`startDate: dateSchema`, `endDate: dateSchema`)
- When creating itineraries via checklist, dates were omitted (undefined)
- On loading, Zod validation failed with "Invalid date" error
- This caused a 403 error because ownership check failed when load failed

**Evidence:**
```json
// File: data/itineraries/0440ba21-21bb-4561-90cc-2ef559c6c6b7.json
{
  "id": "0440ba21-21bb-4561-90cc-2ef559c6c6b7",
  "version": 1,
  "title": "New Itinerary",
  "status": "DRAFT",
  // NO startDate or endDate fields
  "createdBy": "rob@matsuoka.com"
}
```

## Solution

Made dates optional in the Zod schema to match the TypeScript interface:

### Changes

**File: `src/domain/schemas/itinerary.schema.ts`**

1. Changed `startDate` and `endDate` to optional in `itinerarySchema`:
   ```typescript
   // BEFORE
   startDate: dateSchema,
   endDate: dateSchema,

   // AFTER
   startDate: dateSchema.optional(),
   endDate: dateSchema.optional(),
   ```

2. Updated date order validation to only check when both dates are present:
   ```typescript
   .refine((data) => {
     // Only validate date order if both dates are provided
     if (data.startDate && data.endDate) {
       return data.endDate >= data.startDate;
     }
     return true;
   }, {
     message: 'End date must be on or after start date',
     path: ['endDate'],
   })
   ```

## Verification

### Unit Tests
Created comprehensive unit tests in `tests/unit/itinerary-schema-dates.test.ts`:
- ✅ Validate itinerary without dates
- ✅ Validate itinerary with both dates
- ✅ Validate itinerary with only startDate
- ✅ Validate itinerary with only endDate
- ✅ Reject when endDate is before startDate
- ✅ Allow same startDate and endDate

### Integration Tests
Created storage layer tests in `tests/integration/storage-date-validation.test.ts`:
- ✅ Load existing itinerary without dates (the problematic file)
- ✅ List all itineraries including those without dates

### End-to-End Tests
Created complete flow tests in `tests/integration/itinerary-dates-e2e.test.ts`:
- ✅ Create itinerary without dates
- ✅ Load itinerary without dates
- ✅ Create itinerary with dates
- ✅ Update itinerary to add dates
- ✅ Update itinerary to remove dates
- ✅ List itineraries with and without dates

All tests pass:
```
Test Files  3 passed (3)
Tests       14 passed (14)
```

## Impact

### Fixed Behavior
1. ✅ Creating an itinerary without dates succeeds
2. ✅ Loading that itinerary succeeds (no 403 error)
3. ✅ Existing itineraries with valid dates continue to work
4. ✅ Checklist click flow works end-to-end
5. ✅ Trip Designer can collect dates during discovery phase

### Design Rationale
Making dates optional aligns with the Trip Designer workflow:
1. User creates a blank itinerary from checklist (no dates yet)
2. Trip Designer asks clarifying questions to collect:
   - Destinations
   - **Travel dates** ← collected during chat
   - Budget
   - Preferences
3. Trip Designer updates the itinerary with collected information

This matches the comments in code:
```typescript
// src/domain/types/itinerary.ts
/** Trip start date - optional, collected by trip designer */
startDate?: Date;

// src/domain/schemas/itinerary.schema.ts
/** Trip start date - optional, collected by trip designer */
startDate: dateSchema.optional(),
```

## Schema Consistency

All three itinerary schemas now handle optional dates consistently:

| Schema | startDate | endDate | Date Validation |
|--------|-----------|---------|-----------------|
| `itinerarySchema` | optional | optional | Only when both present |
| `itineraryCreateSchema` | optional | optional | Only when both present |
| `itineraryUpdateSchema` | optional | optional | N/A (partial updates) |

## LOC Delta

```
Added:    40 lines (tests)
Modified:  6 lines (schema)
Removed:   0 lines
Net:     +40 lines (tests only, no production code bloat)
```

## Related Files

- `src/domain/schemas/itinerary.schema.ts` - Schema fix
- `src/domain/types/itinerary.ts` - TypeScript interface (unchanged)
- `src/services/itinerary-collection.service.ts` - Already handled undefined dates correctly
- `src/storage/json-storage.ts` - Uses schema for validation (now works)
- `tests/unit/itinerary-schema-dates.test.ts` - Unit tests
- `tests/integration/storage-date-validation.test.ts` - Integration tests
- `tests/integration/itinerary-dates-e2e.test.ts` - E2E tests
