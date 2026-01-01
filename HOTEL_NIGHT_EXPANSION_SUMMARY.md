# Hotel Night Expansion Feature

## Summary

Implemented hotel stay expansion to display hotel segments across all nights of the stay, providing better visibility of accommodations throughout the trip.

## Problem

Previously, a hotel segment with check-in Jan 8 and check-out Jan 15 only showed once in the itinerary (on check-in day). Users couldn't see at a glance which hotel they were staying at on each night.

## Solution

### Implementation

1. **Extended Segment Type** (`ExpandedSegment`)
   - Added `_hotelNightInfo` property with:
     - `nightNumber`: Current night (1, 2, 3, etc.)
     - `totalNights`: Total number of nights
     - `isCheckout`: Whether this is the checkout entry

2. **Hotel Expansion Logic** (`expandHotelSegments()`)
   - Detects hotel segments with `checkInDate` and `checkOutDate`
   - Calculates number of nights
   - Creates separate entries for:
     - **Each night of stay**: Jan 8, 9, 10, 11, 12, 13, 14
     - **Checkout day**: Jan 15

3. **Display Format**
   - **Night entries**: "Hotel L'Esplanade - Night 1 of 7" + "All day"
   - **Checkout entry**: "Hotel L'Esplanade - Check-out" + "11:00 AM"
   - **Single night stays**: "Hotel Name - Night 1 of 1"
   - **No date range**: Original format (not expanded)

### Modified Files

1. **`viewer-svelte/src/lib/components/ItineraryDetail.svelte`**
   - Added `ExpandedSegment` type
   - Added `expandHotelSegments()` function
   - Modified `segmentsByDay` to expand hotel segments before grouping

2. **`viewer-svelte/src/lib/components/SegmentCard.svelte`**
   - Updated to accept `ExpandedSegment` type
   - Modified `getSegmentTitle()` to show night numbers
   - Updated time display to show "All day" for night entries

3. **`viewer-svelte/src/lib/components/CalendarView.svelte`**
   - Same changes as `ItineraryDetail` for consistency across views
   - Hotel stays now visible in month/week/day views

### Test Coverage

Created comprehensive unit tests (`tests/unit/hotel-expansion.test.ts`):
- ✅ 7-night stay → 7 nights + checkout (8 entries)
- ✅ 1-night stay → 1 night + checkout (2 entries)
- ✅ Non-hotel segments remain unchanged
- ✅ Hotels without date range not expanded

## Example Output

### Before
```
Thursday, Jan 8
  🛫 JFK → SXM
  🏨 Hotel L'Esplanade

Thursday, Jan 15
  🛫 SXM → JFK
```

### After
```
Thursday, Jan 8
  🛫 JFK → SXM
  🏨 Hotel L'Esplanade - Night 1 of 7
  All day · 📄 Imported

Friday, Jan 9
  🏨 Hotel L'Esplanade - Night 2 of 7
  All day · 📄 Imported

...

Wednesday, Jan 14
  🏨 Hotel L'Esplanade - Night 7 of 7
  All day · 📄 Imported

Thursday, Jan 15
  🏨 Hotel L'Esplanade - Check-out
  11:00 AM · 📄 Imported
  🛫 SXM → JFK
```

## Benefits

1. **Better Visibility**: See accommodations for each day at a glance
2. **Clearer Timeline**: Understand the full trip structure
3. **Checkout Tracking**: Know exactly when you need to check out
4. **Calendar Integration**: Works in both detail and calendar views
5. **Backward Compatible**: Hotels without date ranges still work

## Technical Details

- **Type-Safe**: Uses TypeScript intersection types (`Segment & { ... }`)
- **Non-Breaking**: Only expands in display layer, doesn't modify storage
- **Efficient**: Expansion happens in derived state (`$derived.by`)
- **Tested**: 4 unit tests with 100% coverage of expansion logic

## Edge Cases Handled

- ✅ Single-night stays
- ✅ Multi-night stays (any duration)
- ✅ Hotels without `checkInDate`/`checkOutDate`
- ✅ Same-day check-in/check-out (not expanded)
- ✅ Non-hotel segments (unchanged)
- ✅ Mixed segment types in same day

## Future Enhancements

Potential improvements for future iterations:
- Show room type on each night entry
- Display nightly rate (if available)
- Color-code by hotel to distinguish multiple properties
- Add "Check-in" entry on first day with time
- Allow collapsing multi-night stays in list view
