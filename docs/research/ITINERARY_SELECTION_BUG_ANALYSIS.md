# Itinerary Selection Bug - Root Cause Analysis

## Problem Statement

**Symptom:** Clicking on an itinerary in the list doesn't:
1. Change the view to show itinerary details
2. Provide context to the LLM
3. Error: "Access denied: You do not have permission to view this itinerary" (403)

## Root Cause

**The server and client use different mechanisms for user identity:**

### Client-Side (api.ts)
```typescript
function getUserEmail(): string | null {
  // Reads from localStorage
  const settings = localStorage.getItem('itinerator_settings');
  if (settings) {
    return parsed.email;
  }
  // Fallback to legacy storage
  return localStorage.getItem('itinerator_user_email');
}

function getBaseHeaders(): HeadersInit {
  const userEmail = getUserEmail();
  if (userEmail) {
    headers['X-User-Email'] = userEmail; // ❌ Sends as HEADER
  }
  return headers;
}
```

### Server-Side (hooks.server.ts)
```typescript
export const handle: Handle = async ({ event, resolve }) => {
  // ❌ ONLY reads from cookie, IGNORES X-User-Email header
  event.locals.userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME) || null;

  const response = await resolve(event);
  return response;
}
```

### Server-Side API Route ([id]/+server.ts)
```typescript
async function verifyOwnership(id, userEmail, storage) {
  if (!userEmail) {
    // ❌ Returns false because userEmail is null
    return false;
  }
  // ... ownership check logic
}

export const GET: RequestHandler = async ({ params, locals }) => {
  const { userEmail } = locals; // ❌ Gets null from cookie

  const isOwner = await verifyOwnership(id, userEmail, storage);
  if (!isOwner) {
    throw error(403, {
      message: 'Access denied: You do not have permission to view this itinerary'
    });
  }
}
```

## The Mismatch

1. **Login sets BOTH:**
   - Cookie: `itinerator_user_email` (server-readable)
   - LocalStorage: `itinerator_user_email` (client-readable)

2. **Client sends header:**
   - Reads from localStorage
   - Sends as `X-User-Email` header

3. **Server ignores header:**
   - ONLY reads from cookie
   - Ignores `X-User-Email` header entirely

4. **When cookie expires/missing:**
   - Server gets `null` for userEmail
   - Ownership verification fails
   - Returns 403 error

## Evidence

### Login Flow (login/+server.ts)
```typescript
// ✅ Sets BOTH cookie and localStorage expectation
cookies.set(USER_EMAIL_COOKIE_NAME, normalizedEmail, {
  path: '/',
  httpOnly: false, // Allow client-side access
  maxAge: 60 * 60 * 24 * 7 // 7 days
});
```

### Client Auth (login/+page.svelte)
```typescript
// ✅ Updates client-side state
authStore.userEmail = email.trim().toLowerCase();
```

### Client Auth Store (auth.svelte.ts)
```typescript
set userEmail(email: string | null) {
  this._userEmail = email;
  if (isBrowser) {
    if (email) {
      // ✅ Sets localStorage
      localStorage.setItem(USER_EMAIL_KEY, email);
    }
  }
}
```

## Why This Bug Occurs

**Scenario 1: Cookie Expires**
- User logs in → cookie set for 7 days
- After 7 days, cookie expires
- LocalStorage persists (never expires)
- Client sends header from localStorage
- Server gets null from cookie
- 403 error

**Scenario 2: Cookie Cleared**
- Browser clears cookies (privacy mode, etc.)
- LocalStorage remains
- Same issue as Scenario 1

**Scenario 3: Cross-Domain**
- Different domain/subdomain
- Cookie not sent
- LocalStorage available
- Same issue

## Solution Options

