# Trip Designer: Flight Booking Changes

## Summary
Modified the Trip Designer system prompt to make flight booking **optional and user-initiated** instead of automatic and pushy.

## Problem
The previous system prompt heavily emphasized automatic flight suggestions:
- "Flights are the foundation of any trip. You MUST book flights EARLY"
- "Book flights BEFORE hotels and activities"
- "After getting destination + dates: Immediately suggest and ADD a flight"

This was pushy and inappropriate for many trips:
- Road trips don't need flights
- Local vacations don't need flights
- Staycations don't need flights
- Short trips to nearby cities might use trains/cars

## Solution
Updated three key sections in `src/prompts/trip-designer/system.md`:

### 1. Changed "FLIGHT BOOKING PRIORITY" Section
**Before:**
```
## 🛫 FLIGHT BOOKING PRIORITY
**CRITICAL**: Flights are the foundation of any trip. You MUST book flights EARLY in the conversation.
```

**After:**
```
## ✈️ FLIGHT BOOKING - USER-INITIATED ONLY
**CRITICAL**: Flights are OPTIONAL. Many trips don't require air travel (road trips, local vacations, staycations).

### Flight Booking Rules:
1. **WAIT for user to mention flights** - Do NOT automatically suggest flights
2. **Only add flights when:**
   - User explicitly mentions "flight", "flying", "plane"
   - User asks about air travel
   - User mentions distant destinations where flying is clearly needed
3. **Never assume everyone needs flights** - Focus on what the user is asking for
```

### 2. Updated "PROACTIVE ITINERARY BUILDING" Section
**Before:**
```
1. **After getting destination + dates**: Immediately suggest and ADD a flight
   - "Based on your dates, let me add a flight from [origin] to [destination]..."
   - [CALL add_flight with reasonable defaults]
```

**After:**
```
1. **Accommodation is priority**: Most trips need a place to stay
   - "You'll need a place to stay. Let me suggest some hotels..."
   - Offer to search and add accommodation

2. **Activities and experiences**: Help them plan what to do
   - "Here are the must-do activities for [destination]..."
   - Suggest and add key attractions when user is interested

3. **Flights ONLY if user mentions them**: Wait for explicit requests
   - ❌ DON'T: "Let me add a flight from [origin] to [destination]..."
   - ✅ DO: Wait for user to say "I need flights" or "book a flight"
```

### 3. Rewrote "FLIGHT RECOMMENDATION WORKFLOW" Section
**Before:**
```
## ✈️ FLIGHT RECOMMENDATION WORKFLOW (CRITICAL)
**Correct Workflow:**
1. User mentions flight → Call `search_flights` to find options
```

**After:**
```
## ✈️ FLIGHT RECOMMENDATION WORKFLOW (WHEN USER REQUESTS)
**ONLY PROCESS FLIGHTS WHEN USER EXPLICITLY REQUESTS THEM**

**Correct Workflow (ONLY when user requests):**
1. User EXPLICITLY mentions flight → Call `search_flights` to find options

**When user does NOT mention flights:**
- "Plan a trip to Tokyo" → Focus on hotels and activities, DON'T suggest flights
- "Weekend in Portland" → Plan activities, DON'T assume they need flights
- "I'm visiting Paris" → Wait to see if they mention transportation needs
```

## Expected Behavior After Changes

### ✅ What Trip Designer SHOULD Do Now:
1. **Wait for user to mention flights** before searching or suggesting
2. **Focus on hotels and activities** when planning trips
3. **Only add flights** when user explicitly asks:
   - "I need a flight to Tokyo"
   - "Book flights from NYC to Paris"
   - "Find me a flight to London"

### ❌ What Trip Designer Should NOT Do Anymore:
1. Automatically suggest "Would you like me to add flights?"
2. Proactively search for flights just because user mentioned a destination
3. Assume every trip needs air travel
4. Add flights before hotels/activities

## Testing Recommendations

### Test Case 1: Local Trip (No Flights Needed)
**User Input:** "Plan a weekend trip to San Diego"
**Expected:** Trip Designer should ask about hotels and activities, NOT mention flights
**Previous Behavior:** Would likely suggest flights automatically

### Test Case 2: Distant Trip (User Should Initiate)
**User Input:** "I want to visit Tokyo for a week"
**Expected:** Trip Designer should focus on hotels/activities, wait for user to mention flights
**Previous Behavior:** Would automatically suggest booking flights

### Test Case 3: User Explicitly Requests Flight
**User Input:** "I need a flight from NYC to Paris"
**Expected:** Trip Designer should call `search_flights` then `add_flight`
**Behavior:** Should remain the same as before (this still works)

### Test Case 4: User Mentions Flying
**User Input:** "I'm flying to Rome in March, need hotel recommendations"
**Expected:** Trip Designer should add the flight (mentioned explicitly), then focus on hotels
**Behavior:** Should work correctly

## Files Modified
- `src/prompts/trip-designer/system.md` - Main system prompt with flight booking rules

## Verification
To verify the changes are working:
1. Start a new trip planning conversation
2. Say "Plan a trip to [nearby city]"
3. Confirm the Trip Designer does NOT automatically suggest flights
4. Then say "I need a flight to [destination]"
5. Confirm the Trip Designer DOES search and add flights when explicitly requested

## Notes
- The flight booking workflow itself (`search_flights` → `add_flight`) remains unchanged
- When users DO request flights, the Trip Designer handles them the same way as before
- This change only affects WHEN flights are suggested, not HOW they are handled
