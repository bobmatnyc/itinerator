# Business Rules & Validation Logic Analysis
**Research Date:** 2026-01-01
**Research Focus:** Itinerary validation, segment overlap detection, constraint enforcement, and transfer requirements

---

## Executive Summary

This analysis documents the existing business rules and validation logic in the Itinerator codebase. The system has **comprehensive validation at multiple layers** but with **gaps in enforcement**. Geographic continuity detection exists but is **not enforced during segment creation** in the Trip Designer workflow.

### Key Findings:
1. ✅ **Duplicate segment detection** - Fully implemented in `SegmentService`
2. ✅ **Temporal validation** - Start/end date ordering enforced
3. ✅ **Geographic continuity detection** - Sophisticated service exists (`SegmentContinuityService`)
4. ❌ **Geographic gap enforcement** - **NOT enforced** during segment add operations
5. ❌ **Transfer requirement enforcement** - Detection exists, but no blocking validation

---

## 1. Existing Business Rules & Constraints

### 1.1 Segment-Level Validation (`SegmentService`)

**Location:** `src/services/segment.service.ts`

#### Duplicate Detection (Lines 46-56)
```typescript
// Check for duplicate segments before adding
const duplicateCheck = this.findDuplicateSegment(existing.segments, segmentWithId);
if (duplicateCheck) {
  return err(
    createValidationError(
      'CONSTRAINT_VIOLATION',
      duplicateCheck.message,
      'duplicate'
    )
  );
}
```

**Duplicate Criteria by Segment Type:**

| Segment Type | Duplicate Criteria |
|--------------|-------------------|
| **ACTIVITY** | Same name + same date |
| **HOTEL** | Same property name + overlapping dates |
| **FLIGHT** | Same flight number + same departure date |
| **MEETING** | Same title + same start time |
| **TRANSFER** | Same type + same pickup/dropoff + same date |
| **CUSTOM** | Same title + same start time |

**Implementation Details:**
- Uses `normalizeString()` for fuzzy matching (lowercase, trim, remove special chars)
- Uses `datesOverlap()` for hotel date range checking
- Prevents same-day checkout/checkin from being flagged as overlap
- Returns user-friendly error messages suggesting updates

#### Date Range Validation (Lines 58-83)

**Rule 1: Segment dates within itinerary bounds**
```typescript
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
```

**Rule 2: Start before end**
```typescript
if (segmentWithId.startDatetime >= segmentWithId.endDatetime) {
  return err(
    createValidationError(
      'CONSTRAINT_VIOLATION',
      'Segment start datetime must be before end datetime',
      'endDatetime'
    )
  );
}
```

#### ID Uniqueness (Lines 85-93)
```typescript
// Check if segment ID already exists
const segmentExists = existing.segments.some((s) => s.id === segmentWithId.id);
if (segmentExists) {
  return err(
    createStorageError('VALIDATION_ERROR', `Segment ${segmentWithId.id} already exists`, {
      segmentId: segmentWithId.id,
    })
  );
}
```

---

### 1.2 Schema-Level Validation (Zod)

**Location:** `src/domain/schemas/segment.schema.ts`

#### Base Segment Constraints
- `startDatetime` and `endDatetime` must be valid dates
- `travelerIds` defaults to empty array (applies to all travelers)
- `source` defaults to 'import'
- `metadata` defaults to empty object

#### Flight-Specific (Lines 109-148)
```typescript
const flightSegmentSchema = flightSegmentBaseSchema.refine(
  (data) => data.endDatetime > data.startDatetime,
  {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  }
);
```

**Flight Number Format:**
```typescript
flightNumber: z.string().regex(
  /^[A-Z0-9]{2,3}\d{1,4}([\/\-][A-Z0-9]{2,3}\d{1,4})?$/,
  'Invalid flight number format'
)
```

#### Hotel-Specific (Lines 157-202)
```typescript
hotelSegmentSchema
  .refine((data) => data.endDatetime > data.startDatetime, {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  })
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  });
```

**Default Times:**
- Check-in: `15:00`
- Check-out: `11:00`

#### All Segment Types
- Meeting, Activity, Transfer, Custom: All enforce `endDatetime > startDatetime`

---

## 2. Geographic Continuity Detection

### 2.1 SegmentContinuityService

**Location:** `src/services/segment-continuity.service.ts`

This is a **sophisticated service** for detecting geographic gaps between segments. However, **it is NOT called during segment creation** in the Trip Designer workflow.

