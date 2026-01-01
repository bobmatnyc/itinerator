# User-Scoped Collections Fix

## Issue
Users with different email addresses were seeing the same itinerary collection instead of their own.

## Root Cause
Existing itineraries had `createdBy: null/undefined`, so they didn't match any user's email during filtering.

## Solution
The user-scoped filtering was **already implemented correctly**:

1. ✅ Login sets `itinerator_user_email` cookie
2. ✅ `hooks.server.ts` reads cookie and populates `locals.userEmail`
3. ✅ POST `/api/v1/itineraries` creates itineraries with `createdBy: userEmail`
4. ✅ GET `/api/v1/itineraries` filters by `createdBy` field
5. ✅ `JsonItineraryStorage.listByUser()` implements case-insensitive filtering

**The system works correctly for new itineraries.** The only issue was legacy data.

## Testing
Created test scripts to verify the fix:

```bash
# Test creating itineraries with different users
cd viewer-svelte
node test-create-itinerary.mjs
```

**Result**: Different users see different collections ✅

## Legacy Data Migration

Existing itineraries (created before this fix) have `createdBy: null` and are hidden from all users.

### Option 1: Assign to Default User (Recommended)
Assign all legacy itineraries to a default user email:

```bash
cd /Users/masa/Projects/itinerator
tsx scripts/migrate-legacy-itineraries.ts your-email@example.com
```

This will:
- Find all itineraries with `createdBy: null`
- Set `createdBy: your-email@example.com`
- Leave itineraries that already have `createdBy` unchanged

### Option 2: Delete Legacy Itineraries
If the legacy itineraries are not needed:

```bash
# Backup first
cp -r data/itineraries data/itineraries.backup

# Delete itineraries without createdBy
find data/itineraries -name "*.json" -exec sh -c \
  'jq -e ".createdBy == null" "$1" > /dev/null && rm "$1"' _ {} \;
```

### Option 3: Share Legacy Itineraries (Alternative)
Modify the filtering logic to show `createdBy: null` itineraries to all users (treat as "shared"):

```typescript
// In json-storage.ts listByUser():
const userItineraries = listResult.value.filter(
  (summary) =>
    !summary.createdBy || // Show legacy itineraries to everyone
    summary.createdBy?.toLowerCase().trim() === normalizedEmail
);
```

## Files Changed
1. `/viewer-svelte/src/hooks.server.ts` - Cookie parsing (debug logs removed)
2. `/viewer-svelte/src/routes/api/v1/itineraries/+server.ts` - List endpoint (debug logs removed)
3. `/src/storage/json-storage.ts` - Filtering implementation (debug logs removed)

## Test Files Created
- `/viewer-svelte/test-user-collections-v2.mjs` - Test login and cookie flow
- `/viewer-svelte/test-create-itinerary.mjs` - Test creating itineraries with ownership
- `/scripts/migrate-legacy-itineraries.ts` - Migration script for legacy data

## Cleanup
After migration, you can delete the test files:

```bash
rm viewer-svelte/test-*.mjs
```

## Verification
1. Login with different emails
2. Create itineraries
3. Verify each user only sees their own itineraries
4. Check `createdBy` field in JSON files

```bash
# Check who owns an itinerary
jq '.createdBy' data/itineraries/YOUR_ID.json
```
