<script lang="ts">
  import type { Segment } from '$lib/types';
  import type { Scratchpad, ScratchpadItem, ScratchpadPriority } from '$lib/types/scratchpad';
  import { getItemsByType } from '$lib/types/scratchpad';
  import { generateSegmentLinks } from '$lib/utils/segment-links';
  import type { SegmentLink } from '$lib/utils/segment-links';

  let {
    scratchpad,
    itinerarySegments,
    onSwap,
    onAddToDay,
    onRemove
  }: {
    scratchpad: Scratchpad;
    itinerarySegments: Segment[];
    onSwap: (scratchpadItemId: string, existingSegmentId: string) => void;
    onAddToDay: (scratchpadItemId: string, dayNumber: number) => void;
    onRemove: (itemId: string) => void;
  } = $props();

  // Tab state
  let activeTab = $state<Segment['type']>('FLIGHT');

  // Get items for current tab
  let tabItems = $derived(getItemsByType(scratchpad, activeTab));

  // Available segment types
  const segmentTypes: Array<{ type: Segment['type']; label: string; icon: string }> = [
    { type: 'FLIGHT', label: 'Flights', icon: '✈️' },
    { type: 'HOTEL', label: 'Hotels', icon: '🏨' },
    { type: 'ACTIVITY', label: 'Activities', icon: '🎯' },
    { type: 'TRANSFER', label: 'Transport', icon: '🚗' }
  ];

  // Get segment title based on type
  function getSegmentTitle(segment: Segment): string {
    switch (segment.type) {
      case 'FLIGHT':
        return `${segment.origin?.code || segment.origin?.name || 'TBD'} → ${segment.destination?.code || segment.destination?.name || 'TBD'}`;
      case 'HOTEL':
        return segment.property.name;
      case 'ACTIVITY':
        return segment.name;
      case 'TRANSFER':
        return `${segment.pickupLocation.name} → ${segment.dropoffLocation.name}`;
      case 'CUSTOM':
        return segment.title;
      default:
        return 'Unknown';
    }
  }

  // Get segment subtitle
  function getSegmentSubtitle(segment: Segment): string {
    switch (segment.type) {
      case 'FLIGHT':
        return segment.airline ? `${segment.airline.name} ${segment.flightNumber || ''}` : 'TBD';
      case 'HOTEL':
        return segment.location.city || segment.location.name || '';
      case 'ACTIVITY':
        return segment.location.city || segment.location.name || '';
      case 'TRANSFER':
        return segment.transferType;
      default:
        return '';
    }
  }

  // Get emoji icon for segment type
  function getSegmentIcon(type: string): string {
    const icons: Record<string, string> = {
      'FLIGHT': '✈️',
      'HOTEL': '🏨',
      'ACTIVITY': '🎯',
      'TRANSFER': '🚗',
      'MEETING': '📅',
      'CUSTOM': '📌'
    };
    return icons[type] || '📍';
  }

  // Get priority badge classes
  function getPriorityBadgeClass(priority: ScratchpadPriority): string {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  }

  // Get priority label
  function getPriorityLabel(priority: ScratchpadPriority): string {
    return priority.toUpperCase();
  }

  // Format price if available
  function formatPrice(segment: Segment): string | null {
    // Type guard to check if segment has price properties
    if ('totalPrice' in segment && segment.totalPrice && typeof segment.totalPrice === 'object' && 'currency' in segment.totalPrice && 'amount' in segment.totalPrice) {
      const price = segment.totalPrice as { currency: string; amount: number };
      return `${price.currency} ${price.amount.toLocaleString()}`;
    }
    if ('price' in segment && segment.price && typeof segment.price === 'object' && 'currency' in segment.price && 'amount' in segment.price) {
      const price = segment.price as { currency: string; amount: number };
      return `${price.currency} ${price.amount.toLocaleString()}`;
    }
    return null;
  }

  // Get segments available for swapping (same type)
  function getSwapOptions(segmentType: Segment['type']): Segment[] {
    return itinerarySegments.filter((s) => s.type === segmentType);
  }

  // State for dropdown selections
  let swapSelections = $state<Record<string, string>>({});
  let daySelections = $state<Record<string, number>>({});

  // Handle swap
  function handleSwap(itemId: string) {
    const selectedSegmentId = swapSelections[itemId];
    if (selectedSegmentId) {
      onSwap(itemId, selectedSegmentId);
      delete swapSelections[itemId];
    }
  }

  // Handle add to day
  function handleAddToDay(itemId: string) {
    const selectedDay = daySelections[itemId];
    if (selectedDay) {
      onAddToDay(itemId, selectedDay);
      delete daySelections[itemId];
    }
  }

  // Get available days (1-30 for simplicity)
  function getAvailableDays(): number[] {
    return Array.from({ length: 30 }, (_, i) => i + 1);
  }

  // Get segment links
  function getLinks(segment: Segment): SegmentLink[] {
    return generateSegmentLinks(segment);
  }
</script>

