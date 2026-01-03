# Trip Designer Tool Calling Investigation

**Date:** 2026-01-01
**Issue:** `add_flight` and `add_hotel` are NEVER called by the Trip Designer, but `add_activity` is successfully called

## Root Cause

The Trip Designer uses **progressive tool disclosure** that provides different tool sets based on whether it's the first user message or a subsequent message:

### Tool Sets by Message Number

**First User Message (ESSENTIAL_TOOLS):**
```typescript
export const ESSENTIAL_TOOLS: ToolDefinition[] = [
  GET_ITINERARY_TOOL,
  UPDATE_ITINERARY_TOOL,
  UPDATE_PREFERENCES_TOOL,
  ADD_TRAVELER_TOOL,
  SEARCH_WEB_TOOL,  // ✅ Available
];
```

**Subsequent Messages (ALL_TOOLS):**
```typescript
export const ALL_TOOLS: ToolDefinition[] = [
  GET_ITINERARY_TOOL,
  GET_SEGMENT_TOOL,
  UPDATE_ITINERARY_TOOL,
  UPDATE_PREFERENCES_TOOL,
  ADD_TRAVELER_TOOL,
  ADD_FLIGHT_TOOL,      // ❌ NOT available on first message
  ADD_HOTEL_TOOL,       // ❌ NOT available on first message
  ADD_ACTIVITY_TOOL,    // ❌ NOT available on first message
  ADD_TRANSFER_TOOL,
  ADD_MEETING_TOOL,
  UPDATE_SEGMENT_TOOL,
  DELETE_SEGMENT_TOOL,
  MOVE_SEGMENT_TOOL,
  REORDER_SEGMENTS_TOOL,
  SEARCH_WEB_TOOL,      // ✅ Available
  SEARCH_FLIGHTS_TOOL,  // ✅ Available
  SEARCH_HOTELS_TOOL,   // ✅ Available
  SEARCH_TRANSFERS_TOOL,
  STORE_TRAVEL_INTELLIGENCE_TOOL,
  RETRIEVE_TRAVEL_INTELLIGENCE_TOOL,
  // Geography tools
  GET_DISTANCE_TOOL,
  SHOW_ROUTE_TOOL,
  GEOCODE_LOCATION_TOOL,
];
```

### Detection Logic

**File:** `/Users/masa/Projects/itinerator/src/services/trip-designer/trip-designer.service.ts`

**Line 162:**
```typescript
const tools = isFirstMessage ? ESSENTIAL_TOOLS : ALL_TOOLS;
```

**Line 339:**
```typescript
const isFirstMessage = session.messages.filter(m => m.role === 'user').length === 1;
const tools = this.getToolsForMode(session.agentMode, isFirstMessage);
```

## Why This Causes the Observed Behavior

### Scenario: User mentions flights/hotels on first message

**User:** "I'm planning a trip to Portugal, flying SFO to Lisbon on United."

**Model's Available Tools:**
- ❌ `add_flight` - **NOT AVAILABLE**
- ❌ `add_hotel` - **NOT AVAILABLE**
- ❌ `add_activity` - **NOT AVAILABLE**
- ✅ `search_flights` - Available
- ✅ `update_itinerary` - Available
- ✅ `update_preferences` - Available

**Result:** Model can search for flights using `search_flights`, but **CANNOT add the flight** to the itinerary because `add_flight` is not in ESSENTIAL_TOOLS.

### Scenario: User mentions activities on first message

**User:** "I want to visit Jerónimos Monastery."

**Model's Available Tools:**
- ❌ `add_activity` - **NOT AVAILABLE**
- ✅ `search_web` - Available
- ✅ `update_preferences` - Available (can note interest)

**Result:** Model can search web for info but **CANNOT add the activity** to the itinerary.

### Why `add_activity` Sometimes Works

If the user says something on the **second message** like "Add dinner at Le Tastevin", then:

**Model's Available Tools (2nd message):**
- ✅ `add_activity` - **NOW AVAILABLE** (ALL_TOOLS)
- ✅ `add_flight` - Now available
- ✅ `add_hotel` - Now available

**Result:** Model successfully calls `add_activity`.

## Tool Definition Comparison

All three tools (`add_flight`, `add_hotel`, `add_activity`) are **identically structured** in `/Users/masa/Projects/itinerator/src/services/trip-designer/tools.ts`:

1. ✅ Properly defined with required/optional parameters
2. ✅ Have clear descriptions (even enhanced with "REQUIRED CALL" language for hotel/activity)
3. ✅ All validation schemas exist in tool-executor.ts
4. ✅ All handlers implemented (handleAddFlight, handleAddHotel, handleAddActivity)

**There is NO difference in tool quality** - the difference is purely in **availability timing**.

