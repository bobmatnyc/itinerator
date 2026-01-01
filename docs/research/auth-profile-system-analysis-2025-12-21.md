# Authentication & Profile System Analysis

**Date:** 2025-12-21
**Investigator:** Research Agent
**Project:** Itinerizer-TS (SvelteKit Viewer)
**Status:** Complete

---

## Executive Summary

The authentication system uses a **dual-layer architecture** with both **client-side** (localStorage-based) and **server-side** (cookie-based) authentication. The current implementation has a **critical disconnect** between these layers causing the login redirect issue. The profile system is minimal, storing only an OpenRouter API key with a functional onboarding flow already in place.

### Key Findings

1. **Root Cause of Login Redirect Issue**: Client-side auth store (`authStore`) is not synchronized with server-side session cookie after successful login
2. **Dual Auth Layers**: System uses both `localStorage` (client) and HTTP-only cookies (server) without proper synchronization
3. **Existing Onboarding Flow**: Profile page already has onboarding capabilities (`?onboarding=true` parameter)
4. **Minimal Settings Store**: Only stores OpenRouter API key currently
5. **Server-Side Guards**: SvelteKit hooks redirect unauthenticated requests, but client needs to know auth state

---

## Issue 1: Broken Login Flow (Root Cause Analysis)

### Symptom
User enters password → API returns success → user stays on login page (no redirect).

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Login Flow                              │
└─────────────────────────────────────────────────────────────┘

Client Side (Browser)                 Server Side (SvelteKit)
─────────────────────                 ───────────────────────

┌──────────────────┐                  ┌──────────────────────┐
│ Login Page       │  POST password   │ /api/auth/login      │
│ +page.svelte     ├─────────────────>│ +server.ts           │
└────────┬─────────┘                  └──────────┬───────────┘
         │                                       │
         │                                       │ Validate password
         │                                       │ Set cookie (SESSION_SECRET)
         │                                       │
         │       { success: true }               │
         │<──────────────────────────────────────┤
         │                                       │
         │ ❌ authStore.isAuthenticated         │ ✅ Cookie set
         │    still FALSE                        │    (itinerator_session)
         │                                       │
         │ Check settingsStore.apiKey            │
         │ → goto('/profile?onboarding=true')    │
         │                                       │
         ▼                                       ▼

┌──────────────────┐                  ┌──────────────────────┐
│ Profile Page     │  GET /profile    │ hooks.server.ts      │
│ +page.svelte     │<─────────────────┤ Checks cookie        │
└────────┬─────────┘                  └──────────┬───────────┘
         │                                       │
         │ onMount() checks:                     │ Cookie valid?
         │ if (!authStore.isAuthenticated)       │ ✅ YES → Allow
         │ ❌ FALSE → goto('/login')             │
         │                                       │
         └───────────────────────────────────────┘
              REDIRECT LOOP CREATED

```

### The Problem

**TWO SEPARATE AUTH SYSTEMS** that don't synchronize:

1. **Client-side**: `auth.svelte.ts` → `localStorage` → `authStore.isAuthenticated`
   - Used by login page to check `settingsStore.apiKey`
   - Used by profile page in `onMount()` to verify auth
   - **Never updated after server login succeeds**

2. **Server-side**: `hooks.server.ts` → HTTP-only cookie → `locals.isAuthenticated`
   - Set by `/api/auth/login` endpoint
   - Checked by server hooks on every request
   - **Client cannot read HTTP-only cookies via JavaScript**

### Why It Happens

#### Login Page Flow (`/viewer-svelte/src/routes/login/+page.svelte`)

```typescript
// Lines 28-46
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password })
});

const data = await response.json();

if (response.ok && data.success) {
  // ❌ ISSUE: Client-side authStore NOT updated here!
  // Server sets cookie, but client localStorage stays stale

  const apiKey = settingsStore.getApiKey();

  if (!apiKey) {
    await goto('/profile?onboarding=true');  // ← Redirects here
  } else {
    await goto('/');
  }
}
```

#### Profile Page Guard (`/viewer-svelte/src/routes/profile/+page.svelte`)

```typescript
// Lines 14-19
onMount(() => {
  // Check authentication
  if (!authStore.isAuthenticated) {  // ← Still FALSE!
    goto('/login');  // ← Redirects back to login
    return;
  }

  // ... rest of onboarding logic
});
```

#### Server-Side Auth Check (`/viewer-svelte/src/hooks.server.ts`)

```typescript
// Lines 236-238
const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);
event.locals.isAuthenticated = sessionCookie === SESSION_SECRET;

