<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import {
    itineraries,
    itinerariesLoading,
    itinerariesError,
    loadItineraries,
    createItinerary,
  } from '$lib/stores/itineraries.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { modal } from '$lib/stores/modal.svelte';
  import Header from '$lib/components/Header.svelte';
  import ItineraryListItem from '$lib/components/ItineraryListItem.svelte';
  import { Notebook, MapTrifold } from 'phosphor-svelte';

  let { children }: { children?: Snippet } = $props();

  // Get currently selected itinerary ID from URL
  let selectedId = $derived($page.params.id);

  let creating = $state(false);

  onMount(() => {
    loadItineraries();
  });

  function handleSelect(id: string) {
    goto(`/itineraries/${id}`);
  }

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

  async function handleDelete(itinerary: any) {
    const confirmed = await modal.confirm({
      title: 'Delete Itinerary',
      message: `Delete "${itinerary.title}"? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true
    });

    if (!confirmed) return;

    try {
      const { deleteItinerary } = await import('$lib/stores/itineraries.svelte');
      await deleteItinerary(itinerary.id);
      toast.success('Itinerary deleted');
      // If we deleted the currently selected itinerary, go back to list
      if (selectedId === itinerary.id) {
        goto('/itineraries');
      }
    } catch (error) {
      console.error('Failed to delete itinerary:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete itinerary. Please try again.';
      toast.error(errorMessage);
    }
  }
</script>

{#if selectedId}
  <!-- Detail page handles its own layout (chat + content) -->
  {@render children?.()}
{:else}
  <!-- List-only view -->
  <div class="app-container">
    <!-- Fixed Header -->
    <Header />

    <!-- Main Content Area: Split Pane Layout -->
    <div class="main-content">
      <!-- LEFT PANE: Itinerary List (always visible) -->
      <div class="itinerary-list-pane">
        <div class="list-header">
          <h1 class="list-title">My Itineraries</h1>
          <button
            class="minimal-button primary"
            onclick={handleCreateNew}
            disabled={creating}
            type="button"
          >
            {creating ? 'Creating...' : 'New'}
          </button>
        </div>

        <div class="list-content">
          {#if $itinerariesLoading}
            <div class="loading-state">
              <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-minimal-accent border-r-transparent mb-4"></div>
              <p class="text-sm text-minimal-text-muted">Loading itineraries...</p>
            </div>
          {:else if $itinerariesError}
            <div class="error-state">
              <p class="text-minimal-text mb-4 text-sm">Error: {$itinerariesError}</p>
              <button class="minimal-button" onclick={loadItineraries} type="button">
                Retry
              </button>
            </div>
          {:else if $itineraries.length === 0}
            <div class="empty-state">
              <div class="empty-state-icon">
                <Notebook size={48} weight="duotone" class="text-gray-400" />
              </div>
              <p class="text-minimal-text mb-2 font-semibold">No itineraries yet</p>
              <p class="text-minimal-text-muted mb-4 text-sm">Start planning your next adventure!</p>
              <button
                class="minimal-button primary"
                onclick={handleCreateNew}
                disabled={creating}
                type="button"
              >
                {creating ? 'Creating...' : 'Create Your First Itinerary'}
              </button>
            </div>
          {:else}
            <div class="itinerary-list">
              {#each $itineraries as itinerary (itinerary.id)}
                <ItineraryListItem
                  {itinerary}
                  selected={itinerary.id === selectedId}
                  onclick={() => handleSelect(itinerary.id)}
                  ondelete={handleDelete}
                />
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- RIGHT PANE: Detail View (slot content) -->
      <div class="detail-pane">
        <div class="empty-detail-state">
          <div class="empty-detail-icon">
            <MapTrifold size={48} weight="duotone" class="text-gray-400" />
          </div>
          <p class="text-minimal-text mb-2 font-semibold">Select an itinerary</p>
          <p class="text-minimal-text-muted text-sm">Choose from the list to view details</p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: #fafafa;
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* LEFT PANE: Itinerary List */
  .itinerary-list-pane {
    width: 320px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background-color: #ffffff;
    border-right: 1px solid #e5e7eb;
    overflow: hidden;
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    background-color: #ffffff;
  }

  .list-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .list-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .itinerary-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    height: 100%;
  }

  .empty-state-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .empty-detail-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
  }

  .empty-detail-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }

  /* RIGHT PANE: Detail View */
  .detail-pane {
    flex: 1;
    overflow: hidden;
    background-color: #fafafa;
  }

  /* Utility classes */
  :global(.minimal-button) {
    padding: 0.5rem 1rem;
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

  :global(.minimal-button:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
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

  :global(.text-minimal-text) {
    color: #1f2937;
  }

  :global(.text-minimal-text-muted) {
    color: #6b7280;
  }

  :global(.text-minimal-accent) {
    color: #3b82f6;
  }

  :global(.text-sm) {
    font-size: 0.875rem;
  }

  :global(.mb-2) {
    margin-bottom: 0.5rem;
  }

  :global(.mb-4) {
    margin-bottom: 1rem;
  }

  :global(.font-semibold) {
    font-weight: 600;
  }

  /* Responsive: stack on mobile */
  @media (max-width: 768px) {
    .main-content {
      flex-direction: column;
    }

    .itinerary-list-pane {
      width: 100%;
      max-height: 40vh;
      border-right: none;
      border-bottom: 1px solid #e5e7eb;
    }

    .detail-pane {
      flex: 1;
    }
  }
</style>
