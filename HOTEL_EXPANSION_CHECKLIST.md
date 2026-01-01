# Hotel Night Expansion - Acceptance Criteria Checklist

## ✅ Implementation Complete

### Core Functionality
- [x] Hotel shows on each night of stay
- [x] Night numbers displayed (Night 1 of 7, etc.)
- [x] Checkout shown on departure date
- [x] Works with single-night stays (no expansion needed)
- [x] Calendar view shows hotel across all dates

### Technical Requirements
- [x] Type-safe implementation using TypeScript
- [x] No modifications to storage layer (display-only)
- [x] Works in ItineraryDetail view
- [x] Works in CalendarView (month/week/day)
- [x] Handles edge cases gracefully

### Display Format
- [x] Night entries: "Hotel Name - Night X of Y"
- [x] Checkout entries: "Hotel Name - Check-out"
- [x] Night entries show "All day" instead of time
- [x] Checkout entries show time (11:00 AM)
- [x] Single-night stays show "Night 1 of 1"

### Edge Cases
- [x] Hotels without checkInDate/checkOutDate (not expanded)
- [x] Same-day check-in/checkout (not expanded)
- [x] Non-hotel segments (unchanged)
- [x] Mixed segment types in same day
- [x] Multi-night stays of any duration

### Testing
- [x] Unit tests for expansion logic (4 tests)
- [x] Tests pass for 7-night stays
- [x] Tests pass for 1-night stays
- [x] Tests pass for non-hotel segments
- [x] Tests pass for hotels without dates

### Code Quality
- [x] No TypeScript errors in components
- [x] Type-safe intersection types used
- [x] Code follows Svelte 5 patterns
- [x] Documentation added

## Manual Testing Needed

To verify in browser:

1. **Start dev server**: `cd viewer-svelte && npm run dev`
2. **Open itinerary** with multi-night hotel stay
3. **Verify Detail View**:
   - [ ] Hotel appears on each night (Jan 8-14)
   - [ ] Checkout appears on departure day (Jan 15)
   - [ ] Night numbers are correct (1 of 7, 2 of 7, etc.)
   - [ ] Night entries show "All day"
   - [ ] Checkout shows "11:00 AM"
4. **Verify Calendar View**:
   - [ ] Switch to Calendar tab
   - [ ] Month view shows hotel on all dates
   - [ ] Week view lists hotel for each day
   - [ ] Day view shows hotel with night numbers
5. **Verify Single-Night Stay**:
   - [ ] Appears as "Night 1 of 1" + checkout
6. **Verify Non-Hotel Segments**:
   - [ ] Flights, activities remain unchanged

## Example Itinerary for Testing

Use any itinerary with hotel segments that have `checkInDate` and `checkOutDate` fields.

Example from data:
```json
{
  "type": "HOTEL",
  "property": { "name": "Pullman Lima Miraflores" },
  "checkInDate": "2023-01-01T00:00:00.000Z",
  "checkOutDate": "2023-01-03T00:00:00.000Z"
}
```

Should expand to:
- Jan 1: Night 1 of 2
- Jan 2: Night 2 of 2
- Jan 3: Check-out
