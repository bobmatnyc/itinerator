# ScratchpadPanel Integration

## Summary

Integrated the ScratchpadPanel component into the ItineraryDetail view with a "Recommendations" button, badge showing item count, and slide-in panel from the right.

## Changes Made

### 1. ItineraryDetail Component (`viewer-svelte/src/lib/components/ItineraryDetail.svelte`)

#### Imports Added
```typescript
import type { Scratchpad, ScratchpadItem } from '$lib/types';
import ScratchpadPanel from './ScratchpadPanel.svelte';
```

#### State Added
```typescript
let scratchpadOpen = $state(false);
let scratchpad = $state<Scratchpad>({
  items: [],
  createdAt: new Date(),
  updatedAt: new Date()
});
```

#### Event Handlers Added

**handleSwap**: Swap scratchpad item with existing segment
- Calls `POST /api/v1/itineraries/{id}/scratchpad/{itemId}/swap`
- Removes item from scratchpad on success
- Shows success/error toast

**handleAddToDay**: Add scratchpad item to specific day
- Calls `POST /api/v1/itineraries/{id}/scratchpad/{itemId}/add`
- Removes item from scratchpad on success
- Shows success/error toast

**handleRemoveFromScratchpad**: Remove item from scratchpad
- Calls `DELETE /api/v1/itineraries/{id}/scratchpad/{itemId}`
- Removes item from local state
- Shows success/error toast

#### UI Changes

**Metadata Header** (lines 415-445):
```svelte
<div class="metadata-header">
  <div class="button-group">
    <button class="minimal-button" onclick={startEditingMetadata}>
      ✏️ Edit Details
    </button>
    <button class="minimal-button" onclick={() => showImportDialog = true}>
      📥 Import
    </button>
  </div>
  <button
    class="minimal-button recommendations-button"
    onclick={() => scratchpadOpen = true}
  >
    💡 Recommendations
    {#if scratchpad.items.length > 0}
      <span class="scratchpad-badge">{scratchpad.items.length}</span>
    {/if}
  </button>
</div>
```

**ScratchpadPanel Component** (at end of template):
```svelte
<ScratchpadPanel
  bind:isOpen={scratchpadOpen}
  {scratchpad}
  itinerarySegments={itinerary.segments}
  onSwap={handleSwap}
  onAddToDay={handleAddToDay}
  onRemove={handleRemoveFromScratchpad}
/>
```

#### CSS Added

```css
.metadata-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.recommendations-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.scratchpad-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  background-color: #6366f1;
  color: white;
}
```

### 2. API Routes Created

#### DELETE `/api/v1/itineraries/[id]/scratchpad/[itemId]/+server.ts`
- Remove item from scratchpad
- Currently returns `{ success: true }` placeholder
- TODO: Implement scratchpad storage service

#### POST `/api/v1/itineraries/[id]/scratchpad/[itemId]/swap/+server.ts`
- Swap scratchpad item with existing segment
- Body: `{ existingSegmentId: string }`
- Currently returns `{ success: true }` placeholder
- TODO: Implement actual swap logic

#### POST `/api/v1/itineraries/[id]/scratchpad/[itemId]/add/+server.ts`
- Add scratchpad item to specific day
- Body: `{ dayNumber: number }`
- Currently returns `{ success: true }` placeholder
- TODO: Implement actual add logic

## Visual Layout

```
┌──────────────────────────────────────────────────┐
│ [Edit Details] [Import]       [💡 Recommendations(5)] │
├──────────────────────────────────────────────────┤
│ Itinerary metadata...                            │
│                                                  │
│ Day 1 - January 8                                │
│ ├─ Flight segment                                │
│ └─ Hotel segment                                 │
│                                                  │
│ Day 2 - January 9                                │
│ └─ Activity segment                              │
└──────────────────────────────────────────────────┘
                                    ┌─────────────┐
                                    │ Alternative │
                                    │ Recommend.  │
                                    │             │
                                    │ Panel slides│
                                    │ in from     │
                                    │ right when  │
                                    │ opened      │
                                    └─────────────┘
```

## User Flow

1. **View Recommendations**: Click "💡 Recommendations" button (shows badge with count if items exist)
2. **Panel Opens**: ScratchpadPanel slides in from right with backdrop
3. **Interact with Items**:
   - **Swap**: Replace existing segment with scratchpad item
   - **Add to Day**: Add segment to specific day in itinerary
   - **Remove**: Remove item from scratchpad
4. **Panel Closes**: Click backdrop, close button, or press Escape

## Next Steps (Backend Implementation)

The frontend integration is complete. The following backend work is needed:

1. **Create ScratchpadService**:
   - Store scratchpad data (in-memory or persistent)
   - Add/remove items
   - Get scratchpad for itinerary

2. **Implement API Route Logic**:
   - `DELETE`: Remove item from scratchpad storage
   - `POST /swap`:
     - Get scratchpad item
     - Update segment in itinerary
     - Remove from scratchpad
   - `POST /add`:
     - Get scratchpad item
     - Calculate date for specified day
     - Add segment to itinerary
     - Remove from scratchpad

3. **Add Trip Designer Integration**:
   - When agent suggests alternatives, add to scratchpad
   - Pass scratchpad context to agent for awareness

## Files Modified

- `viewer-svelte/src/lib/components/ItineraryDetail.svelte` - Added scratchpad integration

## Files Created

- `viewer-svelte/src/routes/api/v1/itineraries/[id]/scratchpad/[itemId]/+server.ts` - DELETE route
- `viewer-svelte/src/routes/api/v1/itineraries/[id]/scratchpad/[itemId]/swap/+server.ts` - Swap route
- `viewer-svelte/src/routes/api/v1/itineraries/[id]/scratchpad/[itemId]/add/+server.ts` - Add route
- `SCRATCHPAD_INTEGRATION.md` - This documentation

## LOC Delta

**Added**: ~150 lines (frontend + API stubs)
**Removed**: 0 lines
**Net Change**: +150 lines

The integration follows the phased delivery approach:
- ✅ **Phase 1 (MVP)**: Frontend integration with placeholder API (complete)
- ⏳ **Phase 2 (Enhancement)**: Backend implementation (next step)
- ⏳ **Phase 3 (Optimization)**: Trip Designer integration
