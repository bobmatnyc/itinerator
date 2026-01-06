# Role Separation: Trip Designer vs Travel Agent

## Overview

This document clarifies the distinct roles and responsibilities of the Trip Designer and Travel Agent components in the Itinerator system.

## Current Architecture (as of 2026-01-05)

### Trip Designer (LLM-based conversational agent)
**Location**: `src/prompts/trip-designer/system.md`
**Type**: LLM-powered conversational interface
**Purpose**: RECOMMENDER - Curates and suggests experiences

### Travel Agent (API service)
**Location**: `src/services/travel-agent.service.ts`
**Type**: SerpAPI-based search service
**Purpose**: Currently handles real-time flight/hotel searches, gap filling

## Role Definitions

### Trip Designer: The RECOMMENDER

**Primary Responsibilities:**
- ✅ Curate and recommend activities, restaurants, experiences
- ✅ Focus on WHAT to do, WHERE to go, WHICH experiences to have
- ✅ Suggest general timing (morning, afternoon, evening)
- ✅ Create thematic experiences (romantic, adventure, cultural, family-friendly)
- ✅ Provide context about venues (why it's special, what to expect)
- ✅ Suggest sequence of experiences (this before that)

**What Designer DOES NOT do:**
- ❌ Dictate specific times (9:30 AM, 7:15 PM) unless user explicitly requests
- ❌ Validate opening hours and operational logistics
- ❌ Calculate exact travel time between locations
- ❌ Confirm if something is "realistically feasible" from timing perspective

**Example - CORRECT Designer behavior:**
> "I recommend visiting the Imperial Palace East Gardens in the morning - it's beautiful and less crowded early. Follow with a traditional lunch nearby at a local ramen shop, then spend the afternoon exploring Shibuya's shopping district."

**Example - INCORRECT Designer behavior (too specific):**
> "Visit Imperial Palace East Gardens at 9:30 AM sharp (opens at 9 AM). Lunch at 12:00 PM at Ichiran Ramen (10-minute walk). Leave by 1:30 PM to catch the train to Shibuya, arriving by 2:00 PM."

### Travel Agent: The SCHEDULER (Future LLM-based agent)

**Primary Responsibilities (PLANNED):**
- ✅ Own the actual schedule - specific times, dates, durations
- ✅ Validate opening hours, closing times, seasonal availability
- ✅ Calculate realistic travel time between locations
- ✅ Confirm feasibility - "Can this realistically happen?"
- ✅ Book and confirm - flights, hotels, reservations
- ✅ Coordinate the full itinerary flow with logistics
- ✅ Handle edge cases - weather delays, closures, alternatives

**Example - CORRECT Travel Agent behavior:**
> "I'll schedule Imperial Palace East Gardens at 9:30 AM on January 12th (opens at 9 AM, closed Mondays and Fridays). You'll have 2 hours there, then it's a 10-minute walk to Marunouchi for lunch at 12:00 PM. I've found Ichiran Ramen nearby, open until 11 PM."

## Implementation Status

### ✅ Completed (2026-01-05)
- Updated Trip Designer prompt to emphasize RECOMMENDER role
- Removed overly prescriptive time validation rules from Designer
- Softened time guidelines to be suggestions, not requirements
- Added clear role separation documentation at top of Designer prompt

### 🚧 In Progress
- Travel Agent is currently an API service (SerpAPI integration)
- No LLM-based scheduling logic yet

### 📋 Future Work
- [ ] Create Travel Agent LLM prompt (when ready to implement scheduling agent)
- [ ] Move time validation rules from Designer to Travel Agent
- [ ] Implement opening hours database/API integration
- [ ] Build Travel Agent tool set:
  - `validate_opening_hours(venue, date)` - Check if venue is open
  - `calculate_travel_time(from, to, mode)` - Get realistic travel time
  - `check_schedule_conflict(segments)` - Validate no overlaps
  - `optimize_daily_flow(day_segments)` - Reorder for efficiency
  - `book_reservation(venue, time, party_size)` - Make actual bookings

## Workflow Example

### Step 1: User Request
> "I want to explore Tokyo's temples and try authentic ramen"

### Step 2: Trip Designer (Recommender)
```json
{
  "message": "Great! I recommend visiting Senso-ji Temple in Asakusa in the morning - it's Tokyo's oldest temple with beautiful architecture. For lunch, try Ichiran Ramen nearby for the authentic experience. In the afternoon, visit Meiji Shrine in Harajuku for a peaceful contrast to the morning's bustle.",
  "segments_suggested": [
    {
      "name": "Senso-ji Temple Visit",
      "time": "morning (~9 AM)",
      "duration": "2-3 hours",
      "why": "Tokyo's oldest temple, beautiful architecture, traditional atmosphere"
    },
    {
      "name": "Lunch at Ichiran Ramen",
      "time": "lunch (~12:30 PM)",
      "duration": "1 hour",
      "why": "Authentic tonkotsu ramen, unique solo dining experience"
    },
    {
      "name": "Meiji Shrine",
      "time": "afternoon (~2 PM)",
      "duration": "1-2 hours",
      "why": "Peaceful forest shrine, serene escape from city"
    }
  ]
}
```

### Step 3: Travel Agent (Scheduler - FUTURE)
```json
{
  "schedule": [
    {
      "name": "Senso-ji Temple Visit",
      "start": "2026-01-12T09:00:00+09:00",
      "end": "2026-01-12T11:30:00+09:00",
      "validation": {
        "opening_hours": "24 hours (always open)",
        "best_time": "9-11 AM (less crowded)",
        "notes": "Main hall opens at 6 AM"
      }
    },
    {
      "name": "Walk to Ichiran Ramen Asakusa",
      "start": "2026-01-12T11:30:00+09:00",
      "end": "2026-01-12T11:45:00+09:00",
      "travel": {
        "mode": "walking",
        "distance": "900m",
        "duration": "12 minutes",
        "route": "Via Kaminarimon-dori"
      }
    },
    {
      "name": "Lunch at Ichiran Ramen",
      "start": "2026-01-12T11:45:00+09:00",
      "end": "2026-01-12T12:45:00+09:00",
      "validation": {
        "opening_hours": "10 AM - 11 PM",
        "wait_time": "15-30 min (typical lunch)",
        "reservation": "Not required (counter seating)"
      }
    },
    {
      "name": "Train to Harajuku Station",
      "start": "2026-01-12T12:50:00+09:00",
      "end": "2026-01-12T13:30:00+09:00",
      "travel": {
        "mode": "train",
        "line": "Ginza Line to Shibuya, transfer to JR Yamanote",
        "cost": "¥200",
        "duration": "35 minutes + 5 min walk"
      }
    },
    {
      "name": "Meiji Shrine",
      "start": "2026-01-12T13:30:00+09:00",
      "end": "2026-01-12T15:00:00+09:00",
      "validation": {
        "opening_hours": "Sunrise to sunset (closes ~4:30 PM in January)",
        "notes": "Plan to finish by 3 PM to see everything before closing"
      }
    }
  ],
  "optimizations_made": [
    "Adjusted Ichiran timing to 11:45 AM to avoid peak lunch rush (12-1 PM)",
    "Added buffer time for temple exploration (2.5 hours vs suggested 2)",
    "Noted Meiji Shrine closes early in January - must finish by 3 PM"
  ]
}
```

## Benefits of This Separation

1. **Designer focuses on curation** - What makes experiences special, not logistics
2. **Travel Agent handles reality** - Real schedules, real constraints, real feasibility
3. **Better user experience** - Get inspiring recommendations first, logistics second
4. **Clearer responsibility** - Each component has a well-defined role
5. **Easier to improve** - Can enhance recommendation quality independently from scheduling logic

## Migration Path

### Phase 1: Current State ✅
- Trip Designer handles both recommendation and rough scheduling
- Travel Agent is API service for searches

### Phase 2: Designer Refactoring ✅ (Completed 2026-01-05)
- Updated Designer prompt to emphasize RECOMMENDER role
- Softened time requirements to be suggestions
- Clarified Designer doesn't validate logistics

### Phase 3: Travel Agent Enhancement (Future)
- Create Travel Agent LLM prompt for scheduling
- Build scheduling validation tools
- Implement opening hours database
- Add travel time calculation

### Phase 4: Full Separation (Future)
- Designer creates high-level recommendations
- Travel Agent refines into detailed schedule
- User sees both: "What to do" (Designer) + "Exact schedule" (Agent)

## Related Files

- `src/prompts/trip-designer/system.md` - Trip Designer prompt (RECOMMENDER)
- `src/services/travel-agent.service.ts` - Travel Agent service (search API)
- `src/services/trip-designer/` - Designer implementation
- `ROLE_SEPARATION.md` - This file (role definitions)

---

**Last Updated**: 2026-01-05
**Status**: Phase 2 complete (Designer refactoring)
**Next Steps**: Implement Travel Agent as LLM-based scheduler when ready
