# Title/Destination Mismatch Detection - Diagnosis

## Issue
The Trip Designer LLM is not acknowledging the title/destination mismatch for itinerary "New York Winter Getaway" which has flights to St. Maarten (JFK → SXM), not New York.

## Investigation Results

### ✅ Code is Working Correctly

1. **Mismatch Detection** (`src/services/trip-designer/itinerary-summarizer.ts:303-449`)
   - Function: `detectTitleDestinationMismatch()`
   - **Status**: ✅ Working
   - Correctly identifies:
     - Title mentions: "New York" (origin/departure city)
     - Actual destination: "St. Maarten"
     - Returns: `{ hasMismatch: true, suggestedTitle: "St. Maarten Winter Getaway", ... }`

2. **Summary Generation** (`src/services/trip-designer/itinerary-summarizer.ts:461-527`)
   - Function: `summarizeItinerary()`
   - **Status**: ✅ Working
   - Generates warning at the TOP of the summary:
     ```markdown
     ⚠️ **TITLE/DESTINATION MISMATCH DETECTED**
     - Current title: "New York Winter Getaway"
     - Title mentions: "New York" (departure city)
     - Actual destination: "St. Maarten"
     - Suggested title: "St. Maarten Winter Getaway"

     **Explanation**: Title mentions "New York" (your departure city) but you're actually traveling to "St. Maarten"...

     **ACTION REQUIRED**: You should acknowledge this mismatch and offer to update the title...
     ```

3. **Context Injection** (`src/services/trip-designer/trip-designer.service.ts:1404-1441`)
   - Function: `buildMessages()`
   - **Status**: ✅ Working
   - Summary is regenerated and injected into system prompt **on every chat message**
   - Not just at session creation!

4. **Date Handling** (`src/storage/json-storage.ts:82-90`)
   - **Status**: ✅ Working
   - Dates are automatically converted from ISO strings to Date objects on load
   - `calculateDuration()` receives proper Date objects in production

### ❌ Root Cause: Prompt Attention Issue

The mismatch warning **IS being sent to the LLM**, but it's not being acknowledged because:

**Problem**: The warning gets buried in the system prompt structure:

```
TRIP_DESIGNER_SYSTEM_PROMPT (base instructions)
  ↓
## Current Itinerary Context
  ↓
Summary:
  ⚠️ TITLE/DESTINATION MISMATCH DETECTED  ← Warning here
  - Title: "New York Winter Getaway"
  - Actual destination: "St. Maarten"
  ...
  (Rest of summary: dates, travelers, segments, etc.)
  ↓
## ⚠️ CRITICAL: INFER PREFERENCES FROM EXISTING BOOKINGS  ← Overshadows mismatch!
  - Luxury hotel → travel luxury
  - Business class → premium
  - NEVER ask questions bookings answer
  ...
```

The "CRITICAL: INFER PREFERENCES" section (lines 1429-1438) uses **strong** language and comes AFTER the summary, drawing more attention than the mismatch warning embedded within the summary.

## Recommended Fixes

### Option 1: Move Mismatch Warning to Separate Section (Recommended)

In `trip-designer.service.ts:1421-1438`, extract the mismatch warning from the summary and place it in a dedicated, prominent section:

```typescript
let systemPrompt = `${TRIP_DESIGNER_SYSTEM_PROMPT}

## Current Itinerary Context

${summary}`;

// If mismatch detected, add CRITICAL section AFTER summary
if (mismatch?.hasMismatch) {
  systemPrompt += `

## 🚨 CRITICAL: TITLE/DESTINATION MISMATCH DETECTED

The itinerary title mentions "${mismatch.titleMentions}" but the flights go to "${mismatch.actualDestination}".

**YOU MUST ACKNOWLEDGE THIS IMMEDIATELY** in your first response:
- Point out the mismatch to the user
- Offer to update the title to: "${mismatch.suggestedTitle}"
- This often happens when importing confirmation emails

**DO NOT PROCEED** with planning until you've addressed this mismatch.`;
}

systemPrompt += `

## ⚠️ CRITICAL: INFER PREFERENCES FROM EXISTING BOOKINGS
...`;
```

### Option 2: Modify Summary Generation

In `itinerary-summarizer.ts:469-480`, use stronger language:

```typescript
if (mismatch?.hasMismatch) {
  lines.push('# 🚨🚨🚨 CRITICAL ALERT 🚨🚨🚨');
  lines.push('## TITLE/DESTINATION MISMATCH DETECTED');
  lines.push('');
  lines.push('**⚠️ STOP AND READ THIS FIRST ⚠️**');
  lines.push('');
  lines.push(`The title says "${itinerary.title}" but flights go to "${mismatch.actualDestination}"!`);
  lines.push('');
  lines.push('**YOU MUST:**');
  lines.push('1. Point this out to the user in your FIRST response');
  lines.push('2. Offer to fix the title immediately');
  lines.push('3. Do NOT proceed without addressing this');
  lines.push('');
  // ... rest of details
}
```

### Option 3: Use Tool Call Hint

Add a suggestion in the mismatch warning to use the `update_itinerary_metadata` tool:

```typescript
lines.push('**IMMEDIATE ACTION**: Call `update_itinerary_metadata` to fix the title before continuing.');
```

## Testing

1. Create or use an itinerary with mismatched title/destination
2. Start a new chat session
3. Send any message
4. Verify LLM's first response acknowledges the mismatch

## Test Script

Run: `npx tsx test-full-context.js` to see the complete summary as the LLM receives it.

## Files Involved

- `src/services/trip-designer/itinerary-summarizer.ts` - Detection and summary generation
- `src/services/trip-designer/trip-designer.service.ts` - Context injection
- `src/storage/json-storage.ts` - Date deserialization
- `data/itineraries/f6f505b6-0408-4841-b305-050f40e490b3.json` - Test itinerary
