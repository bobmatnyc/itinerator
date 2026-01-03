# Traveler Persona Agent Authentication Fix

## Problem
The `TravelerPersonaAgent` class in `tests/e2e/traveler-persona-agent.ts` was failing due to authentication issues. API requests were being made without proper session cookies, causing 401/403 errors.

## Root Cause
The agent was making API requests without:
1. Authenticating with the server first
2. Including session cookies in requests
3. Proper error handling to show what went wrong

## Solution

### 1. Added Authentication Support
- Added `authenticate()` method that:
  - Calls `/api/auth/login` with user email
  - Extracts session cookie from response headers
  - Stores cookie for subsequent requests

### 2. Cookie Management
- Added `sessionCookie` property to store authentication state
- Added `userEmail` property (default: `test@test.com`)
- Added `openrouterApiKey` property for API key management

### 3. Header Management
- Added `getHeaders(includeAIKey?)` method that:
  - Returns proper headers for API requests
  - Includes session cookie when available
  - Optionally includes OpenRouter API key for AI endpoints

### 4. Updated All API Methods
Updated the following methods to use proper authentication:
- `createItinerary()` - Now uses `getHeaders()`
- `createSession()` - Now uses `getHeaders(true)` (includes AI key)
- `sendMessage()` - Now uses `getHeaders(true)` (includes AI key)
- `getItinerary()` - Now uses `getHeaders()`

### 5. Enhanced Error Handling
All API methods now include:
- Verbose error logging (when `--verbose` flag is set)
- Full error response text
- HTTP status codes in error messages

### 6. Added CLI Flags
- `--verbose` - Enable verbose debug output (default: true)
- `--quiet` - Disable verbose output

## Authentication Flow

```
1. Agent Construction
   ↓
2. authenticate()
   - POST /api/auth/login
   - Extract session cookie
   ↓
3. createItinerary()
   - POST /api/v1/itineraries
   - Include: Cookie header
   ↓
4. createSession()
   - POST /api/v1/designer/sessions
   - Include: Cookie + X-OpenRouter-API-Key headers
   ↓
5. sendMessage() / getItinerary()
   - Include proper headers for all requests
```

## Cookie Format

```
Cookie: itinerator_session=<session_token>; itinerator_user_email=test@test.com
```

## Usage

```bash
# Run with verbose output (default)
npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker

# Run with quiet output
npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker --quiet

# Test specific persona with debugging
npx tsx tests/e2e/traveler-persona-agent.ts --persona romantic-couple --verbose
```

## Testing

The agent now properly:
1. ✅ Authenticates before making requests
2. ✅ Includes session cookies in all API calls
3. ✅ Includes OpenRouter API key for AI endpoints
4. ✅ Shows detailed error messages when requests fail
5. ✅ Supports verbose logging for debugging

## Files Changed

- `tests/e2e/traveler-persona-agent.ts`
  - Added authentication methods
  - Updated API methods to use proper headers
  - Enhanced error handling
  - Added CLI flag support

## Pattern Match

This implementation matches the pattern used in:
- `tests/helpers/test-client.ts` - Uses same authentication flow
- `tests/e2e/persona-itinerary-creation.e2e.test.ts` - Uses TestClient with authentication

## Environment Variables

The agent respects these environment variables:
- `OPENROUTER_API_KEY` - Required for LLM API access
- `ITINERIZER_TEST_USER_EMAIL` - Optional, defaults to `test@test.com`
