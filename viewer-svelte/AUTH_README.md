# Authentication & Settings - Itinerator Viewer

This document describes the authentication and settings implementation for the Itinerator SvelteKit viewer application.

## Overview

The application now includes:
- **Login Page** - Password-based authentication with SHA-256 hashing
- **Profile/Settings Page** - API key management for OpenRouter
- **Protected Routes** - Authentication checks on the itineraries dashboard
- **Root Page Redirect** - Automatic routing based on auth status

## File Structure

```
src/
├── routes/
│   ├── +page.svelte              # Root redirect (/ -> /login or /itineraries)
│   ├── login/
│   │   └── +page.svelte          # Login page
│   ├── profile/
│   │   └── +page.svelte          # Settings/profile page
│   └── itineraries/
│       └── +page.svelte          # Main dashboard (protected)
├── lib/
│   ├── stores/
│   │   ├── auth.ts               # Authentication store
│   │   └── settings.ts           # Settings store (API key)
│   └── components/
│       └── Header.svelte         # Updated with settings link
```

## Authentication Flow

### 1. Initial Visit
1. User visits `/` (root page)
2. Root page checks `authStore.isAuthenticated`
3. Redirects to `/login` if not authenticated
4. Redirects to `/itineraries` if authenticated

### 2. Login Process
1. User enters password on `/login` page
2. Password is hashed using SHA-256 (Web Crypto API)
3. Hash is compared to stored hash: `03f8b6334b99364cf4bad126e751ece55b8f34afd1ffbf8bd46f961afd9d5b54`
4. On success:
   - `authStore.isAuthenticated` set to `true`
   - State saved to `localStorage` under key `itinerator_auth`
   - User redirected to `/itineraries`
5. On failure:
   - Error message displayed
   - Password field cleared

### 3. Protected Routes
The `/itineraries` page checks authentication in `onMount`:
```typescript
onMount(() => {
  if (!authStore.isAuthenticated) {
    goto('/login');
    return;
  }
  // ... load data
});
```

### 4. Logout
From the `/profile` page, users can click "Logout" which:
- Sets `authStore.isAuthenticated = false`
- Removes auth state from localStorage
- Redirects to `/login`

## Credentials

### Demo Password
```
Password: travel2025
SHA-256 Hash: 03f8b6334b99364cf4bad126e751ece55b8f34afd1ffbf8bd46f961afd9d5b54
```

The demo password is shown as a hint on the login page for development/demo purposes.

## Settings Management

### API Key Storage

The profile page allows users to configure their OpenRouter API key:

1. **Save API Key**
   - Enter key in password field (masked by default)
   - Toggle visibility with eye icon
   - Click "Save API Key"
   - Key stored in `localStorage` under `itinerator_api_key`

2. **Display Current Key**
   - Masked display: `sk-or-...xxxx` (first 6 + last 4 chars)
   - Full display when "Show" is toggled

3. **Access from Code**
   ```typescript
   import { settingsStore } from '$lib/stores/settings';

   const apiKey = settingsStore.getApiKey();
   settingsStore.updateApiKey('new-key');
   ```

## Store APIs

### Auth Store (`$lib/stores/auth.ts`)

```typescript
import { authStore } from '$lib/stores/auth';

// Reactive state
authStore.isAuthenticated  // boolean (Svelte 5 $state rune)

// Methods
await authStore.login(password: string): Promise<boolean>
authStore.logout(): void
authStore.checkAuth(): void  // Restore from localStorage
```

### Settings Store (`$lib/stores/settings.ts`)

```typescript
import { settingsStore } from '$lib/stores/settings';

// Reactive state
settingsStore.apiKey  // string (Svelte 5 $state rune)

// Methods
settingsStore.updateApiKey(key: string): void
settingsStore.getApiKey(): string
settingsStore.loadSettings(): void  // Restore from localStorage
settingsStore.clearSettings(): void
```

## UI Components

### Login Page (`/login`)
- Gradient background (purple theme)
- Centered card with logo
- Password input field
- Error message display
- Demo password hint
- Responsive design

### Profile Page (`/profile`)
- Clean, minimal design
- Header with back link and logout button
- API key section:
  - Description of purpose
  - Masked current key display
  - Input with show/hide toggle
  - External link to OpenRouter
  - Save button
- Account status section
- Success/error message display

### Header Enhancement
- Settings gear icon (top right)
- Only visible when authenticated
- Links to `/profile`
- Hover effects

## Styling

All pages follow the project's minimal design system:

- **Colors:**
  - Background: `#fafafa`
  - Card: `#ffffff`
  - Border: `#e5e7eb`
  - Text: `#1f2937`
  - Muted: `#6b7280`
  - Accent: `#667eea` → `#764ba2` gradient

- **Components:**
  - Rounded corners: `0.5rem` - `1rem`
  - Subtle shadows
  - Smooth transitions
  - Mobile responsive

## Security Considerations

### Current Implementation (Demo)
⚠️ This is a **demo implementation** suitable for development:

- Client-side only authentication
- Static password hash comparison
- localStorage persistence
- No server-side validation

### Production Recommendations
For production deployment, implement:

1. **Backend Authentication**
   - JWT tokens with expiration
   - Secure HTTP-only cookies
   - Server-side session validation
   - HTTPS only

2. **API Security**
   - Never store API keys in localStorage in production
   - Use secure backend proxy for API calls
   - Implement rate limiting
   - API key rotation

3. **Password Security**
   - Use bcrypt/argon2 server-side
   - Implement rate limiting on login
   - Add CAPTCHA for failed attempts
   - Multi-factor authentication

## Development

### Test the Flow

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:5173/`
   - Should redirect to `/login`

3. Enter password: `travel2025`
   - Should redirect to `/itineraries` on success

4. Click settings icon (top right)
   - Navigate to `/profile`

5. Enter API key and save
   - Key persists in localStorage

6. Click "Logout"
   - Redirects to `/login`
   - Can no longer access `/itineraries`

### localStorage Keys

The application uses these localStorage keys:
- `itinerator_auth` - Authentication state (`"true"` or absent)
- `itinerator_api_key` - OpenRouter API key (string)

## Browser Compatibility

Requires modern browser with:
- Web Crypto API (for SHA-256)
- localStorage API
- ES6+ JavaScript
- CSS custom properties

Supported browsers:
- Chrome/Edge 60+
- Firefox 57+
- Safari 11+

## Future Enhancements

Potential improvements:
- [ ] Backend authentication service
- [ ] JWT token management
- [ ] Password reset flow
- [ ] User registration
- [ ] Role-based access control
- [ ] Secure API key storage
- [ ] OAuth integration (Google, GitHub)
- [ ] Session timeout
- [ ] Remember me functionality
- [ ] Account settings (theme, language)

## LOC Report

### Files Created/Modified

**Created:**
- `/routes/login/+page.svelte` - 245 lines
- `/routes/profile/+page.svelte` - 412 lines
- `/routes/itineraries/+page.svelte` - Moved from root (added auth check: +7 lines)

**Modified:**
- `/routes/+page.svelte` - Replaced with redirect logic (55 lines, net -427 lines)
- `/lib/components/Header.svelte` - Added settings link (+35 lines)

**Total:**
- Added: 754 lines
- Modified: 35 lines
- Removed: 427 lines (moved to /itineraries)
- **Net Change: +362 lines**

Phase: **MVP** (Phase 1 - Core functionality with desktop-first design)