## Evidence from Tool Descriptions

### ADD_HOTEL_TOOL (Line 140):
```typescript
description: 'REQUIRED CALL when user mentions ANY accommodation (hotel, resort, Airbnb, "staying at", etc.). Add a hotel or accommodation segment to the itinerary. You MUST call this tool immediately when user mentions where they are staying - verbal acknowledgment alone will NOT save the data.'
```

### ADD_ACTIVITY_TOOL (Line 225):
```typescript
description: 'REQUIRED CALL when user mentions ANY dining/activity (restaurant, tour, museum, show, etc.) OR when you recommend one. Add an activity, tour, dining experience, or attraction to the itinerary. You MUST call this tool immediately when mentioning restaurants or activities - verbal discussion alone will NOT save the data.'
```

### ADD_FLIGHT_TOOL (Line 56):
```typescript
description: 'Add a flight segment to the itinerary with airline, flight number, and route details',
```

**Observation:** Despite the strong "REQUIRED CALL" language in hotel/activity tools, they are **not available on the first message**, so the model CANNOT comply with the instruction.

## Why This Design Exists

**Intent:** Reduce token count on the first message by limiting tool definitions to essential planning tools (itinerary metadata, preferences, travelers, search).

**Trade-off:** Users who provide concrete booking details (flights, hotels, activities) on their **first message** will have those details acknowledged conversationally but **NOT saved** to the itinerary.

## Summary

| Tool | First Message | Subsequent Messages | Working? |
|------|---------------|---------------------|----------|
| `add_flight` | ❌ Not available | ✅ Available | **Never works on 1st message** |
| `add_hotel` | ❌ Not available | ✅ Available | **Never works on 1st message** |
| `add_activity` | ❌ Not available | ✅ Available | **Never works on 1st message** |
| `search_flights` | ✅ Available | ✅ Available | ✅ Always works |
| `search_web` | ✅ Available | ✅ Available | ✅ Always works |
| `update_itinerary` | ✅ Available | ✅ Available | ✅ Always works |

## Recommended Solutions

### Option 1: Add segment tools to ESSENTIAL_TOOLS
**Impact:** Increases first message token count
**Benefit:** Allows immediate capture of booking details

```typescript
export const ESSENTIAL_TOOLS: ToolDefinition[] = [
  GET_ITINERARY_TOOL,
  UPDATE_ITINERARY_TOOL,
  UPDATE_PREFERENCES_TOOL,
  ADD_TRAVELER_TOOL,
  ADD_FLIGHT_TOOL,      // ✅ Add
  ADD_HOTEL_TOOL,       // ✅ Add
  ADD_ACTIVITY_TOOL,    // ✅ Add
  SEARCH_WEB_TOOL,
];
```

### Option 2: Auto-trigger second response
**Impact:** No token increase
**Benefit:** After first message, immediately send a system message to trigger tool availability

```typescript
// After first message processing
if (isFirstMessage && conversationMentionsBookingDetails(userMessage)) {
  await sendMessage(sessionId, "Ready to add booking details to your itinerary.");
  // Now ALL_TOOLS are available for the model's response
}
```

### Option 3: Detect and defer
**Impact:** Requires conversation state management
**Benefit:** Model explicitly tells user "I'll add that after you answer a few questions"

```typescript
// In system prompt for first message:
"If user provides booking details (flights, hotels, activities) on this first message,
acknowledge them and explain you'll add them to the itinerary after collecting basic
trip information (dates, travelers, preferences)."
```

## Verification Test Plan

**Test Case 1: Flight on First Message**
```
User: "I'm flying UA123 from SFO to Lisbon on Jan 3"
Expected: Flight NOT added (current behavior)
With Fix: Flight added to itinerary
```

**Test Case 2: Hotel on First Message**
```
User: "We're staying at Hotel L'Esplanade in Zagreb"
Expected: Hotel NOT added (current behavior)
With Fix: Hotel added to itinerary
```

**Test Case 3: Activity on First Message**
```
User: "I want to visit Pena Palace"
Expected: Activity NOT added (current behavior)
With Fix: Activity added to itinerary
```

**Test Case 4: Second Message (should work already)**
```
User: "Add dinner at Le Tastevin on Jan 4 at 7pm"
Expected: Activity added (already works)
Status: ✅ Working correctly
```

---

**Conclusion:** The issue is NOT with the tool definitions themselves, but with **progressive tool disclosure**. The model cannot call `add_flight`, `add_hotel`, or `add_activity` on the first user message because these tools are intentionally excluded from ESSENTIAL_TOOLS to reduce token count. This design decision creates a UX gap where booking details mentioned on the first message are acknowledged but not persisted.
