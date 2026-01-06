# Trip Designer Day Assignment Issue - Research Findings

**Date:** 2026-01-05
**Issue:** Trip Designer fails to correctly assign days to trip details when fixing/updating segments
**Priority:** 🔴 Critical - Core functionality bug

---

## Executive Summary

The Trip Designer correctly creates segments with proper dates/times when **creating** segments, but there's a **conceptual gap** between how segments are created and how the LLM is prompted to think about trip days.

**Root Cause:** The system prompt does NOT explicitly guide the LLM to:
1. Calculate which "day" of the trip a segment belongs to based on trip start/end dates
2. Infer proper dates/times for segments when users mention relative days (e.g., "Day 3", "on the second day")
3. Validate that segment dates fall within the trip date range

**Impact:** When users mention activities by trip day (e.g., "add dinner for Day 3"), the LLM may:
- Assign incorrect dates that don't match the trip calendar
- Create segments outside the trip date range
- Fail to infer dates from relative day references

---

## Architecture Analysis

### 1. Tool Definitions (`tools.ts`)

**Current State:**
- Tool schemas define date/time parameters as **absolute dates** (ISO 8601 format)
- No parameters for "trip day" or relative day references
- No validation of date ranges against trip dates

**Relevant Tools:**
```typescript
ADD_FLIGHT_TOOL:
  - departureTime: string (ISO 8601 date-time)
  - arrivalTime: string (ISO 8601 date-time)

ADD_HOTEL_TOOL:
  - checkInDate: string (YYYY-MM-DD)
  - checkOutDate: string (YYYY-MM-DD)

ADD_ACTIVITY_TOOL:
  - startTime: string (ISO 8601 date-time)
  - endTime: string (ISO 8601 date-time)

UPDATE_ITINERARY_TOOL:
  - startDate: string (YYYY-MM-DD)
  - endDate: string (YYYY-MM-DD)
```

**Gap Identified:**
- Tools expect **absolute dates**, but users often think in **relative days**
- No tool parameter for "day of trip" or "day number"
- LLM must calculate absolute dates from relative references WITHOUT explicit guidance

### 2. Tool Executor (`tool-executor.ts`)

**Current Implementation:**

**Date Parsing (Correct):**
```typescript
// Flight dates
const departureTime = parseLocalDateTime(params.departureTime);
const arrivalTime = params.arrivalTime
  ? parseLocalDateTime(params.arrivalTime)
  : new Date(departureTime.getTime() + 2 * 60 * 60 * 1000);

// Hotel dates
const checkInDate = parseLocalDate(params.checkInDate);
const checkOutDate = parseLocalDate(params.checkOutDate);

// Activity dates
const startTime = parseLocalDateTime(params.startTime);
```

**Segment Creation (Correct):**
```typescript
const segment: Omit<Segment, 'id'> = {
  type: SegmentType.FLIGHT,
  status: SegmentStatus.CONFIRMED,
  startDatetime: departureTime,  // ✅ Uses parsed datetime
  endDatetime: arrivalTime,       // ✅ Uses parsed datetime
  // ... other fields
};
```

**Date Validation (Partial):**
```typescript
// Only validates trip start date is not in the past
if (params.startDate) {
  const startDate = parseLocalDate(params.startDate);
  if (startDateNormalized <= today) {
    throw new Error('Trip start date cannot be in the past...');
  }
}
```

**Gaps Identified:**
- ✅ Segment creation logic is **correct** - uses proper dates when provided
- ❌ **No validation** that segment dates fall within trip date range
- ❌ **No date inference** from trip context (e.g., if trip is Jan 8-15, what is "Day 3"?)
- ❌ **No automatic date calculation** from relative day references

### 3. System Prompt (`system.md`)

**Current Guidance on Dates:**

**Section: "ACCOMMODATION MENTIONED"** (Lines 299-340):
```markdown
#### Workflow BEFORE Calling add_hotel:
1. **Get Trip Dates** - ALWAYS call `get_itinerary` first to retrieve saved trip dates
2. **Check Required Fields:**
   - Check-in date ✓ (from trip dates or ask)
   - Check-out date ✓ (from trip dates or ask)
```

