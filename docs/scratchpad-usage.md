# Scratchpad Usage Guide

The Scratchpad is a feature for storing alternative segment recommendations that can be swapped into the main itinerary.

## Overview

The Scratchpad allows you to:
- Store alternative recommendations organized by type (flights, hotels, activities, etc.)
- Tag and prioritize alternatives for easy filtering
- Link alternatives to specific segments they could replace
- Swap scratchpad items into the main itinerary

## Type Definitions

```typescript
interface ScratchpadItem {
  id: ScratchpadItemId;           // UUID
  itineraryId: ItineraryId;        // Parent itinerary
  segment: Segment;                // Reuses existing Segment type
  addedAt: Date;                   // When it was added
  source: 'designer' | 'agent' | 'user' | 'search';
  notes?: string;                  // Why this was recommended
  priority?: 'high' | 'medium' | 'low';
  tags: string[];                  // e.g., ['backup-hotel', 'romantic', 'budget']
  relatedSegmentId?: SegmentId;    // Segment this could replace
}

interface Scratchpad {
  itineraryId: ItineraryId;
  items: ScratchpadItem[];
  byType: {
    FLIGHT: ScratchpadItem[];
    HOTEL: ScratchpadItem[];
    ACTIVITY: ScratchpadItem[];
    TRANSFER: ScratchpadItem[];
    MEETING: ScratchpadItem[];
    CUSTOM: ScratchpadItem[];
  };
}
```

## Basic Usage

### Adding Items to Scratchpad

```typescript
import { addToScratchpad } from './utils/scratchpad.js';
import type { Itinerary, FlightSegment } from './domain/types';

// Create an alternative flight segment
const alternativeFlight: FlightSegment = {
  // ... flight details
};

// Add to scratchpad with metadata
const updatedItinerary = addToScratchpad(itinerary, alternativeFlight, {
  source: 'designer',
  notes: 'Cheaper option, slightly longer layover',
  priority: 'high',
  tags: ['budget-friendly', 'backup'],
  relatedSegmentId: existingFlightId, // Optional: link to segment it could replace
});
```

### Filtering Scratchpad Items

```typescript
import { getByType, getByTag, getByPriority, getRelatedItems } from './utils/scratchpad.js';

// Get all flight alternatives
const flightOptions = getByType(itinerary.scratchpad, 'FLIGHT');

// Get all budget-friendly options
const budgetOptions = getByTag(itinerary.scratchpad, 'budget-friendly');

// Get high-priority alternatives
const highPriority = getByPriority(itinerary.scratchpad, 'high');

// Get alternatives for a specific segment
const alternatives = getRelatedItems(itinerary.scratchpad, segmentId);
```

### Swapping a Scratchpad Item

```typescript
import { swapSegment } from './utils/scratchpad.js';

// Swap a scratchpad item with an existing segment
const { itinerary: updated, result } = swapSegment(
  itinerary,
  scratchpadItemId,
  existingSegmentId
);

console.log('Removed:', result.removedSegment);
console.log('Added:', result.addedSegment);
console.log('Used item:', result.scratchpadItem);

// The scratchpad item is automatically removed after swap
```

### Removing Items

```typescript
import { removeFromScratchpad } from './utils/scratchpad.js';

const updated = removeFromScratchpad(itinerary, scratchpadItemId);
```

## Advanced Usage

### Counting Items by Type

```typescript
import { countByType } from './utils/scratchpad.js';

const counts = countByType(itinerary.scratchpad);
console.log(`Flights: ${counts.FLIGHT}, Hotels: ${counts.HOTEL}`);
```

### Rebuilding Type Index

If the byType index becomes inconsistent (e.g., after manual manipulation):

```typescript
import { rebuildByTypeIndex } from './utils/scratchpad.js';

itinerary.scratchpad = rebuildByTypeIndex(itinerary.scratchpad);
```

## Use Cases

### Trip Designer Workflow

