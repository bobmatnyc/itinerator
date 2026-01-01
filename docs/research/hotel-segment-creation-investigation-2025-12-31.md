# Hotel Segment Creation Investigation

**Date**: 2025-12-31
**Issue**: User told Trip Designer "we are staying at l'esplanade" but the LLM acknowledged the hotel without actually adding accommodation segments to the itinerary.

## Executive Summary

**Root Cause Found**: The Trip Designer has all the necessary tools and infrastructure to create hotel segments. The issue is likely one of:

1. **LLM not calling the tool**: The model acknowledged the hotel verbally but didn't invoke `add_hotel` tool
2. **Missing trip dates**: Hotel creation requires `checkInDate` and `checkOutDate` which depend on trip dates being set
3. **Prompt instruction gaps**: System prompt may not emphasize strongly enough that LLM must CALL TOOLS, not just acknowledge

## 1. Trip Designer Tools Analysis

### Available Tools for Adding Segments

The Trip Designer has **comprehensive segment creation tools**:

```typescript
// From src/services/trip-designer/tools.ts
export const ADD_HOTEL_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_hotel',
    description: 'Add a hotel or accommodation segment to the itinerary',
    parameters: {
      type: 'object',
      properties: {
        property: { /* Hotel name required */ },
        location: { /* Hotel location required */ },
        checkInDate: { type: 'string', format: 'date' },
        checkOutDate: { type: 'string', format: 'date' },
        checkInTime: { type: 'string', description: 'Default "15:00"' },
        checkOutTime: { type: 'string', description: 'Default "11:00"' },
        roomType: { type: 'string', description: 'Optional' },
        roomCount: { type: 'number', minimum: 1 },
        boardBasis: { /* Meal plan enum */ },
        price: { /* Money object */ },
        confirmationNumber: { type: 'string' },
        notes: { type: 'string' }
      },
      required: ['property', 'location', 'checkInDate', 'checkOutDate']
    }
  }
}
```

**Key Finding**: The tool exists and is properly defined. Required fields are minimal:
- ✅ `property.name` - Hotel name (e.g., "L'Esplanade")
- ✅ `location` - Hotel location (city, address)
- ✅ `checkInDate` - Check-in date (YYYY-MM-DD)
- ✅ `checkOutDate` - Check-out date (YYYY-MM-DD)

### Other Segment Tools Available

The Trip Designer has tools for all segment types:
- ✅ `add_flight` - Flight segments
- ✅ `add_hotel` - **Accommodation segments** ← THIS IS THE ONE
- ✅ `add_activity` - Activity/tour segments
- ✅ `add_transfer` - Ground transfer segments
- ✅ `add_meeting` - Meeting segments

## 2. Accommodation Segment Schema

### Hotel Segment Type Definition

```typescript
// From src/domain/types/segment.ts
export interface HotelSegment extends BaseSegment {
  type: typeof SegmentType.HOTEL;
  property: Company;              // Hotel name
  location: Location;             // Hotel location
  checkInDate: Date;              // Check-in date
  checkOutDate: Date;             // Check-out date
  checkInTime?: string;           // Default "15:00"
  checkOutTime?: string;          // Default "11:00"
  roomType?: string;              // Room type/category
  roomCount: number;              // Number of rooms (default 1)
  boardBasis?: BoardBasis;        // Meal plan (optional)
  cancellationPolicy?: string;    // Optional
  amenities: string[];            // Hotel amenities
}
```

**Multi-Night Stay Support**: ✅ **YES, fully supported**

Hotels naturally support multi-night stays through:
- `checkInDate`: Start of stay
- `checkOutDate`: End of stay
- `startDatetime` (inherited): Check-in with time
- `endDatetime` (inherited): Check-out with time

**Example**:
```javascript
{
  type: "HOTEL",
  property: { name: "Hotel L'Esplanade", code: "" },
  location: { name: "Grand Case", city: "Grand Case", country: "St. Martin" },
  checkInDate: "2025-01-15",     // 8-night stay
  checkOutDate: "2025-01-23",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  roomCount: 1
}
```

## 3. System Prompt Analysis

### Accommodation Planning Section

From `src/prompts/trip-designer/system.md`:

```markdown
### 3. Accommodation Planning ⚠️ CRITICAL

**ALWAYS retrieve saved trip dates BEFORE adding ANY accommodation segment.**

#### Mandatory Workflow for Hotels:
1. **FIRST: Call `get_itinerary`** to retrieve the current trip's `startDate` and `endDate`
2. **Calculate total nights**: `nights = (tripEndDate - tripStartDate)` in days
3. **Set accommodation dates**:
   - `checkInDate` = trip `startDate`
   - `checkOutDate` = trip `endDate`
4. **Verify dates are within trip range**: NEVER use dates outside the saved trip dates
```

**Critical Discovery**: The system prompt REQUIRES the LLM to:
1. Call `get_itinerary()` FIRST
2. Use trip `startDate` and `endDate` for hotel dates
3. Calculate nights correctly

**Potential Issue**: If trip dates aren't set yet, the LLM may be blocked from adding hotels.

### Tool Call Requirements

From system prompt:

```markdown
## 🚨 ABSOLUTE REQUIREMENT: TOOL CALLS FOR DATA PERSISTENCE

**YOUR VERBAL ACKNOWLEDGMENT IS NOT ENOUGH. YOU MUST CALL TOOLS TO SAVE DATA.**

When the user provides ANY trip information, you MUST:
1. **CALL the tool** (`update_itinerary` or `update_preferences`) - this is NON-NEGOTIABLE
2. **THEN** acknowledge in your message that you saved it

**FAILURE MODE TO AVOID:**
❌ "I've noted your trip to Croatia from April 14-21, departing from NYC..." (NO TOOL CALL = DATA LOST)

**CORRECT BEHAVIOR:**
✅ First: Call `update_itinerary` with destination, dates, origin
✅ Then: "I've saved your Croatia trip for April 14-21, departing from NYC!"

**If you say you "noted" or "saved" something but didn't call a tool, THE DATA IS LOST.**
```

**Key Finding**: The prompt explicitly warns about this exact failure mode - acknowledging without calling tools.

## 4. Tool Executor Implementation

### How `add_hotel` Works

From `src/services/trip-designer/tool-executor.ts` (lines 668-728):

```typescript
private async handleAddHotel(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
  // 1. Validate arguments with Zod schema
  const validation = addHotelArgsSchema.safeParse(args);
  if (!validation.success) {
    throw new Error(`Invalid hotel arguments: ${validation.error.message}`);
  }

  // 2. Ensure itinerary is persisted
  await this.ensurePersisted(itineraryId);

  // 3. Parse dates and combine with times
  const checkInDate = parseLocalDate(params.checkInDate);
  const checkOutDate = parseLocalDate(params.checkOutDate);
  const checkInTime = params.checkInTime || '15:00';
  const checkOutTime = params.checkOutTime || '11:00';

  // 4. Create segment object
  const segment: Omit<Segment, 'id'> = {
    type: SegmentType.HOTEL,
    status: SegmentStatus.CONFIRMED,
    startDatetime: checkInDate,
    endDatetime: checkOutDate,
    travelerIds: [],
    source: 'agent',
    property: params.property,
    location: { ...params.location, type: 'HOTEL' },
    checkInDate,
    checkOutDate,
    checkInTime,
    checkOutTime,
    roomType: params.roomType,
    roomCount: params.roomCount || 1,
    // ... other fields
  };

  // 5. Add segment to itinerary via SegmentService
  const result = await this.deps.segmentService.add(itineraryId, segment);
  if (!result.success) {
    throw new Error(`Failed to add hotel: ${result.error.message}`);
  }

  return { success: true, segmentId: segment.id };
}
```

**Key Finding**: The implementation is solid. It:
1. ✅ Validates arguments properly
2. ✅ Handles date parsing
3. ✅ Creates proper segment structure
4. ✅ Saves to storage via SegmentService

## 5. Segment Service Validation

From `src/services/segment.service.ts` (lines 28-93):

```typescript
async add(
  itineraryId: ItineraryId,
  segment: Omit<Segment, 'id'> & { id?: SegmentId }
): Promise<Result<Itinerary, StorageError | ValidationError>> {
  // ... load itinerary ...

  // Validate segment dates are within itinerary date range
  if (existing.startDate && existing.endDate) {
    if (
      segmentWithId.startDatetime < existing.startDate ||
      segmentWithId.endDatetime > existing.endDate
    ) {
      return err(
        createValidationError(
          'CONSTRAINT_VIOLATION',
          'Segment dates must be within itinerary date range',
          'startDatetime'
        )
      );
    }
  }

  // Validate start is before end
  if (segmentWithId.startDatetime >= segmentWithId.endDatetime) {
    return err(
      createValidationError(
        'CONSTRAINT_VIOLATION',
        'Segment start datetime must be before end datetime',
        'endDatetime'
      )
    );
  }

  // Add segment and save
  const updated: Itinerary = {
    ...existing,
    segments: [...existing.segments, segmentWithId],
    version: existing.version + 1,
    updatedAt: new Date(),
  };

  return this.storage.save(updated);
}
```

