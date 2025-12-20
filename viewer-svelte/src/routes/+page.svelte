<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';

  onMount(() => {
    // Check authentication status
    if (authStore.isAuthenticated) {
      // Redirect to main dashboard
      goto('/itineraries');
    } else {
      // Redirect to login
      goto('/login');
    }
  });
</script>

<!-- Loading state while redirecting -->
<div class="loading-container">
  <div class="loading-spinner"></div>
  <p class="loading-text">Loading...</p>
</div>

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: #fafafa;
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e5e7eb;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-text {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