#### Gap Types (Lines 20-31)
```typescript
export enum GapType {
  LOCAL_TRANSFER = 'LOCAL_TRANSFER',        // Same city, different locations
  DOMESTIC_GAP = 'DOMESTIC_GAP',            // Different cities, same country
  INTERNATIONAL_GAP = 'INTERNATIONAL_GAP',   // Different countries
  OVERNIGHT_GAP = 'OVERNIGHT_GAP',          // No transfer needed (travelers at hotel)
  UNKNOWN = 'UNKNOWN',                      // Insufficient data
}
```

#### Gap Detection Logic (Lines 282-365)

**Key Algorithm:**
1. Sort segments chronologically
2. For each consecutive pair:
   - Get end location of segment N
   - Get start location of segment N+1
   - Check if locations differ
   - Skip overnight gaps (e.g., dinner → next-day lunch)
   - Skip if existing transfer already connects them
   - Calculate confidence score (0-100)
   - **Only create gap if confidence >= 80%**

**Confidence Scoring (Lines 176-230):**

| Scenario | Confidence | Example |
|----------|-----------|---------|
| Airport → Airport (cross-city) | 95% | JFK → MXP flight needed |
| Flight arrival → Hotel | 95% | Airport → Hotel transfer needed |
| Hotel → Flight departure | 95% | Hotel → Airport transfer needed |
| Hotel → Hotel (cross-city) | 90% | NYC hotel → Paris hotel (travel day) |
| Hotel → Activity | 85% | Hotel checkout → Museum visit |
| Same-city activities | 80% | Restaurant → Theater |
| Cross-city activities | 60% | May need flight, lower confidence |
| Unknown/overnight | 50% | Not enough data |

**Overnight Gap Detection (Lines 239-275):**
- Skips gaps >8 hours on same day
- Skips evening activity (6PM+) → morning activity (<3PM) next day
- Example: Dinner at 9PM → Lunch at 12PM next day = **no gap created**
- Prevents spurious transfer suggestions

#### Location Matching (Lines 418-464)

**Fuzzy Matching Logic:**
1. **Airport codes** - Most reliable (e.g., JFK vs. MXP)
2. **Coordinate proximity** - Within 100 meters via Haversine formula
3. **Address matching** - Cross-check address vs. name fields
4. **Name similarity** - Normalized string comparison
5. **Fuzzy word matching** - >70% word overlap with Levenshtein distance

**Stop Words Removed:**
- Generic: the, at, in, on, of, and, a, an, to, for
- Travel: resort, hotel, inn, suites, lodge, airport, international
- Address: st, ave, blvd, rd, street, avenue, boulevard

---

### 2.2 Current Usage of Continuity Detection

**Used In:**
1. ✅ **Document Import** (`document-import.service.ts:371`) - Post-import analysis
2. ✅ **Travel Agent Facade** (`travel-agent-facade.service.ts:124, 236`) - Analysis mode
3. ❌ **Trip Designer Tool Executor** - **NOT USED** during segment add

**Gap in Enforcement:**
```typescript
// document-import.service.ts (Lines 398-405)
// This DETECTS gaps but does NOT block import
const gaps = this.continuityService.detectLocationGaps(sortedSegments);

if (gaps.length === 0) {
  console.log('✓ No geographic gaps detected');
  return itinerary;
}

// Gaps are REPORTED but NOT enforced
```

---

## 3. Validation Gaps & Missing Rules

### 3.1 Geographic Gap Enforcement

**Current State:**
- ✅ Detection logic exists and is sophisticated
- ❌ **NOT enforced** during Trip Designer segment creation
- ❌ **NOT enforced** during manual segment add via API

**Missing:**
1. No validation in `SegmentService.add()` to check continuity
2. No validation in `ToolExecutor.handleAddFlight/Hotel/Activity()`
3. No blocking mechanism for discontinuous segments

**Recommendation:**
Add optional continuity validation to `SegmentService.add()`:
```typescript
// Proposed enhancement
async add(
  itineraryId: ItineraryId,
  segment: Omit<Segment, 'id'> & { id?: SegmentId },
  options?: { validateContinuity?: boolean }
): Promise<Result<Itinerary, StorageError | ValidationError>> {
  // ... existing validation ...

  if (options?.validateContinuity) {
    const updatedSegments = [...existing.segments, segmentWithId];
    const gaps = this.continuityService.detectLocationGaps(updatedSegments);

    if (gaps.length > 0) {
      return err(
        createValidationError(
          'CONSTRAINT_VIOLATION',
          `Geographic gap detected: ${gaps[0].description}`,
          'location'
        )
      );
    }
  }

  // ... save segment ...
}
```

