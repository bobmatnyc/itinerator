# User Data Management Analysis - Itinerator SvelteKit Application

**Date:** 2025-12-24
**Research Focus:** Authentication patterns, user data scoping, session management, and potential data isolation issues

---

## Executive Summary

The Itinerator application implements a **cookie-based authentication system** with **email-based user scoping** for itineraries. While the architecture includes proper user filtering at the storage layer, there are **critical security gaps** in session management and API access control that could allow data leakage between users.

### Critical Findings

1. ✅ **Itinerary data is properly scoped** - Storage layer filters by `createdBy` email
2. ⚠️ **Chat sessions lack user ownership** - No `createdBy` or `userEmail` field in session data
3. ⚠️ **Session API routes lack access control** - Any authenticated user can access any session ID
4. ⚠️ **Session IDs are predictable** - Time-based generation allows enumeration attacks
5. ✅ **Session cleanup on logout** - Event bus properly clears frontend state
6. ⚠️ **X-User-Email header not validated** - Backend trusts client-provided email header

---

## 1. Authentication & User Identity

### Authentication Flow

**Location:** `viewer-svelte/src/hooks.server.ts` (lines 262-320)

```typescript
// Server hook extracts user identity from cookies
const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);
event.locals.isAuthenticated = sessionCookie === SESSION_SECRET;
event.locals.userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME) || null;
```

**Authentication Storage:**
- **Server-side:** `itinerator_session` cookie (HttpOnly, 7-day expiry)
- **Client-side:** `itinerator_user_email` cookie (readable by JS, 7-day expiry)
- **Frontend store:** `authStore.userEmail` (localStorage: `itinerator_user_email`)

### Login Process

**Location:** `viewer-svelte/src/routes/api/auth/login/+server.ts` (lines 48-123)

```typescript
// Login validates password (production) or auto-authenticates (dev)
if (authMode === 'password') {
  if (password !== authPassword) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
  }
}

// Sets both session and user email cookies
cookies.set(SESSION_COOKIE_NAME, SESSION_SECRET, { httpOnly: true, ... });
cookies.set(USER_EMAIL_COOKIE_NAME, normalizedEmail, { httpOnly: false, ... });
```

**Authentication Modes:**
- **Production (Vercel):** Password required (`AUTH_PASSWORD` env var)
- **Development:** Open mode (auto-login without password)

### User Identity Propagation

**Server-side (via `event.locals`):**
```typescript
// hooks.server.ts sets userEmail from cookie
event.locals.userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME) || null;

// API routes access via locals
const { userEmail } = locals;
```

**Client-side (via headers):**
```typescript
// viewer-svelte/src/lib/api.ts sends email in request headers
function getBaseHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const userEmail = getUserEmail(); // From localStorage
  if (userEmail) {
    headers['X-User-Email'] = userEmail;
  }
  return headers;
}
```

**⚠️ SECURITY GAP:** The backend **never validates** the `X-User-Email` header against the authenticated cookie. This is mitigated by the fact that cookies are automatically sent by the browser, but the header pattern is redundant and potentially confusing.

---

## 2. User Data Scoping

### Itinerary Ownership Model

**Storage Interface:** `src/storage/storage.interface.ts` (lines 31, 58)

```typescript
export interface ItineraryStorage {
  /** List itineraries for a specific user */
  listByUser(userEmail: string): Promise<Result<ItinerarySummary[], StorageError>>;
}

export interface ItinerarySummary {
  /** User who created the itinerary */
  createdBy?: string;
}
```

**Implementation:** `src/storage/json-storage.ts` (lines 284-304)

```typescript
async listByUser(userEmail: string): Promise<Result<ItinerarySummary[], StorageError>> {
  const normalizedEmail = userEmail.toLowerCase().trim();
  const userItineraries = listResult.value.filter((summary) => {
    const summaryEmail = summary.createdBy?.toLowerCase().trim();
    return summaryEmail === normalizedEmail;
  });
  return ok(userItineraries);
}
```

### API Route Protection

**GET /api/v1/itineraries** - List user's itineraries
**Location:** `viewer-svelte/src/routes/api/v1/itineraries/+server.ts` (lines 14-37)

```typescript
export const GET: RequestHandler = async ({ locals }) => {
  const { storage } = locals.services;
  const { userEmail } = locals;

  if (!userEmail) {
    return json([]); // Empty array if not logged in
  }

  // Uses storage layer's listByUser for filtering
  const result = await storage.listByUser(userEmail);
  return json(result.value);
};
```

