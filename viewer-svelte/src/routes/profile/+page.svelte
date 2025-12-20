<script lang="ts">
  import { settingsStore } from '$lib/stores/settings';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let apiKey = $state('');
  let showKey = $state(false);
  let saveSuccess = $state(false);
  let saveError = $state('');

  onMount(() => {
    // Check authentication
    if (!authStore.isAuthenticated) {
      goto('/login');
      return;
    }

    // Load current API key
    apiKey = settingsStore.getApiKey();
  });

  function handleSave() {
    saveSuccess = false;
    saveError = '';

    try {
      settingsStore.updateApiKey(apiKey);
      saveSuccess = true;

      // Clear success message after 3 seconds
      setTimeout(() => {
        saveSuccess = false;
      }, 3000);
    } catch (err) {
      saveError = 'Failed to save API key. Please try again.';
      console.error('Save error:', err);
    }
  }

  function toggleShowKey() {
    showKey = !showKey;
  }

  function handleLogout() {
    authStore.logout();
    goto('/login');
  }

  // Mask API key for display
  let maskedKey = $derived(() => {
    const key = settingsStore.getApiKey();
    if (!key) return 'Not set';
    if (key.length <= 8) return key;
    return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
  });
</script>

<div class="profile-container">
  <!-- Header -->
  <div class="profile-header">
    <div class="header-content">
      <h1 class="page-title">Settings</h1>
      <div class="header-actions">
        <a href="/itineraries" class="back-link">
          ← Back to Dashboard
        </a>
        <button class="logout-button" onclick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="profile-content">
    <div class="settings-card">
      <!-- API Key Section -->
      <div class="setting-section">
        <h2 class="section-title">OpenRouter API Key</h2>
        <p class="section-description">
          Enter your OpenRouter API key to enable AI-powered features such as itinerary
          generation and intelligent travel suggestions.
        </p>

        <!-- Current Key Display -->
        {#if settingsStore.apiKey}
          <div class="current-key">
            <span class="label">Current key:</span>
            <span class="key-value">{maskedKey()}</span>
          </div>
        {/if}

        <!-- API Key Form -->
        <div class="form-group">
          <label for="apiKey" class="form-label">API Key</label>
          <div class="input-with-button">
            <input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              class="form-input"
              bind:value={apiKey}
              placeholder="sk-or-v1-..."
              autocomplete="off"
            />
            <button
              type="button"
              class="toggle-button"
              onclick={toggleShowKey}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {#if showKey}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              {/if}
            </button>
          </div>
          <p class="input-hint">
            Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" class="external-link">openrouter.ai/keys</a>
          </p>
        </div>

        <!-- Success/Error Messages -->
        {#if saveSuccess}
          <div class="success-message">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            API key saved successfully!
          </div>
        {/if}

        {#if saveError}
          <div class="error-message">
            {saveError}
          </div>
        {/if}

        <!-- Save Button -->
        <button
          class="save-button"
          onclick={handleSave}
          disabled={!apiKey}
        >
          Save API Key
        </button>
      </div>

      <!-- Additional Settings Section (placeholder for future) -->
      <div class="setting-section">
        <h2 class="section-title">Account</h2>
        <div class="account-info">
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value">
              <span class="status-badge">Active</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .profile-container {
    min-height: 100vh;
    background-color: #fafafa;
  }

  .profile-header {
    background-color: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    padding: 1.5rem;
  }

  .header-content {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .back-link {
    font-size: 0.875rem;
    color: #6b7280;
    text-decoration: none;
    transition: color 0.2s;
  }

  .back-link:hover {
    color: #374151;
  }

  .logout-button {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #dc2626;
    background-color: #ffffff;
    border: 1px solid #fecaca;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .logout-button:hover {
    background-color: #fee2e2;
    border-color: #fca5a5;
  }

  .profile-content {
    max-width: 800px;
    margin: 2rem auto;
    padding: 0 1.5rem;
  }

  .settings-card {
    background-color: #ffffff;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.03);
  }

  .setting-section {
    padding: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .setting-section:last-child {
    border-bottom: none;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .section-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1.5rem 0;
    line-height: 1.5;
  }

  .current-key {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
  }

  .current-key .label {
    color: #6b7280;
    font-weight: 500;
  }

  .current-key .key-value {
    color: #1f2937;
    font-family: monospace;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .input-with-button {
    display: flex;
    gap: 0.5rem;
  }

  .form-input {
    flex: 1;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    background-color: #ffffff;
    transition: all 0.2s;
    font-family: monospace;
  }

  .form-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .toggle-button {
    padding: 0.75rem;
    background-color: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
    transition: all 0.2s;
  }

  .toggle-button:hover {
    background-color: #f9fafb;
    color: #374151;
  }

  .input-hint {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0.5rem 0 0 0;
  }

  .external-link {
    color: #667eea;
    text-decoration: none;
  }

  .external-link:hover {
    text-decoration: underline;
  }

  .success-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: #d1fae5;
    border: 1px solid #a7f3d0;
    border-radius: 0.5rem;
    color: #065f46;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .error-message {
    padding: 0.75rem 1rem;
    background-color: #fee2e2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    color: #dc2626;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .save-button {
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .save-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }

  .save-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .account-info {
    margin-top: 1rem;
  }

  .info-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0;
  }

  .info-label {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
    min-width: 80px;
  }

  .info-value {
    font-size: 0.875rem;
    color: #1f2937;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background-color: #d1fae5;
    color: #065f46;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .header-actions {
      width: 100%;
      justify-content: space-between;
    }

    .setting-section {
      padding: 1.5rem;
    }

    .input-with-button {
      flex-direction: column;
    }

    .toggle-button {
      width: 100%;
    }
  }
</style>