```typescript
// 1. Trip Designer generates multiple hotel options
const option1 = createHotelSegment({ name: 'Luxury Hotel', price: 500 });
const option2 = createHotelSegment({ name: 'Budget Hotel', price: 150 });
const option3 = createHotelSegment({ name: 'Mid-Range Hotel', price: 250 });

// 2. Add main choice to itinerary
itinerary.segments.push(option2);

// 3. Add alternatives to scratchpad
let updated = addToScratchpad(itinerary, option1, {
  source: 'designer',
  notes: 'Premium option with spa',
  priority: 'low',
  tags: ['luxury', 'spa'],
  relatedSegmentId: option2.id,
});

updated = addToScratchpad(updated, option3, {
  source: 'designer',
  notes: 'Good middle ground',
  priority: 'medium',
  tags: ['mid-range'],
  relatedSegmentId: option2.id,
});

// 4. Later, user decides to upgrade
const alternatives = getRelatedItems(updated.scratchpad, option2.id);
const luxuryOption = alternatives.find(alt => alt.tags.includes('luxury'));

if (luxuryOption) {
  const { itinerary: final } = swapSegment(
    updated,
    luxuryOption.id,
    option2.id
  );
  // Luxury hotel now in itinerary, budget hotel removed
}
```

### Flight Booking with Backups

```typescript
// Primary flight booking
const primaryFlight = createFlightSegment({ /* ... */ });
itinerary.segments.push(primaryFlight);

// Add backup flights to scratchpad
const backup1 = createFlightSegment({ /* earlier departure */ });
const backup2 = createFlightSegment({ /* different airline */ });

let updated = addToScratchpad(itinerary, backup1, {
  source: 'agent',
  notes: 'Departs 2 hours earlier',
  priority: 'high',
  tags: ['backup', 'earlier-departure'],
  relatedSegmentId: primaryFlight.id,
});

updated = addToScratchpad(updated, backup2, {
  source: 'agent',
  notes: 'Via different carrier, longer layover',
  priority: 'medium',
  tags: ['backup', 'alternative-carrier'],
  relatedSegmentId: primaryFlight.id,
});

// If primary flight gets cancelled, swap in backup
if (primaryFlight.status === 'CANCELLED') {
  const backups = getRelatedItems(updated.scratchpad, primaryFlight.id)
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority!] - priorityOrder[b.priority!];
    });

  if (backups.length > 0) {
    const { itinerary: rebooked } = swapSegment(
      updated,
      backups[0].id,
      primaryFlight.id
    );
  }
}
```

## Validation

All scratchpad operations use Zod schemas for validation:

```typescript
import { scratchpadItemSchema, addToScratchpadSchema } from './domain/schemas';

// Validate scratchpad item
const result = scratchpadItemSchema.safeParse(item);
if (!result.success) {
  console.error(result.error);
}

// Validate add operation
const addResult = addToScratchpadSchema.safeParse({
  segment: flightSegment,
  source: 'designer',
  priority: 'high',
  tags: ['backup'],
});
```

## Storage Considerations

The scratchpad is stored as part of the Itinerary:

```typescript
interface Itinerary {
  // ... other fields
  scratchpad?: Scratchpad;  // Optional field
}
```

- **Initialization**: Scratchpad is automatically created when first item is added
- **Persistence**: Saved with itinerary to storage (JSON/Blob)
- **Size**: Consider limiting scratchpad items to avoid bloat (e.g., max 50 items)

## Best Practices

1. **Use Tags Liberally**: Tags make filtering much easier
   ```typescript
   tags: ['budget', 'reviewed', 'user-requested', 'backup']
   ```

2. **Set Priorities**: Helps when automatically selecting alternatives
   ```typescript
   priority: 'high'  // User's top choice
   ```

3. **Add Notes**: Explain why this alternative was recommended
   ```typescript
   notes: 'Cheaper by $200, but 1 more connection'
   ```

4. **Link Related Segments**: Makes finding alternatives easier
   ```typescript
   relatedSegmentId: mainSegmentId
   ```

5. **Clean Up**: Remove scratchpad items after they're no longer needed
   ```typescript
   // After user confirms final itinerary
   itinerary.scratchpad = undefined;
   ```

## Error Handling

All utility functions throw descriptive errors:

```typescript
try {
  const updated = removeFromScratchpad(itinerary, itemId);
} catch (error) {
  if (error.message.includes('Scratchpad does not exist')) {
    // Handle missing scratchpad
  } else if (error.message.includes('not found')) {
    // Handle missing item
  }
}
```

## Type Safety

All operations are fully type-safe with TypeScript:

```typescript
// Type inference works automatically
const item = scratchpad.items[0];
if (item.segment.type === 'FLIGHT') {
  // TypeScript knows this is FlightSegment
  console.log(item.segment.airline);
}

// Discriminated unions for segment types
const flights = scratchpad.byType.FLIGHT;
// Each item.segment is typed as FlightSegment
```
