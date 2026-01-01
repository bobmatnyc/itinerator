# Itinerizer Authentication and OpenRouter API Key Management

**Research Date:** 2025-12-23
**Researcher:** Research Agent
**Purpose:** Understand authentication system and API key management for implementing localhost/demo mode gating

---

## 1. Authentication System

### 1.1 Login Flow

**Login Route:** `/viewer-svelte/src/routes/login/+page.svelte`

**Key Components:**
- Email-based authentication (no user accounts, just email for scoping)
- Password validation (in password mode only)
- Auto-detection of development vs. production mode

**Authentication Modes:**

```typescript
// Auto-detect based on environment
function getAuthMode(): 'password' | 'open' {
  // Explicit override via PUBLIC_AUTH_MODE env var
  const authMode = env.PUBLIC_AUTH_MODE;
  if (authMode === 'password' || authMode === 'open') {
    return authMode;
  }

  // Auto-detect: production requires password, development is open
  return import.meta.env.PROD ? 'password' : 'open';
}
```

**Detection Logic:**
- `PUBLIC_AUTH_MODE` env var takes precedence
- Falls back to `import.meta.env.PROD` (SvelteKit production mode)
- `PROD = true` → password mode
- `PROD = false` → open mode (no password required)

### 1.2 Password Verification

**Server-Side Route:** `/viewer-svelte/src/routes/api/auth/login/+server.ts`

**Password Check (Password Mode Only):**
```typescript
if (authMode === 'password') {
  const authPassword = privateEnv.AUTH_PASSWORD;
  if (!authPassword) {
    return error(500, 'Authentication not configured');
  }

  if (password !== authPassword) {
    return error(401, 'Invalid password');
  }
}
```

**Environment Variable:**
- `AUTH_PASSWORD` - Single demo password (server-side env var)
- Checked against plain text password from login form
- Only validated when `authMode === 'password'`

### 1.3 Session Management