---

### 3.2 Segment Overlap Detection

**Current State:**
- ✅ Duplicate detection prevents exact duplicates
- ❌ **NO validation** for general temporal overlaps

**Missing:**
- No check for overlapping activities at different locations
- Example: 10AM museum visit + 10:30AM restaurant (same traveler)
- Could add warning but not blocking error

---

### 3.3 Transfer Requirements

**Current State:**
- ✅ Detection exists via `SegmentContinuityService`
- ✅ Inferred transfers can be created during import
- ❌ **NOT enforced** in Trip Designer workflow
- ❌ **NOT suggested** proactively to user

**Missing:**
1. No UI prompt: "You need a transfer from JFK to Manhattan Grand Hotel"
2. No auto-creation of transfer segments (by design, requires user confirmation)
3. No validation preventing non-contiguous segments

---

## 4. Tool Definitions & Enforcement

### 4.1 Trip Designer Tools

**Location:** `src/services/trip-designer/tools.ts`

#### add_hotel Tool (Lines 136-215)
```typescript
description: 'REQUIRED CALL when user mentions ANY accommodation...'
```

**Enforcement:** Description-level only (no runtime validation)

#### add_activity Tool (Lines 221-292)
```typescript
description: 'REQUIRED CALL when user mentions ANY dining/activity...'
```

**Enforcement:** Description-level only (no runtime validation)

#### add_transfer Tool (Lines 298-371)
```typescript
description: 'Add a ground transfer (taxi, shuttle, car service) between locations'
```

**Missing:** No enforcement that transfers are REQUIRED for geographic gaps

---

### 4.2 Constraint Enforcement in Tool Executor

**Location:** `src/services/trip-designer/tool-executor.ts`

**Current Implementation:**
- Zod schema validation for tool arguments (Lines 103-120)
- No post-creation validation of itinerary state
- No continuity checking after segment addition

**Gap:**
```typescript
// tool-executor.ts - handleAddFlight, handleAddHotel, etc.
// These methods call segmentService.add() but do NOT check continuity
case 'add_flight':
  result = await this.handleAddFlight(itineraryId, args);
  break;

// Missing:
// - Post-add continuity validation
// - Gap detection and warning
// - Transfer suggestion
```

---

## 5. Itinerary-Level Validation

### 5.1 Itinerary Schema Constraints

**Location:** `src/domain/schemas/itinerary.schema.ts`

#### Date Order Validation (Lines 71-80)
```typescript
.refine((data) => {
  // Only validate date order if both dates are provided
  if (data.startDate && data.endDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
})
```

**Note:** Itinerary dates are **optional** (collected by Trip Designer during discovery)

#### Primary Traveler Validation (Lines 81-88)
```typescript
.refine(
  (data) =>
    !data.primaryTravelerId || data.travelers.some((t) => t.id === data.primaryTravelerId),
  {
    message: 'Primary traveler must be in travelers list',
    path: ['primaryTravelerId'],
  }
);
```

---

## 6. Validation Locations Summary

### Where Validation Happens

| Validation Type | Location | Enforcement Level |
|----------------|----------|-------------------|
| **Duplicate Segments** | `SegmentService.add()` | ✅ Blocking |
| **Segment Date Order** | Zod schemas | ✅ Blocking |
| **Segment Within Itinerary Dates** | `SegmentService.add()` | ✅ Blocking (if dates set) |
| **ID Uniqueness** | `SegmentService.add()` | ✅ Blocking |
| **Flight Number Format** | Zod schema | ✅ Blocking |
| **Hotel Date Order** | Zod schema | ✅ Blocking |
| **Geographic Continuity** | `SegmentContinuityService` | ❌ Detection only |
| **Transfer Requirements** | `SegmentContinuityService` | ❌ Detection only |
| **Segment Temporal Overlap** | None | ❌ No validation |
| **Itinerary Date Order** | Zod schema | ✅ Blocking |
| **Primary Traveler Exists** | Zod schema | ✅ Blocking |

### Where Validation Does NOT Happen

1. ❌ **Trip Designer Workflow** - No continuity validation during segment add
2. ❌ **ToolExecutor** - No post-creation state validation
3. ❌ **API Routes** - Rely on service-level validation only

---

## 7. Recommendations