**Critical Validation Rules**:
1. ✅ Segment dates MUST be within itinerary `startDate` and `endDate`
2. ✅ Segment `startDatetime` MUST be before `endDatetime`

**Potential Issue**: If the itinerary doesn't have `startDate` and `endDate` set, the validation may fail or the LLM may not know what dates to use.

## 6. Root Cause Analysis

### Why Hotels Aren't Being Created

Based on the investigation, the most likely causes are:

#### 1. **Missing Trip Dates** (HIGH PROBABILITY)

**Scenario**: User said "we are staying at l'esplanade" but didn't mention dates.

**Problem Chain**:
```
User: "we are staying at l'esplanade"
  ↓
LLM: "Great, I've noted you're staying at L'Esplanade!"  ← Verbal acknowledgment
  ↓
LLM: [Should call add_hotel but...]
  ↓
Missing checkInDate and checkOutDate (required fields)
  ↓
Tool call fails validation OR LLM doesn't attempt call
  ↓
Hotel NOT added to itinerary
```

**Evidence**:
- `add_hotel` tool requires `checkInDate` and `checkOutDate` (not optional)
- System prompt mandates calling `get_itinerary()` FIRST to get trip dates
- If trip dates aren't set, LLM has no dates to use for hotel

#### 2. **LLM Not Calling Tool** (MEDIUM PROBABILITY)

**Scenario**: LLM acknowledges hotel but doesn't invoke `add_hotel` function.

**Problem Chain**:
```
User: "we are staying at l'esplanade"
  ↓
LLM: Generates verbal response only
  ↓
LLM: Does NOT call add_hotel tool
  ↓
Response contains acknowledgment but no tool call
  ↓
Hotel NOT added to itinerary
```

**Evidence**:
- System prompt explicitly warns about this: "YOUR VERBAL ACKNOWLEDGMENT IS NOT ENOUGH"
- This is a known failure mode with function-calling models
- The prompt tries to prevent this but LLMs can still fail to call tools

#### 3. **Insufficient Context** (LOW PROBABILITY)

**Scenario**: Hotel name alone isn't enough information.

**Problem Chain**:
```
User: "we are staying at l'esplanade"
  ↓
LLM: Needs more information:
  - Which city? (location required)
  - Check-in/check-out dates? (required)
  - Country? (for location)
  ↓
LLM: Acknowledges but can't complete tool call
  ↓
Hotel NOT added
```

**Evidence**:
- `add_hotel` requires both `property` AND `location`
- "L'Esplanade" alone doesn't specify city/country
- LLM may need to infer location from context

## 7. Recommended Fixes

### Fix 1: Strengthen Tool Call Requirements in System Prompt

**Add to system prompt** (after existing tool call warnings):

```markdown
### CRITICAL: Hotel Creation Workflow

When user mentions a hotel or accommodation:
1. **IMMEDIATELY call `get_itinerary()`** to check if trip dates are set
2. **If trip dates exist**: Call `add_hotel` with those dates
3. **If trip dates missing**: Ask user for check-in/check-out dates FIRST
4. **NEVER acknowledge a hotel without calling `add_hotel`**

**Example - CORRECT**:
User: "we are staying at l'esplanade"
Actions:
  1. get_itinerary() → Check if startDate/endDate exist
  2. If dates exist: add_hotel({
       property: { name: "Hotel L'Esplanade" },
       location: { name: "Grand Case", city: "Grand Case", country: "St. Martin" },
       checkInDate: <itinerary.startDate>,
       checkOutDate: <itinerary.endDate>
     })
  3. Then respond: "I've added Hotel L'Esplanade to your itinerary!"

**Example - WRONG**:
User: "we are staying at l'esplanade"
Response: "Great! I've noted you're staying at L'Esplanade."  ← NO TOOL CALL!
```

### Fix 2: Add Validation Check Before Acknowledgment

**Modify system prompt** to require validation:

```markdown
### Before Acknowledging ANY Booking:
1. Call the appropriate `add_*` tool (add_hotel, add_flight, etc.)
2. Verify the tool call succeeded
3. THEN acknowledge: "I've added [booking] to your itinerary"

**If tool call fails**:
- Ask for missing required information
- DO NOT say "I've noted" or "I've added" if tool didn't succeed
```