**Session Storage:**
- Cookie: `itinerator_session` (value: `"authenticated"`)
- Cookie: `itinerator_user_email` (user's email address)
- HttpOnly: Yes (session cookie), No (email cookie for client-side access)
- Secure: Only in production (`import.meta.env.PROD`)
- Max Age: 7 days

**Client-Side Store:** `/viewer-svelte/src/lib/stores/auth.svelte.ts`

**Deprecated Client-Side Validation:**
```typescript
// IMPORTANT: This password hash is DEPRECATED
// It's still in auth.svelte.ts but NOT USED for actual login
const VALID_PASSWORD_HASH = '1003766e45ffdcbacdbfdedaf03034eee6b6a9b7cb8f0e47c49ed92f952dbad5';
```

**Note:** The client-side password hash is legacy code. Login validation now happens server-side only via `/api/auth/login`.

### 1.4 Server-Side Authentication Hook

**Hook:** `/viewer-svelte/src/hooks.server.ts`

**Authentication Check:**
```typescript
// Check for session cookie
const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);
event.locals.isAuthenticated = sessionCookie === SESSION_SECRET;

// Get user email from cookie
event.locals.userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME) || null;

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/auth', '/api/health'];

// Redirect to login if not authenticated
if (!event.locals.isAuthenticated && !isPublicRoute) {
  // API routes return 401
  if (event.url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401
    });
  }

  // Page routes redirect to login
  return new Response(null, {
    status: 302,
    headers: { location: '/login' }
  });
}
```

---

## 2. Profile/Settings Page

### 2.1 Profile Page Location

**Route:** `/viewer-svelte/src/routes/profile/+page.svelte`

**Features:**
- User profile information (first name, last name, nickname)
- Home airport preference (3-letter IATA code)
- **OpenRouter API Key input**
- Save/update settings
- Logout functionality

### 2.2 OpenRouter API Key Input

**UI Component:**
```svelte
<!-- API Key Form -->
<div class="form-group">
  <label for="apiKey" class="form-label">API Key</label>
  <div class="input-with-button">
    <input
      id="apiKey"
      type={showKey ? 'text' : 'password'}
      class="form-input"
      bind:value={apiKey}
      placeholder="sk-or-v1-..."
      autocomplete="off"
    />
    <button type="button" class="toggle-button" onclick={toggleShowKey}>
      <!-- Eye icon to show/hide key -->
    </button>
  </div>
  <p class="input-hint">
    Get your API key from
    <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>
  </p>
</div>
```

**Save Handler:**
```typescript
function handleSave() {
  settingsStore.updateSettings({
    firstName,
    lastName,
    nickname,
    openRouterKey: apiKey,  // API key saved here
    homeAirport
  });

  saveSuccess = true;
}
```

---

## 3. API Key Storage

### 3.1 Settings Store

**Store:** `/viewer-svelte/src/lib/stores/settings.svelte.ts`

**Storage Mechanism:**
- **Client-side only:** localStorage (browser)
- **Storage key:** `itinerator_settings`
- **Legacy key:** `itinerator_api_key` (migrated to unified storage)

**Data Structure:**
```typescript
interface SettingsData {
  firstName: string;
  lastName: string;
  nickname: string;
  openRouterKey: string;  // API key stored here
  homeAirport: string;
}
```

**Save to localStorage:**
```typescript
private saveSettings(): void {
  if (!isBrowser) return;

  const data: SettingsData = {
    firstName: this.firstName,
    lastName: this.lastName,
    nickname: this.nickname,
    openRouterKey: this.openRouterKey,  // Stored in localStorage
    homeAirport: this.homeAirport
  };

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
}
```

**Load from localStorage:**
```typescript
loadSettings(): void {
  if (!isBrowser) return;

  // Try loading from new unified storage
  const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (storedSettings) {
    const data: SettingsData = JSON.parse(storedSettings);
    this.openRouterKey = data.openRouterKey || '';
    // ... load other fields
    return;
  }

  // Migrate from legacy storage if available
  const legacyKey = localStorage.getItem(LEGACY_API_KEY_STORAGE_KEY);
  if (legacyKey) {
    this.openRouterKey = legacyKey;
    this.saveSettings();
    localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
  }
}
```

### 3.2 API Key Access Patterns

**Multiple Access Methods:**
1. `settingsStore.openRouterKey` - Direct rune access
2. `settingsStore.getApiKey()` - Method access (backward compatibility)
3. `settingsStore.apiKey` - Getter access (backward compatibility)

**Direct localStorage Read (for non-component contexts):**
```typescript
// Used in api.ts and ChatPanel.svelte
function getOpenRouterApiKey(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // Try new unified storage first
    const settings = localStorage.getItem('itinerator_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.openRouterKey) return parsed.openRouterKey;
    }

    // Fall back to legacy storage
    return localStorage.getItem('itinerator_api_key');
  } catch {
    return null;
  }
}
```

---

## 4. API Key Usage in API Routes

### 4.1 Client-to-Server Transmission

**API Client:** `/viewer-svelte/src/lib/api.ts`

**Header Injection:**
```typescript
function getAIHeaders(): HeadersInit {
  const headers = { ...getBaseHeaders() };

  const apiKey = getOpenRouterApiKey();  // Read from localStorage
  if (apiKey) {
    headers['X-OpenRouter-API-Key'] = apiKey;  // Send as HTTP header
  }

  return headers;
}
```

**Usage in API Calls:**
```typescript
// Create chat session
async createChatSession(itineraryId?: string): Promise<{ sessionId: string }> {
  const response = await fetch(`/api/v1/designer/sessions`, {
    method: 'POST',
    headers: getAIHeaders(),  // Includes X-OpenRouter-API-Key
    body: JSON.stringify({ itineraryId }),
  });
  return handleResponse(response);
}

// Send streaming chat message
async *sendChatMessageStream(sessionId: string, message: string) {
  const response = await fetch(`/api/v1/designer/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers: getAIHeaders(),  // Includes X-OpenRouter-API-Key
    body: JSON.stringify({ message }),
  });
  // ... SSE stream handling
}
```

### 4.2 Server-Side API Key Handling

**Trip Designer Route:** `/viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/messages/stream/+server.ts`

**API Key Priority:**
1. **Client-provided key** (via `X-OpenRouter-API-Key` header) - highest priority
2. **Server env key** (via `OPENROUTER_API_KEY` env var) - fallback

**Key Extraction:**
```typescript
export const POST: RequestHandler = async ({ params, request, locals }) => {
  // Get API key from header or use cached service
  const headerApiKey = request.headers.get('X-OpenRouter-API-Key');
  let tripDesignerService = locals.services.tripDesignerService;

  // Validate API key from header (reject empty/whitespace keys)
  if (headerApiKey !== null && headerApiKey.trim() === '') {
    throw error(400, {
      message: 'Invalid API key: API key cannot be empty. Please add your OpenRouter API key in Profile settings.'
    });
  }

  // Create on-demand service if header key provided
  if (headerApiKey) {
    tripDesignerService = await createTripDesignerWithKey(headerApiKey, locals.services);
  }

  if (!tripDesignerService) {
    throw error(503, {
      message: 'Trip Designer disabled: No API key provided. Set your OpenRouter API key in Profile settings.'
    });
  }

  // ... use tripDesignerService
};
```

**Service Initialization:** `/viewer-svelte/src/hooks.server.ts`

```typescript
// Trip Designer service - requires OPENROUTER_API_KEY
let tripDesignerService: TripDesignerService | null = null;
const tripDesignerApiKey = process.env.OPENROUTER_API_KEY;

