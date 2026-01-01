# Booking Data Priority Override - Implementation Summary

## Problem Statement

The Trip Designer LLM was giving too much weight to incorrect title/description fields, causing it to misinterpret trips:

**Example:**
- Title: "Winter Destination Trip"
- Description: "Deciding between NYC and St. Maarten"
- Flights: JFK → SXM (going TO St. Maarten)
- Hotel: L'Esplanade in Grand Case, St. Maarten

**Wrong LLM Response:**
> "I see you're torn between NYC and St. Maarten..."

**Root Cause:**
The LLM treated the description as truth instead of recognizing that actual bookings (flights, hotels) are facts while title/description may be outdated or incorrect.

## Solution

### 1. Added "BOOKING DATA = GROUND TRUTH" Section to System Prompt

**Location:** `src/prompts/trip-designer/system.md` (lines 3-26)

Added a prominent section at the very top of the system prompt that:
- Declares booking data as FACTS that override title/description
- Provides concrete examples of wrong vs. correct interpretation
- Establishes clear rules for handling conflicts

**Key Rules:**
1. If flights show destination X, user is GOING to X (not "deciding")
2. If hotel is booked in location Y, user is STAYING in Y (not "considering")
3. Title/description mentioning other cities = OUTDATED or USER ERROR
4. LLM must acknowledge the REAL trip based on bookings, suggest updating the title

**Example in Prompt:**
```
**Example - WRONG interpretation:**
- Title: "Deciding between NYC and St. Maarten"
- Flights: JFK → SXM
- Hotel: Grand Case, St. Maarten
- LLM says: "You're torn between NYC and St. Maarten" ❌

**Example - CORRECT interpretation:**
- Same data as above
- LLM says: "I see you're going to St. Maarten! You have flights from JFK to SXM and you're staying at L'Esplanade in Grand Case." ✅
```

### 2. Verified Mismatch Detection Clarity

**Location:** `src/services/trip-designer/itinerary-summarizer.ts` (lines 458-496)

The existing `generateMismatchWarning()` function already provides clear, unambiguous warnings:

```
**Title Mentions**: "New York" ← This is the DEPARTURE city
**Actual Destination**: "St. Maarten" ← This is where they're GOING
```

This warning appears as a separate, top-level section BEFORE the itinerary summary, ensuring the LLM sees it first.

## Expected Behavior After Fix

### Scenario: Import with incorrect title

**Data:**
- Title: "New York Winter Trip"
- Flights: JFK → SXM → JFK
- Hotel: L'Esplanade, Grand Case, St. Maarten

**LLM Should Now Say:**
> "I notice there's a mismatch in your trip title. It says 'New York Winter Trip' but your flights and hotel show you're actually going to St. Maarten! You're flying from New York (JFK) to St. Maarten (SXM) and staying at L'Esplanade in Grand Case. Would you like me to update the title to 'St. Maarten Winter Trip'?"

## Files Modified

1. **src/prompts/trip-designer/system.md**
   - Added "BOOKING DATA = GROUND TRUTH" section at line 3
   - Provides clear examples and rules for handling conflicts
   - Emphasizes that bookings are facts, not suggestions

2. **No changes needed** to `itinerary-summarizer.ts`
   - Existing mismatch detection already provides clear warnings
   - Warning format already distinguishes departure city from destination

## Testing Checklist

- [x] Build passes (`npm run build`)
- [ ] Test with NYC/St. Maarten scenario
- [ ] Verify LLM acknowledges actual destination (St. Maarten)
- [ ] Verify LLM doesn't repeat incorrect title as fact
- [ ] Verify LLM offers to update title

## Technical Details

### How Mismatch Detection Works

1. **Extract flight data**: Gets first and last flight segments
2. **Identify origin and destination**: Normalizes city names, detects round trips
3. **Check title/description**: Looks for mentions of origin vs. destination
4. **Generate warning**: Creates prominent warning if title mentions origin but not destination
5. **Inject into context**: Warning appears BEFORE itinerary summary in LLM prompt

### Priority Order in LLM Context

1. **BOOKING DATA = GROUND TRUTH** section (new, at top)
2. **🚨 MISMATCH WARNING** (if detected, before summary)
3. **Itinerary Summary** (includes inferred booking tiers)
4. **Trip preferences** (user-stated preferences)
5. **Discovery questions** (if new trip)

## LOC Delta

```
LOC Delta:
- Added: 24 lines (system.md)
- Removed: 0 lines
- Net Change: +24 lines
- Phase: Enhancement
```

## Related Documentation

- `SECOND_STREAM_FIX_SUMMARY.md` - Mismatch detection implementation
- `EMAIL_IMPORT_IMPLEMENTATION.md` - Import extraction logic
- `TRIP_DESIGNER_FIXES.md` - Previous Trip Designer improvements
