# Title/Destination Mismatch Warning - Implementation Summary

## Problem Statement

When users import flight confirmations (e.g., JFK → SXM for St. Maarten) into an itinerary titled "New York Winter Getaway", the mismatch detection works correctly, but the LLM ignores the warning because:

1. The warning appeared within the itinerary summary section
2. Other "## ⚠️ CRITICAL" sections appeared AFTER the summary with stronger language
3. Those subsequent sections drew the LLM's attention away from the mismatch

## Solution

Extract the mismatch warning from the summary and place it in a **dedicated, prominent section** that:
1. Uses the STRONGEST possible language (`## 🚨🚨🚨 STOP - CRITICAL DATA CONFLICT DETECTED 🚨🚨🚨`)
2. Appears BEFORE the itinerary summary in the context
3. Explicitly instructs the LLM to ACKNOWLEDGE this issue in its response
4. Uses direct, imperative language that cannot be ignored

## Implementation Changes

### 1. New Function: `generateMismatchWarning()`

**File**: `src/services/trip-designer/itinerary-summarizer.ts`

Created a new exported function that generates a standalone, impossible-to-ignore warning:

```typescript
export function generateMismatchWarning(itinerary: Itinerary): string | null
```

**Key Features**:
- Returns `null` if no mismatch detected (clean separation)
- Uses triple fire emoji header: `🚨🚨🚨 STOP - CRITICAL DATA CONFLICT DETECTED 🚨🚨🚨`
- Explicit "YOU MUST ADDRESS THIS ISSUE BEFORE ANYTHING ELSE"
- Clear breakdown of the problem:
  - Current title
  - What the title mentions (departure city)
  - Actual destination
  - Why it happened
  - Suggested fix
- **MANDATORY ACTION** section with numbered steps
- Emphasizes this must be done in FIRST RESPONSE

**Example Output**:
```
## 🚨🚨🚨 STOP - CRITICAL DATA CONFLICT DETECTED 🚨🚨🚨

**YOU MUST ADDRESS THIS ISSUE BEFORE ANYTHING ELSE**

**PROBLEM**: The itinerary title does NOT match the actual travel destination.

**Current Title**: "New York Winter Getaway"
**Title Mentions**: "New York" ← This is the DEPARTURE city
**Actual Destination**: "St. Maarten" ← This is where they're GOING

**WHY THIS HAPPENED**: This commonly occurs when importing confirmation emails
that were sent from the departure city.

**SUGGESTED FIX**: Update the title to "St. Maarten Winter Getaway"

**MANDATORY ACTION - YOU MUST DO THIS IN YOUR FIRST RESPONSE**:
1. ⚠️ Point out this title/destination mismatch to the user
2. ⚠️ Explain that the title mentions their departure city, not their destination
3. ⚠️ Ask if they want to update the title to "St. Maarten Winter Getaway"
4. ⚠️ DO NOT proceed with trip suggestions until this is acknowledged

**DO NOT IGNORE THIS WARNING** - The user needs to know their trip title is incorrect.
```

### 2. Updated: `summarizeItinerary()`

**File**: `src/services/trip-designer/itinerary-summarizer.ts`

- Removed mismatch warning generation from within the summary
- Added documentation noting that mismatch warnings are handled separately
- Summary now focuses purely on itinerary state, not warnings

### 3. Updated: `TripDesignerService.createSession()`

**File**: `src/services/trip-designer/trip-designer.service.ts`

**Changes**:
- Import the new `generateMismatchWarning` function
- Check for mismatch FIRST before building context
- If mismatch detected, inject warning at the VERY TOP of context message
- Add separator (`---`) between warning and summary sections

**Code Flow**:
```typescript
// Check for title/destination mismatch FIRST - this gets top priority
const mismatchWarning = generateMismatchWarning(itinerary);

// Generate itinerary summary (via facade or direct)
let summary: string;
// ... (existing summary generation logic)

// Build context message with mismatch warning appearing FIRST if present
let contextMessage = '';

if (mismatchWarning) {
  // CRITICAL: Mismatch warning goes at the very top for maximum visibility
  contextMessage = `${mismatchWarning}

