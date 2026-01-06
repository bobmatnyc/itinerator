<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    itineraries,
    itinerariesLoading,
    itinerariesError,
    loadItineraries,
    selectedItinerary,
    selectedItineraryLoading,
    selectItinerary,
    deleteItinerary,
    createItinerary,
  } from '$lib/stores/itineraries.svelte';
  import { visualizationStore } from '$lib/stores/visualization.svelte';
  import { navigationStore } from '$lib/stores/navigation.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { modal } from '$lib/stores/modal.svelte';
  import Header from '$lib/components/Header.svelte';
  import ItineraryListItem from '$lib/components/ItineraryListItem.svelte';
  import ChatPanel from '$lib/components/ChatPanel.svelte';
  import MainPane from '$lib/components/MainPane.svelte';
  import CalendarView from '$lib/components/CalendarView.svelte';
  import MapView from '$lib/components/MapView.svelte';
  import TravelersView from '$lib/components/TravelersView.svelte';
  import ItineraryDetail from '$lib/components/ItineraryDetail.svelte';
  import ScratchpadView from '$lib/components/ScratchpadView.svelte';
  import EditModeToggle from '$lib/components/EditModeToggle.svelte';
  import VisualizationPane from '$lib/components/VisualizationPane.svelte';
  import VisualizationTimeline from '$lib/components/VisualizationTimeline.svelte';
  import type { Itinerary } from '$lib/types';
  import { List, Calendar, MapTrifold, Users, Notebook } from 'phosphor-svelte';

  interface AgentConfig {
    mode: 'trip-designer' | 'help';
    placeholderText: string;
    showTokenStats: boolean;
  }

  // Get itinerary ID from URL
  let itineraryId = $derived($page.params.id);

  // Resize state (kept local)
  let leftPaneWidth = $state(350);
  let isResizing = $state(false);
  let resizeStartX = $state(0);
  let resizeStartWidth = $state(0);

  let creating = $state(false);

  // Visualization state from store
  let isPaneVisible = $derived(visualizationStore.isPaneVisible);
  let historyLength = $derived(visualizationStore.history.length);

  // Agent configuration
  let agentConfig = $derived<AgentConfig>({
    mode: navigationStore.agentMode,
    placeholderText: navigationStore.agentMode === 'help'
      ? 'Ask me anything about Itinerizer...'
      : 'Type a message... (Shift+Enter for new line)',
    showTokenStats: navigationStore.agentMode === 'trip-designer'
  });

  // Load itineraries and selected itinerary
  onMount(() => {
    loadItineraries();

    // Sync navigation state from URL parameters
    navigationStore.syncFromUrl($page.url.searchParams);

    // Add mouse event listeners for resizing
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const delta = e.clientX - resizeStartX;
        const newWidth = Math.max(250, Math.min(600, resizeStartWidth + delta));
        leftPaneWidth = newWidth;
      }
    };

    const handleMouseUp = () => {
      isResizing = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  });

  // Load itinerary when ID changes
  $effect(() => {
    if (itineraryId) {
      selectItinerary(itineraryId);
      // Set navigation to detail view
      navigationStore.goToItineraryDetail();
    }
  });

  function handleEditManually(itinerary: Itinerary) {
    navigationStore.openEditModal(itinerary);
  }

  function handleEditWithPrompt(itinerary: Itinerary) {
    navigationStore.setLeftPaneTab('chat');
    navigationStore.setEditMode('ai');
  }

  async function handleDelete(itinerary: Itinerary) {
    // Confirm before deleting
    const confirmed = await modal.confirm({
      title: 'Delete Itinerary',
      message: `Delete "${itinerary.title}"? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true
    });

    if (!confirmed) return;

    try {
      await deleteItinerary(itinerary.id);
      toast.success('Itinerary deleted');
      // Navigate back to list after deletion
      goto('/itineraries');
    } catch (error) {
      console.error('Failed to delete itinerary:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete itinerary. Please try again.';
      toast.error(errorMessage);
    }
  }

  function startResize(e: MouseEvent) {
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartWidth = leftPaneWidth;
    e.preventDefault();
  }

  function handleEditModeChange(mode: 'ai' | 'manual') {
    navigationStore.setEditMode(mode);
  }

  function handleSelectItinerary(id: string) {
    goto(`/itineraries/${id}`);
  }

  async function handleDeleteFromList(itinerary: any) {
    const confirmed = await modal.confirm({
      title: 'Delete Itinerary',
      message: `Delete "${itinerary.title}"? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true
    });

    if (!confirmed) return;

    try {
      await deleteItinerary(itinerary.id);
      toast.success('Itinerary deleted');
      // If we deleted the currently selected itinerary, go back to list
      if (itineraryId === itinerary.id) {
        goto('/itineraries');
      }
    } catch (error) {
      console.error('Failed to delete itinerary:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete itinerary. Please try again.';
      toast.error(errorMessage);
    }
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
</script>

<div class="app-container">
  <!-- Fixed Header -->
  <Header />

  <!-- Main Content Area: 2-Pane Layout with Conditional Left Content -->
  <div class="main-content">
    <!-- Left Pane: Toggles between Chat (AI mode) and List (Manual mode) -->
    <div class="left-pane" style="width: {leftPaneWidth}px">
      {#if navigationStore.editMode === 'ai'}
        <!-- AI Mode: Show Chat Panel -->
        <ChatPanel
          bind:agent={agentConfig}
          itineraryId={itineraryId}
        />
      {:else}
        <!-- Manual Mode: Show Itinerary List -->
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
              <div class="empty-state-icon">📋</div>
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
                  selected={itinerary.id === itineraryId}
                  onclick={() => handleSelectItinerary(itinerary.id)}
                  ondelete={handleDeleteFromList}
                />
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Resize handle between left and right panes -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="resize-handle"
      onmousedown={startResize}
      role="separator"
      aria-orientation="vertical"
    ></div>

    <!-- Right Pane: Detail View -->
    <div class="detail-pane">
      <!-- Detail Content + Visualization -->
      <div class="detail-wrapper">
        <!-- Main Content Area -->
        <div class="detail-content" class:with-viz={isPaneVisible}>
          {#if $selectedItineraryLoading}
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-minimal-accent border-r-transparent mb-4"></div>
                <p class="text-sm text-minimal-text-muted">Loading itinerary...</p>
              </div>
            </div>
          {:else if !$selectedItinerary}
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <p class="text-minimal-text mb-4">Itinerary not found</p>
                <button class="minimal-button" onclick={() => goto('/itineraries')} type="button">
                  Back to List
                </button>
              </div>
            </div>
          {:else}
            <!-- Itinerary Detail View with Tabs -->
            <MainPane
              title={$selectedItinerary.title}
              tabs={[
                { id: 'itinerary', label: 'Detail', icon: List },
                { id: 'calendar', label: 'Calendar', icon: Calendar },
                { id: 'map', label: 'Map', icon: MapTrifold },
                { id: 'travelers', label: 'Travelers', icon: Users },
                { id: 'notebook', label: 'Notebook', icon: Notebook }
              ]}
              activeTab={navigationStore.detailTab}
              onTabChange={(tab) => navigationStore.setDetailTab(tab as any)}
            >
              {#snippet actions()}
                <EditModeToggle
                  bind:mode={navigationStore.editMode}
                  onChange={handleEditModeChange}
                />
                <button
                  class="minimal-button delete-button"
                  onclick={() => handleDelete($selectedItinerary)}
                  type="button"
                >
                  Delete
                </button>
              {/snippet}

              {#if navigationStore.detailTab === 'itinerary'}
                <ItineraryDetail
                  itinerary={$selectedItinerary}
                  editMode={navigationStore.editMode}
                  onEditManually={handleEditManually}
                  onEditWithPrompt={handleEditWithPrompt}
                  onDelete={handleDelete}
                />
              {:else if navigationStore.detailTab === 'calendar'}
                <CalendarView itinerary={$selectedItinerary} />
              {:else if navigationStore.detailTab === 'map'}
                <MapView itinerary={$selectedItinerary} />
              {:else if navigationStore.detailTab === 'travelers'}
                <TravelersView itinerary={$selectedItinerary} />
              {:else if navigationStore.detailTab === 'notebook'}
                <ScratchpadView
                  scratchpad={$selectedItinerary.scratchpad || { items: [], createdAt: new Date(), updatedAt: new Date() }}
                  itinerarySegments={$selectedItinerary.segments || []}
                  onSwap={async (scratchpadItemId, existingSegmentId) => {
                    try {
                      const response = await fetch(`/api/v1/itineraries/${$selectedItinerary.id}/scratchpad/${scratchpadItemId}/swap`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ existingSegmentId })
                      });
                      if (!response.ok) throw new Error('Failed to swap segment');
                      await selectItinerary($selectedItinerary.id);
                      toast.success('Segment swapped successfully');
                    } catch (error) {
                      console.error('Failed to swap segment:', error);
                      toast.error('Failed to swap segment. Please try again.');
                    }
                  }}
                  onAddToDay={async (scratchpadItemId, dayNumber) => {
                    try {
                      const response = await fetch(`/api/v1/itineraries/${$selectedItinerary.id}/scratchpad/${scratchpadItemId}/add`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dayNumber })
                      });
                      if (!response.ok) throw new Error('Failed to add segment');
                      await selectItinerary($selectedItinerary.id);
                      toast.success('Segment added to itinerary');
                    } catch (error) {
                      console.error('Failed to add segment:', error);
                      toast.error('Failed to add segment. Please try again.');
                    }
                  }}
                  onRemove={async (itemId) => {
                    try {
                      const response = await fetch(`/api/v1/itineraries/${$selectedItinerary.id}/scratchpad/${itemId}`, {
                        method: 'DELETE'
                      });
                      if (!response.ok) throw new Error('Failed to remove from scratchpad');
                      await selectItinerary($selectedItinerary.id);
                      toast.success('Removed from recommendations');
                    } catch (error) {
                      console.error('Failed to remove from scratchpad:', error);
                      toast.error('Failed to remove. Please try again.');
                    }
                  }}
                />
              {/if}
            </MainPane>
          {/if}
        </div>

        <!-- Visualization Pane (conditional) -->
        {#if isPaneVisible}
          <div class="visualization-pane-container">
            <VisualizationPane />

            <!-- Visualization Timeline (at bottom, conditional) -->
            {#if historyLength > 0}
              <VisualizationTimeline />
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

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
    position: relative;
  }

  /* Left Pane: Toggles between Chat (AI) and List (Manual) */
  .left-pane {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background-color: #ffffff;
    border-right: 1px solid #e5e7eb;
    overflow: hidden;
  }

  /* Resize Handle */
  .resize-handle {
    width: 4px;
    cursor: col-resize;
    background-color: transparent;
    transition: background-color 0.2s;
    flex-shrink: 0;
  }

  .resize-handle:hover,
  .resize-handle:focus {
    background-color: #d1d5db;
    outline: none;
  }

  .resize-handle:active {
    background-color: #9ca3af;
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
    font-size: 1.125rem;
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
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  /* Right Pane: Detail View */
  .detail-pane {
    flex: 1;
    display: flex;
    overflow: hidden;
    background-color: #fafafa;
  }

  /* Detail Wrapper (contains detail content + visualization) */
  .detail-wrapper {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: row;
  }

  .detail-content {
    flex: 1;
    overflow: hidden;
    background-color: #fafafa;
    display: flex;
    flex-direction: column;
    transition: flex 0.3s ease;
  }

  .detail-content.with-viz {
    /* Main content shrinks when viz pane is visible */
    flex: 0.6;
  }

  .visualization-pane-container {
    flex: 0.4;
    min-width: 400px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Utility classes (minimal design system) */
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

  :global(.delete-button) {
    color: #dc2626;
    border-color: #fecaca;
  }

  :global(.delete-button:hover:not(:disabled)) {
    background-color: #fef2f2;
    border-color: #fca5a5;
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

  /* Responsive: stack on mobile */
  @media (max-width: 768px) {
    .main-content {
      flex-direction: column;
    }

    .left-pane {
      width: 100% !important;
      border-right: none;
      border-bottom: 1px solid #e5e7eb;
      max-height: 40%;
    }

    .resize-handle {
      display: none;
    }

    .detail-pane {
      flex-direction: column;
    }

    .detail-wrapper {
      flex: 1;
      flex-direction: column;
    }

    .detail-content {
      flex: 1 !important;
    }

    .visualization-pane-container {
      flex: 0 0 auto;
      min-width: 100%;
      max-height: 40vh;
    }
  }

  /* Flexbox utilities */
  :global(.flex) {
    display: flex;
  }

  :global(.items-center) {
    align-items: center;
  }

  :global(.justify-center) {
    justify-content: center;
  }

  :global(.h-full) {
    height: 100%;
  }

  :global(.text-center) {
    text-align: center;
  }

  :global(.mb-4) {
    margin-bottom: 1rem;
  }

  :global(.text-sm) {
    font-size: 0.875rem;
  }
</style>
