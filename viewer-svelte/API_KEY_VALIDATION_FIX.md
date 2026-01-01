# API Key Validation Fix

## Problem

Users with a valid OpenRouter API key stored in localStorage were seeing the error:
```
No OpenRouter API key configured. Please add your API key in Profile settings.
```

## Root Cause

**Timing race condition in Svelte 5 store initialization:**

1. **ChatBox.svelte** mounts and runs `onMount()` hook
2. During `onMount`, it reads `settingsStore.openRouterKey`
3. **settingsStore** hasn't finished loading from localStorage yet
4. Store returns empty string `''` (default value)
5. Validation fails even though API key exists in localStorage
6. Meanwhile, **api.ts** reads directly from localStorage and works correctly

### Code Flow

```
Component Mount
    ↓
ChatBox.onMount() → settingsStore.openRouterKey (empty!)
    ↓
Validation fails ❌
    ↓
SettingsStore.constructor() → loadSettings() → loads from localStorage
    ↓
Too late - validation already failed
```

## Solution

**Read API key directly from localStorage** instead of relying on Svelte store:

### Before (Broken)
```typescript
onMount(async () => {
  const apiKey = settingsStore.openRouterKey;  // ❌ May be empty during init
  if (!apiKey || apiKey.trim() === '') {
    chatError.set('No OpenRouter API key configured...');
    return;
  }
});
```

### After (Fixed)
```typescript
onMount(async () => {
  const apiKey = getApiKeyFromStorage();  // ✅ Reads directly from localStorage
  if (!apiKey || apiKey.trim() === '') {
    chatError.set('No OpenRouter API key configured...');
    return;
  }
});

function getApiKeyFromStorage(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // Same logic as api.ts - reads directly from localStorage
    const settings = localStorage.getItem('itinerator_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.openRouterKey) return parsed.openRouterKey;
    }

    return localStorage.getItem('itinerator_api_key');
  } catch {
    return null;
  }
}
```

## Why This Works

1. **Direct localStorage access** - No dependency on Svelte 5 store initialization timing
2. **Consistent with api.ts** - Uses same logic as the working API client
3. **SSR-safe** - Still checks for `window` before accessing localStorage
4. **Backward compatible** - Handles both new and legacy storage formats

## Files Changed

- **viewer-svelte/src/lib/components/ChatBox.svelte**
  - Added `getApiKeyFromStorage()` helper function
  - Updated `onMount()` to use direct localStorage access
  - Updated `$effect()` (itinerary change handler) to use direct localStorage access
  - Added debug logging to track validation flow

## Testing

### Manual Test Steps

1. **Open browser console** to see debug logs
2. **Navigate to test page**: http://localhost:5177/test-api-key.html
3. **Click "Set Test API Key"** to store a key in localStorage
4. **Click "Go to App"** to navigate to main application
5. **Select an itinerary** to trigger ChatBox mount
6. **Check console logs** for:
   ```
   [ChatBox] onMount - API key check: { hasKey: true, keyLength: 38, ... }
   ```
7. **Verify no error banner** appears in chat interface

### Expected Console Output

```javascript
[ChatBox] onMount - API key check: {
  hasKey: true,
  keyLength: 38,
  storeValue: '',  // Store hasn't loaded yet
  storeValueLength: 0
}
```

This shows:
- ✅ API key found via direct localStorage access (`hasKey: true`)
- ✅ Key has correct length (`keyLength: 38`)
- ⚠️  Store value empty during mount (proves the timing issue)
- ✅ Validation passes anyway (because we read from localStorage directly)

## Svelte 5 Runes Pattern

This demonstrates an important pattern for Svelte 5:

**When to use Svelte stores vs. direct storage:**

| Use Case | Approach | Reason |
|----------|----------|--------|
| **Reactive UI updates** | Svelte 5 runes store | Need reactivity across components |
| **Initial validation** | Direct localStorage | Avoid timing race conditions |
| **API requests** | Direct localStorage | Works in non-component context |

## Future Improvements

Consider these approaches to eliminate the need for direct localStorage access:

1. **Await store initialization**
   ```typescript
   await settingsStore.loadSettings();
   const apiKey = settingsStore.openRouterKey;
   ```

2. **Use derived store**
   ```typescript
   const apiKeyLoaded = $derived(settingsStore.openRouterKey !== '');
   ```

3. **Move validation to load function**
   ```typescript
   // +page.server.ts or +page.ts
   export const load = async () => {
     // Validation happens before component mount
   };
   ```

For now, direct localStorage access is the simplest and most reliable solution.

## Related Files

- **viewer-svelte/src/lib/api.ts** - Uses same localStorage access pattern
- **viewer-svelte/src/lib/stores/settings.svelte.ts** - Settings store with async init
- **viewer-svelte/src/lib/stores/auth.svelte.ts** - Auth store (similar pattern)