// Lines 243-260
if (!event.locals.isAuthenticated && !isPublicRoute) {
  if (event.url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401
    });
  }

  return new Response(null, {
    status: 302,
    headers: { location: '/login' }
  });
}
```

**The server knows the user is authenticated (has valid cookie), but the client doesn't (localStorage not updated).**

### Why This Architecture Exists

Looking at the code history and structure:

1. **Server-side auth** (`hooks.server.ts`) uses cookies for:
   - Security (HTTP-only cookies can't be stolen via XSS)
   - SSR compatibility (server can check auth on first page load)
   - Automatic expiration (7-day max-age)

2. **Client-side auth** (`auth.svelte.ts`) uses localStorage for:
   - Legacy compatibility (old hash-based password validation)
   - Quick client-side checks without server round-trip
   - Persistence across sessions

**These were implemented at different times and never integrated.**

---

## Issue 2: Current Profile & Settings System

### Settings Store (`/viewer-svelte/src/lib/stores/settings.svelte.ts`)

**Storage Mechanism**: `localStorage` with key `itinerator_api_key`

**Current Fields**:
```typescript
class SettingsStore {
  apiKey = $state('');  // Only field currently
}
```

**API**:
- `updateApiKey(key: string)` - Save to localStorage
- `getApiKey(): string` - Retrieve current key
- `clearSettings()` - Remove all settings

**Persistence**: Automatic via `localStorage`, loads on construction

### Profile Page (`/viewer-svelte/src/routes/profile/+page.svelte`)

**Current Sections**:

1. **OpenRouter API Key**
   - Input field with show/hide toggle
   - Masked display when saved: `sk-or-...xyz4`
   - Link to `https://openrouter.ai/keys`
   - Save button (disabled when empty)

2. **Account Info** (Placeholder)
   - Status badge showing "Active"
   - No other fields currently

**Onboarding Flow** (Already Implemented):
```typescript
// Lines 22-23
const urlParams = new URLSearchParams(window.location.search);
isOnboarding = urlParams.get('onboarding') === 'true';

// Lines 96-112 - Onboarding Banner
{#if isOnboarding}
  <div class="onboarding-banner">
    <h3>Welcome to Itinerizer!</h3>
    <p>
      To unlock AI-powered itinerary generation and travel suggestions,
      please configure your OpenRouter API key below.
      You can skip this step and add it later if needed.
    </p>
  </div>
{/if}

// Lines 184-201 - Conditional Buttons
<button onclick={handleSave}>
  {isOnboarding ? 'Save and Continue' : 'Save API Key'}
</button>

{#if isOnboarding}
  <button onclick={handleSkip}>Skip for now</button>
{/if}
```

**Redirect Logic**:
```typescript
// Lines 42-46
if (isOnboarding) {
  setTimeout(() => {
    goto('/itineraries');
  }, 1500);
}
```

### Auth Store (`/viewer-svelte/src/lib/stores/auth.svelte.ts`)

**Storage Mechanism**: `localStorage` with key `itinerator_auth`

**Current Fields**:
```typescript
class AuthStore {
  isAuthenticated = $state(false);  // Boolean only
}
```

**Password Validation**:
- Static hash comparison (SHA-256)
- Hash: `1003766e45ffdcbacdbfdedaf03034eee6b6a9b7cb8f0e47c49ed92f952dbad5`
- **Note**: This is client-side only, server uses `AUTH_PASSWORD` env var

**API**:
- `login(password: string): Promise<boolean>`
- `logout(): void`
- `checkAuth(): void` - Restore from localStorage

---

## Issue 3: Dual Authentication Modes

### Environment-Based Auth Mode

**Detection Logic** (`/viewer-svelte/src/routes/api/auth/login/+server.ts`):

```typescript
function getAuthMode(): 'password' | 'open' {
  // 1. Explicit override via env var
  const authMode = env.PUBLIC_AUTH_MODE;
  if (authMode === 'password' || authMode === 'open') {
    return authMode;
  }

  // 2. Auto-detect based on environment
  return import.meta.env.PROD ? 'password' : 'open';
}
```

**Modes**:

