<script lang="ts">
  import { healthStore } from '$lib/stores/health.svelte';
  import { onMount } from 'svelte';

  let showReconnected = $state(false);
  let dismissed = $state(false);

  // Watch for reconnection
  $effect(() => {
    if (healthStore.wasOffline && healthStore.isOnline) {
      showReconnected = true;
      dismissed = false;
      // Auto-hide reconnected message after 5 seconds
      setTimeout(() => {
        showReconnected = false;
      }, 5000);
    }
  });

  // Reset dismissed flag when going offline again
  $effect(() => {
    if (healthStore.isOffline) {
      dismissed = false;
    }
  });

  function handleDismiss() {
    dismissed = true;
  }

  // Auto-show after being dismissed if still offline (after 30s)
  $effect(() => {
    if (healthStore.isOffline && dismissed) {
      const timer = setTimeout(() => {
        dismissed = false;
      }, 30000);
      return () => clearTimeout(timer);
    }
  });
</script>

<!-- Offline Banner -->
{#if healthStore.isOffline && !dismissed}
  <div class="fixed top-0 left-0 right-0 z-50 bg-yellow-500 border-b-2 border-yellow-600 px-4 py-3 shadow-lg animate-slide-down">
    <div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <span class="text-2xl flex-shrink-0" title="Warning">⚠️</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-yellow-900">
            Connection to server lost. Some features may be unavailable.
          </p>
          <p class="text-xs text-yellow-800 mt-0.5">
            Retrying automatically... (attempt {healthStore.status === 'offline' ? Math.min(healthStore.consecutiveFailures || 1, 99) : 0})
          </p>
        </div>
      </div>
      <button
        onclick={handleDismiss}
        class="flex-shrink-0 text-yellow-900 hover:text-yellow-950 transition-colors p-1 rounded hover:bg-yellow-400"
        aria-label="Dismiss"
        title="Dismiss (will reappear in 30s if still offline)"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
{/if}

<!-- Reconnected Banner (briefly shown) -->
{#if showReconnected && !healthStore.isOffline}
  <div class="fixed top-0 left-0 right-0 z-50 bg-green-500 border-b-2 border-green-600 px-4 py-3 shadow-lg animate-slide-down">
    <div class="max-w-7xl mx-auto flex items-center justify-center gap-3">
      <span class="text-2xl" title="Success">✅</span>
      <p class="text-sm font-medium text-green-900">
        Reconnected to server!
      </p>
    </div>
  </div>
{/if}

<style>
  @keyframes slide-down {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .animate-slide-down {
    animation: slide-down 0.3s ease-out;
  }
</style>
