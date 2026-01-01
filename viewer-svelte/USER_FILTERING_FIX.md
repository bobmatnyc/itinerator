# User-Scoped Itinerary Filtering - Fix Summary

## Problem
Different users were seeing all itineraries instead of only their own.

## Root Cause
One itinerary file (`ce3718ec-f44d-4486-a1ec-9df047fcb37a.json`) had invalid data:
- Segment 13 had `endDatetime` BEFORE `startDatetime`
- This caused Zod schema validation to fail
- Invalid itineraries were silently skipped, reducing count from 18 to 17
- User filtering was actually working correctly, but the missing itinerary masked the issue

## Solution

### 1. Fixed Data Issue
Fixed segment 13 in `ce3718ec-f44d-4486-a1ec-9df047fcb37a.json`:
```json
{
  "id": "47473aea-b83b-4306-a79c-c3228307b662",
  "type": "TRANSFER",
  "status": "TENTATIVE",
  "startDatetime": "2021-04-08T23:45:00.000Z",  // ✅ Now before end
  "endDatetime": "2021-04-09T00:29:00.000Z"     // ✅ Now after start
}
```

### 2. Added Validation Logging
Enhanced `json-storage.ts` to log validation errors:
```typescript
} else {
  // Log validation errors to help identify data issues
  console.warn(`Skipping invalid itinerary file: ${file}`, result.error.errors);
}
```

This helps identify data quality issues early.

## Verification

### Test Results
```
bob@matsuoka.com:   18 itineraries ✅
alice@example.com:  0 itineraries  ✅
```

### Flow Confirmed
1. Login sets `itinerator_user_email` cookie with normalized email
2. `hooks.server.ts` reads cookie and sets `locals.userEmail`
3. List endpoint calls `storage.listByUser(userEmail)`
4. Storage filters by `createdBy` field (case-insensitive)
5. Users only see their own itineraries

## Files Changed

- `/data/itineraries/ce3718ec-f44d-4486-a1ec-9df047fcb37a.json` - Fixed invalid segment datetime
- `/src/storage/json-storage.ts` - Added validation error logging

## Testing

Run the test script to verify:
```bash
cd viewer-svelte
node test-user-filter.mjs
```

Expected output:
```
bob@matsuoka.com: 18 itineraries (expected 18)
alice@example.com: 0 itineraries (expected 0)
✅ User filtering is working correctly!
```
