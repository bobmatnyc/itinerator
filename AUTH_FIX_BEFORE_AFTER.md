# Authentication Fix: Before vs After

## The Problem

When `response.headers.get('set-cookie')` is called, it only returns the **first** Set-Cookie header, not all of them.

The server sends TWO cookies:
```http
HTTP/1.1 200 OK
set-cookie: itinerator_session=authenticated; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
set-cookie: itinerator_user_email=test%40test.com; Max-Age=604800; Path=/; SameSite=Lax
```

## Before Fix

### Code
```typescript
// ❌ WRONG: Only captures first cookie
const setCookie = response.headers.get('set-cookie');
if (setCookie) {
  const match = setCookie.match(/itinerator_session=([^;]+)/);
  if (match) {
    this.sessionCookie = `itinerator_session=${match[1]}; itinerator_user_email=${encodeURIComponent(this.userEmail)}`;
  }
}
```

### What Happened
1. `get('set-cookie')` returns: `"itinerator_session=authenticated; ..."`
2. Only session cookie is captured
3. Email cookie is **manually constructed** (may not match server's value)
4. Different encoding or format causes user mismatch

### Symptoms
```
✅ Itinerary created: abc-123
   Owner: some-random-user@example.com  ← Wrong user!

❌ Failed to create session: 404
   Error: Itinerary not found
```

## After Fix

### Code
```typescript
// ✅ CORRECT: Captures all cookies
const allCookies: string[] = [];
if (typeof response.headers.getSetCookie === 'function') {
  // Modern API: returns array of all Set-Cookie headers
  allCookies.push(...response.headers.getSetCookie());
} else {
  // Fallback for older Node.js
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) allCookies.push(setCookie);
}

// Extract both cookies
let sessionValue = '';
let emailValue = '';

for (const cookieHeader of allCookies) {
  const sessionMatch = cookieHeader.match(/itinerator_session=([^;]+)/);
  const emailMatch = cookieHeader.match(/itinerator_user_email=([^;]+)/);

  if (sessionMatch) sessionValue = sessionMatch[1];
  if (emailMatch) emailValue = emailMatch[1];
}

// Build cookie string
if (!emailValue) {
  emailValue = encodeURIComponent(this.userEmail);
}
this.sessionCookie = `itinerator_session=${sessionValue}; itinerator_user_email=${emailValue}`;
```

### What Happens Now
1. `getSetCookie()` returns: `["itinerator_session=...", "itinerator_user_email=..."]`
2. Both cookies are captured
3. Email cookie uses **exact server value**
4. User authentication is consistent

### Result
```
✅ Itinerary created: abc-123
   Owner: test@test.com  ← Correct user!

✅ Session created: session-456
   Itinerary found and loaded
```

## Debug Comparison

### Before (Failure)
```
🔍 DEBUG: Authentication Response Headers
Set-Cookie (via get()): itinerator_session=authenticated; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax

⚠️  Only one cookie captured!
✅ Session cookie stored: itinerator_session=authenticated; itinerator_user_email=test%40test.com

[Later...]
❌ Failed to create session: 404 Itinerary not found
```

### After (Success)
```
🔍 DEBUG: Authentication Response Headers
Set-Cookie (via getSetCookie()): [
  "itinerator_session=authenticated; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax",
  "itinerator_user_email=test%40test.com; Max-Age=604800; Path=/; SameSite=Lax"
]

✅ Both cookies captured!
✅ Session cookie stored: itinerator_session=authenticated; itinerator_user_email=test%40test.com

[Later...]
✅ Session created successfully
```

## API Reference

### `response.headers.get('set-cookie')`
- ❌ Returns only the **first** Set-Cookie header
- ❌ Misses additional cookies
- ✅ Works in all Node.js versions

### `response.headers.getSetCookie()`
- ✅ Returns **all** Set-Cookie headers as array
- ✅ Captures multiple cookies correctly
- ⚠️  Requires Node.js >= 19.7.0

## Key Takeaway

**Always use `getSetCookie()` when handling authentication responses that set multiple cookies.**

If supporting older Node.js, implement fallback but ensure both cookies are sent in subsequent requests.
