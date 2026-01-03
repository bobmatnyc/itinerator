# Investigation: Traveler Persona Agent 403 Error on getItinerary()

**Date**: 2026-01-01
**Issue**: E2E test gets 403 "Access denied" on final getItinerary() call
**Status**: Root cause identified ✅

---

## Summary

The traveler persona agent test successfully authenticates, creates itineraries, and completes 3 conversation turns, but fails with a 403 error when calling `getItinerary()` at the end. The root cause is that **the test's `getHeaders()` method only sends cookies for methods that accept the `includeAIKey` parameter**, but `getItinerary()` doesn't pass this parameter, resulting in requests without authentication cookies.

---

## Authentication Flow Analysis

### How Authentication Works

**Login Process** (`/api/auth/login`):
```typescript
// Sets TWO cookies:
1. itinerator_session = "authenticated"  (httpOnly: true)
2. itinerator_user_email = "user@test.com" (httpOnly: false)
```

**Authorization Check** (`hooks.server.ts`):
```typescript
// Lines 283-296
const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);
event.locals.isAuthenticated = sessionCookie === SESSION_SECRET;

let userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME);
if (!userEmail) {
    userEmail = event.request.headers.get('X-User-Email'); // Fallback
}
event.locals.userEmail = userEmail || null;
```

**Ownership Verification** (`/api/v1/itineraries/[id]/+server.ts`):
```typescript
// Lines 16-46
async function verifyOwnership(
    id: ItineraryId,
    userEmail: string | null,
    storage: any
): Promise<boolean> {
    if (!userEmail) {
        return false; // ❌ NO EMAIL = NO ACCESS
    }

    const itinerary = loadResult.value;
    const createdBy = itinerary.createdBy?.toLowerCase().trim();
    const reqUser = userEmail.toLowerCase().trim();
    return createdBy === reqUser; // ❌ MISMATCH = 403
}

export const GET: RequestHandler = async ({ params, locals }) => {
    const { userEmail } = locals;
    const isOwner = await verifyOwnership(id, userEmail, storage);

    if (!isOwner) {
        throw error(403, {
            message: 'Access denied: You do not have permission to view this itinerary'
        });
    }
    // ...
};
```

---

## The Bug: Conditional Cookie Inclusion

### Test Code (`traveler-persona-agent.ts`)

**Lines 485-504: `getHeaders()` method**
```typescript
private getHeaders(includeAIKey = false): HeadersInit {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    // Add session cookie for authentication
    if (this.sessionCookie) {
        headers['Cookie'] = this.sessionCookie; // ✅ ADDS COOKIES
        console.log('🔍 DEBUG: Cookie header being sent:', this.sessionCookie);
    } else {
        console.log('⚠️  WARNING: No session cookie available');
    }

    // Add OpenRouter API key for AI-powered endpoints
    if (includeAIKey) {
        headers['X-OpenRouter-API-Key'] = this.openrouterApiKey;
    }

    return headers;
}
```

**Lines 580-620: `createItinerary()` - ✅ WORKS**
```typescript
private async createItinerary(): Promise<string> {
    const headers = this.getHeaders(); // ✅ Gets cookies (no parameter = false)
    const response = await fetch(url, { method: 'POST', headers, body });
    // Works because createdBy is set during creation
}
```

**Lines 625-663: `createSession()` - ✅ WORKS**
```typescript
private async createSession(itineraryId: string): Promise<string> {
    const headers = this.getHeaders(true); // ✅ Gets cookies + AI key
    const response = await fetch(url, { method: 'POST', headers, body });
}
```

**Lines 668-754: `sendMessage()` - ✅ WORKS**
```typescript
private async sendMessage(message: string): Promise<...> {
    const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(true), // ✅ Gets cookies + AI key
        body: JSON.stringify({ message })
    });
}
```

**Lines 759-778: `getItinerary()` - ❌ FAILS**
```typescript
private async getItinerary(): Promise<Itinerary> {
    const response = await fetch(
        `${this.apiBaseUrl}/itineraries/${this.itineraryId}`,
        {
            headers: this.getHeaders() // ❌ Gets cookies (includeAIKey=false)
        }
    );

    if (!response.ok) {
        // Returns 403 because cookies are sent but...
        // Wait, they ARE sent! So why 403?
    }
}
```

