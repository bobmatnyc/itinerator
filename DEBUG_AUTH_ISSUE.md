# Debug Authentication Issue in E2E Tests

## Summary

**Fixed**: Updated `tests/e2e/traveler-persona-agent.ts` to properly capture and send both authentication cookies (`itinerator_session` and `itinerator_user_email`) using the `getSetCookie()` API with fallback support.

## Problem

Itineraries are being created but with a different user than expected. When creating a session, the itinerary is not found because it belongs to a different user.

## Root Cause Analysis

The issue is likely that **only one cookie is being captured** from the authentication response. The server returns TWO cookies:

```
set-cookie: itinerator_session=authenticated; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
set-cookie: itinerator_user_email=test%40test.com; Max-Age=604800; Path=/; SameSite=Lax
```

**The problem**: `response.headers.get('set-cookie')` only returns the **first** cookie header, not all of them.

## Fix Applied

Updated `tests/e2e/traveler-persona-agent.ts` with:

1. **Use `getSetCookie()` method** (newer Fetch API):
   - This method returns ALL Set-Cookie headers as an array
   - Falls back to `get('set-cookie')` if not available

2. **Parse both cookies**:
   - Extract `itinerator_session` value
   - Extract `itinerator_user_email` value
   - If email cookie not found, construct it manually from `userEmail`

3. **Comprehensive debug logging**:
   - Log raw Set-Cookie headers received
   - Log the session cookie being stored
   - Log Cookie header being sent in each request
   - Log full request/response details for create itinerary
   - Log full request/response details for create session

## Debug Output to Check

When running the test, look for:

### 1. Authentication Phase
```
🔍 DEBUG: Authentication Response Headers
Status: 200
Set-Cookie (via getSetCookie()): [
  "itinerator_session=authenticated; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax",
  "itinerator_user_email=test%40test.com; Max-Age=604800; Path=/; SameSite=Lax"
]
✅ Session cookie stored: itinerator_session=authenticated; itinerator_user_email=test%40test.com
```

### 2. Create Itinerary Phase
```
🔍 DEBUG: Cookie header being sent: itinerator_session=authenticated; itinerator_user_email=test%40test.com

🔍 DEBUG: Creating itinerary
URL: http://localhost:5176/api/v1/itineraries
Headers: {
  "Content-Type": "application/json",
  "Cookie": "itinerator_session=authenticated; itinerator_user_email=test%40test.com"
}
```

### 3. Create Session Phase
```
🔍 DEBUG: Cookie header being sent: itinerator_session=authenticated; itinerator_user_email=test%40test.com

🔍 DEBUG: Creating session
URL: http://localhost:5176/api/v1/designer/sessions
Itinerary ID: abc-123-xyz
Headers: {
  "Content-Type": "application/json",
  "Cookie": "itinerator_session=authenticated; itinerator_user_email=test%40test.com",
  "X-OpenRouter-API-Key": "..."
}
```

## Expected Behavior

- **Authentication**: Should capture both `itinerator_session` and `itinerator_user_email` cookies
- **Create Itinerary**: Should send both cookies, creating itinerary for `test@test.com`
- **Create Session**: Should send both cookies, finding the itinerary created in previous step
- **No errors**: Session creation should succeed because itinerary belongs to the same user

## Testing

Run the test with a single persona:

```bash
cd /Users/masa/Projects/itinerator
npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker
```

## What to Look For

### ✅ Success Indicators:
1. Both cookies captured in authentication
2. Both cookies sent in subsequent requests
3. Itinerary created successfully
4. Session created successfully (no "itinerary not found" error)

### ❌ Failure Indicators:
1. Only one cookie captured: `Set-Cookie (via get()): itinerator_session=...`
2. Warning: "Server did not send itinerator_user_email cookie, constructing manually"
3. Error: "Failed to create session: 404 Itinerary not found"
4. Different user IDs in itinerary vs session

## Browser vs Node.js Fetch API

**Important**: The `getSetCookie()` method was added in Node.js 19.7.0 for the Fetch API. If using an older Node version, it may fall back to the single-cookie behavior.

Check Node version:
```bash
node --version  # Should be >= 19.7.0
```

## Alternative Fix (if getSetCookie not available)

If `getSetCookie()` is not available, we construct the email cookie manually:
```typescript
if (!emailValue) {
  emailValue = encodeURIComponent(this.userEmail);
  console.log('⚠️  Server did not send itinerator_user_email cookie, constructing manually');
}
```

This ensures both cookies are always sent, even if we only capture the session cookie from the server.
