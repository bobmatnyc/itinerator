<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import {
    itineraries,
    itinerariesLoading,
    itinerariesError,
    selectedItinerary,
    loadItineraries,
    loadModels,
    selectItinerary,
    importPDF,
    createItinerary,
    deleteItinerary,
  } from '$lib/stores/itineraries';
  import Header from '$lib/components/Header.svelte';
  import ImportModal from '$lib/components/ImportModal.svelte';
  import TextImportModal from '$lib/components/TextImportModal.svelte';
  import EditItineraryModal from '$lib/components/EditItineraryModal.svelte';
  import ChatBox from '$lib/components/ChatBox.svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import CalendarView from '$lib/components/CalendarView.svelte';
  import MapView from '$lib/components/MapView.svelte';
  import ItineraryListItem from '$lib/components/ItineraryListItem.svelte';
  import ItineraryDetail from '$lib/components/ItineraryDetail.svelte';
  import type { ItineraryListItem as ItineraryListItemType } from '$lib/types';

  type ViewMode = 'list' | 'chat';
  type TabMode = 'itinerary' | 'calendar' | 'map';

  let viewMode = $state<ViewMode>('list');
  let activeTab = $state<TabMode>('itinerary');
  let leftPaneWidth = $state(350);
  let importModalOpen = $state(false);
  let textImportModalOpen = $state(false);
  let editModalOpen = $state(false);
  let editingItinerary = $state<ItineraryListItemType | null>(null);

  // Resize state
  let isResizing = $state(false);
  let resizeStartX = $state(0);
  let resizeStartWidth = $state(0);

  onMount(() => {
    // Check authentication
    if (!authStore.isAuthenticated) {
      goto('/login');
      return;
    }

    loadItineraries();
    loadModels();

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

  // Auto-select first itinerary when loaded
  $effect(() => {
    if ($itineraries.length > 0 && !$selectedItinerary) {
      selectItinerary($itineraries[0].id);
    }
  });

  function handleImportClick() {
    importModalOpen = true;
  }

  function handleTextImportClick() {
    textImportModalOpen = true;
  }

  async function handleBuildClick() {
    try {
      // Create a new blank itinerary
      const newItinerary = await createItinerary({
        title: 'New Itinerary',
        description: '',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week default
      });

      // Select the new itinerary
      selectItinerary(newItinerary.id);

      // Switch to chat mode
      viewMode = 'chat';
    } catch (error) {
      console.error('Failed to create itinerary:', error);
      alert('Failed to create new itinerary. Please try again.');
    }
  }

  function handleListItinerariesClick() {
    viewMode = 'list';
  }

  async function handleImport(file: File, model: string | undefined) {
    await importPDF(file, model);
    alert('Import successful!');
  }

  function handleTextImportSuccess(itineraryId: string) {
    // Reload itineraries
    loadItineraries();
    // Select the newly imported itinerary
    selectItinerary(itineraryId);
  }

  function handleSelect(id: string) {
    selectItinerary(id);
  }

  function handleEdit(itinerary: ItineraryListItemType) {
    editingItinerary = itinerary;
    editModalOpen = true;
  }

  function handleEditManually(itinerary: any) {
    // Select the itinerary and open edit modal
    editingItinerary = itinerary as ItineraryListItemType;
    editModalOpen = true;
  }

  function handleEditWithPrompt(itinerary: any) {
    // Select the itinerary
    selectItinerary(itinerary.id);
    // Switch to chat mode
    viewMode = 'chat';
  }

  async function handleDelete(itinerary: any) {
    try {
      await deleteItinerary(itinerary.id);
    } catch (error) {
      console.error('Failed to delete itinerary:', error);
      alert('Failed to delete itinerary. Please try again.');
    }
  }

  function startResize(e: MouseEvent) {
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartWidth = leftPaneWidth;
    e.preventDefault();
  }
</script>

<div class="app-container">
  <!-- Fixed Header -->
  <Header />

  <!-- Import Modal (PDF) -->
  <ImportModal bind:open={importModalOpen} onImport={handleImport} />

  <!-- Text Import Modal -->
  <TextImportModal bind:open={textImportModalOpen} onSuccess={handleTextImportSuccess} />

  <!-- Edit Modal -->
  <EditItineraryModal bind:open={editModalOpen} itinerary={editingItinerary} />

  <!-- Main Content Area -->
  <div class="main-content">
    <!-- Left Pane: List or Chat Mode -->
    <div class="left-pane" style="width: {leftPaneWidth}px;">
      {#if viewMode === 'chat'}
        <!-- Chat Mode Header -->
        <div class="left-pane-header">
          <button class="minimal-button" onclick={handleListItinerariesClick} type="button">
            ← List Itineraries
          </button>
        </div>
      {:else}
        <!-- List Mode Header -->
        <div class="left-pane-header">
          <button class="minimal-button" onclick={handleImportClick} type="button">
            Import PDF
          </button>
          <button class="minimal-button" onclick={handleTextImportClick} type="button">
            Import Text
          </button>
          <button class="minimal-button" onclick={handleBuildClick} type="button">
            Build
          </button>
        </div>
      {/if}

      <div class="left-pane-content">
        {#if viewMode === 'chat'}
          <!-- Chat Mode: Chat messages area -->
          <div class="chat-messages">
            <p class="text-minimal-text-muted text-sm text-center p-4">
              Chat mode - Build a new itinerary
            </p>
            <!-- TODO: Chat history will be displayed here -->
          </div>
        {:else}
          <!-- List Mode: Show itineraries -->
          {#if $itinerariesLoading}
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-minimal-accent border-r-transparent mb-4"></div>
                <p class="text-sm text-minimal-text-muted">Loading...</p>
              </div>
            </div>
          {:else if $itinerariesError}
            <div class="flex items-center justify-center h-full p-4">
              <div class="text-center">
                <p class="text-minimal-text mb-4 text-sm">Error: {$itinerariesError}</p>
                <button class="minimal-button" onclick={loadItineraries} type="button">
                  Retry
                </button>
              </div>
            </div>
          {:else if $itineraries.length === 0}
            <div class="flex items-center justify-center h-full p-4">
              <div class="text-center">
                <p class="text-minimal-text-muted mb-4 text-sm">No itineraries yet</p>
                <button class="minimal-button" onclick={handleImportClick} type="button">
                  Import your first PDF
                </button>
              </div>
            </div>
          {:else}
            <div class="space-y-1 p-2">
              {#each $itineraries as itinerary (itinerary.id)}
                <ItineraryListItem
                  {itinerary}
                  selected={$selectedItinerary?.id === itinerary.id}
                  onclick={() => handleSelect(itinerary.id)}
                />
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <!-- ChatBox pinned to bottom - only in chat mode -->
      {#if viewMode === 'chat' && $selectedItinerary}
        <ChatBox itineraryId={$selectedItinerary.id} />
      {/if}
    </div>

    <!-- Resize Handle -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="resize-handle"
      class:resizing={isResizing}
      onmousedown={startResize}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      tabindex="0"
    ></div>

    <!-- Right Pane: Detail View with Tabs -->
    <div class="right-pane">
      {#if $selectedItinerary}
        <!-- Tab Bar -->
        <TabBar bind:activeTab />

        <!-- Tab Content -->
        <div class="tab-content">
          {#if activeTab === 'itinerary'}
            <ItineraryDetail
              itinerary={$selectedItinerary}
              onEditManually={handleEditManually}
              onEditWithPrompt={handleEditWithPrompt}
              onDelete={handleDelete}
            />
          {:else if activeTab === 'calendar'}
            <CalendarView itinerary={$selectedItinerary} />
          {:else if activeTab === 'map'}
            <MapView itinerary={$selectedItinerary} />
          {/if}
        </div>
      {:else if !$itinerariesLoading && $itineraries.length > 0}
        <div class="flex items-center justify-center h-full">
          <p class="text-minimal-text-muted">Select an itinerary</p>
        </div>
      {/if}
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

  .left-pane {
    flex-shrink: 0;
    background-color: #ffffff;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .left-pane-header {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    gap: 0.5rem;
    background-color: #ffffff;
  }

  .left-pane-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
  }

  .resize-handle {
    width: 5px;
    cursor: col-resize;
    background-color: transparent;
    transition: background-color 0.2s;
    position: relative;
  }

  .resize-handle:hover,
  .resize-handle.resizing {
    background-color: #3b82f6;
  }

  .resize-handle::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    right: -3px;
  }

  .right-pane {
    flex: 1;
    overflow: hidden;
    background-color: #fafafa;
    display: flex;
    flex-direction: column;
  }

  .tab-content {
    flex: 1;
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

  :global(.text-minimal-text) {
    color: #1f2937;
  }

  :global(.text-minimal-text-muted) {
    color: #6b7280;
  }

  :global(.text-minimal-accent) {
    color: #3b82f6;
  }

  :global(.bg-minimal-card) {
    background-color: #ffffff;
  }

  :global(.border-minimal-border) {
    border-color: #e5e7eb;
  }

  :global(.minimal-badge) {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background-color: #f3f4f6;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    text-transform: capitalize;
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
      max-height: 50%;
    }

    .resize-handle {
      display: none;
    }

    .right-pane {
      flex: 1;
    }
  }

  /* Flexbox utilities */
  :global(.flex) {
    display: flex;
  }

  :global(.flex-col) {
    flex-direction: column;
  }

  :global(.items-center) {
    align-items: center;
  }

  :global(.justify-center) {
    justify-content: center;
  }

  :global(.gap-1) {
    gap: 0.25rem;
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

  :global(.p-4) {
    padding: 1rem;
  }

  :global(.text-sm) {
    font-size: 0.875rem;
  }

  :global(.space-y-1 > * + *) {
    margin-top: 0.25rem;
  }

  :global(.p-2) {
    padding: 0.5rem;
  }
</style>