**Section: "Accommodation Planning"** (Lines 1071-1176):
```markdown
#### Mandatory Workflow for Hotels:
1. **FIRST: Call `get_itinerary`** to retrieve the current trip's `startDate` and `endDate`
2. **Calculate total nights**: `nights = (tripEndDate - tripStartDate)` in days
3. **Set accommodation dates**:
   - `checkInDate` = trip `startDate`
   - `checkOutDate` = trip `endDate`
4. **Verify dates are within trip range**: NEVER use dates outside the saved trip dates
```

**Section: "DINING/ACTIVITY MENTIONED"** (Lines 433-531):
```markdown
3. **Use Intelligent Defaults:**
   - **Dinner time**: 7:30 PM (if not specified)
   - **Lunch time**: 12:30 PM (if not specified)
   - **Date selection**: If trip has multiple days, pick a reasonable date (mid-trip for dinners, early for tours)
```

**What's MISSING:**

❌ **No explicit guidance for calculating "Day X" of trip:**
- Example: "User says 'add dinner for Day 3'. If trip is Jan 8-15, Day 3 = Jan 10"
- Prompt does NOT teach LLM to calculate: `tripStartDate + (dayNumber - 1) days`

❌ **No validation rules for segment dates:**
- Example: "NEVER create segments with dates before `tripStartDate` or after `tripEndDate`"
- Prompt does NOT enforce: `segmentDate >= tripStartDate AND segmentDate <= tripEndDate`

❌ **No examples of relative-to-absolute date conversion:**
- User: "Add snorkeling for Day 2"
- Prompt should show: "Trip is Jan 8-15 → Day 2 = Jan 9 → Call add_activity with startTime '2025-01-09T09:00:00'"

❌ **No tool calling patterns for day-based planning:**
- Missing: "When user mentions 'Day X', first call get_itinerary to retrieve trip dates, then calculate absolute date"

---

## Specific Prompt Gaps

### Gap 1: Day Calculation Formula Missing

**Current State:** Prompt says "pick a reasonable date (mid-trip for dinners)"
**Problem:** No explicit formula for calculating which date is "Day 3" of a trip

**What's Needed:**
```markdown
## 📅 TRIP DAY CALCULATION (CRITICAL)

When users reference trip days (e.g., "Day 1", "Day 3", "second day"):

**FORMULA:**
```
tripStartDate = from get_itinerary()
dayNumber = user's day reference (1-indexed)
absoluteDate = tripStartDate + (dayNumber - 1) days
```

**Example:**
- Trip: Jan 8-15, 2025 (8 days)
- User: "Add dinner for Day 3"
- Calculation: Jan 8 + (3-1) days = Jan 10
- Tool call: add_activity({ startTime: "2025-01-10T19:30:00", ... })

**CRITICAL RULES:**
1. Day 1 = tripStartDate (first day of trip)
2. Day N = tripStartDate + (N-1) days
3. ALWAYS validate: calculated date <= tripEndDate
4. If dayNumber > trip duration: Ask user to clarify or suggest valid range
```

### Gap 2: Date Range Validation Missing

**Current State:** Prompt mentions "NEVER use dates outside the saved trip dates"
**Problem:** Not enforced consistently, no validation pattern shown

**What's Needed:**
```markdown
## 🚨 SEGMENT DATE VALIDATION (MANDATORY)

**BEFORE calling ANY add_* tool:**
1. Call get_itinerary() to retrieve tripStartDate and tripEndDate
2. Calculate/parse the segment date from user input
3. Validate: segmentDate >= tripStartDate AND segmentDate <= tripEndDate
4. If validation fails: Ask user for clarification

**Validation Examples:**

✅ CORRECT:
```
Trip: Jan 8-15, 2025
User: "Add hotel for Jan 10-12"
Validation: Jan 10 >= Jan 8 AND Jan 12 <= Jan 15 → PASS
Action: Call add_hotel
```

❌ WRONG:
```
Trip: Jan 8-15, 2025
User: "Add activity for Jan 20"
Validation: Jan 20 > Jan 15 → FAIL
Response: "Jan 20 is outside your trip dates (Jan 8-15). Did you mean a different day?"
```
```

### Gap 3: Few-Shot Examples for Day-Based Planning

**Current State:** Prompt has examples for booking, but not for day-based planning
**Problem:** LLM doesn't see how to handle "Day X" references

