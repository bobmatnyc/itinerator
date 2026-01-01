# Dining/Activity Tool Call Enforcement

## Problem Solved
When user or LLM mentioned restaurants/activities, the LLM would discuss them but not add them to the itinerary. Similar to the hotel fix, we needed to enforce tool calls for dining and activities.

## Changes Made

### 1. System Prompt Enhancement (`src/prompts/trip-designer/system.md`)

Added new section: **🍽️ DINING/ACTIVITY MENTIONED = MANDATORY TOOL CALL**

Similar to the hotel enforcement, this section:
- Lists all trigger phrases (restaurants, tours, shows, museums, etc.)
- Shows WRONG behavior (discussion without tool call)
- Shows CORRECT behavior (tool call first, then acknowledgment)
- Provides workflow with intelligent defaults
- Includes concrete TypeScript examples

**Key Features:**
- **Intelligent defaults** for missing info:
  - Dinner time: 7:30 PM
  - Lunch time: 12:30 PM
  - Tours: 9:00 AM (morning) or 2:00 PM (afternoon)
  - Date selection: Mid-trip for dinners, early for tours
- **Minimal questions** - only ask if absolutely necessary
- **Works for both user mentions AND LLM recommendations**

### 2. Tool Description Enhancement (`src/services/trip-designer/tools.ts`)

Enhanced `ADD_ACTIVITY_TOOL` description to emphasize mandatory usage:

```typescript
description: 'REQUIRED CALL when user mentions ANY dining/activity (restaurant, tour, museum, show, etc.) OR when you recommend one. Add an activity, tour, dining experience, or attraction to the itinerary. You MUST call this tool immediately when mentioning restaurants or activities - verbal discussion alone will NOT save the data. Example: User says "Dinner at Le Tastevin" OR you recommend "Ocean 82 has great seafood" → You MUST call this tool with activity details BEFORE/DURING your response.'
```

## Examples

### Before (BAD) ❌
```
User: "Let's do dinner at Le Tastevin on January 10th"
LLM: "Great choice! Le Tastevin is truly a culinary gem in Grand Case...
      Would you like me to help you make a reservation?"
→ Restaurant NOT added to itinerary
```

### After (GOOD) ✅
```
User: "Let's do dinner at Le Tastevin on January 10th"
LLM: [Calls add_activity tool]
     {
       name: "Dinner at Le Tastevin",
       location: { name: "Grand Case", city: "Grand Case", country: "St. Martin" },
       startTime: "2025-01-10T19:30:00",  // 7:30 PM default
       durationHours: 2,
       category: "dining"
     }
LLM: "I've added Le Tastevin dinner to your itinerary for January 10th at 7:30 PM.
      This fine French restaurant is perfect for a special evening!"
→ Restaurant ADDED to itinerary ✓
```

### LLM Recommendations (NEW) ✅
```
LLM: [Calls add_activity tool]
     {
       name: "Lunch at Ocean 82",
       location: { name: "Grand Case Beach", city: "Grand Case", country: "St. Martin" },
       startTime: "2025-01-08T12:30:00",  // 12:30 PM, mid-trip
       durationHours: 1.5,
       category: "dining"
     }
LLM: "I've added Ocean 82 for lunch on January 8th at 12:30 PM.
      This beachfront restaurant has incredible seafood and stunning views!"
→ Recommendation WITH action ✓
```

## Intelligent Defaults

The LLM now uses these defaults to minimize questions:

| Activity Type | Default Time | Default Duration | When to Use |
|---------------|--------------|------------------|-------------|
| Dinner | 7:30 PM | 2 hours | Evening meals |
| Lunch | 12:30 PM | 1.5 hours | Midday meals |
| Breakfast | 8:00 AM | 1 hour | Morning meals |
| Morning Tour | 9:00 AM | 3 hours | Tours, excursions |
| Afternoon Activity | 2:00 PM | 2-3 hours | Museums, shows |

**Date Selection:**
- If trip is 5+ days: Use day 3-4 for dinners (mid-trip)
- For tours: Use early in trip (day 2-3)
- If user specifies date: Always use their date

## Acceptance Criteria

- [x] System prompt has mandatory dining/activity tool section
- [x] Tool description emphasizes required usage
- [x] Provides intelligent defaults for time/date
- [x] Works for user mentions of restaurants/activities
- [x] Works for LLM recommendations
- [x] Build passes without errors

## Impact

**Before:**
- User: "Dinner at Le Tastevin" → Discussion only, nothing added
- LLM: "I recommend Ocean 82" → Suggestion only, nothing added

**After:**
- User: "Dinner at Le Tastevin" → Tool call + confirmation, ADDED to itinerary
- LLM: "I recommend Ocean 82" → Tool call + recommendation, ADDED to itinerary

**Result:** All restaurants, tours, and activities mentioned in conversation are now automatically added to the itinerary with reasonable defaults.

## Related Changes

This follows the same pattern as:
- Hotel enforcement (`🏨 ACCOMMODATION MENTIONED = MANDATORY TOOL CALL`)
- Trip data enforcement (`🚨 ABSOLUTE REQUIREMENT: TOOL CALLS FOR DATA PERSISTENCE`)

All three ensure that verbal acknowledgment is NEVER enough - only tool calls persist data.
