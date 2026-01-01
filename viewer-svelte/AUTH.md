# Authentication System

Environment-based session authentication for the Itinerator SvelteKit application.

## Overview

The authentication system provides flexible security based on deployment environment:

- **Production (Vercel)**: Password-protected with session cookies
- **Development (Local/Ngrok)**: Optional open access for easy testing

## Architecture

### Session-Based Authentication

```
┌─────────────┐
│   Client    │
│   Browser   │
└──────┬──────┘
       │
       │ POST /api/auth/login
       │ { password: "..." }
       ▼
┌─────────────────────────┐
│  SvelteKit Server       │
│  hooks.server.ts        │
│                         │
│  1. Validate password   │
│  2. Set session cookie  │
│  3. Redirect to app     │
└─────────────────────────┘
       │
       │ Set-Cookie: itinerator_session=authenticated
       ▼
┌─────────────┐
│   Client    │
│   Browser   │
│  (Cookie)   │
└──────┬──────┘
       │
       │ Subsequent requests
       │ Cookie: itinerator_session=authenticated
       ▼
┌─────────────────────────┐
│  hooks.server.ts        │
│                         │
│  1. Check cookie        │
│  2. Allow/Deny request  │
│  3. Redirect if needed  │
└─────────────────────────┘
```

### Components

| Component | Purpose |
|-----------|---------|
| `hooks.server.ts` | Server-side authentication check on all requests |
| `/api/auth/login` | Login endpoint (password validation + cookie) |
| `/api/auth/logout` | Logout endpoint (cookie deletion) |
| `/api/auth/status` | Check auth status and mode |
| `/login` page | Login UI (adaptive based on mode) |
| `Header.svelte` | Logout button |

## Environment Detection

Authentication mode is determined by:

1. **Explicit Override**: `PUBLIC_AUTH_MODE=password|open`
2. **Auto-Detection**: `import.meta.env.PROD` (production = password, dev = open)

```typescript
function getAuthMode(): 'password' | 'open' {
  // 1. Explicit override
  if (PUBLIC_AUTH_MODE === 'password' || PUBLIC_AUTH_MODE === 'open') {
    return PUBLIC_AUTH_MODE;
  }

  // 2. Auto-detect
  return import.meta.env.PROD ? 'password' : 'open';
}
```

## Configuration

### Environment Variables

Create `.env` or set in Vercel dashboard:

```bash
# Required for production password mode
AUTH_PASSWORD=your-secure-password-here

# Optional: Force specific mode
PUBLIC_AUTH_MODE=password  # or 'open' or leave empty for auto-detect
```

### Production Setup (Vercel)

1. Set `AUTH_PASSWORD` in Vercel environment variables
2. Deploy - authentication is automatically enabled
3. Users must enter password to access the app

### Development Setup (Local/Ngrok)

**Option 1: Open Access (Default)**
```bash
# No .env needed
npm run dev
# Login page shows "Continue" button only
```

**Option 2: Test Password Mode**
```bash
# .env
AUTH_PASSWORD=test123
PUBLIC_AUTH_MODE=password

npm run dev
# Login page shows password field
```

## User Flows

### Production (Password Mode)

```
User visits app
  → Redirected to /login
  → Enters password
  → POST /api/auth/login
  → Server validates password
  → Sets session cookie
  → Redirects to /
  → Access granted

User clicks logout
  → POST /api/auth/logout
  → Server clears cookie
  → Redirects to /login
```

### Development (Open Mode)

```
User visits app
  → Redirected to /login
  → Clicks "Continue"
  → POST /api/auth/login (no password check)
  → Sets session cookie
  → Redirects to /
  → Access granted
```

## Session Management

### Cookie Configuration

```typescript
cookies.set('itinerator_session', 'authenticated', {
  path: '/',
  httpOnly: true,              // Prevent XSS
  secure: import.meta.env.PROD, // HTTPS only in production
  sameSite: 'lax',             // CSRF protection
  maxAge: 60 * 60 * 24 * 7     // 7 days
});
```

### Route Protection

All routes are protected by default except:
- `/login`
- `/api/auth/*`

Protected routes automatically redirect to `/login` if not authenticated.

## API Endpoints

### POST /api/auth/login

**Request:**
```json
{
  "password": "optional-in-open-mode"
}
```

**Response (Success):**
```json
{
  "success": true,
  "mode": "password" | "open"
}
```

**Response (Error):**
```json
{
  "error": "Invalid password"
}
```

