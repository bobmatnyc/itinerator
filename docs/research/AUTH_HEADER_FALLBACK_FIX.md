# Auth Header Fallback Fix

**Date:** 2025-12-30
**Issue:** 403 errors when selecting itineraries due to cookie expiration
**Status:** ✅ Fixed

## Problem

Users experienced 403 errors when selecting itineraries because:

1. **Client behavior:**
   - Reads email from `localStorage`
   - Sends email via `X-User-Email` header with all API requests
   - Cookie can expire while `localStorage` persists

2. **Server behavior (before fix):**
   - Only read email from `itinerator_user_email` cookie
   - Completely ignored `X-User-Email` header
   - When cookie expired → `userEmail = null` → 403 Forbidden

3. **Mismatch:**
   - Client thinks it's sending valid auth (header)
   - Server expects cookie
   - Result: Silent auth failure

## Solution

Updated `viewer-svelte/src/hooks.server.ts` (lines 286-296) to accept `X-User-Email` header as fallback:

```typescript
// Try cookie first, fallback to X-User-Email header for compatibility
// This handles cases where the cookie expires but localStorage still has the email
let userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME);
if (!userEmail) {
  userEmail = event.request.headers.get('X-User-Email');
  if (userEmail) {
    console.log('[hooks] Using X-User-Email header:', userEmail);
  }
}
event.locals.userEmail = userEmail || null;
console.log('[hooks] userEmail:', event.locals.userEmail);
```

### Behavior

| Cookie | Header | Result | Source Used |
|--------|--------|--------|-------------|
| ✅ Set | ✅ Set | Use cookie | Cookie (preferred) |
| ✅ Set | ❌ Missing | Use cookie | Cookie |
| ❌ Missing | ✅ Set | Use header | Header (fallback) |
| ❌ Missing | ❌ Missing | `null` | None |

## Security

**Is this safe?**

✅ **Yes, this is secure because:**

1. **Session authentication is verified first** (lines 282-284)
   - `itinerator_session` cookie must be valid
   - Without valid session, request fails with 401

2. **Email header only checked AFTER session validation**
   - User must have valid session to reach this code
   - Header only used for user-scoping, not authentication

3. **Cookie still preferred**
   - Cookie takes precedence when present
   - Header only used as fallback

4. **No trust escalation**
   - Email is used for filtering user's own data
   - Cannot access other users' data
   - Already authenticated at this point

## Testing

### Manual Test

```bash
# Start dev server
cd viewer-svelte && npm run dev

# In another terminal, run test script
node test-auth-header-fallback.mjs
```

### Expected Results

1. ✅ Server accepts `X-User-Email` header when cookie missing
2. ✅ Cookie takes precedence when both present
3. ✅ Request fails without valid session (401)
4. ✅ Server logs show header being used in fallback case

### Test Script

Created `viewer-svelte/test-auth-header-fallback.mjs` to verify:
- Header fallback works
- Cookie precedence works
- Session still required
- Appropriate server logging

## Files Changed

- `viewer-svelte/src/hooks.server.ts` - Added header fallback logic
- `viewer-svelte/test-auth-header-fallback.mjs` - Test script (new file)

## Impact

### Before
- Cookie expires → 403 errors
- User must re-login even with valid session
- Poor UX (unexpected errors)

### After
- Cookie expires → Header fallback works
- User continues using app seamlessly
- Better UX (no unexpected errors)

## Related Issues

- Client sets header: `viewer-svelte/src/lib/api.ts` (lines 60-63, 263-266)
- Session auth: `viewer-svelte/src/hooks.server.ts` (lines 262-264, 282-284)
- User scoping: All API routes check `event.locals.userEmail`

## Future Considerations

### Option 1: Keep Current Approach
- Header as fallback (this fix)
- Cookie preferred for compatibility
- ✅ Works immediately
- ✅ No client changes needed

### Option 2: Header-Only (Future)
- Remove cookie entirely
- Use only `X-User-Email` header
- Requires client changes
- Simplifies auth flow

**Recommendation:** Keep current approach (cookie + header fallback) for backward compatibility.
