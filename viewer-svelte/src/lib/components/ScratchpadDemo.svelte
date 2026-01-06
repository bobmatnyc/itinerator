<script lang="ts">
  /**
   * Demo component showing how to use ScratchpadPanel
   * This can be removed or used as a reference
   */
  import ScratchpadPanel from './ScratchpadPanel.svelte';
  import type { Scratchpad, ScratchpadItem } from '$lib/types/scratchpad';
  import type { Segment } from '$lib/types';

  // Example scratchpad data
  const exampleScratchpad: Scratchpad = {
    items: [
      {
        id: 'sp-1',
        segment: {
          id: 'seg-1',
          type: 'HOTEL',
          property: { name: 'Park Hyatt Tokyo' },
          location: {
            name: 'Shinjuku',
            city: 'Tokyo',
            country: 'Japan',
            type: 'HOTEL'
          },
          status: 'TENTATIVE',
          startDatetime: '2025-03-15T15:00:00Z',
          endDatetime: '2025-03-17T11:00:00Z',
          checkInDate: '2025-03-15',
          checkOutDate: '2025-03-17',
          roomCount: 1,
          amenities: ['WiFi', 'Pool', 'Gym'],
          travelerIds: [],
          source: 'agent',
          sourceDetails: {
            model: 'claude-opus-4',
            confidence: 0.95
          },
          price: {
            amount: 450,
            currency: 'USD'
          },
          metadata: {}
        } as Segment,
        reason: 'Iconic views, featured in Lost in Translation',
        priority: 'high',
        addedAt: new Date(),
        addedBy: 'Trip Designer'
      },
      {
        id: 'sp-2',
        segment: {
          id: 'seg-2',
          type: 'HOTEL',
          property: { name: 'Aman Tokyo' },
          location: {
            name: 'Otemachi',
            city: 'Tokyo',
            country: 'Japan',
            type: 'HOTEL'
          },
          status: 'TENTATIVE',
          startDatetime: '2025-03-15T15:00:00Z',
          endDatetime: '2025-03-17T11:00:00Z',
          checkInDate: '2025-03-15',
          checkOutDate: '2025-03-17',
          roomCount: 1,
          amenities: ['WiFi', 'Spa', 'Restaurant'],
          travelerIds: [],
          source: 'agent',
          price: {
            amount: 750,
            currency: 'USD'
          },
          metadata: {}
        } as Segment,
        reason: 'Ultra-luxury ryokan-inspired design',
        priority: 'medium',
        addedAt: new Date(),
        addedBy: 'Trip Designer'
      },
      {
        id: 'sp-3',
        segment: {
          id: 'seg-3',
          type: 'ACTIVITY',
          name: 'TeamLab Borderless',
          description: 'Immersive digital art museum with interactive installations',
          location: {
            name: 'Odaiba',
            city: 'Tokyo',
            country: 'Japan',
            type: 'ATTRACTION'
          },
          status: 'TENTATIVE',
          startDatetime: '2025-03-16T10:00:00Z',
          endDatetime: '2025-03-16T13:00:00Z',
          travelerIds: [],
          source: 'agent',
          price: {
            amount: 35,
            currency: 'USD'
          },
          metadata: {}
        } as Segment,
        reason: 'Unique digital art experience, highly rated',
        priority: 'high',
        addedAt: new Date(),
        addedBy: 'Trip Designer'
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Example itinerary segments for swap options
  const exampleItinerarySegments: Segment[] = [
    {
      id: 'existing-hotel-1',
      type: 'HOTEL',
      property: { name: 'Current Hotel' },
      location: {
        name: 'Shibuya',
        city: 'Tokyo',
        type: 'HOTEL'
      },
      status: 'CONFIRMED',
      startDatetime: '2025-03-15T15:00:00Z',
      endDatetime: '2025-03-17T11:00:00Z',
      checkInDate: '2025-03-15',
      checkOutDate: '2025-03-17',
      roomCount: 1,
      amenities: [],
      travelerIds: [],
      source: 'import',
      metadata: {}
    } as Segment
  ];

  // Panel state
  let isPanelOpen = $state(false);

  // Handlers
  function handleSwap(scratchpadItemId: string, existingSegmentId: string) {
    console.log('Swap:', { scratchpadItemId, existingSegmentId });
    // TODO: Implement swap logic
  }

  function handleAddToDay(scratchpadItemId: string, dayNumber: number) {
    console.log('Add to day:', { scratchpadItemId, dayNumber });
    // TODO: Implement add to day logic
  }

  function handleRemove(itemId: string) {
    console.log('Remove:', itemId);
    // TODO: Implement remove logic
  }
</script>

<div class="demo-container p-8">
  <h1 class="text-2xl font-bold mb-4">Scratchpad Demo</h1>

  <button
    class="minimal-button"
    onclick={() => (isPanelOpen = true)}
  >
    Open Scratchpad ({exampleScratchpad.items.length} items)
  </button>

  <ScratchpadPanel
    bind:isOpen={isPanelOpen}
    scratchpad={exampleScratchpad}
    itinerarySegments={exampleItinerarySegments}
    onSwap={handleSwap}
    onAddToDay={handleAddToDay}
    onRemove={handleRemove}
  />
</div>

<style>
  .demo-container {
    max-width: 800px;
    margin: 0 auto;
  }
</style>
