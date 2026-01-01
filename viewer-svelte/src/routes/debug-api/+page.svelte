<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';

  let apiKeyStatus = $state('Checking...');
  let apiKeyLength = $state(0);
  let apiKeyPreview = $state('');
  let storageValue = $state('');
  let testResult = $state('');
  let testError = $state('');

  onMount(() => {
    // Check API key status
    const apiKey = settingsStore.getApiKey();
    apiKeyLength = apiKey.length;

    if (!apiKey) {
      apiKeyStatus = '❌ No API key set';
      apiKeyPreview = 'N/A';
    } else {
      apiKeyStatus = '✅ API key found';
      // Show first 6 and last 4 characters
      if (apiKey.length > 10) {
        apiKeyPreview = `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`;
      } else {
        apiKeyPreview = apiKey;
      }
    }

    // Check raw localStorage value
    try {
      const settings = localStorage.getItem('itinerator_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        storageValue = JSON.stringify(parsed, null, 2);
      } else {
        storageValue = 'No settings in localStorage';
      }
    } catch (e) {
      storageValue = `Error reading storage: ${e}`;
    }
  });

  async function testApiKey() {
    testResult = '';
    testError = '';

    try {
      const apiKey = settingsStore.getApiKey();
      if (!apiKey) {
        testError = 'No API key configured';
        return;
      }

      testResult = 'Testing API key with OpenRouter...';

      // Make a simple request to OpenRouter to validate the key
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        testResult = '✅ API key is valid! OpenRouter API is accessible.';
      } else {
        const error = await response.text();
        testError = `❌ API key validation failed: ${response.status} ${response.statusText}\n${error}`;
      }
    } catch (e) {
      testError = `❌ Error testing API key: ${e}`;
    }
  }
</script>

<div class="debug-page">
  <h1>API Key Debug Page</h1>

  <section class="debug-section">
    <h2>API Key Status</h2>
    <div class="status-grid">
      <div class="status-item">
        <strong>Status:</strong> {apiKeyStatus}
      </div>
      <div class="status-item">
        <strong>Length:</strong> {apiKeyLength} characters
      </div>
      <div class="status-item">
        <strong>Preview:</strong> <code>{apiKeyPreview}</code>
      </div>
    </div>
  </section>

  <section class="debug-section">
    <h2>Raw Storage Value</h2>
    <pre class="storage-dump">{storageValue}</pre>
  </section>

  <section class="debug-section">
    <h2>Test API Key</h2>
    <button onclick={testApiKey} class="test-button">
      Test API Key with OpenRouter
    </button>

    {#if testResult}
      <div class="test-result success">{testResult}</div>
    {/if}

    {#if testError}
      <div class="test-result error">{testError}</div>
    {/if}
  </section>

  <section class="debug-section">
    <h2>Instructions</h2>
    <ol>
      <li>Make sure you have set your OpenRouter API key in <a href="/profile">Profile Settings</a></li>
      <li>The API key should start with <code>sk-or-v1-</code></li>
      <li>Get your API key from <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a></li>
      <li>Click "Test API Key" above to validate it with OpenRouter</li>
    </ol>
  </section>

  <a href="/itineraries" class="back-link">← Back to Dashboard</a>
</div>

<style>
  .debug-page {
    max-width: 900px;
    margin: 2rem auto;
    padding: 0 1.5rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 2rem;
  }

  .debug-section {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .debug-section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 1rem 0;
  }

  .status-grid {
    display: grid;
    gap: 0.75rem;
  }

  .status-item {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: #f9fafb;
    border-radius: 0.25rem;
  }

  code {
    font-family: monospace;
    background: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .storage-dump {
    background: #1f2937;
    color: #f9fafb;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    font-size: 0.875rem;
    font-family: monospace;
  }

  .test-button {
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

  .test-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }

  .test-result {
    margin-top: 1rem;
    padding: 1rem;
    border-radius: 0.5rem;
    white-space: pre-wrap;
    font-family: monospace;
    font-size: 0.875rem;
  }

  .test-result.success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  .test-result.error {
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .back-link {
    display: inline-block;
    margin-top: 1rem;
    color: #6b7280;
    text-decoration: none;
    font-size: 0.875rem;
  }

  .back-link:hover {
    color: #374151;
    text-decoration: underline;
  }

  ol {
    margin: 0;
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.5rem;
    color: #4b5563;
  }

  a {
    color: #667eea;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
</style>