---

The user is working on an existing itinerary. Here's the current state:

${summary}

Important: Since the itinerary already has content...
CRITICAL: If the summary shows "⚠️ EXISTING BOOKINGS"...`;
} else {
  // No mismatch - use standard context message
  contextMessage = `The user is working on an existing itinerary...`;
}
```

## Context Injection Order

**BEFORE** (mismatch warning buried in summary):
```
The user is working on an existing itinerary. Here's the current state:

⚠️ **TITLE/DESTINATION MISMATCH DETECTED**
- Current title: "New York Winter Getaway"
...

**Trip**: New York Winter Getaway
**Dates**: Jan 15-22, 2025
...

Important: Since the itinerary already has content...
CRITICAL: If the summary shows "⚠️ EXISTING BOOKINGS"...
```

**AFTER** (mismatch warning at top with maximum visibility):
```
## 🚨🚨🚨 STOP - CRITICAL DATA CONFLICT DETECTED 🚨🚨🚨

**YOU MUST ADDRESS THIS ISSUE BEFORE ANYTHING ELSE**

**PROBLEM**: The itinerary title does NOT match the actual travel destination.
...
**MANDATORY ACTION - YOU MUST DO THIS IN YOUR FIRST RESPONSE**:
1. ⚠️ Point out this title/destination mismatch to the user
...

---

The user is working on an existing itinerary. Here's the current state:

**Trip**: New York Winter Getaway
**Dates**: Jan 15-22, 2025
...
```

## Testing

**Test Case**: JFK → SXM round trip with title "New York Winter Getaway"

**Expected Result**:
1. Mismatch detection identifies "New York" as departure city mentioned in title
2. Actual destination is "St. Maarten"
3. `generateMismatchWarning()` returns prominent warning
4. Trip Designer context has warning at the VERY TOP
5. LLM's first response MUST acknowledge the mismatch

**Manual Test Command**:
```bash
# Import a flight confirmation with this pattern
# Create a new chat session
# LLM should immediately point out the title mismatch
```

## Verification

To verify the warning is being generated:
```bash
cd /Users/masa/Projects/Itinerator
npx tsx -e "
import { generateMismatchWarning } from './src/services/trip-designer/itinerary-summarizer.js';
const itinerary = {
  id: 'test', userId: 'test', title: 'New York Trip',
  segments: [
    { type: 'FLIGHT', origin: { name: 'New York', code: 'JFK' },
      destination: { name: 'St. Maarten', code: 'SXM' },
      startDatetime: new Date('2025-01-15') }
  ], destinations: [], travelers: [], tripPreferences: {},
  createdAt: new Date(), updatedAt: new Date()
};
console.log(generateMismatchWarning(itinerary) || 'No warning');
"
```

## Benefits

1. **Impossible to Ignore**: Triple emoji header and ALL CAPS demands attention
2. **Top Priority**: Appears BEFORE everything else in context
3. **Clear Instructions**: Numbered mandatory actions
4. **Explicit Requirement**: "YOU MUST DO THIS IN YOUR FIRST RESPONSE"
5. **Better UX**: User is immediately informed of the title issue

## Related Files

- `src/services/trip-designer/itinerary-summarizer.ts` - Mismatch detection and warning generation
- `src/services/trip-designer/trip-designer.service.ts` - Context injection logic
- `src/services/travel-agent-facade.service.ts` - Uses summarizer (unchanged, works as before)

## Acceptance Criteria

- [x] Mismatch warning extracted from itinerary summary
- [x] New prominent section created with strongest language
- [x] Section appears before/above other context sections
- [x] LLM is explicitly required to acknowledge mismatch in first response
- [x] Build succeeds without errors
- [x] Test verifies warning is generated correctly

## Next Steps

1. Deploy to Vercel
2. Test with real import workflow (JFK → SXM flight)
3. Verify LLM acknowledges the mismatch in first response
4. Monitor user feedback on mismatch detection accuracy