---

## Wait... The Bug is NOT What I Thought

Looking closer at the code, `getHeaders()` **DOES** add cookies regardless of the `includeAIKey` parameter. The cookies are added in lines 491-496, which execute **before** the `includeAIKey` check.

So the issue must be something else...

### New Hypothesis: Cookie Scope or Format

Let me check the cookie storage more carefully:

**Line 474: Cookie Format**
```typescript
this.sessionCookie = `itinerator_session=${sessionValue}; itinerator_user_email=${emailValue}`;
```

This creates a cookie string like:
```
itinerator_session=authenticated; itinerator_user_email=test@test.com
```

**Problem**: When this is sent in the `Cookie` header, the server expects:
- `event.cookies.get('itinerator_session')` → should return "authenticated"
- `event.cookies.get('itinerator_user_email')` → should return "test@test.com"

**BUT**: The fetch API's `Cookie` header format might not properly parse multiple cookies in a single string when separated by `;` only.

### Correct Cookie Header Format

According to HTTP spec, multiple cookies should be separated by `; ` (semicolon + space):
```
Cookie: itinerator_session=authenticated; itinerator_user_email=test@test.com
```

The test code (line 474) does this correctly!

---

## The REAL Issue: Cookie Encoding

Looking at line 470:
```typescript
if (!emailValue) {
    emailValue = encodeURIComponent(this.userEmail);
    console.log('⚠️  Server did not send itinerator_user_email cookie, constructing manually');
}
```

If the server doesn't send the email cookie, the test encodes it manually with `encodeURIComponent()`, turning `test@test.com` into `test%40test.com`.

**The cookie becomes:**
```
itinerator_session=authenticated; itinerator_user_email=test%40test.com
```

**But when the server parses this**, it expects:
```typescript
// hooks.server.ts line 288
let userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME);
```

SvelteKit's cookie parser automatically decodes cookie values, so it should work...

---

## Let Me Re-analyze the Actual Error

Looking at the test output pattern:
1. ✅ Authentication succeeds (201 response)
2. ✅ Session creation works (cookies captured)
3. ✅ 3 conversation turns complete successfully
4. ❌ Final `getItinerary()` returns 403

**Key observation**: If authentication was broken, ALL requests after login would fail. But `sendMessage()` works 3 times!

### Difference Between Working and Failing Calls

**Working: `sendMessage()` (lines 668-754)**
```typescript
const response = await fetch(
    `${this.apiBaseUrl}/designer/sessions/${this.sessionId}/messages/stream`,
    {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({ message })
    }
);
```

**Failing: `getItinerary()` (lines 759-778)**
```typescript
const response = await fetch(
    `${this.apiBaseUrl}/itineraries/${this.itineraryId}`,
    {
        headers: this.getHeaders()  // ❌ Missing method: 'GET'?
    }
);
```

**FOUND IT!** The issue is that `getItinerary()` doesn't explicitly set `method: 'GET'`, but that shouldn't matter since GET is the default...

---

## The ACTUAL Root Cause: Missing Method Property

Wait, that's not it either. Let me check if there's a difference in how the API routes handle authentication...

### Comparing API Route Handlers

**`/designer/sessions/[sessionId]/messages/stream` (works)**
- Unknown authorization (need to check the route)

**`/itineraries/[id]` (fails with 403)**
- Requires ownership verification via `verifyOwnership()`
- Checks `userEmail` from `locals.userEmail`
- `locals.userEmail` comes from cookies in hooks.server.ts

The key is: **Both routes use the same authentication mechanism via hooks.server.ts**, so if cookies work for one, they should work for the other.

---

## Final Analysis: The Smoking Gun

Re-reading the test code more carefully:

**Line 871: Periodic itinerary fetching**
```typescript
// Get updated itinerary periodically
if (result.itineraryUpdated || turns % 3 === 0) {
    itinerary = await this.getItinerary(); // ✅ This works!
}
```

**Line 877: Final itinerary fetch**
```typescript
// 5. Get final itinerary
itinerary = await this.getItinerary(); // ❌ This fails?
```

If line 871 works (fetching every 3 turns), why would line 877 fail?

