# User Scoping Fix - Frontend

## Problem

The backend was correctly filtering itineraries by user email (confirmed in logs), but the frontend was showing all itineraries regardless of which user logged in. This was because:

1. The API client wasn't sending the `X-User-Email` header in requests
2. The itinerary list wasn't being cleared on login/logout

## Root Cause

The `apiClient` in `viewer-svelte/src/lib/api.ts` was making API requests without including the user's email in the headers. The backend expects an `X-User-Email` header to filter data by user, but the frontend wasn't providing it.

## Solution

### 1. Added User Email Headers to All API Requests

**File**: `viewer-svelte/src/lib/api.ts`

Created new helper functions:
- `getUserEmail()`: Reads user email from localStorage
- `getBaseHeaders()`: Returns headers with `X-User-Email` and `Content-Type`
- Updated `getAIHeaders()`: Now includes user email headers plus OpenRouter API key

Updated all API methods to use `getBaseHeaders()`:
- `getItineraries()`
- `getItinerary()`
- `createItinerary()`
- `updateItinerary()`
- `deleteItinerary()`
- `addSegment()`
- `updateSegment()`
- `deleteSegment()`
- `getModels()`
- `getCosts()`
- `importPDF()` (special case - multipart/form-data)

### 2. Added Itinerary Cache Clearing

**File**: `viewer-svelte/src/lib/stores/itineraries.ts`

Added `clearItineraries()` function to clear all cached itinerary data when logging out or switching users.

**File**: `viewer-svelte/src/lib/stores/auth.svelte.ts`

Updated `logout()` method to call `clearItineraries()`, ensuring no cached data persists between user sessions.

### 3. Added Comments for Clarity

**File**: `viewer-svelte/src/routes/login/+page.svelte`

Added comment explaining that itinerary data is cleared after login and will be reloaded fresh on the itineraries page.

## Testing Instructions

### Test 1: Basic User Scoping

1. **Logout** (if logged in)
2. **Login as bob@matsuoka.com**
   - Should see 18 itineraries
3. **Logout**
4. **Login as alice@example.com**
   - Should see 0 itineraries (or different set if you create some)

### Test 2: Cross-User Data Isolation

1. **Login as alice@example.com**
2. **Create a new itinerary** (or import a PDF)
3. **Note the itinerary appears** in the list
4. **Logout**
5. **Login as bob@matsuoka.com**
6. **Verify alice's itinerary is NOT visible**
7. **Logout**
8. **Login as alice@example.com**
9. **Verify alice's itinerary IS visible**

### Test 3: Network Inspection

1. **Login as bob@matsuoka.com**
2. **Open Browser DevTools** → Network tab
3. **Refresh the page** or navigate to itineraries
4. **Click on the `/api/v1/itineraries` request**
5. **Check Request Headers** → Should see:
   ```
   X-User-Email: bob@matsuoka.com
   ```
6. **Check Response** → Should contain only bob's itineraries

## Files Modified

1. `viewer-svelte/src/lib/api.ts` - Added user email headers to all requests
2. `viewer-svelte/src/lib/stores/itineraries.ts` - Added clearItineraries function
3. `viewer-svelte/src/lib/stores/auth.svelte.ts` - Clear itineraries on logout
4. `viewer-svelte/src/routes/login/+page.svelte` - Added clarifying comment

## Technical Details

### How It Works

1. **On Login**:
   - User email is stored in `localStorage` under key `itinerator_user_email`
   - Auth store updates `userEmail` property
   - User is redirected to home/profile

2. **On API Request**:
   - `getUserEmail()` reads email from localStorage
   - `getBaseHeaders()` creates headers with `X-User-Email: user@example.com`
   - Fetch request includes these headers
   - Backend receives header and filters data accordingly

3. **On Logout**:
   - Auth store clears localStorage
   - `clearItineraries()` resets all itinerary stores to empty state
   - No cached data persists

### Why This Pattern?

- **SSR-Safe**: Functions read directly from localStorage (no Svelte store complications)
- **Consistent**: All API requests automatically include user context
- **Type-Safe**: TypeScript ensures headers are properly typed
- **Maintainable**: Single source of truth for user email

## Expected Behavior After Fix

✅ Each user sees only their own itineraries
✅ Logging in as different users shows different data
✅ Creating/updating/deleting itineraries affects only current user
✅ No cached data leaks between user sessions
✅ All API requests include user context
✅ Backend logs show correct user email scoping

## Verification Commands

```bash
# Check backend logs for user email
# Should show "bob@matsuoka.com" for bob, "alice@example.com" for alice
# Look for lines like: "[ItineraryService] Fetching itineraries for user: bob@matsuoka.com"

# Build frontend to verify no TypeScript errors
cd viewer-svelte
npm run build

# Start dev server to test
npm run dev
```

## Related Backend Code

The backend already correctly handles user scoping:

**File**: `src/routes/api/v1/itineraries.ts`
```typescript
// Extract user email from header (set by middleware or client)
const userEmail = req.headers['x-user-email'] as string | undefined;

// Pass to service
const itineraries = await itineraryService.listItineraries({ userEmail });
```

**File**: `src/services/itinerary-service.ts`
```typescript
async listItineraries(options?: { userEmail?: string }): Promise<ItineraryListItem[]> {
  // Filter by user email if provided
  // ...
}
```

The frontend fix ensures the `X-User-Email` header is always sent.
