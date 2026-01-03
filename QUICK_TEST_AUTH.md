# Quick Test Guide - Authentication Fix

## Quick Start

```bash
# Make sure dev server is running
cd viewer-svelte && npm run dev

# In another terminal, run quick cookie test
node test-auth-cookies.js

# Run full E2E test with debug output
npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker
```

## What Was Fixed

The test was only capturing **one** of the two authentication cookies:
- ❌ Before: Only `itinerator_session` was captured
- ✅ After: Both `itinerator_session` AND `itinerator_user_email` are captured

## Changes Made

File: `tests/e2e/traveler-persona-agent.ts`

1. **Use `getSetCookie()` API** to get all Set-Cookie headers
2. **Parse both cookies** from the response
3. **Fallback**: If email cookie not sent, construct it manually
4. **Debug logging**: Added comprehensive logging to trace the issue

## Expected Debug Output

### ✅ Success Pattern

```
🔐 Authenticating as test@test.com...

🔍 DEBUG: Authentication Response Headers
Status: 200
Set-Cookie (via getSetCookie()): [
  "itinerator_session=authenticated; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax",
  "itinerator_user_email=test%40test.com; Max-Age=604800; Path=/; SameSite=Lax"
]
✅ Session cookie stored: itinerator_session=authenticated; itinerator_user_email=test%40test.com

✅ Authenticated successfully

🎭 Alex the Backpacker - Creating itinerary...
🔍 DEBUG: Cookie header being sent: itinerator_session=authenticated; itinerator_user_email=test%40test.com

✅ Itinerary created: abc-123-xyz

🎭 Creating Trip Designer session...
🔍 DEBUG: Cookie header being sent: itinerator_session=authenticated; itinerator_user_email=test%40test.com

✅ Session created: session-456
```

### ❌ Failure Pattern (Old Behavior)

```
🔍 DEBUG: Authentication Response Headers
Set-Cookie (via get()): itinerator_session=authenticated; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
⚠️  Server did not send itinerator_user_email cookie, constructing manually
✅ Session cookie stored: itinerator_session=authenticated; itinerator_user_email=test%40test.com

🔍 DEBUG: Cookie header being sent: itinerator_session=authenticated; itinerator_user_email=test%40test.com

❌ Failed to create session: 404
Response: {"error":"Itinerary not found"}
```

## Node.js Version

The `getSetCookie()` method requires **Node.js >= 19.7.0**

Check version:
```bash
node --version
```

If using older Node.js, the code will:
1. Fall back to `get('set-cookie')` (gets only first cookie)
2. Construct the email cookie manually
3. Still work, but with a warning message

## Files Modified

- ✅ `tests/e2e/traveler-persona-agent.ts` - Fixed authentication + debug logging
- 📄 `DEBUG_AUTH_ISSUE.md` - Detailed documentation
- 🧪 `test-auth-cookies.js` - Quick verification script
- 📋 `QUICK_TEST_AUTH.md` - This guide

## Next Steps

1. Run `node test-auth-cookies.js` to verify cookie handling
2. Run E2E test: `npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker`
3. Check debug output matches success pattern above
4. Remove debug logging once verified (optional)
