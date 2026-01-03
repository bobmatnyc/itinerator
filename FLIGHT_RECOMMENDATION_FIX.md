# Flight Recommendation Fix

## Problem
The Trip Designer model was calling `search_flights` but never calling `add_flight` to actually add the recommendation to the itinerary. This resulted in users getting flight options but no segments being created.

## Root Cause
The model didn't understand that:
1. We're building itineraries with **recommendations**, not actual bookings
2. `search_flights` ONLY searches - it doesn't add anything to the itinerary
3. `add_flight` MUST be called after searching to add the recommendation

## Solution
Made minimal, focused changes to clarify the search → add workflow:

### 1. Updated Tool Descriptions (`src/services/trip-designer/tools.ts`)

**`add_flight` tool:**
- **Before:** "Add a flight segment to the itinerary with airline, flight number, and route details"
- **After:** "Add a RECOMMENDED flight to the itinerary. This does NOT book the flight - it adds a flight recommendation that the user can review and book later. MUST be called after search_flights to add your recommended option to the itinerary."

**`search_flights` tool:**
- **Before:** "Search for flight prices and availability using Google Flights via SERP API"
- **After:** "Search for flight prices and availability using Google Flights via SERP API. After calling this, you MUST call add_flight to add the recommended option to the itinerary."

**`add_hotel` tool:**
- Added: "This does NOT book the hotel - it adds a hotel recommendation that the user can review and book later."
- Added: "OR after calling search_hotels" to trigger condition

**`add_activity` tool:**
- Added: "This does NOT book the activity - it adds a recommendation that the user can review and book later."

**`search_hotels` tool:**
- Added: "After calling this, you MUST call add_hotel to add the recommended option to the itinerary."

### 2. Updated System Prompt (`src/prompts/trip-designer/system.md`)

**Section: "CRITICAL WORKFLOW: Search → Add"**
- Added prominent explanation that we're building **recommendations**, not bookings
- Changed examples from "Book a flight" to "Find me a flight" (more accurate)
- Changed confirmation from "I've added the flight" to "I've added a flight recommendation"

**Section: "FLIGHT RECOMMENDATION WORKFLOW" (renamed from "FLIGHT BOOKING WORKFLOW")**
- Renamed section header to emphasize "recommendations" not "bookings"
- Added "CRITICAL UNDERSTANDING" subsection explaining:
  - We build itineraries with recommendations, not bookings
  - `search_flights` finds options but doesn't add them
  - `add_flight` adds recommendations (not bookings)
  - User will book themselves later
- Added explicit rule: "After every search_flights call, you MUST call add_flight"
- Extended pattern to ALL search tools (flights, hotels, etc.)

## Expected Behavior After Fix

### Before (WRONG):
```
User: "Find me a flight from NYC to Tokyo"
AI: *calls search_flights*
AI: "I found some great flight options!"
[NO SEGMENT CREATED]
```

### After (CORRECT):
```
User: "Find me a flight from NYC to Tokyo"
AI: *calls search_flights*
AI: *calls add_flight with recommended option*
AI: "I've added a United flight to your itinerary as a recommendation!"
[SEGMENT CREATED WITH RECOMMENDATION]
```

## Testing
Test by asking the Trip Designer to:
1. "Find me a flight from SFO to JFK on January 15"
2. "Search for hotels in Paris"
3. Verify that both search AND add tools are called
4. Verify segment appears in itinerary

## Files Changed
- `src/services/trip-designer/tools.ts` - Tool descriptions
- `src/prompts/trip-designer/system.md` - System prompt clarifications
