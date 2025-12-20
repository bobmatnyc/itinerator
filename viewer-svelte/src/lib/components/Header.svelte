<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
</script>

<div class="header">
  <h1 class="text-xl font-semibold tracking-tight text-minimal-text">Itinerizer</h1>

  {#if authStore.isAuthenticated}
    <div class="header-actions">
      <a href="/profile" class="settings-link" aria-label="Settings">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m-6-6h6m6 0h-6M4.22 4.22l4.24 4.24m5.66 5.66l4.24 4.24M19.78 4.22l-4.24 4.24M9.88 14.12l-4.24 4.24"></path>
        </svg>
      </a>
    </div>
  {/if}
</div>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background-color: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .settings-link {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    color: #6b7280;
    border-radius: 0.375rem;
    transition: all 0.2s;
    text-decoration: none;
  }

  .settings-link:hover {
    background-color: #f3f4f6;
    color: #374151;
  }
</style>
