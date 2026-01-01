# Hotel Night Expansion - Quick Reference

## What Changed

Hotel segments with check-in/check-out dates now appear on **every night of the stay** plus a checkout entry.

## Before & After

### Before (1 entry)
```
Jan 8: Hotel L'Esplanade
```

### After (8 entries for 7-night stay)
```
Jan 8:  Hotel L'Esplanade - Night 1 of 7
Jan 9:  Hotel L'Esplanade - Night 2 of 7
Jan 10: Hotel L'Esplanade - Night 3 of 7
Jan 11: Hotel L'Esplanade - Night 4 of 7
Jan 12: Hotel L'Esplanade - Night 5 of 7
Jan 13: Hotel L'Esplanade - Night 6 of 7
Jan 14: Hotel L'Esplanade - Night 7 of 7
Jan 15: Hotel L'Esplanade - Check-out (11:00 AM)
```

## How It Works

1. **Expansion happens in display layer** (not storage)
2. **Only affects hotels** with `checkInDate` and `checkOutDate`
3. **Creates virtual entries** for each night + checkout
4. **Tracks night numbers** via `_hotelNightInfo` property

## Key Functions

### `expandHotelSegments(segments: Segment[]): ExpandedSegment[]`
Expands hotel segments across all nights of stay.

### `ExpandedSegment` Type
```typescript
type ExpandedSegment = Segment & {
  _hotelNightInfo?: {
    nightNumber: number;    // 1, 2, 3, etc. (0 for checkout)
    totalNights: number;    // Total nights (e.g., 7)
    isCheckout: boolean;    // true for checkout entry
  };
};
```

## Modified Components

1. **ItineraryDetail.svelte** - Main detail view
2. **SegmentCard.svelte** - Individual segment display
3. **CalendarView.svelte** - Calendar visualization

## Testing

Run tests: `npx vitest run hotel-expansion`

Test coverage:
- 7-night stays
- 1-night stays
- Non-hotel segments
- Hotels without dates

## Edge Cases

| Case | Behavior |
|------|----------|
| **Multi-night stay** | Expands to N nights + checkout |
| **Single night** | Shows "Night 1 of 1" + checkout |
| **No checkInDate/checkOutDate** | Not expanded (original format) |
| **Same-day check-in/out** | Not expanded |
| **Non-hotel segments** | Unchanged |

## Manual Testing

1. Start dev server: `cd viewer-svelte && npm run dev`
2. Open itinerary with hotel
3. Verify nights appear on each day
4. Check calendar view shows hotel on all dates

## Troubleshooting

**Hotel not expanding?**
- Check if `checkInDate` and `checkOutDate` exist
- Verify dates are different (not same day)
- Check console for errors

**Wrong night numbers?**
- Verify check-in date is correct
- Check timezone handling (should use UTC)

**Checkout not appearing?**
- Should appear on `checkOutDate` with time "11:00 AM"
- Look for `isCheckout: true` in segment

## Code Location

- **Implementation**: `viewer-svelte/src/lib/components/ItineraryDetail.svelte` (lines 191-261)
- **Display Logic**: `viewer-svelte/src/lib/components/SegmentCard.svelte` (lines 26-49)
- **Tests**: `tests/unit/hotel-expansion.test.ts`
