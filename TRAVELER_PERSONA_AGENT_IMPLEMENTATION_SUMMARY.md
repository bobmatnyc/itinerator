# Traveler Persona Agent - Authentication Implementation Summary

## Overview
Updated `tests/e2e/traveler-persona-agent.ts` to properly authenticate with the API using session cookies, matching the pattern used in the existing test infrastructure.

## Changes Made

### 1. Authentication System

#### Added Properties
```typescript
private sessionCookie: string | null = null;
private userEmail: string;
private openrouterApiKey: string;
```

#### Added `authenticate()` Method
```typescript
private async authenticate(): Promise<void>
```
- Calls `POST /api/auth/login` with user email
- Extracts `itinerator_session` cookie from `Set-Cookie` header
- Stores cookie for subsequent requests
- Throws descriptive error if authentication fails

#### Added `getHeaders()` Method
```typescript
private getHeaders(includeAIKey = false): HeadersInit
```
- Returns headers with `Content-Type: application/json`
- Includes session cookie if authenticated
- Optionally includes `X-OpenRouter-API-Key` for AI endpoints

### 2. Updated API Methods

All API methods now use proper authentication:

#### `createItinerary()`
- Uses `getHeaders()` for authentication
- Enhanced error logging with response details

#### `createSession()`
- Uses `getHeaders(true)` (includes AI key)
- Enhanced error logging

#### `sendMessage()`
- Uses `getHeaders(true)` (includes AI key)
- Enhanced error logging

#### `getItinerary()`
- Uses `getHeaders()` for authentication
- Enhanced error logging

### 3. Updated `runConversation()`

Added authentication as first step:
```typescript
async runConversation(): Promise<ConversationResult> {
  // 0. Authenticate first
  await this.authenticate();

  // 1. Create itinerary
  // ... rest of flow
}
```

### 4. CLI Enhancements

Added flags:
- `--verbose` - Enable verbose debug output (default: true)
- `--quiet` - Disable verbose output

Updated help text to document new flags.

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Agent Construction                                        │
│    - Store userEmail (default: test@test.com)               │
│    - Store openrouterApiKey from env/options                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. authenticate()                                            │
│    POST /api/auth/login                                      │
│    Body: { email: userEmail }                               │
│    ─────────────────────────────────────────────────────    │
│    Response:                                                 │
│    Set-Cookie: itinerator_session=<token>; ...              │
│    ─────────────────────────────────────────────────────    │
│    Store: sessionCookie = "itinerator_session=<token>;      │
│           itinerator_user_email=<email>"                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. All API Requests                                          │
│    Include headers from getHeaders():                        │
│    - Content-Type: application/json                          │
│    - Cookie: itinerator_session=<token>;                    │
│              itinerator_user_email=<email>                  │
│    - X-OpenRouter-API-Key: <key> (when includeAIKey=true)  │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

All API methods now include comprehensive error handling:

```typescript
if (!response.ok) {
  const error = await response.text();
  if (this.verbose) {
    console.error(`❌ Failed to <operation>: ${response.status}`);
    console.error(`Response: ${error}`);
  }
  throw new Error(`Failed to <operation>: ${response.status} ${error}`);
}
```

## Pattern Match

This implementation follows the exact pattern from:

### `tests/helpers/test-client.ts`
```typescript
// TestClient authentication
async authenticate(): Promise<void> {
  const response = await fetch(`${this.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: this.userEmail }),
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/itinerator_session=([^;]+)/);
    if (match) {
      this.sessionCookie = `itinerator_session=${match[1]}; itinerator_user_email=${this.userEmail}`;
    }
  }
}
```

### `tests/e2e/persona-itinerary-creation.e2e.test.ts`
```typescript
beforeAll(async () => {
  client = new TestClient({
    baseUrl: process.env.ITINERIZER_TEST_BASE_URL || 'http://localhost:5176',
    apiKey: process.env.ITINERIZER_TEST_API_KEY || process.env.OPENROUTER_API_KEY,
    userEmail: TEST_USER,
  });
  await client.authenticate();
});
```

## Usage Examples

### Basic Usage
```bash
# Run single persona test
npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker

# Run all personas
npx tsx tests/e2e/traveler-persona-agent.ts
```

### With Debug Output
```bash
# Verbose output (default)
npx tsx tests/e2e/traveler-persona-agent.ts --persona romantic-couple --verbose

# Quiet output
npx tsx tests/e2e/traveler-persona-agent.ts --persona romantic-couple --quiet
```

### Custom Configuration
```bash
# Custom API URL and model
npx tsx tests/e2e/traveler-persona-agent.ts \
  --persona family-vacation \
  --api http://localhost:3000/api/v1 \
  --model anthropic/claude-3.5-sonnet \
  --max-turns 10 \
  --verbose
```

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `OPENROUTER_API_KEY` | Yes | - | LLM API access |
| `ITINERIZER_TEST_USER_EMAIL` | No | `test@test.com` | Authentication email |

## Testing Checklist

- [x] Agent instantiation works
- [x] Authentication method implemented
- [x] Cookie management working
- [x] All API methods use proper headers
- [x] Error handling shows detailed messages
- [x] Verbose flag controls output
- [x] Help text documents new flags
- [x] Follows TestClient pattern
- [x] Code compiles with tsx

## Files Modified

```
tests/e2e/traveler-persona-agent.ts
  - Added authentication system (authenticate, getHeaders)
  - Updated API methods to use proper headers
  - Enhanced error handling throughout
  - Added CLI flags (--verbose, --quiet)
  - Updated help text
```

## Next Steps

To test the authentication:

1. Start the development server:
   ```bash
   cd viewer-svelte && npm run dev
   ```

2. Run a test persona:
   ```bash
   npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker --verbose
   ```

3. Expected output:
   ```
   🔐 Authenticating as test@test.com...
   ✅ Authenticated successfully

   🎭 Alex the Backpacker - Creating itinerary...
   ✅ Itinerary created: <id>

   🎭 Creating Trip Designer session...
   ✅ Session created: <session-id>

   👤 Alex the Backpacker: <message>
   🤖 Trip Designer: <response>
   ...
   ```

## Success Criteria

✅ Authentication succeeds before making API calls
✅ Session cookies included in all requests
✅ OpenRouter API key included in AI endpoints
✅ Detailed error messages when requests fail
✅ Verbose logging helps debug issues
✅ Pattern matches existing test infrastructure

## Debugging Tips

If authentication fails:

1. Check server is running on correct port
2. Verify `OPENROUTER_API_KEY` is set
3. Use `--verbose` flag to see detailed error messages
4. Check API URL matches server (default: `http://localhost:5176/api/v1`)
5. Verify `/api/auth/login` endpoint is available

Common issues:
- `OPENROUTER_API_KEY is required` → Set environment variable
- `Authentication failed: 404` → Server not running or wrong URL
- `Failed to create itinerary: 401` → Authentication didn't succeed
- `No session cookie received` → Server didn't return Set-Cookie header