1. **Password Mode** (Production/Vercel):
   - Requires `AUTH_PASSWORD` env var
   - Validates user input against env var
   - Sets HTTP-only cookie on success

2. **Open Mode** (Local Development):
   - No password required
   - Auto-authenticates on any login attempt
   - Still sets session cookie

**Login Page Adaptation** (`/viewer-svelte/src/routes/login/+page.svelte`):

```typescript
// Lines 12-19
onMount(async () => {
  const response = await fetch('/api/auth/status');
  const data = await response.json();
  authMode = data.mode;  // 'password' or 'open'
});

// Lines 76-94 - Conditional UI
{#if authMode === 'password'}
  <input type="password" bind:value={password} required />
{:else}
  <p>Development Mode - No password required</p>
{/if}
```

---

## Recommended Solutions

### Solution 1: Synchronize Client Auth After Login (Minimal Change)

**Update login page to sync client-side auth store after successful API login:**

```typescript
// In /viewer-svelte/src/routes/login/+page.svelte
// After lines 36-37

if (response.ok && data.success) {
  // NEW: Synchronize client-side auth store
  await authStore.login(password);  // This updates localStorage

  // Existing redirect logic
  const apiKey = settingsStore.getApiKey();
  if (!apiKey) {
    await goto('/profile?onboarding=true');
  } else {
    await goto('/');
  }
}
```

**Pros**:
- Minimal code change (2 lines)
- Maintains backward compatibility
- Both auth layers now synchronized

**Cons**:
- Still maintains dual auth system
- Password validated twice (server + client hash)
- Client-side hash validation is redundant

---

### Solution 2: Remove Client Auth Store (Recommended)

**Eliminate `authStore` entirely, rely only on server-side session:**

1. **Remove `authStore` checks** from profile page:
   ```typescript
   // Remove lines 16-19 in profile/+page.svelte
   // Server hooks already redirect unauthenticated users
   ```

2. **Update login page** to not use `authStore`:
   ```typescript
   // Login page only needs to call API
   // Server handles cookie, hooks handle redirects
   ```

3. **For client-side auth checks**, use server-side load function:
   ```typescript
   // +page.server.ts
   export async function load({ locals }) {
     return {
       isAuthenticated: locals.isAuthenticated
     };
   }
   ```

**Pros**:
- Single source of truth (server-side)
- More secure (HTTP-only cookies)
- Simpler architecture
- SSR-compatible

**Cons**:
- Breaking change (removes `authStore` API)
- Need to update all components using `authStore`
- Requires server round-trip for auth checks

---

### Solution 3: Extend Settings Store for Profile Data (For New Fields)

**Add profile fields to `settings.svelte.ts`:**

```typescript
// New structure in settings.svelte.ts
class SettingsStore {
  // Existing
  apiKey = $state('');

  // New profile fields
  firstName = $state('');
  lastName = $state('');
  nickname = $state('');
  openRouterKey = $state('');  // Rename from apiKey for clarity
  homeAirport = $state('');

  // Single localStorage key for all settings
  private readonly STORAGE_KEY = 'itinerator_settings';

  loadSettings(): void {
    if (!isBrowser) return;

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      this.firstName = data.firstName || '';
      this.lastName = data.lastName || '';
      this.nickname = data.nickname || '';
      this.openRouterKey = data.openRouterKey || '';
      this.homeAirport = data.homeAirport || '';
    }
  }

  saveSettings(): void {
    if (!isBrowser) return;

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
      firstName: this.firstName,
      lastName: this.lastName,
      nickname: this.nickname,
      openRouterKey: this.openRouterKey,
      homeAirport: this.homeAirport
    }));
  }

  // Individual update methods
  updateProfile(updates: Partial<ProfileData>): void {
    if (updates.firstName !== undefined) this.firstName = updates.firstName;
    if (updates.lastName !== undefined) this.lastName = updates.lastName;
    if (updates.nickname !== undefined) this.nickname = updates.nickname;
    if (updates.openRouterKey !== undefined) this.openRouterKey = updates.openRouterKey;
    if (updates.homeAirport !== undefined) this.homeAirport = updates.homeAirport;
    this.saveSettings();
  }
}
```

**Update profile page** to include new sections:

