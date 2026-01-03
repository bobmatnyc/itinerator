# Fix: Traveler Empty lastName Schema Validation Error

## Issue
The Trip Designer was creating travelers with empty `lastName` fields, causing schema validation failures when loading itineraries. The `travelerSchema` requires `lastName` to have at least 1 character (`.min(1)`), but the `add_traveler` tool handler was setting it to an empty string when lastName was not provided.

## Root Cause
In `src/services/trip-designer/tool-executor.ts`, the `handleAddTraveler` method was setting:
```typescript
lastName: params.lastName || '',  // ❌ Empty string fails schema validation
```

## Solution
Changed the handler to provide a default lastName of `"Traveler"` when empty or missing:

```typescript
// lastName is required by schema (.min(1)), so provide default if empty/missing
const lastName = params.lastName && params.lastName.trim().length > 0
  ? params.lastName
  : 'Traveler'; // Default for single-name travelers

const newTraveler: any = {
  // ...
  lastName,
  // ...
};
```

## Why This Approach?

### Considered Options:
1. ✅ **Fix at handler level** - Provide default lastName when empty (CHOSEN)
2. ❌ Make lastName optional in schema - Would require broader schema changes
3. ❌ Make tool require lastName - Would worsen UX (people often provide just first names)

### Why Option 1 is Best:
- **Minimal change** - Single location fix, no schema changes
- **UX-friendly** - Allows users to provide just first names naturally
- **Schema compliant** - Satisfies existing validation requirements
- **Clear default** - "Traveler" is semantically appropriate

## Migration for Existing Data
Created migration script to fix 10 existing itineraries with empty lastName:
```bash
node scripts/fix-empty-lastname.js
```

### Results:
- Modified: 10 files
- Changed empty lastName ("") to "Traveler"
- Travelers affected: Masa, Alex, Sarah, David, Joanie

## Files Changed
1. **src/services/trip-designer/tool-executor.ts** - Handler fix (5 lines)
2. **scripts/fix-empty-lastname.js** - Migration script (new file)
3. **data/itineraries/*.json** - 10 itineraries fixed

## Testing
- ✅ TypeScript build passes
- ✅ Existing itineraries now load successfully
- ✅ New travelers created without lastName get "Traveler" as default

## Impact
- **Positive**: Fixes 10 broken itineraries that couldn't load
- **Positive**: Prevents future schema validation errors
- **Neutral**: Travelers without lastName will show as "FirstName Traveler"
- **None**: No breaking changes to API or behavior