if (tripDesignerApiKey) {
  // Initialize with server env key
  tripDesignerService = new TripDesignerServiceClass(
    { apiKey: tripDesignerApiKey },
    globalSessionStorage,
    { itineraryService, segmentService, ... }
  );
  console.log('✅ Trip Designer service initialized');
} else {
  console.log('⚠️  Trip Designer service disabled (no OPENROUTER_API_KEY)');
}
```

**On-Demand Service Creation (Client Key):**
```typescript
export async function createTripDesignerWithKey(
  apiKey: string,
  services: Services
): Promise<TripDesignerService> {
  // Check cache first
  const cached = tripDesignerCache.get(apiKey);
  if (cached) return cached;

  // Create new service with client-provided key
  const service = new TripDesignerServiceClass(
    { apiKey },
    globalSessionStorage,
    { itineraryService, segmentService, ... }
  );

  // Cache for reuse
  tripDesignerCache.set(apiKey, service);
  return service;
}
```

### 4.3 Import Text Route (Alternative Pattern)

**Route:** `/viewer-svelte/src/routes/api/v1/import/text/+server.ts`

**API Key in Request Body:**
```typescript
interface TextImportRequest {
  title: string;
  text: string;
  apiKey: string;  // API key sent in POST body
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const body: TextImportRequest = await request.json();
  const { title, text, apiKey } = body;

  // Validate API key
  if (!apiKey || !apiKey.trim()) {
    throw error(400, { message: 'API key is required' });
  }

  // Create LLM service instance with provided API key
  const llmService = new LLMService({
    apiKey: apiKey.trim(),
    costTrackingEnabled: false,
  });

  // Use llmService for parsing
  const llmResult = await llmService.parseItinerary(text.trim());
  // ...
};
```

**Note:** This route uses body-based API key (not header-based).

### 4.4 PDF Import Route

**Route:** `/viewer-svelte/src/routes/api/v1/agent/import/pdf/+server.ts`

**Server Env Key Only:**
```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  const { importService } = locals.services;

  if (!importService) {
    throw error(503, {
      message: 'Import disabled: OPENROUTER_API_KEY not configured - import functionality is disabled'
    });
  }

  // importService already initialized with server OPENROUTER_API_KEY
  const result = await importService.importWithValidation(filePath, {
    model: model || undefined,
    saveToStorage: true,
    validateContinuity: true,
    fillGaps: true
  });
  // ...
};
```

**Note:** PDF import relies on server `OPENROUTER_API_KEY` env var only (no client key support).

---

## 5. AI Features Requiring API Key

### 5.1 Trip Designer (Chat)

**Routes:**
- `POST /api/v1/designer/sessions` - Create chat session
- `POST /api/v1/designer/sessions/:id/messages` - Send message
- `POST /api/v1/designer/sessions/:id/messages/stream` - Send message with SSE streaming

**API Key Support:**
- ✅ Client key (via `X-OpenRouter-API-Key` header)
- ✅ Server key (via `OPENROUTER_API_KEY` env var)

**Service:** `TripDesignerService`

**Error Handling:**
```typescript
// In ChatPanel.svelte (client-side)
const apiKey = getApiKeyFromStorage();
if (!apiKey || apiKey.trim() === '') {
  chatError.set('No OpenRouter API key configured. Please add your API key in Profile settings.');
  return;
}