```svelte
<!-- In profile/+page.svelte -->

<!-- Profile Information Section -->
<div class="setting-section">
  <h2>Profile Information</h2>

  <div class="form-group">
    <label for="firstName">First Name</label>
    <input id="firstName" bind:value={firstName} />
  </div>

  <div class="form-group">
    <label for="lastName">Last Name</label>
    <input id="lastName" bind:value={lastName} />
  </div>

  <div class="form-group">
    <label for="nickname">Nickname (optional)</label>
    <input id="nickname" bind:value={nickname} />
  </div>

  <button onclick={handleSaveProfile}>Save Profile</button>
</div>

<!-- Travel Preferences Section -->
<div class="setting-section">
  <h2>Travel Preferences</h2>

  <div class="form-group">
    <label for="homeAirport">Home Airport (IATA code)</label>
    <input
      id="homeAirport"
      bind:value={homeAirport}
      placeholder="e.g., LAX, JFK, ORD"
      pattern="[A-Z]{3}"
      maxlength="3"
    />
    <p class="input-hint">3-letter airport code</p>
  </div>

  <button onclick={handleSavePreferences}>Save Preferences</button>
</div>
```

**Pros**:
- Extends existing pattern
- All settings in one place
- Easy to add more fields later
- Maintains localStorage persistence

**Cons**:
- localStorage can be cleared by user
- No server-side storage (profile data lost on new device)
- Limited to ~5MB storage

---

## Additional Findings

### Session Management

**Cookie Configuration** (`/viewer-svelte/src/routes/api/auth/login/+server.ts`):
```typescript
cookies.set(SESSION_COOKIE_NAME, SESSION_SECRET, {
  path: '/',
  httpOnly: true,           // Cannot be read by JavaScript
  secure: import.meta.env.PROD,  // HTTPS only in production
  sameSite: 'lax',          // CSRF protection
  maxAge: 60 * 60 * 24 * 7  // 7 days
});
```

**Security Features**:
- HTTP-only prevents XSS token theft
- Secure flag enforces HTTPS in production
- SameSite protects against CSRF
- 7-day expiration auto-logout

### Public Routes

**Routes that don't require auth** (`/viewer-svelte/src/hooks.server.ts`):
```typescript
const PUBLIC_ROUTES = ['/login', '/api/auth'];
```

**Behavior**:
- Server redirects unauthenticated users to `/login` for all other routes
- API routes return 401 instead of redirecting
- Already-authenticated users are redirected from `/login` to `/`

### Environment Variables

**Auth-Related Env Vars**:

| Variable | Purpose | Where Used | Default |
|----------|---------|------------|---------|
| `PUBLIC_AUTH_MODE` | Override auth mode | Client + Server | Auto-detect |
| `AUTH_PASSWORD` | Server-side password | Server API routes | Required in prod |
| `VITE_API_URL` | API base URL | Client (dev only) | `http://localhost:5177` |

**Password Storage**:
- **Development**: No password needed (open mode)
- **Production**: `AUTH_PASSWORD` in `.env` (Vercel secrets)
- **Client Hash**: Hardcoded in `auth.svelte.ts` (legacy, not used by server)

---

## Implementation Checklist

### Fix Login Redirect Issue

**Option A: Quick Fix (Sync Client Auth)**
- [ ] Update `/viewer-svelte/src/routes/login/+page.svelte`
- [ ] Add `authStore.login(password)` after successful API response
- [ ] Test login → profile redirect flow
- [ ] Verify profile page doesn't redirect back

**Option B: Proper Fix (Remove Client Auth)**
- [ ] Remove `authStore` checks from profile page `onMount()`
- [ ] Add `+page.server.ts` load function if needed for client-side checks
- [ ] Update any components using `authStore.isAuthenticated`
- [ ] Update documentation to remove client auth store references
- [ ] Test all auth flows (login, logout, protected routes)

### Add Profile Fields

- [ ] Extend `SettingsStore` class with new fields
- [ ] Update localStorage schema to include all fields
- [ ] Add profile information section to profile page UI
- [ ] Add travel preferences section to profile page UI
- [ ] Implement airport code validation (3 letters, uppercase)
- [ ] Add form state management for profile fields
- [ ] Update onboarding flow to include profile fields (optional)
- [ ] Test localStorage persistence across sessions
- [ ] Add clear/reset settings functionality

### Testing

- [ ] Login with password → redirects to profile/onboarding
- [ ] Login with existing API key → redirects to home
- [ ] Profile page auth guard (should not redirect when logged in)
- [ ] Profile field persistence across page refreshes
- [ ] Onboarding skip button functionality
- [ ] Logout clears all client state
- [ ] Development mode (open auth) works
- [ ] Production mode (password auth) works

