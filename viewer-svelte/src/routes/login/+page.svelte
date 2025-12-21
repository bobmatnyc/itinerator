<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { authStore } from '$lib/stores/auth.svelte';

  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let authMode = $state<'password' | 'open'>('password');

  // Fetch auth mode on component mount
  onMount(async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      authMode = data.mode;
    } catch (err) {
      console.error('Failed to fetch auth mode:', err);
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: authMode === 'password' ? password : '' })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Sync client-side auth store with server state
        // Don't call authStore.login() - server already validated
        authStore.isAuthenticated = true;

        // Check if OpenRouter API key is configured
        const apiKey = settingsStore.getApiKey();

        if (!apiKey) {
          // Redirect to profile with onboarding message
          await goto('/profile?onboarding=true');
        } else {
          // Redirect to home on successful login
          await goto('/');
        }
      } else {
        error = data.error || 'Login failed. Please try again.';
        password = '';
      }
    } catch (err) {
      error = 'Login failed. Please try again.';
      console.error('Login error:', err);
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-container">
  <div class="login-card">
    <!-- Logo/Title -->
    <div class="logo-section">
      <div class="logo-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
      <h1 class="app-title">Itinerizer</h1>
      <p class="app-subtitle">Plan your perfect journey</p>
    </div>

    <!-- Login Form -->
    <form class="login-form" onsubmit={handleSubmit}>
      {#if authMode === 'password'}
        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <input
            id="password"
            type="password"
            class="form-input"
            bind:value={password}
            placeholder="Enter your password"
            disabled={loading}
            autocomplete="current-password"
            required
          />
        </div>
      {:else}
        <div class="form-group">
          <p class="dev-mode-message">Development Mode - No password required</p>
        </div>
      {/if}

      {#if error}
        <div class="error-message">
          {error}
        </div>
      {/if}

      <button
        type="submit"
        class="login-button"
        disabled={loading || (authMode === 'password' && !password)}
      >
        {#if loading}
          {authMode === 'password' ? 'Logging in...' : 'Continuing...'}
        {:else}
          {authMode === 'password' ? 'Login' : 'Continue'}
        {/if}
      </button>
    </form>

  </div>
</div>

<style>
  .login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 1rem;
  }

  .login-card {
    background-color: #ffffff;
    border-radius: 1rem;
    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    padding: 3rem 2rem;
    width: 100%;
    max-width: 400px;
  }

  .logo-section {
    text-align: center;
    margin-bottom: 2rem;
  }

  .logo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    color: white;
    margin-bottom: 1rem;
  }

  .app-title {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .app-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .login-form {
    margin-bottom: 1.5rem;
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

  .form-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    background-color: #ffffff;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  .form-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .form-input:disabled {
    background-color: #f9fafb;
    cursor: not-allowed;
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

  .dev-mode-message {
    padding: 0.75rem 1rem;
    background-color: #dbeafe;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    color: #1e40af;
    font-size: 0.875rem;
    text-align: center;
    margin: 0;
  }

  .login-button {
    width: 100%;
    padding: 0.875rem 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: white;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .login-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }

  .login-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  /* Mobile responsiveness */
  @media (max-width: 480px) {
    .login-card {
      padding: 2rem 1.5rem;
    }

    .app-title {
      font-size: 1.75rem;
    }

    .logo-icon {
      width: 64px;
      height: 64px;
    }
  }
</style>