**POST /api/v1/itineraries** - Create itinerary
**Location:** `viewer-svelte/src/routes/api/v1/itineraries/+server.ts` (lines 45-88)

```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  const { collectionService } = locals.services;
  const { userEmail } = locals;

  if (!userEmail) {
    throw error(401, { message: 'User must be logged in to create itineraries' });
  }

  // Sets createdBy from authenticated user
  const result = await collectionService.createItinerary({
    title,
    description,
    startDate,
    endDate,
    draft,
    createdBy: userEmail
  });
};
```

**GET/PATCH/DELETE /api/v1/itineraries/:id** - Individual operations
**Location:** `viewer-svelte/src/routes/api/v1/itineraries/[id]/+server.ts` (lines 16-46, 52-77, 85-153)

```typescript
async function verifyOwnership(
  id: ItineraryId,
  userEmail: string | null,
  storage: any
): Promise<boolean> {
  if (!userEmail) return false;

  const loadResult = await storage.load(id);
  if (!loadResult.success) return false;

  const createdBy = itinerary.createdBy?.toLowerCase().trim();
  const reqUser = userEmail.toLowerCase().trim();
  return createdBy === reqUser;
}

export const GET: RequestHandler = async ({ params, locals }) => {
  const isOwner = await verifyOwnership(id, userEmail, storage);
  if (!isOwner) {
    throw error(403, { message: 'Access denied: You do not have permission...' });
  }
  // ... proceed with operation
};
```

✅ **SECURE:** All itinerary operations properly verify ownership before allowing access.

---

## 3. Session Management

### Session Storage Architecture

**Location:** `src/services/trip-designer/session.ts` (lines 38-106)

```typescript
export class InMemorySessionStorage implements SessionStorage {
  private sessions = new Map<SessionId, TripDesignerSession>();

  async save(session: TripDesignerSession): Promise<Result<void, StorageError>> {
    this.sessions.set(session.id, session);
    return ok(undefined);
  }

  async load(sessionId: SessionId): Promise<Result<TripDesignerSession, StorageError>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(createStorageError('NOT_FOUND', `Session ${sessionId} not found`));
    }
    return ok(session);
  }
}
```

**Global Session Storage:** `viewer-svelte/src/hooks.server.ts` (lines 60-78, 206-214)

```typescript
// Global session storage survives HMR in development
let globalSessionStorage: SessionStorage | null = null;

// Cache for TripDesignerService instances keyed by API key
const tripDesignerCache = new Map<string, TripDesignerService>();

// All TripDesignerService instances share globalSessionStorage
if (!globalSessionStorage) {
  const { InMemorySessionStorage } = await import(
    '../../src/services/trip-designer/session.js'
  );
  globalSessionStorage = new InMemorySessionStorage();
}
```

### Session Data Structure

**Location:** `src/domain/types/trip-designer.ts` (lines 110-138)

```typescript
export interface TripDesignerSession {
  id: SessionId;
  itineraryId: ItineraryId; // Links session to itinerary
  messages: Message[];
  tripProfile: TripProfile;
  createdAt: Date;
  lastActiveAt: Date;
  agentMode: 'trip-designer' | 'help';
  metadata: {
    messageCount: number;
    totalTokens: number;
  };
}
```

**⚠️ MISSING FIELD:** Session has **no `createdBy` or `userEmail` field** to track ownership!

### Session API Access Control

**POST /api/v1/designer/sessions** - Create session
**Location:** `viewer-svelte/src/routes/api/v1/designer/sessions/+server.ts` (lines 18-81)

```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  const { itineraryId, mode = 'trip-designer' } = body;

  // Verifies itinerary exists (but NOT that user owns it!)
  if (mode === 'trip-designer' && itineraryId) {
    const itineraryResult = await itineraryService.get(itineraryId as ItineraryId);
    if (!itineraryResult.success) {
      throw error(404, { message: `Itinerary not found...` });
    }
  }

  const sessionResult = await tripDesignerService.createSession(itineraryId, mode);
  return json({ sessionId: sessionResult.value });
};
```

⚠️ **SECURITY GAP:** Creates session without checking if user owns the itinerary!

**GET /api/v1/designer/sessions/:sessionId** - Get session
**Location:** `viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/+server.ts` (lines 18-44)

```typescript
export const GET: RequestHandler = async ({ params, request, locals }) => {
  const sessionId = params.sessionId as SessionId;
  const sessionResult = await tripDesignerService.getSession(sessionId);

  if (!sessionResult.success) {
    throw error(404, { message: `Session not found...` });
  }

  return json(sessionResult.value);
};
```