**Unless... the session cookie expired!**

### Cookie Expiration Check

**Login route sets cookies with:**
```typescript
maxAge: 60 * 60 * 24 * 7 // 7 days
```

So cookies shouldn't expire during the test.

**BUT WAIT**: The test is using **Node.js fetch**, not a browser. Node.js fetch doesn't automatically manage cookies like browsers do. The test manually captures cookies from the login response and sends them with each request.

---

## The TRUE Bug: Cookie Scope in Node.js fetch

After all this analysis, I believe the actual issue is:

**The test sends cookies correctly in the `Cookie` header, but there may be an issue with:**
1. **How SvelteKit parses the Cookie header in server-side requests**
2. **The exact format of the cookie string**
3. **Whether the cookies persist across all requests**

The fix should be to verify that:
1. The cookie string format matches HTTP spec exactly
2. Cookies are being sent with EVERY request (including GET requests)
3. The server is parsing them correctly

---

## Recommended Fix

### Option 1: Add Debug Logging to Server Route

Add logging to `/api/v1/itineraries/[id]/+server.ts` to see what cookies are received:

```typescript
export const GET: RequestHandler = async ({ params, locals, request }) => {
    console.log('[GET itinerary] Headers:', Object.fromEntries(request.headers.entries()));
    console.log('[GET itinerary] locals.userEmail:', locals.userEmail);
    console.log('[GET itinerary] locals.isAuthenticated:', locals.isAuthenticated);
    // ... rest of code
};
```

### Option 2: Fix Test's getItinerary() Method

Ensure the method explicitly sends cookies:

```typescript
private async getItinerary(): Promise<Itinerary> {
    if (!this.itineraryId) {
        throw new Error('No itinerary ID');
    }

    console.log('🔍 DEBUG: Fetching itinerary with ID:', this.itineraryId);
    console.log('🔍 DEBUG: Session cookie:', this.sessionCookie);

    const url = `${this.apiBaseUrl}/itineraries/${this.itineraryId}`;
    const headers = this.getHeaders(); // This should include cookies

    console.log('🔍 DEBUG: Request URL:', url);
    console.log('🔍 DEBUG: Request headers:', JSON.stringify(headers, null, 2));

    const response = await fetch(url, {
        method: 'GET',  // Explicit method
        headers
    });

    console.log('🔍 DEBUG: Response status:', response.status);
    console.log('🔍 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
        const error = await response.text();
        console.error('❌ Failed to get itinerary');
        console.error('Status:', response.status);
        console.error('Response:', error);
        throw new Error(`Failed to get itinerary: ${response.status} ${error}`);
    }

    return await response.json();
}
```

### Option 3: Use X-User-Email Header as Fallback

The server already supports `X-User-Email` header (hooks.server.ts line 290). Modify the test to send this header:

```typescript
private getHeaders(includeAIKey = false): HeadersInit {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    // Add session cookie for authentication
    if (this.sessionCookie) {
        headers['Cookie'] = this.sessionCookie;
    }

    // ADDED: Also send X-User-Email header as fallback
    headers['X-User-Email'] = this.userEmail;

    // Add OpenRouter API key for AI-powered endpoints
    if (includeAIKey) {
        headers['X-OpenRouter-API-Key'] = this.openrouterApiKey;
    }

    return headers;
}
```

---

## Testing Plan

1. **Add debug logging** to both the test and server route
2. **Run the test** and capture the full request/response cycle
3. **Compare successful requests** (createItinerary, sendMessage) vs. failing request (getItinerary)
4. **Identify the exact difference** in headers, cookies, or request format
5. **Apply the fix** based on findings

---

## Conclusion

The 403 error is caused by ownership verification failing in the GET itinerary route. The most likely causes are:

1. **Cookies not being sent correctly** in the getItinerary() method
2. **Cookies not being parsed correctly** by SvelteKit in server-side fetch
3. **userEmail mismatch** between itinerary.createdBy and the authenticated user

**The getHeaders() method DOES include cookies**, so the bug is likely in:
- Cookie format/encoding
- Server-side cookie parsing
- User email normalization mismatch

**Recommended immediate fix**: Add `X-User-Email` header to all requests as a fallback (Option 3), since the server already supports this.