// In +server.ts (server-side)
if (!tripDesignerService) {
  throw error(503, {
    message: 'Trip Designer disabled: No API key provided. Set your OpenRouter API key in Profile settings.'
  });
}
```

### 5.2 Import PDF

**Route:** `POST /api/v1/agent/import/pdf`

**API Key Support:**
- ❌ Client key (not supported)
- ✅ Server key (via `OPENROUTER_API_KEY` env var)

**Service:** `DocumentImportService`

**Error Handling:**
```typescript
if (!importService) {
  throw error(503, {
    message: 'Import disabled: OPENROUTER_API_KEY not configured - import functionality is disabled'
  });
}
```

### 5.3 Import Text

**Route:** `POST /api/v1/import/text`

**API Key Support:**
- ✅ Client key (via request body)
- ❌ Server key (not used)

**Service:** `LLMService` (created on-demand)

**Error Handling:**
```typescript
if (!apiKey || !apiKey.trim()) {
  throw error(400, { message: 'API key is required' });
}
```

### 5.4 Other AI Features

**Additional AI-powered endpoints:**
- `/api/v1/agent/analyze` - Analyze itinerary
- `/api/v1/agent/summarize` - Summarize itinerary
- `/api/v1/agent/fill-gaps` - Fill gaps in itinerary
- `/api/v1/designer/knowledge/search` - Search knowledge base

**Typical Pattern:**
```typescript
// Check if service is initialized (requires server OPENROUTER_API_KEY)
const { someService } = locals.services;