---

## Technical Debt & Future Improvements

### Short Term
1. **Unify auth system** - Remove dual client/server auth or synchronize properly
2. **Migrate to server-side profile storage** - Move from localStorage to database
3. **Add form validation** - Airport codes, email format, etc.

### Medium Term
1. **Implement user accounts** - Replace single password with multi-user system
2. **Add profile avatars** - Upload and store user profile pictures
3. **Preferences API** - Server-side storage for syncing across devices
4. **Session management UI** - Show active sessions, logout all devices

### Long Term
1. **OAuth integration** - Google/Apple sign-in
2. **Multi-factor authentication** - TOTP, SMS, email verification
3. **User permissions/roles** - Admin, traveler, viewer
4. **Audit log** - Track authentication events

---

## Related Files

### Authentication
- `/viewer-svelte/src/lib/stores/auth.svelte.ts` - Client-side auth store
- `/viewer-svelte/src/routes/api/auth/login/+server.ts` - Login API endpoint
- `/viewer-svelte/src/routes/api/auth/status/+server.ts` - Auth status endpoint
- `/viewer-svelte/src/routes/api/auth/logout/+server.ts` - Logout API endpoint
- `/viewer-svelte/src/hooks.server.ts` - Server-side auth middleware
- `/viewer-svelte/src/routes/login/+page.svelte` - Login page UI

### Settings & Profile
- `/viewer-svelte/src/lib/stores/settings.svelte.ts` - Settings store
- `/viewer-svelte/src/routes/profile/+page.svelte` - Profile page UI
- `/viewer-svelte/src/lib/stores/README.md` - Stores documentation

### Types
- `/viewer-svelte/src/app.d.ts` - SvelteKit app types (Locals interface)

---

## Appendix: Data Flow Diagrams

### Current Login Flow (Broken)

```
User                Login Page           API Server          Profile Page
 |                      |                      |                   |
 | Enter password      |                      |                   |
 |-------------------->|                      |                   |
 |                      | POST /api/auth/login|                   |
 |                      |--------------------->|                   |
 |                      |                      | Validate password|
 |                      |                      | Set cookie       |
 |                      | { success: true }    |                   |
 |                      |<---------------------|                   |
 |                      | Check settingsStore  |                   |
 |                      | apiKey? NO           |                   |
 |                      | goto('/profile')     |                   |
 |                      |------------------------------------->|   |
 |                      |                      |  GET /profile |   |
 |                      |                      |<------------------|
 |                      |                      | Check cookie  |   |
 |                      |                      | ✅ Valid       |   |
 |                      |                      | Allow request |   |
 |                      |                      |---------------->| |
 |                      |                      |               | onMount() |
 |                      |                      |               | Check authStore |
 |                      |                      |               | ❌ FALSE |
 |                      |                      |               | goto('/login') |
 |                      |<--------------------------------------|  |
 |                      |                      |                   |
 | STUCK ON LOGIN      |                      |                   |
 |<--------------------|                      |                   |
```

### Fixed Login Flow (Solution 1)

```
User                Login Page           API Server          Profile Page
 |                      |                      |                   |
 | Enter password      |                      |                   |
 |-------------------->|                      |                   |
 |                      | POST /api/auth/login|                   |
 |                      |--------------------->|                   |
 |                      |                      | Validate password|
 |                      |                      | Set cookie       |
 |                      | { success: true }    |                   |
 |                      |<---------------------|                   |
 |                      | authStore.login()    |                   |
 |                      | ✅ localStorage set  |                   |
 |                      | goto('/profile')     |                   |
 |                      |------------------------------------->|   |
 |                      |                      |  GET /profile |   |
 |                      |                      |<------------------|
 |                      |                      | Check cookie  |   |
 |                      |                      | ✅ Valid       |   |
 |                      |                      | Allow request |   |
 |                      |                      |---------------->| |
 |                      |                      |               | onMount() |
 |                      |                      |               | Check authStore |
 |                      |                      |               | ✅ TRUE |
 |                      |                      |               | Render profile |
 |                      |                      |               |-------------->|
 | Profile page shown  |                      |                   |
 |<------------------------------------------------------------|  |
```

---

**End of Report**
