# Frontend Health Monitoring

## Overview

The health monitoring system provides real-time backend connectivity status to users, showing a warning banner when the server is unreachable and confirming reconnection.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      +layout.svelte                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            HealthStatusBanner.svelte                  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Shows when: healthStore.isOffline = true     │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           health.svelte.ts (HealthStore)             │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Polls: /api/v1/health every 30s              │  │  │
│  │  │  States: online | offline | checking          │  │  │
│  │  │  Retry: Exponential backoff (5s → 60s max)    │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       /api/v1/health (Public Endpoint)               │  │
│  │  Returns: { status, timestamp, service }             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Health Endpoint (`/api/v1/health`)

**File:** `src/routes/api/v1/health/+server.ts`

Simple health check endpoint that returns server status:

```json
{
  "status": "ok",
  "timestamp": "2025-12-27T19:46:49.797Z",
  "service": "itinerator-api"
}
```

- No authentication required (public route)
- Fast response (< 100ms)
- Used for connectivity checks only

### 2. Health Store (`health.svelte.ts`)

**File:** `src/lib/stores/health.svelte.ts`

Reactive Svelte 5 store that manages health monitoring:

**State:**
- `status`: `'online' | 'offline' | 'checking'`
- `lastCheck`: Timestamp of last health check
- `isOnline`: Boolean helper
- `isOffline`: Boolean helper
- `wasOffline`: Tracks reconnection for success message

**Methods:**
- `start()`: Begin health monitoring (call on app mount)
- `stop()`: Stop health monitoring (cleanup on unmount)
- `refresh()`: Manually trigger a health check

**Behavior:**
- Initial check happens immediately on start
- Subsequent checks every 30 seconds when online
- Exponential backoff when offline:
  - 1st retry: 5 seconds
  - 2nd retry: 10 seconds
  - 3rd retry: 20 seconds
  - 4th retry: 40 seconds
  - 5th+ retry: 60 seconds (max)
- Fetch timeout: 5 seconds
- No console spam during offline state

### 3. Status Banner (`HealthStatusBanner.svelte`)

**File:** `src/lib/components/HealthStatusBanner.svelte`

Visual component that displays connection status:

**Offline Banner (Yellow):**
- Shows when `healthStore.isOffline === true`
- Fixed position at top of page
- Contains:
  - Warning emoji (⚠️)
  - "Connection to server lost" message
  - Retry attempt counter
  - Dismiss button [X]
- Can be dismissed (reappears after 30s if still offline)
- Slide-down animation on appearance

**Reconnected Banner (Green):**
- Shows briefly when connection restored
- "Reconnected to server!" message
- Success emoji (✅)
- Auto-dismisses after 5 seconds
- Slide-down animation on appearance

## Integration

### Layout Integration

**File:** `src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import HealthStatusBanner from '$lib/components/HealthStatusBanner.svelte';
  import { healthStore } from '$lib/stores/health.svelte';
  import { onMount, onDestroy } from 'svelte';

  onMount(() => {
    healthStore.start();
  });

  onDestroy(() => {
    healthStore.stop();
  });
</script>

<HealthStatusBanner />

<div class="h-full bg-minimal-bg">
  {@render children()}
</div>
```

### Authentication Bypass

The `/api/v1/health` endpoint is added to the public routes list in `hooks.server.ts`:

```typescript
const PUBLIC_ROUTES = ['/login', '/api/auth', '/api/health', '/api/v1/health'];
```

This allows health checks to work even when not authenticated.

## User Experience Flow

### Scenario 1: Server Goes Down

1. User is actively using the app
2. Health check fails after 30 seconds
3. Yellow warning banner appears at top: "Connection to server lost"
4. Banner shows retry attempt counter
5. Health checks retry with exponential backoff
6. User can dismiss banner (it reappears after 30s if still offline)

### Scenario 2: Server Comes Back Online

1. Health check succeeds
2. Green success banner appears: "Reconnected to server!"
3. Success banner auto-dismisses after 5 seconds
4. Health checks resume normal 30-second interval

### Scenario 3: Brief Network Hiccup

1. Single health check fails
2. Retry happens after 5 seconds
3. If successful, no banner shown (too brief to display)
4. If fails again, offline banner appears

## Configuration

### Timing Constants

**File:** `src/lib/stores/health.svelte.ts`

