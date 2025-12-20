# Post-Login Onboarding Flow

## Overview

After successful login, the application checks if the user has configured their OpenRouter API key. If not configured, the user is redirected to the profile/settings page with an onboarding banner.

## Flow Diagram

```
┌─────────────┐
│   /login    │
└──────┬──────┘
       │
       │ Login Success
       ▼
┌──────────────────┐
│ Check API Key    │
│ settingsStore    │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
 No API Key   API Key Exists
    │         │
    ▼         ▼
┌─────────┐  ┌──────────┐
│/profile │  │    /     │
│?onboard │  │(redirect │
│ing=true │  │to /itin) │
└─────────┘  └──────────┘
    │
    ▼
┌─────────────────────────┐
│ Onboarding Banner       │
│ "Welcome to Itinerizer" │
│ Configure API Key       │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │         │
  Save Key    Skip
    │         │
    ▼         ▼
┌──────────────────┐
│  /itineraries    │
└──────────────────┘
```

## Implementation Details

### 1. Login Page (`/routes/login/+page.svelte`)

**Changes:**
- Import `settingsStore` from `$lib/stores/settings.svelte`
- After successful login, check `settingsStore.getApiKey()`
- Redirect based on API key presence:
  - **No key**: `goto('/profile?onboarding=true')`
  - **Key exists**: `goto('/')` (redirects to /itineraries)

```typescript
if (response.ok && data.success) {
  const apiKey = settingsStore.getApiKey();

  if (!apiKey) {
    await goto('/profile?onboarding=true');
  } else {
    await goto('/');
  }
}
```

### 2. Profile Page (`/routes/profile/+page.svelte`)

**New Features:**

#### Onboarding State
- Read `?onboarding=true` URL parameter
- Show onboarding banner when `isOnboarding` is true

#### Onboarding Banner
- Displayed only when `isOnboarding === true`
- Welcome message explaining API key requirement
- Visual gradient banner with icon

#### Action Buttons
- **Save and Continue**: Saves API key and redirects to `/itineraries` (onboarding mode)
- **Save API Key**: Saves API key only (normal mode)
- **Skip for now**: Allows user to skip setup and go to `/itineraries`

```typescript
function handleSave() {
  settingsStore.updateApiKey(apiKey);
  saveSuccess = true;

  // Auto-redirect in onboarding mode
  if (isOnboarding) {
    setTimeout(() => {
      goto('/itineraries');
    }, 1500);
  }
}

function handleSkip() {
  goto('/itineraries');
}
```

### 3. Settings Store (`/lib/stores/settings.svelte.ts`)

**No changes needed** - Already provides:
- `getApiKey()`: Returns current API key
- `updateApiKey(key)`: Saves to localStorage
- SSR-safe localStorage access

## User Experience

### First-Time Login (No API Key)
1. User logs in successfully
2. Automatically redirected to `/profile?onboarding=true`
3. See welcome banner: "Welcome to Itinerizer!"
4. Options:
   - **Enter API key** → Click "Save and Continue" → Auto-redirect to itineraries
   - **Skip** → Click "Skip for now" → Go to itineraries (can add key later)

### Returning User (Has API Key)
1. User logs in successfully
2. Automatically redirected to `/` → `/itineraries`
3. No interruption, seamless access

### Updating API Key Later
1. Navigate to `/profile` (via settings link)
2. No onboarding banner shown
3. Can update or remove API key
4. Click "Save API Key" to update
5. Stay on profile page (no auto-redirect)

## Storage

- **Location**: `localStorage` (client-side)
- **Key**: `itinerizer_api_key`
- **Access**: Via `settingsStore.getApiKey()` / `updateApiKey()`

## Environment Variables

Ensure `.env` includes:
```env
VITE_API_URL=http://localhost:5177
AUTH_PASSWORD=
PUBLIC_AUTH_MODE=
```

## Testing Checklist

- [ ] Login without API key → redirects to `/profile?onboarding=true`
- [ ] Onboarding banner shows welcome message
- [ ] Save API key → success message → auto-redirect to `/itineraries`
- [ ] Skip onboarding → redirects to `/itineraries`
- [ ] Login with existing API key → redirects to `/itineraries` (no profile page)
- [ ] Navigate to `/profile` manually → no onboarding banner
- [ ] Update API key → saves correctly
- [ ] Mobile responsive (banner, buttons)

## Future Enhancements

- Server-side API key storage (encrypted)
- API key validation on save
- Test API key connection before saving
- Multi-step onboarding (API key, preferences, tutorial)