if (!someService) {
  throw error(503, {
    message: 'Service disabled: OPENROUTER_API_KEY not configured'
  });
}
```

---

## 6. Current Localhost/Demo Detection

### 6.1 Environment Detection

**SvelteKit Production Mode:**
```typescript
// import.meta.env.PROD - SvelteKit build mode
// true: production build (npm run build)
// false: development mode (npm run dev)
```

**Vercel Detection:**
```typescript
// In hooks.server.ts
const isVercel = process.env.VERCEL === '1';
```

**Authentication Mode Detection:**
```typescript
function getAuthMode(): 'password' | 'open' {
  // Explicit override
  const authMode = env.PUBLIC_AUTH_MODE;
  if (authMode === 'password' || authMode === 'open') {
    return authMode;
  }

  // Auto-detect
  return import.meta.env.PROD ? 'password' : 'open';
}
```

### 6.2 No Explicit Localhost Detection

**Current Situation:**
- No code explicitly checks for `localhost` hostname
- No code checks for `127.0.0.1` or `::1` IP addresses
- No code checks for development port numbers (e.g., 5176)

**Existing Detection is Build-Mode Based:**
- `import.meta.env.PROD` indicates production **build**, not production **deployment**
- A production build can run on localhost
- A development build can run on a public domain (e.g., ngrok, staging server)

### 6.3 Demo Mode Indicators

**No explicit "demo mode" exists, but similar concepts:**

**Open Authentication Mode:**
- When `authMode === 'open'`, no password required
- This is NOT the same as "demo mode with limited features"
- Users can still use all features if they have an API key

**No Server API Key:**
- If `process.env.OPENROUTER_API_KEY` is not set
- AI features like PDF import will be disabled
- But users can still use their own API keys for Trip Designer

---

## 7. Summary

### 7.1 Authentication Architecture

| Component | Implementation | Storage |
|-----------|----------------|---------|
| **Login** | Email + password (password mode) or email only (open mode) | Session cookie |
| **Session** | Cookie-based (`itinerator_session`) | Server + Client |
| **User Identity** | Email address | Cookie (`itinerator_user_email`) |
| **Password** | Server-side validation via `AUTH_PASSWORD` env var | Server env |

### 7.2 API Key Architecture

| Aspect | Implementation | Notes |
|--------|----------------|-------|
| **Storage** | localStorage (`itinerator_settings`) | Client-side only |
| **Transmission** | HTTP header (`X-OpenRouter-API-Key`) | Trip Designer routes |
| **Transmission** | Request body (`apiKey` field) | Import text route |
| **Fallback** | Server env var (`OPENROUTER_API_KEY`) | Trip Designer, PDF import |
| **Priority** | Client key > Server key | For Trip Designer |

### 7.3 AI Feature Gating

| Feature | Client Key Support | Server Key Support | Gating Strategy |
|---------|-------------------|-------------------|-----------------|
| **Trip Designer** | ✅ Yes (header) | ✅ Yes (env) | Client key preferred, falls back to server key |
| **Import PDF** | ❌ No | ✅ Yes (env) | Server key only, disabled if not set |
| **Import Text** | ✅ Yes (body) | ❌ No | Client key required in request body |
| **Other AI** | Varies | ✅ Yes (env) | Typically server key only |

### 7.4 Environment Detection

| Detection Method | Current Usage | Purpose |
|------------------|---------------|---------|
| `import.meta.env.PROD` | Auth mode selection | Production build vs. dev build |
| `process.env.VERCEL` | Service initialization | Vercel deployment detection |
| `PUBLIC_AUTH_MODE` | Auth mode override | Explicit auth mode configuration |
| Localhost detection | ❌ Not used | N/A |

---

## 8. Recommendations for Localhost/Demo Mode Implementation

### 8.1 Detection Strategy

**Option 1: Hostname-based Detection (Client-side)**
```typescript
function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' ||
         hostname === '127.0.0.1' ||
         hostname === '[::1]';
}
```

**Option 2: Environment Variable (Server-side)**
```typescript
// Set PUBLIC_DEMO_MODE=true for demo deployments
const isDemoMode = env.PUBLIC_DEMO_MODE === 'true';
```

**Option 3: Hybrid Approach**
```typescript
function isDemoEnvironment(): boolean {
  // Client-side: check hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }
  }

  // Server-side: check env var
  return env.PUBLIC_DEMO_MODE === 'true';
}
```

### 8.2 Gating Implementation

**Client-Side Gating (UI Level):**
```typescript
// In ChatPanel.svelte
function checkApiKeyAvailability() {
  const apiKey = getApiKeyFromStorage();

  if (isDemoEnvironment() && (!apiKey || apiKey.trim() === '')) {
    // Demo mode without API key
    chatError.set(
      'Demo mode: AI features require an OpenRouter API key. ' +
      'Get your free key at openrouter.ai/keys and add it in Profile settings.'
    );
    return false;
  }

  return true;
}
```

**Server-Side Gating (API Level):**
```typescript
// In hooks.server.ts or route handlers
function getEffectiveApiKey(
  headerKey: string | null,
  isDemoMode: boolean
): string | null {
  // In demo mode, require client key
  if (isDemoMode) {
    if (!headerKey || headerKey.trim() === '') {
      throw error(403, {
        message: 'Demo mode: Please provide your OpenRouter API key in Profile settings to use AI features.'
      });
    }
    return headerKey;
  }

  // In production, allow server key fallback
  return headerKey || process.env.OPENROUTER_API_KEY || null;
}
```

### 8.3 Feature Matrix

| Environment | Server API Key | Client API Key | Behavior |
|-------------|---------------|----------------|----------|
| **Production** | Set | Not required | Use server key for all features |
| **Production** | Not set | Required | Users must provide key |
| **Demo (localhost)** | Ignored | Required | Users must provide key |
| **Demo (PUBLIC_DEMO_MODE)** | Ignored | Required | Users must provide key |

### 8.4 User Experience Improvements

**Profile Page Banner (Demo Mode):**
```svelte
{#if isDemoMode}
  <div class="demo-banner">
    <h3>Demo Mode</h3>
    <p>
      You're using Itinerizer in demo mode. To use AI-powered features like
      Trip Designer and PDF import, you'll need to provide your own OpenRouter API key.
    </p>
    <p>
      Get a free API key at
      <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a>
      (includes $5 free credit).
    </p>
  </div>
{/if}
```

**Trip Designer Locked State:**
```svelte
{#if isDemoMode && !hasApiKey}
  <div class="locked-feature">
    <svg><!-- Lock icon --></svg>
    <h3>API Key Required</h3>
    <p>
      Trip Designer requires an OpenRouter API key in demo mode.
    </p>
    <a href="/profile" class="button">Add API Key</a>
  </div>
{/if}
```

---

## 9. File Reference

### Authentication Files
- `/viewer-svelte/src/routes/login/+page.svelte` - Login UI
- `/viewer-svelte/src/routes/api/auth/login/+server.ts` - Login API
- `/viewer-svelte/src/routes/api/auth/status/+server.ts` - Auth status API
- `/viewer-svelte/src/routes/api/auth/logout/+server.ts` - Logout API
- `/viewer-svelte/src/lib/stores/auth.svelte.ts` - Auth store (client-side)
- `/viewer-svelte/src/hooks.server.ts` - Server auth middleware

### Settings/Profile Files
- `/viewer-svelte/src/routes/profile/+page.svelte` - Profile/settings UI
- `/viewer-svelte/src/lib/stores/settings.svelte.ts` - Settings store (localStorage)

### API Client Files
- `/viewer-svelte/src/lib/api.ts` - API client with header injection
- `/viewer-svelte/src/lib/stores/chat.ts` - Chat store (uses API client)

### API Route Files (Server-Side)
- `/viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/messages/stream/+server.ts` - Trip Designer streaming
- `/viewer-svelte/src/routes/api/v1/import/text/+server.ts` - Text import
- `/viewer-svelte/src/routes/api/v1/agent/import/pdf/+server.ts` - PDF import
- `/viewer-svelte/src/hooks.server.ts` - Service initialization

### UI Components
- `/viewer-svelte/src/lib/components/ChatPanel.svelte` - Trip Designer chat UI

---

## 10. Key Insights

### 10.1 Current Strengths
1. **Flexible API key handling** - Supports both client and server keys
2. **Clear error messages** - Users know when API key is missing
3. **Graceful degradation** - Services disabled when keys not configured
4. **Onboarding flow** - New users guided to add API key

### 10.2 Current Gaps
1. **No localhost detection** - Build mode ≠ deployment environment
2. **No demo mode** - No concept of "limited features for demo users"
3. **Inconsistent key handling** - Some routes use headers, others use body
4. **Server key fallback** - May give false impression that AI features work without user key

### 10.3 Implementation Paths

**Path A: Strict Demo Mode (Recommended for Public Demo)**
- Detect localhost OR set `PUBLIC_DEMO_MODE=true`
- **Require** client API key for ALL AI features
- **Ignore** server `OPENROUTER_API_KEY` in demo mode
- Show prominent banner explaining demo limitations
- Provide clear CTA to get free OpenRouter key

**Path B: Soft Demo Mode (Better UX, Requires Server Key)**
- Detect localhost OR set `PUBLIC_DEMO_MODE=true`
- Allow server API key as fallback
- Show "demo mode" badge but don't enforce restrictions
- Encourage users to add their own key for better rate limits

**Path C: No Demo Mode (Current Behavior)**
- Keep existing behavior
- Rely on server key presence for feature availability
- Users without server key must provide client key

**Recommendation:** Path A for public demos to avoid API cost surprises.

---

**End of Research Document**
