# Itinerary Detail Route Authentication Fix

## Problem
The `/itineraries/[id]` route was returning a 401 "Authentication required" error even for authenticated users.

## Root Cause
The `+page.server.ts` file was checking for `locals.user`, which doesn't exist in the application's type definitions.

```typescript
// ❌ BEFORE - Incorrect check
if (!locals.user) {
  throw error(401, 'Authentication required');
}
```

According to `src/app.d.ts`, the `App.Locals` interface only defines:
- `isAuthenticated: boolean`
- `userEmail: string | null`
- `services: Services`

There is **no `user` property**, so the check always failed.

## Solution
Changed the authentication check to use `locals.isAuthenticated` instead, which is properly set in `hooks.server.ts` based on the session cookie.

```typescript
// ✅ AFTER - Correct check
if (!locals.isAuthenticated) {
  throw error(401, 'Authentication required');
}
```

Also updated the return value to use `userEmail` instead of `user.id`:

```typescript
// ✅ AFTER
return {
  itineraryId: id,
  userEmail: locals.userEmail
};
```

## Files Changed
- `viewer-svelte/src/routes/itineraries/[id]/+page.server.ts`

## Testing
The fix aligns with the authentication pattern used throughout the application:
- `hooks.server.ts` sets `locals.isAuthenticated` based on the session cookie
- All routes should check `locals.isAuthenticated` for auth verification
- User identity is tracked via `locals.userEmail`, not a `user` object

## Impact
- ✅ Authenticated users can now access itinerary detail pages
- ✅ Unauthenticated users still get 401 as expected
- ✅ Type-safe according to the app's type definitions
- ✅ Consistent with the rest of the application's auth pattern