**Behavior:**
- **Password Mode**: Validates password against `AUTH_PASSWORD`
- **Open Mode**: Skips password validation
- Sets `itinerator_session` cookie on success

### POST /api/auth/logout

**Response:**
```json
{
  "success": true
}
```

**Behavior:**
- Deletes `itinerator_session` cookie
- User must login again

### GET /api/auth/status

**Response:**
```json
{
  "isAuthenticated": true | false,
  "mode": "password" | "open"
}
```

**Use Case:**
- Frontend checks current auth status
- Determines which login UI to show

## Security Considerations

### Production Checklist

- [x] `AUTH_PASSWORD` stored in environment variables (never committed)
- [x] Session cookie is `httpOnly` (prevents XSS)
- [x] Session cookie is `secure` in production (HTTPS only)
- [x] CSRF protection via `sameSite: 'lax'`
- [x] Server-side authentication check on all requests
- [x] Automatic redirect to login for unauthenticated users

### Limitations

This is a simple authentication system suitable for:
- Single-user or small team applications
- Prototyping and development
- Internal tools

**Not suitable for:**
- Multi-user applications with user accounts
- Public-facing applications requiring user management
- Applications needing role-based access control

### Recommendations for Production

For production multi-user applications, consider:
- Auth0, Clerk, or Supabase for managed authentication
- OAuth providers (Google, GitHub, etc.)
- JWT-based authentication with refresh tokens
- Database-backed user sessions
- Password hashing with bcrypt or Argon2

## Testing

### Manual Testing

**Test Password Mode:**
```bash
# .env
AUTH_PASSWORD=test123
PUBLIC_AUTH_MODE=password

npm run dev
# Visit http://localhost:5176
# Should see password field
# Enter "test123" → access granted
# Enter wrong password → error message
```

**Test Open Mode:**
```bash
# .env
PUBLIC_AUTH_MODE=open

npm run dev
# Visit http://localhost:5176
# Should see "Continue" button
# Click Continue → access granted
```

**Test Auto-Detection:**
```bash
# Development (should be open mode)
npm run dev

# Production build (should be password mode)
npm run build
npm run preview
```

### Test Cases

- [ ] Login with correct password (password mode)
- [ ] Login with incorrect password (password mode)
- [ ] Login without password (open mode)
- [ ] Access protected route when not authenticated (redirect to login)
- [ ] Access login page when authenticated (redirect to home)
- [ ] Logout from authenticated session
- [ ] Session persists across page refresh
- [ ] Session expires after 7 days

## Troubleshooting

### "Authentication not configured" Error

**Cause:** `AUTH_PASSWORD` not set in password mode

**Solution:**
```bash
# Add to .env or Vercel environment variables
AUTH_PASSWORD=your-password
```

### "Unauthorized" on API Requests

**Cause:** Session cookie missing or invalid

**Solution:**
1. Check browser cookies (should have `itinerator_session`)
2. Try logging out and logging in again
3. Clear browser cookies and retry

### Login Page Not Showing Password Field

**Cause:** Running in development mode (auto-detected as open mode)

**Solution:**
```bash
# Force password mode in development
PUBLIC_AUTH_MODE=password
```

### Infinite Redirect Loop

**Cause:** Hooks redirecting authenticated user to login

**Solution:**
1. Clear browser cookies
2. Check `hooks.server.ts` for correct redirect logic
3. Verify `/login` is in `PUBLIC_ROUTES` array

## Migration from Client-Side Auth

Previous implementation used client-side localStorage:

```typescript
// OLD: Client-side auth store
authStore.login(password);
if (!authStore.isAuthenticated) {
  goto('/login');
}
```

**Migration Steps:**

1. Remove `authStore` imports from pages
2. Remove client-side auth checks (server handles this)
3. Update logout to call `/api/auth/logout`
4. Keep auth store for backward compatibility (optional)

**Before:**
```svelte
<script>
  import { authStore } from '$lib/stores/auth.svelte';

  onMount(() => {
    if (!authStore.isAuthenticated) {
      goto('/login');
    }
  });
</script>
```

**After:**
```svelte
<script>
  // No auth check needed - server handles it
  onMount(() => {
    loadData();
  });
</script>
```

## Future Enhancements

Potential improvements:

- [ ] Add rate limiting for login attempts
- [ ] Add 2FA support
- [ ] Add remember me functionality (longer session)
- [ ] Add session timeout warning
- [ ] Add concurrent session detection
- [ ] Add admin user management
- [ ] Add OAuth provider integration
- [ ] Add audit logging for authentication events

---

**Last Updated:** 2025-12-20
**Version:** 1.0.0