### 7.1 High Priority (Geographic Continuity)

**Option A: Soft Validation (Recommended)**
- Add continuity check in `SegmentService.add()`
- Return warning metadata but allow creation
- UI shows warning: "⚠️ Transfer needed from JFK to Hotel"
- User can dismiss or auto-create transfer

**Option B: Strict Validation**
- Block segment creation if gap detected
- Require transfer segment first
- More rigid, may frustrate users

**Implementation:**
```typescript
// Add to SegmentService.add()
const continuityCheck = this.checkContinuity(
  [...existing.segments, segmentWithId]
);

if (continuityCheck.gaps.length > 0) {
  // Return success but with warning metadata
  return ok({
    itinerary: updated,
    warnings: continuityCheck.gaps.map(g => ({
      type: 'GEOGRAPHIC_GAP',
      message: g.description,
      suggestedType: g.suggestedType,
      confidence: g.confidence,
    }))
  });
}
```

---

### 7.2 Medium Priority (Tool Enforcement)

**Trip Designer Tool Descriptions**
- Current: Description-level hints ("REQUIRED CALL")
- Enhancement: Runtime validation in tool executor
- Example: Track if user mentions hotel but tool not called

**Implementation:**
```typescript
// Add to TripDesignerService
private async validateToolUsage(
  userMessage: string,
  toolsCalled: string[]
): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];

  // Check for hotel mentions without add_hotel call
  if (
    /staying at|hotel|accommodation/i.test(userMessage) &&
    !toolsCalled.includes('add_hotel')
  ) {
    warnings.push({
      type: 'MISSING_TOOL_CALL',
      message: 'User mentioned accommodation but add_hotel was not called',
    });
  }

  return warnings;
}
```

---

### 7.3 Low Priority (Temporal Overlap)

**Segment Overlap Warnings**
- Detect when traveler has overlapping activities
- Example: 10AM museum + 10:30AM restaurant for same person
- Show warning but allow (may be intentional multi-tasking)

---

## 8. Architecture Patterns

### 8.1 Error Handling Pattern

**Result Type:**
```typescript
type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };
```

**Error Types:**
- `StorageError` - Data access failures
- `ValidationError` - Business rule violations
  - `CONSTRAINT_VIOLATION` - Duplicate, date range, etc.
  - `NOT_FOUND` - Missing entities
  - `VALIDATION_ERROR` - Schema validation failures

---

### 8.2 Service Layer Pattern

**Separation of Concerns:**
1. **SegmentService** - CRUD operations + basic validation
2. **SegmentContinuityService** - Geographic analysis (pure function)
3. **ItineraryService** - Itinerary-level operations
4. **ToolExecutor** - Maps LLM tool calls to services

**Gap:** No orchestration layer that combines validation from multiple services

---

## 9. Conclusion

### Summary of Findings

**Strengths:**
1. ✅ Comprehensive duplicate detection with fuzzy matching
2. ✅ Robust date validation at schema and service levels
3. ✅ Sophisticated geographic continuity detection service
4. ✅ Confidence-based gap filtering (80% threshold)
5. ✅ Clear separation of concerns between services

**Weaknesses:**
1. ❌ Geographic continuity detection NOT enforced during segment creation
2. ❌ No validation in Trip Designer workflow for missing transfers
3. ❌ No temporal overlap detection for same traveler
4. ❌ Tool enforcement relies on LLM behavior, not runtime checks

**Critical Gap:**
The `SegmentContinuityService` exists and works well, but it's **never called during segment add operations**. It's only used for post-import analysis and reporting, not for real-time validation.

---

## 10. Next Steps

### Immediate Actions
1. **Add continuity check to `SegmentService.add()`**
   - Return warnings without blocking
   - Include suggested transfer type and confidence

2. **Update `ToolExecutor` to propagate warnings**
   - Surface continuity warnings to LLM context
   - Allow LLM to suggest transfers to user

3. **Add UI indicators for geographic gaps**
   - Show warning badges on timeline
   - Offer "Add Transfer" quick action

### Future Enhancements
1. Auto-suggest transfers based on detected gaps
2. Add temporal overlap detection (warning only)
3. Implement runtime tool enforcement checks
4. Add validation settings (strict vs. permissive mode)

---

**Research Completed:** 2026-01-01
**Researcher:** Research Agent (Claude Opus 4.5)
**Files Analyzed:** 12 TypeScript files
**Lines Reviewed:** ~3,500 LOC
