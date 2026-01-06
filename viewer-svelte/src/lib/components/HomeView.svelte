<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { itineraries } from '$lib/stores/itineraries.svelte';
  import { hasAIAccess } from '$lib/stores/settings.svelte';
  import { Tray, Airplane, MapPin, Calendar, FolderOpen, HandWaving, Lightbulb, Beach } from 'phosphor-svelte';

  let {
    onQuickPromptClick,
    onImportClick
  }: {
    onQuickPromptClick: (prompt: string) => void;
    onImportClick: () => void;
  } = $props();

  // Derive user's first name or email for welcome message
  let displayName = $derived(() => {
    if (authStore.userEmail) {
      // Extract first name from email if possible
      const emailPrefix = authStore.userEmail.split('@')[0];
      return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }
    return 'there';
  });

  // Action cards with Phosphor icons
  const actionCards = [
    {
      id: 'import-itinerary',
      text: 'Import Itinerary',
      icon: Tray,
      description: 'Upload PDF, ICS, or image files',
      isImport: true
    },
    {
      id: 'weekend-getaway',
      text: 'Plan a weekend getaway',
      icon: Beach,
      description: 'Create a quick 2-3 day trip',
      isImport: false
    },
    {
      id: 'upcoming-trip',
      text: 'Help me with my upcoming trip',
      icon: Airplane,
      description: 'Get assistance with trip planning',
      isImport: false
    },
    {
      id: 'find-activities',
      text: 'Find activities for my destination',
      icon: MapPin,
      description: 'Discover things to do',
      isImport: false
    },
    {
      id: 'optimize-itinerary',
      text: 'Optimize my travel schedule',
      icon: Calendar,
      description: 'Improve your itinerary flow',
      isImport: false
    }
  ];

  // Check if user has AI access
  let aiAccessAvailable = $derived(hasAIAccess());

  function handleActionClick(action: typeof actionCards[number]) {
    if (!aiAccessAvailable) return;

    if (action.isImport) {
      onImportClick();
    } else {
      onQuickPromptClick(action.text);
    }
  }
</script>

<div class="home-view">
  <div class="home-content">
    <!-- Welcome Section -->
    <div class="welcome-section">
      <div class="welcome-icon"><HandWaving size={64} weight="duotone" /></div>
      <h1 class="welcome-title">Welcome back, {displayName()}!</h1>
      <p class="welcome-subtitle">Ready to plan your next adventure?</p>
    </div>

    <!-- Itinerary Summary -->
    <div class="summary-card">
      <div class="summary-icon"><FolderOpen size={48} weight="duotone" /></div>
      <div class="summary-content">
        <div class="summary-number">{$itineraries.length}</div>
        <div class="summary-label">
          {$itineraries.length === 1 ? 'Itinerary' : 'Itineraries'}
        </div>
      </div>
    </div>

    <!-- Quick Prompts Section -->
    <div class="quick-prompts-section">
      <h2 class="section-title">Get Started</h2>
      <p class="section-subtitle">Choose a quick action below or start chatting with the Trip Designer</p>

      <div class="quick-prompts-grid">
        {#each actionCards as action}
          <button
            class="prompt-button"
            class:disabled={!aiAccessAvailable}
            class:import-action={action.isImport}
            onclick={() => handleActionClick(action)}
            disabled={!aiAccessAvailable}
            title={!aiAccessAvailable ? 'API key required - visit Profile to add one' : ''}
            type="button"
          >
            <div class="prompt-icon"><svelte:component this={action.icon} size={32} weight="duotone" /></div>
            <div class="prompt-content">
              <div class="prompt-text">{action.text}</div>
              <div class="prompt-description">{action.description}</div>
            </div>
            {#if !aiAccessAvailable}
              <div class="prompt-lock-icon"><svelte:component this={action.icon} size={14} weight="fill" /></div>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <!-- Help Section -->
    <div class="help-section">
      <div class="help-icon"><Lightbulb size={24} weight="duotone" /></div>
      <p class="help-text">
        New to Itinerizer? Check out our <a href="/help" class="help-link">Help & Documentation</a> to learn more.
      </p>
    </div>
  </div>
</div>

<style>
  .home-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    overflow-y: auto;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #fef3c7 100%);
    padding: 2rem;
  }

  .home-content {
    max-width: 800px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* Welcome Section */
  .welcome-section {
    text-align: center;
    padding: 2rem;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .welcome-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
    color: #3b82f6;
  }

  .welcome-title {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .welcome-subtitle {
    font-size: 1.125rem;
    color: #6b7280;
    margin: 0;
  }

  /* Summary Card */
  .summary-card {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1.5rem 2rem;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border: 2px solid #3b82f6;
  }

  .summary-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
  }

  .summary-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .summary-number {
    font-size: 2.5rem;
    font-weight: 700;
    color: #3b82f6;
    line-height: 1;
  }

  .summary-label {
    font-size: 1rem;
    font-weight: 500;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  /* Quick Prompts Section */
  .quick-prompts-section {
    background: rgba(255, 255, 255, 0.8);
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
    text-align: center;
  }

  .section-subtitle {
    font-size: 0.9375rem;
    color: #6b7280;
    margin: 0 0 1.5rem 0;
    text-align: center;
  }

  .quick-prompts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .prompt-button {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    background: #ffffff;
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .prompt-button:not(.disabled):hover {
    border-color: #3b82f6;
    background: #eff6ff;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
  }

  .prompt-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #f9fafb;
  }

  .prompt-button.import-action {
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border-color: #93c5fd;
  }

  .prompt-button.import-action:not(.disabled):hover {
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    border-color: #60a5fa;
  }

  .prompt-lock-icon {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    font-size: 0.875rem;
    opacity: 0.6;
  }

  .prompt-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #6b7280;
  }

  .prompt-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .prompt-text {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
  }

  .prompt-description {
    font-size: 0.875rem;
    color: #6b7280;
  }

  /* Help Section */
  .help-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
  }

  .help-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
  }

  .help-text {
    font-size: 0.9375rem;
    color: #4b5563;
    margin: 0;
  }

  .help-link {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
  }

  .help-link:hover {
    text-decoration: underline;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .home-view {
      padding: 1rem;
    }

    .welcome-title {
      font-size: 1.5rem;
    }

    .welcome-subtitle {
      font-size: 1rem;
    }

    .quick-prompts-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
