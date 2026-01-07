<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';

  // Display name: nickname > email
  let displayName = $derived(settingsStore.nickname || authStore.userEmail || 'User');

  async function handleLogout() {
    try {
      // Call logout API to clear cookies
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // Send cookies for proper deletion
      });

      // Clear localStorage (auth and user email)
      authStore.logout();

      // Redirect to login page
      await goto('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear localStorage even if API call fails
      authStore.logout();
      await goto('/login');
    }
  }
</script>

<div class="header">
  <h1 class="text-xl font-semibold tracking-tight text-minimal-text">Itinerizer</h1>

  <div class="header-actions">
    <span class="user-display-name">{displayName}</span>
    <a href="/itineraries?mode=help" class="header-icon-link" aria-label="Help">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    </a>
    <a href="/profile" class="header-icon-link" aria-label="Settings">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 1v6m0 6v6m-6-6h6m6 0h-6M4.22 4.22l4.24 4.24m5.66 5.66l4.24 4.24M19.78 4.22l-4.24 4.24M9.88 14.12l-4.24 4.24"></path>
      </svg>
    </a>
    <button onclick={handleLogout} class="logout-button" aria-label="Logout">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
    </button>
  </div>
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

  .user-display-name {
    color: #374151;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.5rem 0.75rem;
    background-color: #f9fafb;
    border-radius: 0.375rem;
    border: 1px solid #e5e7eb;
  }

  .header-icon-link {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    color: #6b7280;
    border-radius: 0.375rem;
    transition: all 0.2s;
    text-decoration: none;
  }

  .header-icon-link:hover {
    background-color: #f3f4f6;
    color: #374151;
  }

  .logout-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    color: #6b7280;
    background: none;
    border: none;
    border-radius: 0.375rem;
    transition: all 0.2s;
    cursor: pointer;
  }

  .logout-button:hover {
    background-color: #fee2e2;
    color: #dc2626;
  }
</style>
