<script lang="ts">
  import { goto } from '$app/navigation';
  import { createItinerary } from '$lib/stores/itineraries.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { Airplane } from 'phosphor-svelte';

  let creating = $state(false);

  async function handleCreateNew() {
    if (creating) return;
    creating = true;
    try {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const newItinerary = await createItinerary({
        title: 'New Trip',
        description: '',
        startDate: today,
        endDate: nextWeek
      });

      // Navigate to the new itinerary with AI mode enabled
      await goto(`/itineraries/${newItinerary.id}?mode=ai`);
    } catch (error) {
      console.error('Failed to create itinerary:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create itinerary');
    } finally {
      creating = false;
    }
  }
</script>

<div class="welcome-container">
  <div class="welcome-content">
    <div class="welcome-icon">
      <Airplane size={64} weight="duotone" class="text-blue-600" />
    </div>
    <h2 class="welcome-title">Select an itinerary</h2>
    <p class="welcome-text">
      Choose an itinerary from the list to view details, edit, or chat with the AI assistant.
    </p>
    <div class="welcome-actions">
      <button
        class="minimal-button primary"
        onclick={handleCreateNew}
        disabled={creating}
        type="button"
      >
        {creating ? 'Creating...' : 'Create New Itinerary'}
      </button>
    </div>
  </div>
</div>

<style>
  .welcome-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    background-color: #fafafa;
  }

  .welcome-content {
    text-align: center;
    max-width: 400px;
  }

  .welcome-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .welcome-title {
    font-size: 1.875rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1rem 0;
  }

  .welcome-text {
    font-size: 1rem;
    color: #6b7280;
    margin: 0 0 2rem 0;
    line-height: 1.5;
  }

  .welcome-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  :global(.minimal-button) {
    padding: 0.75rem 1.5rem;
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
    cursor: pointer;
    transition: all 0.2s;
  }

  :global(.minimal-button:hover:not(:disabled)) {
    background-color: #f9fafb;
    border-color: #d1d5db;
  }

  :global(.minimal-button.primary) {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  :global(.minimal-button.primary:hover:not(:disabled)) {
    background-color: #2563eb;
    border-color: #2563eb;
  }
</style>