```typescript
const CHECK_INTERVAL_MS = 30000;        // 30 seconds
const INITIAL_RETRY_DELAY_MS = 5000;    // 5 seconds
const MAX_RETRY_DELAY_MS = 60000;       // 60 seconds
```

**Fetch Timeout:** 5 seconds (aborts if no response)

**Banner Timings:**
- Reconnected banner: 5 seconds auto-dismiss
- Dismissed banner reappear: 30 seconds
- "Was offline" flag clear: 3 seconds

## Testing

### Automated Tests

Run the test script:

```bash
cd viewer-svelte
node test-health-monitoring.mjs
```

### Manual Testing

1. **Basic Offline Detection:**
   - Start dev server: `npm run dev`
   - Open http://localhost:5176/itineraries
   - Stop the server (Ctrl+C)
   - Wait 30 seconds
   - Verify yellow warning banner appears

2. **Reconnection:**
   - With server stopped and banner showing
   - Restart server: `npm run dev`
   - Wait for reconnection (~5-10 seconds)
   - Verify green "Reconnected!" banner appears
   - Verify it auto-dismisses after 5 seconds

3. **Exponential Backoff:**
   - Keep server stopped
   - Open DevTools Network tab
   - Observe health check timing:
     - First: ~5s after initial failure
     - Second: ~10s later
     - Third: ~20s later
     - Fourth: ~40s later
     - Subsequent: ~60s apart

4. **Dismiss and Reappear:**
   - See offline banner
   - Click [X] to dismiss
   - Wait 30 seconds
   - Verify banner reappears

5. **No Console Spam:**
   - Keep server offline
   - Open DevTools Console
   - Verify no repeated error messages
   - Should only see initial warning

## Files Created/Modified

### New Files
- `src/routes/api/v1/health/+server.ts` - Health check endpoint
- `src/lib/stores/health.svelte.ts` - Health monitoring store
- `src/lib/components/HealthStatusBanner.svelte` - Status banner UI
- `test-health-monitoring.mjs` - Test script
- `HEALTH_MONITORING.md` - This documentation

### Modified Files
- `src/routes/+layout.svelte` - Added health monitoring integration
- `src/lib/api.ts` - Added health check client method
- `src/hooks.server.ts` - Added `/api/v1/health` to public routes

## Performance Considerations

- **Network Impact:** One lightweight request every 30s (online) or exponential backoff (offline)
- **Memory Impact:** Minimal (single store instance, ~1KB)
- **CPU Impact:** Negligible (setTimeout-based polling)
- **Bundle Size:** ~2KB total (store + component)

## Future Enhancements

Potential improvements:
- [ ] Add manual "Retry Now" button to offline banner
- [ ] Show last successful connection time
- [ ] Persist health status to localStorage
- [ ] Add health status indicator in UI (e.g., dot in header)
- [ ] WebSocket fallback for real-time status updates
- [ ] Detect slow connections (response time > 2s)
- [ ] Show estimated time to next retry
- [ ] Add telemetry/analytics for uptime tracking

## Troubleshooting

### Banner doesn't appear when server is down

1. Check health endpoint is accessible: `curl http://localhost:5176/api/v1/health`
2. Verify health store is started in +layout.svelte
3. Check browser console for errors
4. Verify PUBLIC_ROUTES includes '/api/v1/health'

### Banner shows even when server is up

1. Check CORS configuration if using separate API server
2. Verify VITE_API_URL is correctly set
3. Check network tab for failed requests
4. Try manual health check: `healthStore.refresh()`

### Exponential backoff not working

1. Check console for timing logs
2. Verify consecutiveFailures counter incrementing
3. Check if timeout/interval IDs are being cleared properly

## LOC Report

```
Files Added:
- +server.ts (health endpoint):      13 lines
- health.svelte.ts (store):         176 lines
- HealthStatusBanner.svelte:         78 lines
- test-health-monitoring.mjs:        68 lines
Total Added:                        335 lines

Files Modified:
- +layout.svelte:                   +13 lines
- api.ts:                           +7 lines
- hooks.server.ts:                  +1 line
Total Modified:                     +21 lines

Net Change:                         +356 lines
```

## Related Documentation

- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/$state)
- [SvelteKit Server Hooks](https://kit.svelte.dev/docs/hooks#server-hooks)
- [MDN: Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