⚠️ **SECURITY GAP:** Returns session data without verifying user owns the associated itinerary!

**DELETE /api/v1/designer/sessions/:sessionId** - Delete session
**Location:** `viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/+server.ts` (lines 52-85)

```typescript
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  const sessionId = params.sessionId as SessionId;
  const deleteResult = await tripDesignerService.deleteSession(sessionId);
  return new Response(null, { status: 204 });
};
```

⚠️ **SECURITY GAP:** Allows deleting any session without ownership check!

### Session ID Generation

**Location:** `src/domain/types/trip-designer.ts` (lines 16-18)

```typescript
export function generateSessionId(): SessionId {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}` as SessionId;
}
```

⚠️ **PREDICTABLE IDs:** Format: `session_1735084800000_abc123def45`
- First part is Unix timestamp (predictable)
- Second part is only ~36 bits of entropy
- Vulnerable to enumeration attacks

### Session Cleanup

**Frontend Cleanup on Logout:**
**Location:** `viewer-svelte/src/lib/stores/itineraries.svelte.ts` (lines 245-248)

```typescript
// Listen for auth:logout events to clear itinerary data
eventBus.on('auth:logout', () => {
  itinerariesStore.clear();
});
```

**Location:** `viewer-svelte/src/lib/stores/auth.svelte.ts` (lines 98-107)

```typescript
logout(): void {
  this.isAuthenticated = false;
  this.userEmail = null;
  if (isBrowser) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
  }
  eventBus.emit({ type: 'auth:logout' }); // Triggers cleanup
}
```

✅ **PROPER CLEANUP:** Frontend clears state on logout.

**Backend Session Cleanup:**
**Location:** `viewer-svelte/src/routes/api/v1/itineraries/[id]/+server.ts` (lines 147-150)

```typescript
export const DELETE: RequestHandler = async ({ params, locals }) => {
  // ... delete itinerary ...

  // Clean up any associated chat sessions
  if (tripDesignerService) {
    tripDesignerService.deleteSessionsByItineraryId(id);
  }
};
```

**Location:** `src/services/trip-designer/session.ts` (lines 280-292)

```typescript
deleteByItineraryId(itineraryId: ItineraryId): void {
  // Remove from active sessions
  for (const [sessionId, session] of this.activeSessions.entries()) {
    if (session.itineraryId === itineraryId) {
      this.activeSessions.delete(sessionId);
    }
  }

  // Delete from storage
  if ('deleteByItineraryId' in this.storage) {
    (this.storage as InMemorySessionStorage).deleteByItineraryId(itineraryId);
  }
}
```

✅ **PROPER CLEANUP:** Sessions deleted when itinerary is deleted.

---

## 4. Data Isolation Security Analysis

### Potential Attack Vectors

#### 1. Session Hijacking via Predictable IDs

**Vulnerability:** Time-based session IDs allow enumeration
**Attack Scenario:**
1. Attacker creates session at `session_1735084800000_xyz`
2. Enumerates nearby timestamps: `session_1735084799000_*`, `session_1735084801000_*`
3. Tries to access sessions via GET `/api/v1/designer/sessions/:sessionId`
4. Gains access to other users' chat sessions and itinerary IDs

**Impact:** **HIGH** - Full access to chat history, trip profiles, itinerary context

**Mitigation:** Implement ownership verification:
```typescript
// Pseudocode fix
export const GET: RequestHandler = async ({ params, locals }) => {
  const session = await tripDesignerService.getSession(sessionId);
  const itinerary = await storage.load(session.itineraryId);

  if (itinerary.createdBy !== locals.userEmail) {
    throw error(403, { message: 'Access denied' });
  }

  return json(session);
};
```

#### 2. Cross-User Session Creation

**Vulnerability:** Can create session for any existing itinerary
**Attack Scenario:**
1. User A creates itinerary (gets ID: `itin_123`)
2. User B calls POST `/api/v1/designer/sessions` with `itineraryId: "itin_123"`
3. Session created successfully (only checks if itinerary exists, not ownership)
4. User B can now chat with AI about User A's itinerary

**Impact:** **MEDIUM** - Can interact with other users' itineraries via chat agent

**Current Code:** `viewer-svelte/src/routes/api/v1/designer/sessions/+server.ts` (lines 54-61)
```typescript
// Verify itinerary exists (only for trip-designer mode)
if (mode === 'trip-designer' && itineraryId) {
  const itineraryResult = await itineraryService.get(itineraryId as ItineraryId);
  if (!itineraryResult.success) {
    throw error(404, { message: `Itinerary not found...` });
  }
}
// ⚠️ No ownership check!
```

**Mitigation:** Add ownership verification:
```typescript
if (mode === 'trip-designer' && itineraryId) {
  const itineraryResult = await itineraryService.get(itineraryId);
  if (!itineraryResult.success) {
    throw error(404, { message: 'Itinerary not found' });
  }

  // NEW: Verify ownership
  if (itineraryResult.value.createdBy !== locals.userEmail) {
    throw error(403, { message: 'Access denied' });
  }
}
```

#### 3. Session Deletion DoS

**Vulnerability:** Can delete any user's session without verification
**Attack Scenario:**
1. Attacker enumerates session IDs
2. Deletes active sessions via DELETE `/api/v1/designer/sessions/:sessionId`
3. Disrupts other users' chat sessions

**Impact:** **LOW** - Denial of service (sessions can be recreated)

#### 4. X-User-Email Header Spoofing

**Vulnerability:** Client sends email in request headers, but it's not used for auth
**Current Behavior:**
- **Server trusts cookie only:** `event.locals.userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME)`
- **Client sends redundant header:** `headers['X-User-Email'] = userEmail`
- **Header is never validated** against cookie

**Risk:** **MINIMAL** - Header is redundant; server uses cookie (which is secure)

**Recommendation:** Remove `X-User-Email` header entirely to avoid confusion:
```typescript
// api.ts - Remove this:
function getBaseHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  // DELETE: headers['X-User-Email'] = userEmail;
  return headers;
}
```

---

## 5. Summary of Security Findings

### ✅ Properly Secured

| Component | Protection Mechanism | File |
|-----------|---------------------|------|
| **Itinerary List** | Filtered by `createdBy` email | `viewer-svelte/src/routes/api/v1/itineraries/+server.ts:28` |
| **Itinerary Create** | Sets `createdBy` from authenticated user | `viewer-svelte/src/routes/api/v1/itineraries/+server.ts:72` |
| **Itinerary Read/Update/Delete** | Verifies ownership before access | `viewer-svelte/src/routes/api/v1/itineraries/[id]/+server.ts:16-46` |
| **Authentication** | HttpOnly cookies, server-side validation | `viewer-svelte/src/hooks.server.ts:283-287` |
| **Logout Cleanup** | Event bus clears frontend state | `viewer-svelte/src/lib/stores/itineraries.svelte.ts:245-248` |

### ⚠️ Security Gaps

| Vulnerability | Severity | Location | Recommendation |
|--------------|----------|----------|----------------|
| **Session Access Control** | HIGH | `viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/+server.ts:18-44` | Verify session's itinerary ownership before returning |
| **Session Creation** | MEDIUM | `viewer-svelte/src/routes/api/v1/designer/sessions/+server.ts:54-67` | Check user owns itinerary before creating session |
| **Session Deletion** | LOW | `viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/+server.ts:52-85` | Verify ownership before deletion |
| **Predictable Session IDs** | MEDIUM | `src/domain/types/trip-designer.ts:16-18` | Use cryptographically random UUIDs |
| **No Session Owner Field** | HIGH | `src/domain/types/trip-designer.ts:110-138` | Add `createdBy: string` to session schema |
| **Redundant Email Header** | MINIMAL | `viewer-svelte/src/lib/api.ts:60-63` | Remove `X-User-Email` header (unused) |

---

## 6. Recommended Fixes

### Priority 1: Add Session Ownership

**Schema Update:** `src/domain/types/trip-designer.ts`
```typescript
export interface TripDesignerSession {
  id: SessionId;
  itineraryId: ItineraryId;
  createdBy: string; // NEW: User email who created session
  messages: Message[];
  // ... rest of fields
}
```

**Session Creation:** `src/services/trip-designer/session.ts`
```typescript
async createSession(
  itineraryId?: ItineraryId,
  mode: 'trip-designer' | 'help' = 'trip-designer',
  createdBy?: string // NEW: Pass user email
): Promise<Result<TripDesignerSession, StorageError>> {
  const session: TripDesignerSession = {
    id: generateSessionId(),
    itineraryId: itineraryId || ('' as ItineraryId),
    createdBy: createdBy || '', // NEW: Store creator
    messages: [],
    // ... rest of fields
  };
  // ...
}
```

### Priority 2: Implement Session Access Control

**Helper Function:** `viewer-svelte/src/routes/api/v1/designer/sessions/[sessionId]/+server.ts`
```typescript
async function verifySessionOwnership(
  sessionId: SessionId,
  userEmail: string | null,
  tripDesignerService: TripDesignerService,
  storage: ItineraryStorage
): Promise<boolean> {
  if (!userEmail) return false;

  const sessionResult = await tripDesignerService.getSession(sessionId);
  if (!sessionResult.success) return false;

  const session = sessionResult.value;

  // If session has createdBy, check it directly
  if (session.createdBy) {
    return session.createdBy.toLowerCase().trim() === userEmail.toLowerCase().trim();
  }

  // Fallback: Check itinerary ownership
  if (session.itineraryId) {
    const itinResult = await storage.load(session.itineraryId);
    if (!itinResult.success) return false;
    return itinResult.value.createdBy?.toLowerCase().trim() === userEmail.toLowerCase().trim();
  }

  return false;
}

