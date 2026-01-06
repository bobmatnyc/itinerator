# Scratchpad Components

Alternative segment recommendation system for displaying and managing Trip Designer suggestions.

## Overview

The scratchpad system provides a UI for displaying alternative segment recommendations (hotels, flights, activities, transfers) that users can swap with existing segments or add to specific days.

## Components

### 1. ScratchpadPanel.svelte

Collapsible side panel that displays the scratchpad.

**Props:**
- `isOpen` (bindable): Controls panel visibility
- `scratchpad`: Scratchpad data structure
- `itinerarySegments`: Current itinerary segments (for swap dropdown)
- `onSwap`: Handler for swapping segments
- `onAddToDay`: Handler for adding to specific day
- `onRemove`: Handler for removing from scratchpad

**Features:**
- Slide-in animation from right
- Backdrop overlay
- Escape key to close
- Responsive (full-width on mobile)

### 2. ScratchpadView.svelte

Main content view with tabs and segment cards.

**Props:**
- `scratchpad`: Scratchpad data structure
- `itinerarySegments`: Current itinerary segments
- `onSwap`: Swap handler
- `onAddToDay`: Add to day handler
- `onRemove`: Remove handler

**Features:**
- Tab navigation by segment type (Flights, Hotels, Activities, Transport)
- Count badges on tabs
- Priority badges (high/medium/low)
- Segment cards matching SegmentCard.svelte design
- Review/booking links
- Action dropdowns for swap and add to day
- Empty states per tab

## Data Types

### Scratchpad
```typescript
interface Scratchpad {
  items: ScratchpadItem[];
  createdAt: Date;
  updatedAt: Date;
}
```

### ScratchpadItem
```typescript
interface ScratchpadItem {
  id: string;
  segment: Segment;
  reason?: string;          // Why recommended
  priority: 'high' | 'medium' | 'low';
  addedAt: Date;
  addedBy?: string;         // Agent/source
}
```

## Usage Example

```svelte
<script lang="ts">
  import ScratchpadPanel from '$lib/components/ScratchpadPanel.svelte';
  import type { Scratchpad } from '$lib/types';

  let isPanelOpen = $state(false);
  let scratchpad: Scratchpad = {
    items: [...],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  function handleSwap(itemId: string, segmentId: string) {
    // Swap logic
  }

  function handleAddToDay(itemId: string, day: number) {
    // Add to day logic
  }

  function handleRemove(itemId: string) {
    // Remove logic
  }
</script>

<button onclick={() => isPanelOpen = true}>
  Open Recommendations ({scratchpad.items.length})
</button>

<ScratchpadPanel
  bind:isOpen={isPanelOpen}
  {scratchpad}
  itinerarySegments={itinerary.segments}
  onSwap={handleSwap}
  onAddToDay={handleAddToDay}
  onRemove={handleRemove}
/>
```

## Integration Points

### With Trip Designer
Trip Designer can populate scratchpad with alternatives:
```typescript
// When Trip Designer suggests alternatives
const scratchpadItem: ScratchpadItem = {
  id: generateId(),
  segment: recommendedSegment,
  reason: 'Better price and location',
  priority: 'high',
  addedAt: new Date(),
  addedBy: 'Trip Designer'
};
```

### With Itinerary Service
Swap and add operations update itinerary:
```typescript
async function handleSwap(itemId: string, segmentId: string) {
  const item = scratchpad.items.find(i => i.id === itemId);
  const existingSegment = itinerary.segments.find(s => s.id === segmentId);

  if (item && existingSegment) {
    // Replace existing segment with recommended one
    await itineraryService.replaceSegment(
      itinerary.id,
      segmentId,
      item.segment
    );

    // Remove from scratchpad
    await handleRemove(itemId);
  }
}

async function handleAddToDay(itemId: string, day: number) {
  const item = scratchpad.items.find(i => i.id === itemId);

  if (item) {
    // Add segment to specific day
    await itineraryService.addSegment(
      itinerary.id,
      item.segment,
      day
    );

    // Remove from scratchpad
    await handleRemove(itemId);
  }
}
```

## Design Decisions

1. **Reuses SegmentCard design**: Consistent with existing segment display
2. **Left border color**: Purple (#c084fc) to differentiate from other sources
3. **Tab navigation**: Organized by segment type for easy browsing
4. **Inline actions**: Swap/add/remove directly on each card
5. **Priority badges**: Visual hierarchy for recommendations
6. **Empty states**: Clear feedback when no items in a category

## Styling

Uses existing minimal design system:
- `minimal-card` for cards
- `minimal-button` for actions
- `minimal-badge` for counts and priority
- Tailwind utilities for layout
- Custom styles for tabs and dropdowns

## Accessibility

- Keyboard navigation (Tab, Escape)
- ARIA labels on interactive elements
- Semantic HTML (buttons, selects)
- Focus states on all controls

## Performance

- Svelte 5 runes for reactive state ($state, $derived)
- Efficient filtering by tab type
- No unnecessary re-renders
- Lazy loading of segment images

## Future Enhancements

- [ ] Drag-and-drop to reorder or add to itinerary
- [ ] Bulk actions (add all, remove all)
- [ ] Filtering by priority
- [ ] Search within scratchpad
- [ ] Persist scratchpad to storage
- [ ] Notification when new items added
- [ ] Compare side-by-side with existing segments
- [ ] Export scratchpad as PDF/email

## Files

- `src/lib/types/scratchpad.ts` - Type definitions
- `src/lib/components/ScratchpadPanel.svelte` - Side panel wrapper
- `src/lib/components/ScratchpadView.svelte` - Main content view
- `src/lib/components/ScratchpadDemo.svelte` - Example usage