**What's Needed:**
```markdown
### Example 9: Day-Based Activity Planning

**User**: "Add snorkeling for Day 2 and dinner at Le Tastevin for Day 3"

**What to do - Step 1 (Get trip dates)**:
- Call `get_itinerary()` to retrieve trip dates
- Result: startDate: "2025-01-08", endDate: "2025-01-15"

**What to do - Step 2 (Calculate Day 2)**:
- Day 2 = Jan 8 + (2-1) days = Jan 9
- Call `add_activity` with name "Snorkeling Tour", startTime "2025-01-09T09:00:00"

**What to do - Step 3 (Calculate Day 3)**:
- Day 3 = Jan 8 + (3-1) days = Jan 10
- Call `add_activity` with name "Dinner at Le Tastevin", startTime "2025-01-10T19:30:00"

**What to do - Step 4 (Respond)**:
- "I've added snorkeling for Day 2 (Jan 9) and dinner at Le Tastevin for Day 3 (Jan 10) to your itinerary!"
```

### Gap 4: Update/Fix Segment Workflow

**Current State:** Prompt has update_segment tool, but no guidance on updating dates
**Problem:** When "fixing" segments, LLM doesn't know how to recalculate dates

**What's Needed:**
```markdown
### Example 10: Fixing Segment with Wrong Day

**User**: "The snorkeling should be on Day 4, not Day 2"

**What to do - Step 1 (Get current state)**:
- Call `get_itinerary()` to find the snorkeling segment
- Result: Segment ID "seg_123", currently scheduled for "2025-01-09T09:00:00"

**What to do - Step 2 (Calculate correct date)**:
- Trip dates: Jan 8-15
- Day 4 = Jan 8 + (4-1) days = Jan 11
- New startTime: "2025-01-11T09:00:00"

**What to do - Step 3 (Update segment)**:
- Call `update_segment` with segmentId "seg_123", updates: { startDatetime: "2025-01-11T09:00:00", endDatetime: "2025-01-11T12:00:00" }

**What to do - Step 4 (Respond)**:
- "I've moved the snorkeling tour to Day 4 (Jan 11) as requested!"
```

---

## Recommendations

### Priority 1: Add Day Calculation Guidance (🔴 Critical)

**Location:** `src/prompts/trip-designer/system.md`
**Section:** Add new section after line 295 (before "ACCOMMODATION MENTIONED")

**Content:**
```markdown
## 📅 TRIP DAY CALCULATION (CRITICAL)

**When users reference trip days (e.g., "Day 1", "Day 3", "on the second day"):**

### Day-to-Date Conversion Formula

**ALWAYS follow this process:**
1. **Call `get_itinerary()`** to retrieve trip `startDate` and `endDate`
2. **Calculate absolute date:**
   ```
   absoluteDate = tripStartDate + (dayNumber - 1) days
   ```
3. **Validate:**
   - Day number must be >= 1
   - Calculated date must be <= tripEndDate
4. **Use absolute date** in tool calls (add_activity, add_hotel, etc.)

**Examples:**

**Example 1: Single Day Reference**
```
Trip: Jan 8-15, 2025 (8 days)
User: "Add dinner for Day 3"

Calculation:
  tripStartDate = 2025-01-08
  dayNumber = 3
  absoluteDate = 2025-01-08 + (3-1) days = 2025-01-10

Tool call:
  add_activity({
    name: "Dinner",
    startTime: "2025-01-10T19:30:00",  // Day 3 = Jan 10
    ...
  })
```

**Example 2: Multi-Day Reference**
```
Trip: Jan 8-15, 2025 (8 days)
User: "Add snorkeling Day 2 and museum Day 4"

Day 2 calculation:
  absoluteDate = 2025-01-08 + (2-1) = 2025-01-09
Day 4 calculation:
  absoluteDate = 2025-01-08 + (4-1) = 2025-01-11

Tool calls:
  add_activity({ name: "Snorkeling", startTime: "2025-01-09T09:00:00" })
  add_activity({ name: "Museum", startTime: "2025-01-11T14:00:00" })
```

**Example 3: Out-of-Range Day**
```
Trip: Jan 8-15, 2025 (8 days)
User: "Add activity for Day 10"

