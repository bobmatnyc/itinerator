<script lang="ts">
  import type { Segment } from '$lib/types';
  import type { Scratchpad } from '$lib/types/scratchpad';
  import ScratchpadView from './ScratchpadView.svelte';

  let {
    isOpen = $bindable(false),
    scratchpad,
    itinerarySegments,
    onSwap,
    onAddToDay,
    onRemove
  }: {
    isOpen?: boolean;
    scratchpad: Scratchpad;
    itinerarySegments: Segment[];
    onSwap: (scratchpadItemId: string, existingSegmentId: string) => void;
    onAddToDay: (scratchpadItemId: string, dayNumber: number) => void;
    onRemove: (itemId: string) => void;
  } = $props();

  // Get total item count
  let totalItems = $derived(scratchpad.items.length);

  // Close panel
  function close() {
    isOpen = false;
  }

  // Handle escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      close();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="scratchpad-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === 'Enter' && close()}
    role="button"
    tabindex="0"
    aria-label="Close scratchpad"
  ></div>

  <!-- Panel -->
  <div class="scratchpad-panel">
    <!-- Header -->
    <div class="panel-header">
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-semibold text-minimal-text">Alternative Recommendations</h2>
        {#if totalItems > 0}
          <span class="total-badge">{totalItems}</span>
        {/if}
      </div>
      <button
        class="close-button"
        onclick={close}
        type="button"
        title="Close scratchpad"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="panel-content">
      <ScratchpadView
        {scratchpad}
        {itinerarySegments}
        {onSwap}
        {onAddToDay}
        {onRemove}
      />
    </div>
  </div>
{/if}

<style>
  .scratchpad-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 40;
    animation: fadeIn 0.2s ease-out;
  }

  .scratchpad-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    max-width: 42rem;
    background-color: white;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
    z-index: 50;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.3s ease-out;
  }

  @media (max-width: 768px) {
    .scratchpad-panel {
      max-width: 100%;
    }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background-color: #fafafa;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    border: none;
    background: none;
    cursor: pointer;
    color: #6b7280;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .close-button:hover {
    background-color: #f3f4f6;
    color: #1f2937;
  }

  .total-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.75rem;
    height: 1.75rem;
    padding: 0 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 9999px;
    background-color: #6366f1;
    color: white;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
</style>