export const GET: RequestHandler = async ({ params, request, locals }) => {
  const { tripDesignerService, storage } = locals.services;
  const { userEmail } = locals;
  const sessionId = params.sessionId as SessionId;

  const isOwner = await verifySessionOwnership(sessionId, userEmail, tripDesignerService, storage);
  if (!isOwner) {
    throw error(403, { message: 'Access denied: You do not have permission to access this session' });
  }

  const sessionResult = await tripDesignerService.getSession(sessionId);
  return json(sessionResult.value);
};
```

### Priority 3: Use Cryptographically Random Session IDs

**Update Generator:** `src/domain/types/trip-designer.ts`
```typescript
import { randomUUID } from 'node:crypto';

export function generateSessionId(): SessionId {
  return `session_${randomUUID()}` as SessionId;
  // Example: session_550e8400-e29b-41d4-a716-446655440000
}
```

### Priority 4: Remove Redundant Email Header

**Update API Client:** `viewer-svelte/src/lib/api.ts`
```typescript
function getBaseHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    // REMOVED: 'X-User-Email' header (server uses cookies)
  };
}
```

---

## 7. Testing Recommendations

### Unit Tests

1. **Session Ownership Verification**
   - Test `verifySessionOwnership()` with matching/non-matching emails
   - Test with missing `createdBy` field (fallback to itinerary)
   - Test with invalid session IDs

2. **Itinerary Access Control**
   - Test `verifyOwnership()` prevents cross-user access
   - Test case-insensitive email matching
   - Test with missing `createdBy` field

### Integration Tests

1. **Session Access Control**
   - User A creates itinerary and session
   - User B attempts to GET `/api/v1/designer/sessions/{sessionA}`
   - Expect 403 Forbidden

2. **Session Creation**
   - User A creates itinerary
   - User B attempts POST `/api/v1/designer/sessions` with itinerary A's ID
   - Expect 403 Forbidden

3. **Session Enumeration**
   - Create sessions with different users
   - Attempt to enumerate session IDs
   - Verify no information leakage

### Security Audit

1. **Session ID Entropy Analysis**
   - Generate 10,000 session IDs
   - Verify no predictable patterns
   - Ensure sufficient randomness (128+ bits)

2. **Cookie Security**
   - Verify `HttpOnly` flag on session cookie
   - Verify `Secure` flag in production
   - Verify `SameSite=lax` prevents CSRF

---

## 8. Conclusion

The Itinerator application has **strong data isolation for itineraries** but **critical gaps in session access control**. The primary concerns are:

1. **No ownership tracking for chat sessions** - Sessions can be accessed by any authenticated user who guesses the ID
2. **Predictable session IDs** - Time-based generation makes enumeration feasible
3. **Missing authorization checks** - Session API routes don't verify user owns associated itinerary

These issues are **exploitable in production** and should be addressed before handling sensitive travel data. The recommended fixes are straightforward:
- Add `createdBy` field to sessions
- Implement ownership verification in session API routes
- Use cryptographically random session IDs

**Risk Assessment:**
- **Itinerary Data:** ✅ LOW RISK (properly scoped and protected)
- **Session Data:** ⚠️ HIGH RISK (accessible across users, contains chat history and trip profiles)
- **Authentication:** ✅ LOW RISK (cookie-based with proper flags)

**Next Steps:**
1. Implement Priority 1 & 2 fixes (session ownership + access control)
2. Add integration tests for cross-user access prevention
3. Conduct security audit of session ID generation
4. Review all API routes for similar authorization gaps