Validation:
  tripDuration = (Jan 15 - Jan 8) + 1 = 8 days
  dayNumber = 10 > 8 days → INVALID

Response:
  "Your trip is 8 days (Jan 8-15). Day 10 would be outside your trip dates. Did you mean Day 8 (Jan 15) or a different day?"
```

### Day Validation Rules

**ALWAYS validate before creating segments:**

1. ✅ **Day 1 = Trip start date**
   - Day 1 = tripStartDate (not tripStartDate + 1)

2. ✅ **Day number within trip duration**
   - dayNumber <= ((tripEndDate - tripStartDate) + 1)

3. ✅ **Calculated date within trip range**
   - calculatedDate >= tripStartDate
   - calculatedDate <= tripEndDate

4. ❌ **Never assume day numbers without context**
   - ALWAYS call get_itinerary() first to get trip dates
   - NEVER guess dates without knowing trip start/end

### Fixing Segments with Wrong Days

**When user says segment is on wrong day:**

1. **Call `get_itinerary()`** to find the segment and trip dates
2. **Calculate new absolute date** using day number formula
3. **Call `update_segment`** with new startDatetime/endDatetime
4. **Confirm with absolute date:** "Moved to Day 3 (Jan 10)"

**Example:**
```
User: "Move dinner to Day 5"

Step 1: get_itinerary() → Find segment, get trip dates (Jan 8-15)
Step 2: Calculate: Day 5 = Jan 8 + (5-1) = Jan 12
Step 3: update_segment({ startDatetime: "2025-01-12T19:30:00" })
Step 4: Respond: "I've moved dinner to Day 5 (Jan 12)!"
```
```

### Priority 2: Add Date Range Validation (🔴 Critical)

**Location:** `src/prompts/trip-designer/system.md`
**Section:** Add to RULE 5 (AUTO-UPDATE ITINERARY) around line 637

**Content:**
```markdown
### RULE 5.2: VALIDATE ALL SEGMENT DATES ⚠️ CRITICAL

**Before calling ANY segment-creating tool (add_flight, add_hotel, add_activity, etc.):**

1. **Retrieve trip dates:**
   ```
   Call get_itinerary() to get tripStartDate and tripEndDate
   ```

2. **Calculate/parse segment date:**
   ```
   If user says "Day X": calculate absoluteDate = tripStartDate + (X-1) days
   If user provides date: parse the date
   ```

3. **Validate date range:**
   ```
   IF segmentDate < tripStartDate OR segmentDate > tripEndDate:
     Ask user for clarification
   ELSE:
     Proceed with tool call
   ```

**Validation Examples:**

✅ **CORRECT - Date within range:**
```
Trip: Jan 8-15, 2025
User: "Add dinner for Jan 10"
Validation: Jan 10 >= Jan 8 AND Jan 10 <= Jan 15 → PASS
Action: add_activity({ startTime: "2025-01-10T19:30:00" })
```

❌ **WRONG - Date before trip:**
```
Trip: Jan 8-15, 2025
User: "Add dinner for Jan 5"
Validation: Jan 5 < Jan 8 → FAIL
Response: "Jan 5 is before your trip starts (Jan 8). Did you mean a different date?"
```

❌ **WRONG - Date after trip:**
```
Trip: Jan 8-15, 2025
User: "Add activity for Jan 20"
Validation: Jan 20 > Jan 15 → FAIL
Response: "Jan 20 is after your trip ends (Jan 15). Did you mean a day within your trip (Jan 8-15)?"
```

**Common Mistake to AVOID:**
```
❌ User: "Add hotel"
   AI: add_hotel({ checkInDate: "2025-01-01", checkOutDate: "2025-01-02" })
   (Without checking trip dates!)

✅ User: "Add hotel"
   AI: get_itinerary() → Trip is Jan 8-15
   AI: add_hotel({ checkInDate: "2025-01-08", checkOutDate: "2025-01-15" })
   (Uses actual trip dates!)
```
```

### Priority 3: Add Few-Shot Examples (🟡 Important)

**Location:** `src/prompts/trip-designer/system.md`
**Section:** Add to "TOOL CALLING EXAMPLES" after line 164