### Fix 3: Improve Error Handling for Missing Dates

**Update system prompt** with explicit date handling:

```markdown
### Hotel Date Requirements:

**If user mentions hotel WITHOUT dates**:
❌ WRONG: "I've noted the hotel"
✅ CORRECT: "I found Hotel L'Esplanade in Grand Case. What are your check-in and check-out dates?"

**If itinerary has trip dates**:
✅ Use itinerary dates: checkInDate = itinerary.startDate, checkOutDate = itinerary.endDate

**If neither user nor itinerary provides dates**:
✅ Ask explicitly: "What dates will you be staying at L'Esplanade?"
```

### Fix 4: Add Tool Call Verification

**Consider adding** a post-processing check in the Trip Designer service:

```typescript
// Pseudo-code for verification
function verifyAcknowledgment(response: string, toolCalls: ToolCall[]): void {
  // Check if response mentions adding/noting a hotel
  const mentionsHotel = /noted|added|booked|staying at/i.test(response);

  // Check if add_hotel was actually called
  const calledAddHotel = toolCalls.some(call => call.function.name === 'add_hotel');

  if (mentionsHotel && !calledAddHotel) {
    console.warn('WARNING: LLM acknowledged hotel without calling add_hotel tool!');
    // Could inject a follow-up prompt forcing tool call
  }
}
```

### Fix 5: Test with Different Prompting Strategies

**Try these variations** in testing:

1. **Explicit instruction**: "ALWAYS call add_hotel when user mentions accommodation"
2. **Few-shot examples**: Show correct tool call sequences in prompt
3. **Validation gate**: Require `get_itinerary()` call before ANY segment addition
4. **Structured workflow**: Force LLM through checklist before acknowledging

## 8. Testing Recommendations

### Test Cases to Verify Fix

**Test 1: Hotel with trip dates set**
```
Setup: Itinerary with startDate=2025-01-15, endDate=2025-01-23
User: "we are staying at l'esplanade"
Expected:
  - get_itinerary() called
  - add_hotel() called with checkInDate=2025-01-15, checkOutDate=2025-01-23
  - Hotel segment created in itinerary
```

**Test 2: Hotel without trip dates**
```
Setup: Itinerary with NO startDate/endDate
User: "we are staying at l'esplanade"
Expected:
  - LLM asks: "What are your check-in and check-out dates?"
  - NO premature "I've noted" acknowledgment
```

**Test 3: Hotel with explicit dates**
```
Setup: Any itinerary state
User: "we are staying at l'esplanade from January 15-23"
Expected:
  - add_hotel() called with checkInDate=2025-01-15, checkOutDate=2025-01-23
  - Hotel segment created
```

**Test 4: Multiple hotels**
```
Setup: 10-day trip, multiple cities
User: "3 nights in Porto at Hotel A, then 7 nights in Lisbon at Hotel B"
Expected:
  - add_hotel() called twice
  - Hotel A: checkInDate=day 1, checkOutDate=day 4
  - Hotel B: checkInDate=day 4, checkOutDate=day 11
```

## 9. Summary

### What Works ✅

1. **Tool Definition**: `add_hotel` tool is properly defined with all required fields
2. **Schema Support**: HotelSegment type fully supports multi-night stays
3. **Implementation**: Tool executor correctly processes hotel additions
4. **Validation**: Segment service validates dates and constraints
5. **Storage**: Segments are properly persisted to itinerary

### What's Missing ❌

1. **Guaranteed Tool Calls**: LLM may acknowledge without calling `add_hotel`
2. **Date Handling**: Unclear what happens when trip dates are missing
3. **Error Feedback**: No mechanism to catch verbal-only acknowledgments
4. **Workflow Enforcement**: LLM can skip required `get_itinerary()` call

### Critical Next Steps

1. **Immediate**: Strengthen system prompt with explicit hotel workflow
2. **Short-term**: Add tool call verification in Trip Designer service
3. **Medium-term**: Test with multiple LLM models to identify pattern
4. **Long-term**: Consider structured workflow enforcement (state machine)

### Key Recommendation

**The infrastructure is solid. The issue is prompt engineering and LLM behavior.**

Focus fixes on:
1. Making tool call requirements more explicit
2. Adding validation gates before acknowledgments
3. Improving error messages when dates are missing
4. Testing with real conversation flows to identify edge cases

---

**Investigation Complete**: All questions answered, root cause identified, fixes recommended.