<div class="scratchpad-view space-y-4">
  <!-- Tab navigation -->
  <div class="flex gap-2 border-b border-gray-200">
    {#each segmentTypes as { type, label, icon }}
      {@const count = scratchpad.items.filter((item) => item.segment.type === type).length}
      <button
        class="tab-button"
        class:active={activeTab === type}
        onclick={() => (activeTab = type)}
        type="button"
      >
        <span class="text-lg">{icon}</span>
        <span>{label}</span>
        {#if count > 0}
          <span class="count-badge">{count}</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Items list -->
  <div class="items-container space-y-3">
    {#if tabItems.length === 0}
      <div class="empty-state minimal-card p-8 text-center">
        <div class="text-4xl mb-2">{segmentTypes.find((t) => t.type === activeTab)?.icon}</div>
        <p class="text-minimal-text-muted">No {segmentTypes.find((t) => t.type === activeTab)?.label.toLowerCase()} recommendations yet</p>
      </div>
    {:else}
      {#each tabItems as item (item.id)}
        <div class="minimal-card p-4 space-y-3 border-l-4 border-l-purple-400">
          <!-- Header with icon, title, and priority -->
          <div class="flex items-start gap-3">
            <span class="text-2xl">{getSegmentIcon(item.segment.type)}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-start gap-2">
                <h4 class="font-medium text-minimal-text flex-1">
                  {getSegmentTitle(item.segment)}
                </h4>
                <span class="minimal-badge {getPriorityBadgeClass(item.priority)}">
                  {getPriorityLabel(item.priority)}
                </span>
              </div>
              {#if getSegmentSubtitle(item.segment)}
                <p class="text-sm text-minimal-text-muted mt-0.5">
                  {getSegmentSubtitle(item.segment)}
                </p>
              {/if}
            </div>
          </div>

          <!-- Description and reason -->
          {#if item.segment.type === 'ACTIVITY' && item.segment.description}
            <p class="text-sm text-minimal-text ml-11 line-clamp-2">
              {item.segment.description}
            </p>
          {/if}
          {#if item.reason}
            <p class="text-xs text-minimal-accent italic ml-11">
              💡 {item.reason}
            </p>
          {/if}

          <!-- Price -->
          {#if formatPrice(item.segment)}
            <p class="text-sm font-medium text-minimal-text ml-11">
              {formatPrice(item.segment)}
            </p>
          {/if}

          <!-- Review links -->
          {#if getLinks(item.segment).length > 0}
            {@const links = getLinks(item.segment)}
            <div class="segment-links ml-11">
              {#each links as link}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="segment-link"
                >
                  {link.provider}
                </a>
              {/each}
            </div>
          {/if}

          <!-- Action buttons -->
          <div class="flex flex-wrap gap-2 ml-11">
            <!-- Swap dropdown -->
            {#if getSwapOptions(item.segment.type).length > 0}
              {@const swapOptions = getSwapOptions(item.segment.type)}
              <div class="flex gap-1">
                <select
                  class="action-select"
                  bind:value={swapSelections[item.id]}
                >
                  <option value="">Swap with...</option>
                  {#each swapOptions as segment}
                    <option value={segment.id}>{getSegmentTitle(segment)}</option>
                  {/each}
                </select>
                <button
                  class="action-button"
                  onclick={() => handleSwap(item.id)}
                  disabled={!swapSelections[item.id]}
                  type="button"
                >
                  Swap
                </button>
              </div>
            {/if}

            <!-- Add to day dropdown -->
            <div class="flex gap-1">
              <select
                class="action-select"
                bind:value={daySelections[item.id]}
              >
                <option value="">Add to day...</option>
                {#each getAvailableDays() as day}
                  <option value={day}>Day {day}</option>
                {/each}
              </select>
              <button
                class="action-button"
                onclick={() => handleAddToDay(item.id)}
                disabled={!daySelections[item.id]}
                type="button"
              >
                Add
              </button>
            </div>

            <!-- Remove button -->
            <button
              class="remove-button"
              onclick={() => onRemove(item.id)}
              type="button"
              title="Remove from scratchpad"
            >
              ✕ Remove
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .tab-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: none;
    background: none;
    cursor: pointer;
    color: #6b7280;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: #1f2937;
    background-color: #f9fafb;
  }

  .tab-button.active {
    color: #6366f1;
    border-bottom-color: #6366f1;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 9999px;
    background-color: #6366f1;
    color: white;
  }

  .tab-button.active .count-badge {
    background-color: #4f46e5;
  }

  .action-select {
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background-color: white;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-select:hover {
    border-color: #9ca3af;
  }

  .action-select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .action-button {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid #6366f1;
    background-color: #6366f1;
    color: white;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-button:hover:not(:disabled) {
    background-color: #4f46e5;
    border-color: #4f46e5;
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .remove-button {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid #e5e7eb;
    background-color: white;
    color: #6b7280;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .remove-button:hover {
    background-color: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }

  .segment-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .segment-link {
    display: inline-flex;
    align-items: center;
    font-size: 0.75rem;
    padding: 0.25rem 0.625rem;
    background-color: #f3f4f6;
    color: #4b5563;
    border-radius: 9999px;
    text-decoration: none;
    transition: all 0.2s;
    font-weight: 500;
  }

  .segment-link:hover {
    background-color: #e5e7eb;
    color: #1f2937;
  }

  .empty-state {
    opacity: 0.7;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