**Content:**
```markdown
### Example 9: Day-Based Activity Addition

**User**: "Add snorkeling for Day 2"

**What to do - Step 1 (Get trip context)**:
- Call `get_itinerary()` to retrieve trip dates
- Result: { startDate: "2025-01-08", endDate: "2025-01-15", ... }

**What to do - Step 2 (Calculate absolute date)**:
- Day 2 = Jan 8 + (2-1) days = Jan 9
- Starttime: Jan 9 at 09:00 (typical morning tour time)

**What to do - Step 3 (Add activity)**:
- Call `add_activity` with:
  ```json
  {
    "name": "Snorkeling Tour",
    "location": { "name": "Orient Bay", "city": "Orient Bay", "country": "St. Martin" },
    "startTime": "2025-01-09T09:00:00",
    "durationHours": 3,
    "category": "tour"
  }
  ```

**What to do - Step 4 (Confirm with both day and date)**:
- Respond: "I've added a snorkeling tour for Day 2 (January 9th) at 9:00 AM to your itinerary!"

---

### Example 10: Multiple Activities on Different Days

**User**: "Add lunch at Ocean 82 on Day 2 and dinner at Le Tastevin on Day 3"

**What to do - Step 1 (Get trip context)**:
- Call `get_itinerary()` → Trip: Jan 8-15, 2025

**What to do - Step 2 (Calculate dates)**:
- Day 2: Jan 8 + 1 = Jan 9
- Day 3: Jan 8 + 2 = Jan 10

**What to do - Step 3 (Add both activities)**:
- Call `add_activity` for Ocean 82:
  ```json
  {
    "name": "Lunch at Ocean 82",
    "startTime": "2025-01-09T12:30:00",  // Day 2 at typical lunch time
    "category": "dining",
    ...
  }
  ```
- Call `add_activity` for Le Tastevin:
  ```json
  {
    "name": "Dinner at Le Tastevin",
    "startTime": "2025-01-10T19:30:00",  // Day 3 at typical dinner time
    "category": "dining",
    ...
  }
  ```

**What to do - Step 4 (Confirm both)**:
- "I've added Ocean 82 lunch for Day 2 (Jan 9) and Le Tastevin dinner for Day 3 (Jan 10)!"

---

### Example 11: Fixing Segment with Wrong Day

**User**: "The museum should be on Day 4, not Day 2"

**What to do - Step 1 (Get current state)**:
- Call `get_itinerary()` to find the museum segment
- Result: Segment ID "seg_museum_001", currently at "2025-01-09T14:00:00" (Day 2)

**What to do - Step 2 (Calculate correct date)**:
- Trip: Jan 8-15
- Day 4 = Jan 8 + (4-1) = Jan 11
- New time: Jan 11 at 14:00 (preserve time, change date)

**What to do - Step 3 (Update segment)**:
- Call `update_segment`:
  ```json
  {
    "segmentId": "seg_museum_001",
    "updates": {
      "startDatetime": "2025-01-11T14:00:00",
      "endDatetime": "2025-01-11T17:00:00"
    }
  }
  ```

**What to do - Step 4 (Confirm change)**:
- "I've moved the museum visit to Day 4 (January 11th) as requested!"

---

### Example 12: Out-of-Range Day Validation

**User**: "Add an activity for Day 10"

**What to do - Step 1 (Get trip context)**:
- Call `get_itinerary()` → Trip: Jan 8-15, 2025 (8 days total)

**What to do - Step 2 (Validate day number)**:
- tripDuration = (Jan 15 - Jan 8) + 1 = 8 days
- dayNumber = 10
- Validation: 10 > 8 → INVALID

**What to do - Step 3 (Ask for clarification, DO NOT create segment)**:
- Respond: "Your trip is 8 days long (January 8-15, 2025). Day 10 would be outside your trip dates. Did you mean Day 8 (the last day, January 15th) or would you like to extend your trip?"
- DO NOT call add_activity with an invalid date
```

---

## Testing Strategy

### Test Case 1: Day-Based Activity Creation
```
Setup: Trip from Jan 8-15, 2025
Input: "Add snorkeling for Day 3"
Expected:
  1. LLM calls get_itinerary()
  2. LLM calculates: Day 3 = Jan 8 + 2 = Jan 10
  3. LLM calls add_activity({ startTime: "2025-01-10T09:00:00", ... })
  4. Segment created with startDatetime = 2025-01-10T09:00:00
```

