<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';

  let password = $state('');
  let errorMessage = $state('');
  let newApiKey = $state('');

  async function handleLogin() {
    errorMessage = '';
    const success = await authStore.login(password);
    if (success) {
      password = '';
    } else {
      errorMessage = 'Invalid password';
    }
  }

  function handleLogout() {
    authStore.logout();
  }

  function handleSaveApiKey() {
    settingsStore.updateApiKey(newApiKey);
    newApiKey = '';
  }
</script>

<div class="p-4 space-y-6">
  <!-- Authentication Section -->
  <div class="card p-4">
    <h2 class="h2 mb-4">Authentication</h2>

    {#if authStore.isAuthenticated}
      <div class="space-y-2">
        <p class="text-success-500">✓ You are logged in</p>
        <button class="btn variant-filled" onclick={handleLogout}>Logout</button>
      </div>
    {:else}
      <div class="space-y-2">
        <input
          bind:value={password}
          type="password"
          placeholder="Enter password"
          class="input"
          onkeydown={(e) => e.key === 'Enter' && handleLogin()}
        />
        <button class="btn variant-filled-primary" onclick={handleLogin}>Login</button>
        {#if errorMessage}
          <p class="text-error-500">{errorMessage}</p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Settings Section -->
  <div class="card p-4">
    <h2 class="h2 mb-4">Settings</h2>

    <div class="space-y-2">
      <p class="text-sm">
        Current API Key: {settingsStore.openRouterKey || '(not set)'}
      </p>

      <input
        bind:value={newApiKey}
        type="text"
        placeholder="Enter API key"
        class="input"
        onkeydown={(e) => e.key === 'Enter' && handleSaveApiKey()}
      />
      <button class="btn variant-filled-secondary" onclick={handleSaveApiKey}>
        Save API Key
      </button>
    </div>
  </div>
</div>