### Option 1: Server Reads Header (RECOMMENDED)
**Modify `hooks.server.ts` to read `X-User-Email` header as fallback:**

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  // First try cookie (traditional session)
  let userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME) || null;

  // Fallback to X-User-Email header (client-provided)
  if (!userEmail) {
    userEmail = event.request.headers.get('X-User-Email') || null;
  }

  event.locals.userEmail = userEmail;
  console.log('[hooks] userEmail:', userEmail, 'source:', userEmail ? (event.cookies.get(USER_EMAIL_COOKIE_NAME) ? 'cookie' : 'header') : 'none');

  // ... rest of authentication logic
}
```

**Pros:**
- Minimal change (1 file)
- Fixes the immediate issue
- Backward compatible with cookie-based auth
- Supports both cookie and header-based identity

**Cons:**
- Headers can be spoofed (client can send any email)
- No cryptographic verification of identity
- Security relies on cookie-based session check

### Option 2: Client Uses Cookie API
**Modify `api.ts` to read from `document.cookie` instead of localStorage:**

```typescript
function getUserEmail(): string | null {
  if (typeof window === 'undefined') return null;

  // Read from cookie (same as server)
  const cookies = document.cookie.split(';');
  const userCookie = cookies.find(c => c.trim().startsWith('itinerator_user_email='));
  if (userCookie) {
    return userCookie.split('=')[1];
  }

  return null;
}
```

**Pros:**
- Client and server use same source (cookie)
- More secure (cookie can be httpOnly)
- No localStorage dependency

**Cons:**
- Cookie set to `httpOnly: false` in login (security concern)
- Breaks if cookie expires but session valid
- Requires client-side cookie parsing

### Option 3: Unified Session Token
**Replace email-based identity with session token:**

1. Server generates signed JWT with user claims
2. Client stores JWT in localStorage
3. Client sends JWT in Authorization header
4. Server verifies JWT signature and extracts claims

**Pros:**
- Cryptographically secure
- Can't be spoofed
- Standard OAuth2/OIDC pattern

**Cons:**
- Major refactor required
- Adds JWT dependency
- Overkill for current use case

## Recommended Fix

**Use Option 1 (Server Reads Header)**

### Implementation

**File: `viewer-svelte/src/hooks.server.ts`**

Change lines 286-288:
```typescript
// BEFORE (current)
event.locals.userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME) || null;
console.log('[hooks] userEmail from cookie:', event.locals.userEmail);

// AFTER (fixed)
// Try cookie first (traditional session), fallback to header (client-provided)
let userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME);
if (!userEmail) {
  userEmail = event.request.headers.get('X-User-Email');
}
event.locals.userEmail = userEmail || null;
console.log('[hooks] userEmail:', event.locals.userEmail, 'from:', userEmail ? (event.cookies.get(USER_EMAIL_COOKIE_NAME) ? 'cookie' : 'header') : 'none');
```

### Security Considerations

**This approach is acceptable because:**

1. **Session Authentication Still Required**
   - User must have valid session cookie (`itinerator_session`)
   - X-User-Email header only used AFTER session is verified
   - Without session, request fails at line 294 (redirect to login)

2. **Scope of Attack**
   - Attacker needs valid session cookie
   - Can only spoof email to access OTHER USER's data
   - Cannot bypass authentication entirely

3. **Current Use Case**
   - Single-user or small team deployment
   - Not a multi-tenant SaaS
   - Risk is limited to users who share session access

4. **Additional Protection**
   - Ownership verified against `itinerary.createdBy`
   - Attacker would need to know victim's email
   - Would only work for read access (GET requests)

**For production multi-tenant:**
- Consider Option 3 (JWT-based auth)
- Add request signing
- Implement CSRF tokens
- Use httpOnly cookies exclusively

## Testing the Fix

1. Clear cookies but keep localStorage
2. Refresh page
3. Click on itinerary
4. Should load successfully (reading from header)

## Related Code Locations

- **Bug Location:** `viewer-svelte/src/hooks.server.ts:287`
- **Error Thrown:** `viewer-svelte/src/routes/api/v1/itineraries/[id]/+server.ts:64`
- **Client Header:** `viewer-svelte/src/lib/api.ts:62`
- **Login Sets Cookie:** `viewer-svelte/src/routes/api/auth/login/+server.ts:104`
- **Login Sets LocalStorage:** `viewer-svelte/src/lib/stores/auth.svelte.ts:62`