### Test Case 2: Multiple Days
```
Setup: Trip from Jan 8-15, 2025
Input: "Add lunch Day 2, dinner Day 3"
Expected:
  1. LLM calls get_itinerary()
  2. LLM calculates: Day 2 = Jan 9, Day 3 = Jan 10
  3. LLM calls add_activity for lunch (Jan 9 12:30)
  4. LLM calls add_activity for dinner (Jan 10 19:30)
  5. Both segments created with correct dates
```

### Test Case 3: Day Range Validation (Out of Range)
```
Setup: Trip from Jan 8-15, 2025 (8 days)
Input: "Add activity for Day 10"
Expected:
  1. LLM calls get_itinerary()
  2. LLM validates: 10 > 8 days → INVALID
  3. LLM responds: "Day 10 is outside your trip (8 days). Did you mean Day 8?"
  4. NO segment created
```

### Test Case 4: Fixing Wrong Day
```
Setup: Trip from Jan 8-15, 2025, existing activity on Jan 9 (Day 2)
Input: "Move that activity to Day 5"
Expected:
  1. LLM calls get_itinerary()
  2. LLM calculates: Day 5 = Jan 8 + 4 = Jan 12
  3. LLM calls update_segment({ startDatetime: "2025-01-12T..." })
  4. Segment updated to Jan 12
```

### Test Case 5: Absolute Date Validation (Before Trip)
```
Setup: Trip from Jan 8-15, 2025
Input: "Add dinner for Jan 5"
Expected:
  1. LLM calls get_itinerary()
  2. LLM validates: Jan 5 < Jan 8 → INVALID
  3. LLM responds: "Jan 5 is before your trip. Did you mean a different date?"
  4. NO segment created
```

---

## Implementation Plan

### Phase 1: System Prompt Updates (Immediate)
1. ✅ Add "TRIP DAY CALCULATION" section with formula and examples
2. ✅ Add "SEGMENT DATE VALIDATION" rules to RULE 5
3. ✅ Add few-shot examples for day-based planning (Examples 9-12)
4. ✅ Update existing examples to show date validation

**Files to Modify:**
- `src/prompts/trip-designer/system.md`

**Estimated LOC:** +150 lines (new sections and examples)

### Phase 2: Tool Schema Enhancement (Optional)
1. Consider adding optional `dayNumber` parameter to activity/hotel tools
2. Add validation helper in tool-executor to check date ranges
3. Add automatic date calculation from dayNumber if provided

**Files to Modify:**
- `src/services/trip-designer/tools.ts` (add dayNumber parameter)
- `src/services/trip-designer/tool-executor.ts` (add validation logic)

**Estimated LOC:** +50 lines

### Phase 3: Testing & Validation
1. Add E2E test cases for day-based planning
2. Add unit tests for date validation logic
3. Test with real conversations using day references

---

## Files Analyzed

1. ✅ `src/services/trip-designer/tools.ts` - Tool definitions
2. ✅ `src/services/trip-designer/tool-executor.ts` - Tool execution logic
3. ✅ `src/prompts/trip-designer/system.md` - System prompt
4. ✅ `src/services/trip-designer/itinerary-summarizer.ts` - Itinerary formatting
5. ✅ `FLIGHT_BOOKING_CHANGES.md` - Recent related changes
6. ✅ `TRAVELER_FIXES.md` - Recent related changes

---

## Conclusion

**The core issue is NOT a code bug** - the tool executor correctly creates segments with proper dates when provided.

**The actual issue is a PROMPT GAP** - the system prompt does not explicitly guide the LLM to:
1. Calculate which absolute date corresponds to "Day X" of a trip
2. Validate that segment dates fall within trip date ranges
3. Handle relative day references properly

**The fix is primarily PROMPT ENGINEERING**, not code changes. By adding explicit guidance, formulas, and examples to the system prompt, we can teach the LLM to correctly handle day-based planning without modifying the underlying code.

**Recommended Next Steps:**
1. Implement Phase 1 (System Prompt Updates) immediately
2. Test with real conversations to validate improvements
3. Consider Phase 2 (Tool Schema Enhancement) if prompt improvements are insufficient

---

**Research Complete**
Generated: 2026-01-05
Researcher: Claude Code (Research Agent)
