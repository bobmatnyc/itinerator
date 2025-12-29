<script lang="ts">
  import type { ItineraryListItem } from '$lib/types';

  let {
    itinerary,
    selected = false,
    onclick,
    ondelete
  }: {
    itinerary: ItineraryListItem;
    selected?: boolean;
    onclick?: () => void;
    ondelete?: (itinerary: ItineraryListItem) => void;
  } = $props();

  // Format date for display
  function formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Get date range display
  function getDateRange(): string {
    if (!itinerary.startDate) return '';
    const start = formatDate(itinerary.startDate);
    if (!itinerary.endDate || itinerary.startDate === itinerary.endDate) {
      return start;
    }
    const end = formatDate(itinerary.endDate);
    return `${start} - ${end}`;
  }

  // Get primary destination or title
  function getTitle(): string {
    if (itinerary.title) return itinerary.title;
    if (!itinerary.destinations || itinerary.destinations.length === 0) {
      return 'Untitled';
    }
    const dest = itinerary.destinations[0];
    return dest.city || dest.name || 'Untitled';
  }

  // Format updated date
  function getUpdatedDate(): string {
    if (!itinerary.updatedAt) return '';
    const date = new Date(itinerary.updatedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Updated today';
    } else if (diffDays === 1) {
      return 'Updated yesterday';
    } else if (diffDays < 7) {
      return `Updated ${diffDays} days ago`;
    } else {
      return `Updated ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
  }

  // Handle delete button click
  function handleDelete(e: MouseEvent) {
    e.stopPropagation(); // Prevent item selection when clicking delete
    if (ondelete) {
      ondelete(itinerary);
    }
  }
</script>

<button
  class="itinerary-list-item"
  class:selected
  onclick={onclick}
  type="button"
>
  <div class="item-content">
    <div class="item-info">
      <h3 class="font-semibold text-minimal-text truncate">
        {getTitle()}
      </h3>

      <div class="flex flex-col gap-1 text-xs text-minimal-text-muted">
        <div class="flex items-center gap-2">
          {#if getDateRange()}
            <span>{getDateRange()}</span>
            <span>•</span>
          {/if}
          <span>{itinerary.segmentCount} seg{itinerary.segmentCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="text-xs text-minimal-text-muted">
          {getUpdatedDate()}
        </div>
      </div>
    </div>

    {#if ondelete}
      <button
        class="delete-btn"
        onclick={handleDelete}
        title="Delete itinerary"
        type="button"
        aria-label="Delete {getTitle()}"
      >
        🗑️
      </button>
    {/if}
  </div>
</button>

<style>
  .itinerary-list-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    transition: all 0.15s ease;
    cursor: pointer;
    border: none;
    background: transparent;
  }

  .itinerary-list-item:hover {
    background-color: #f9fafb;
  }

  .itinerary-list-item.selected {
    background-color: #f1f5f9;
  }

  .itinerary-list-item.selected:hover {
    background-color: #e2e8f0;
  }

  .item-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .item-info {
    flex: 1;
    min-width: 0;
  }

  .delete-btn {
    opacity: 0;
    padding: 0.375rem 0.5rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .itinerary-list-item:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    background-color: #fef2f2;
    border-color: #fca5a5;
    transform: scale(1.1);
  }

  .delete-btn:active {
    transform: scale(0.95);
  }
</style>
