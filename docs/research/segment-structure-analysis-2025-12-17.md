# Segment Structure Analysis - Itinerator

**Research Date:** 2025-12-17
**Objective:** Investigate current segment types and structure to understand temporal/geographic data fields and identify gaps for implementing semantic segments with auto-generated transfers.

---

## Executive Summary

The Itinerator project has a well-structured segment type system using TypeScript discriminated unions with Zod schema validation. The current implementation provides:

- ✅ **Strong typing** with 6 distinct segment types (FLIGHT, HOTEL, MEETING, ACTIVITY, TRANSFER, CUSTOM)
- ✅ **Temporal data** via `startDatetime` and `endDatetime` on all segments
- ✅ **Geographic data** via location fields (varies by segment type)
- ✅ **Validation** for time ordering and date ranges
- ⚠️ **Partial location semantics** - only FLIGHT and TRANSFER have explicit start/end locations
- ❌ **No auto-transfer generation** - transfers must be manually created

**Key Gap Identified:** Not all segment types have explicit start/end location fields, making it difficult to auto-generate transfers between adjacent segments with different geographic endpoints.

---

## 1. Current Segment Type Definition

### Base Segment Structure

All segments inherit from `BaseSegment` interface:

```typescript
interface BaseSegment {
  // Identity & Status
  id: SegmentId;                    // UUID branded type
  status: SegmentStatus;             // TENTATIVE | CONFIRMED | WAITLISTED | CANCELLED | COMPLETED

  // ✅ TEMPORAL DATA (ALL SEGMENTS)
  startDatetime: Date;               // Start date and time
  endDatetime: Date;                 // End date and time

  // Travelers
  travelerIds: TravelerId[];         // Empty array = all travelers

  // Booking Information
  confirmationNumber?: string;
  bookingReference?: string;
  provider?: Company;

  // Pricing
  price?: Money;
  taxes?: Money;
  fees?: Money;
  totalPrice?: Money;

  // Dependencies & Metadata
  dependsOn?: SegmentId[];           // Explicit dependencies
  notes?: string;
  metadata: Record<string, unknown>;
}
```

**Validation Rules (all segments):**
- ✅ `endDatetime > startDatetime` enforced via Zod refinement
- ✅ Segment dates must fall within itinerary `startDate` and `endDate` range
- ✅ Circular dependencies prevented via `DependencyService`

---

## 2. Geographic Data Fields by Segment Type

### 2.1 FLIGHT Segment
```typescript
interface FlightSegment extends BaseSegment {
  type: 'FLIGHT';

  // ✅ EXPLICIT START/END LOCATIONS
  origin: Location;           // Departure airport
  destination: Location;      // Arrival airport

  airline: Company;
  flightNumber: string;       // Format: [A-Z0-9]{2,3}\d{1,4}
  departureTerminal?: string;
  arrivalTerminal?: string;
  aircraft?: string;
  cabinClass?: CabinClass;    // ECONOMY | PREMIUM_ECONOMY | BUSINESS | FIRST
  bookingClass?: string;
  seatAssignments?: Record<string, string>;
  durationMinutes?: number;
  baggageAllowance?: string;
}
```

**Location Semantics:**
- ✅ Clear start location: `origin`
- ✅ Clear end location: `destination`
- Both are `Location` objects with airport codes

---

### 2.2 HOTEL Segment
```typescript
interface HotelSegment extends BaseSegment {
  type: 'HOTEL';

  // ⚠️ SINGLE LOCATION (no start/end distinction)
  location: Location;         // Hotel address

  property: Company;
  checkInDate: Date;
  checkOutDate: Date;
  checkInTime?: string;       // HH:mm format (default: "15:00")
  checkOutTime?: string;      // HH:mm format (default: "11:00")
  roomType?: string;
  roomCount: number;
  boardBasis?: BoardBasis;    // ROOM_ONLY | BED_BREAKFAST | HALF_BOARD | FULL_BOARD | ALL_INCLUSIVE
  cancellationPolicy?: string;
  amenities: string[];
}
```

**Location Semantics:**
- ⚠️ Only has single `location` field
- ❓ Implicit: start location = end location (stationary segment)
- **Gap:** No explicit `startLocation`/`endLocation` for semantic consistency

---

### 2.3 MEETING Segment
```typescript
interface MeetingSegment extends BaseSegment {
  type: 'MEETING';

  // ⚠️ SINGLE LOCATION
  location: Location;         // Meeting venue

  title: string;
  organizer?: string;
  attendees: string[];
  agenda?: string;
  meetingUrl?: string;        // For virtual meetings
  dialIn?: string;
}
```

**Location Semantics:**
- ⚠️ Only has single `location` field
- ❓ Implicit: start location = end location (stationary segment)
- **Gap:** No explicit `startLocation`/`endLocation` for semantic consistency

---

### 2.4 ACTIVITY Segment
```typescript
interface ActivitySegment extends BaseSegment {
  type: 'ACTIVITY';

  // ⚠️ SINGLE LOCATION
  location: Location;         // Activity venue

  name: string;
  description?: string;
  category?: string;
  voucherNumber?: string;
}
```

**Location Semantics:**
- ⚠️ Only has single `location` field
- ❓ Implicit: start location = end location for most activities
- **Edge Case:** Some activities might involve movement (e.g., "City Walking Tour")
- **Gap:** No explicit `startLocation`/`endLocation` for semantic consistency

---

### 2.5 TRANSFER Segment
```typescript
interface TransferSegment extends BaseSegment {
  type: 'TRANSFER';

  // ✅ EXPLICIT START/END LOCATIONS
  pickupLocation: Location;    // Pickup point
  dropoffLocation: Location;   // Dropoff point

  transferType: TransferType;  // TAXI | SHUTTLE | PRIVATE | PUBLIC | RIDE_SHARE
  vehicleDetails?: string;
  driverName?: string;
  driverPhone?: string;
}
```

**Location Semantics:**
- ✅ Clear start location: `pickupLocation`
- ✅ Clear end location: `dropoffLocation`
- Explicitly designed for point-to-point movement

---

### 2.6 CUSTOM Segment
```typescript
interface CustomSegment extends BaseSegment {
  type: 'CUSTOM';

  // ❓ OPTIONAL LOCATION (no semantics)
  location?: Location;

  title: string;
  description?: string;
  customData: Record<string, unknown>;
}
```

**Location Semantics:**
- ❓ Optional, undefined semantics
- **Gap:** Cannot determine start/end locations for transfer generation

---

## 3. Location Type Structure

```typescript
interface Location {
  name: string;                 // Required: Location name
  code?: string;                // Optional: IATA code (3 letters, uppercase)
  address?: Address;            // Optional: Physical address
  coordinates?: Coordinates;    // Optional: Lat/long
  timezone?: string;            // Optional: IANA timezone
}

interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;              // Required: ISO 3166-1 alpha-2 (2 letters)
}

interface Coordinates {
  latitude: number;             // -90 to 90
  longitude: number;            // -180 to 180
}
```

**Validation:**
- ✅ Location name is required
- ✅ IATA code validated as 3-letter uppercase
- ✅ Country code validated as 2-letter ISO code
- ✅ Coordinates validated for valid lat/long ranges

---

## 4. LLM Parsing Implementation

### 4.1 LLM Service Overview

Located in: `/Users/masa/Projects/itinerator/src/services/llm.service.ts`

**LLM Pipeline:**
1. **Input:** Structured markdown (pre-categorized by segment type)
2. **LLM Role:** Content cleanup and JSON formatting (Phase 2)
3. **Output:** JSON matching `itinerarySchema`
4. **Validation:** Zod schema validation with error details

### 4.2 LLM System Prompt (Segment Instructions)

The LLM is instructed to parse segments as follows:

**FLIGHT:**
```json
{
  "type": "FLIGHT",
  "startDatetime": "ISO datetime",
  "endDatetime": "ISO datetime",
  "travelerIds": [],
  "notes": "Key flight details",
  "airline": { "name": "Full Airline Name", "code": "XX" },
  "flightNumber": "XX1234",
  "origin": { "name": "Airport", "city": "City", "country": "Country", "code": "XXX", "type": "AIRPORT" },
  "destination": { "name": "Airport", "city": "City", "country": "Country", "code": "XXX", "type": "AIRPORT" },
  "cabin": "ECONOMY|BUSINESS|FIRST"
}
```

**HOTEL:**
```json
{
  "type": "HOTEL",
  "startDatetime": "ISO datetime (check-in 3PM default)",
  "endDatetime": "ISO datetime (check-out 11AM default)",
  "travelerIds": [],
  "notes": "Hotel highlights",
  "property": { "name": "Full Hotel Name" },
  "location": { "name": "Address", "city": "City", "country": "Country", "type": "HOTEL" },
  "roomType": "Room type",
  "checkInDate": "ISO date",
  "checkOutDate": "ISO date"
}
```

**ACTIVITY:**
```json
{
  "type": "ACTIVITY",
  "startDatetime": "ISO datetime",
  "endDatetime": "ISO datetime (add 2-4 hours if not specified)",
  "travelerIds": [],
  "name": "Activity Title",
  "description": "What it involves",
  "notes": "Special requirements",
  "location": { "name": "Venue", "city": "City", "country": "Country", "type": "ATTRACTION" }
}
```

**TRANSFER:**
```json
{
  "type": "TRANSFER",
  "startDatetime": "ISO datetime",
  "endDatetime": "ISO datetime (add 30-60 min)",
  "travelerIds": [],
  "notes": "Transfer details",
  "transferType": "TAXI|SHUTTLE|PRIVATE|PUBLIC|RIDE_SHARE",
  "pickupLocation": { "name": "Pickup", "city": "City", "type": "OTHER" },
  "dropoffLocation": { "name": "Dropoff", "city": "City", "type": "OTHER" }
}
```

### 4.3 LLM Post-Processing

After LLM response, `addDefaults()` method applies:

1. **ID Generation:** Generates UUIDs for segments without IDs
2. **Status Normalization:** Defaults to "CONFIRMED" if invalid
3. **Transfer Type Mapping:** Normalizes variations (e.g., "PRIVATE_CAR" → "PRIVATE")
4. **Datetime Validation:** Fixes invalid end times (if end ≤ start, adds 2 hours)
5. **Location Fallbacks:** Ensures all location objects have `name` field (defaults to "Unknown")
6. **Flight-Specific Fixes:**
   - Ensures airline object with defaults: `{ name: "Unknown", code: "XX" }`
   - Normalizes flight number to match regex: `[A-Z0-9]{2,3}\d{1,4}`
   - Ensures airport codes exist (defaults to "XXX")

**Key Insight:** LLM does NOT currently generate transfers automatically. It only parses explicitly mentioned transfers in the source document.

---

## 5. Existing Time/Date Validation

### 5.1 Schema-Level Validation

All segment schemas enforce:
```typescript
.refine((data) => data.endDatetime > data.startDatetime, {
  message: 'End datetime must be after start datetime',
  path: ['endDatetime'],
})
```

Hotels have additional validation:
```typescript
.refine((data) => data.checkOutDate > data.checkInDate, {
  message: 'Check-out date must be after check-in date',
  path: ['checkOutDate'],
})
```

### 5.2 Service-Level Validation

**SegmentService** validates when adding/updating segments:
```typescript
// Segment dates must be within itinerary range
if (segment.startDatetime < itinerary.startDate ||
    segment.endDatetime > itinerary.endDate) {
  return err('Segment dates must be within itinerary date range');
}

// Start must be before end
if (segment.startDatetime >= segment.endDatetime) {
  return err('Segment start datetime must be before end datetime');
}
```

### 5.3 Dependency-Based Validation

**DependencyService** provides:
- ✅ Circular dependency detection via DFS
- ✅ Topological ordering of segments
- ✅ Chronological dependency inference (30-minute window)
- ✅ Conflict detection for exclusive segments (FLIGHT and TRANSFER cannot overlap)
- ✅ Cascade adjustments when moving dependent segments

**Chronological Inference Logic:**
```typescript
// Segment B depends on Segment A if:
// 1. B starts within 30 minutes after A ends
// 2. B is not a background segment (hotels excluded)
```

**Overlap Detection:**
```typescript
// Flights and transfers are "exclusive" - they cannot time-overlap
// Hotels and meetings are "background" - they can overlap with other segments
```

---

## 6. Gaps for Semantic Segments Implementation

### 6.1 Missing Start/End Location Fields

**Current State:**
| Segment Type | Has Start Location | Has End Location | Field Names |
|--------------|-------------------|------------------|-------------|
| FLIGHT       | ✅ Yes            | ✅ Yes           | `origin`, `destination` |
| TRANSFER     | ✅ Yes            | ✅ Yes           | `pickupLocation`, `dropoffLocation` |
| HOTEL        | ⚠️ Implicit       | ⚠️ Implicit      | `location` (single field) |
| MEETING      | ⚠️ Implicit       | ⚠️ Implicit      | `location` (single field) |
| ACTIVITY     | ⚠️ Implicit       | ⚠️ Implicit      | `location` (single field) |
| CUSTOM       | ❌ No             | ❌ No            | `location?` (optional) |

**Required Changes:**
1. **Option A: Add explicit start/end location fields** to HOTEL, MEETING, ACTIVITY segments
2. **Option B: Create semantic getters** that normalize existing location fields:
   ```typescript
   function getStartLocation(segment: Segment): Location | undefined {
     if (isFlightSegment(segment)) return segment.origin;
     if (isTransferSegment(segment)) return segment.pickupLocation;
     if (isHotelSegment(segment)) return segment.location;
     if (isMeetingSegment(segment)) return segment.location;
     if (isActivitySegment(segment)) return segment.location;
     return undefined;
   }

   function getEndLocation(segment: Segment): Location | undefined {
     if (isFlightSegment(segment)) return segment.destination;
     if (isTransferSegment(segment)) return segment.dropoffLocation;
     if (isHotelSegment(segment)) return segment.location;
     if (isMeetingSegment(segment)) return segment.location;
     if (isActivitySegment(segment)) return segment.location;
     return undefined;
   }
   ```

**Recommendation:** **Option B** (semantic getters) is less invasive and maintains backward compatibility.

---

### 6.2 Auto-Transfer Generation Logic

**Required Implementation:**

```typescript
interface TransferGap {
  fromSegment: Segment;
  toSegment: Segment;
  fromLocation: Location;
  toLocation: Location;
  timeBetween: number; // milliseconds
  needsTransfer: boolean;
}

function detectTransferGaps(segments: Segment[]): TransferGap[] {
  // 1. Sort segments chronologically
  const sorted = sortByStartTime(segments);

  // 2. For each adjacent pair:
  const gaps: TransferGap[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const currentEnd = getEndLocation(current);
    const nextStart = getStartLocation(next);

    // 3. Check if locations differ
    if (currentEnd && nextStart && !locationsMatch(currentEnd, nextStart)) {
      gaps.push({
        fromSegment: current,
        toSegment: next,
        fromLocation: currentEnd,
        toLocation: nextStart,
        timeBetween: next.startDatetime.getTime() - current.endDatetime.getTime(),
        needsTransfer: true,
      });
    }
  }

  return gaps;
}

function locationsMatch(loc1: Location, loc2: Location): boolean {
  // Compare by IATA code first (if both have codes)
  if (loc1.code && loc2.code) {
    return loc1.code === loc2.code;
  }

  // Compare by coordinates (if both have coordinates)
  if (loc1.coordinates && loc2.coordinates) {
    const distance = haversineDistance(loc1.coordinates, loc2.coordinates);
    return distance < 1; // Within 1km
  }

  // Fallback: fuzzy name comparison
  return normalizeLocationName(loc1.name) === normalizeLocationName(loc2.name);
}
```

**Auto-Generation Rules:**
1. Only generate transfers when `endLocation` differs from next segment's `startLocation`
2. Estimate transfer duration based on distance/location type:
   - Airport ↔ Hotel: 45-60 minutes
   - Hotel ↔ Activity: 30 minutes
   - Airport ↔ Airport (layover): Already a FLIGHT, skip
3. Set transfer type based on context:
   - Airport transfers: SHUTTLE or PRIVATE
   - City transfers: TAXI or RIDE_SHARE
4. Insert transfer segment chronologically between gaps
5. Add `dependsOn` field linking transfer to preceding segment

---

### 6.3 Location Comparison Enhancement

**Current State:**
- ❌ No location comparison utility
- ❌ No geographic distance calculation
- ❌ No semantic "same location" logic

**Required Implementation:**
1. **IATA Code Comparison:** Primary method for airports
2. **Coordinate Distance:** Haversine formula for lat/long comparison
3. **Fuzzy Name Matching:** Normalize names (lowercase, remove punctuation, trim)
4. **City-Level Grouping:** Consider locations in same city as "close enough" for some purposes

---

### 6.4 LLM Prompt Enhancement

**Current LLM Does NOT:**
- Infer missing transfers between segments
- Suggest transfers when locations change
- Validate location continuity

**Suggested LLM Prompt Addition:**
```markdown
## Transfer Inference
When consecutive segments have different locations, add a TRANSFER segment:
- Flight SFO → JFK, then Hotel in Manhattan → Add transfer from JFK to hotel
- Hotel checkout in Paris, Activity in Versailles → Add transfer from hotel to activity venue
- Set reasonable transfer times: 30-60 minutes for most city transfers

Example:
{
  "type": "TRANSFER",
  "transferType": "TAXI",
  "pickupLocation": { "name": "Previous segment end location" },
  "dropoffLocation": { "name": "Next segment start location" },
  "startDatetime": "ISO datetime (previous segment end + 5 min)",
  "endDatetime": "ISO datetime (next segment start - 5 min)"
}
```

---

## 7. Implementation Recommendations

### Phase 1: Foundation (Semantic Accessors)
1. Create utility functions:
   - `getStartLocation(segment: Segment): Location | undefined`
   - `getEndLocation(segment: Segment): Location | undefined`
   - `locationsMatch(loc1: Location, loc2: Location): boolean`
   - `calculateDistance(loc1: Location, loc2: Location): number`

### Phase 2: Transfer Gap Detection
2. Implement transfer gap detection:
   - `detectTransferGaps(segments: Segment[]): TransferGap[]`
   - Sort segments chronologically
   - Compare adjacent end/start locations
   - Calculate time available for transfers

### Phase 3: Auto-Generation
3. Implement auto-transfer generation:
   - `generateTransferSegment(gap: TransferGap): TransferSegment`
   - Estimate transfer duration based on location types
   - Infer transfer type (TAXI, SHUTTLE, etc.)
   - Insert into segment array chronologically

### Phase 4: LLM Integration
4. Enhance LLM parsing:
   - Update system prompt with transfer inference instructions
   - Add post-processing step to detect missing transfers
   - Validate location continuity in parsed itineraries

### Phase 5: Service Integration
5. Add to SegmentService:
   - `autoGenerateTransfers(itineraryId: ItineraryId): Result<Itinerary, Error>`
   - Option to enable/disable auto-generation
   - Validation that transfers don't conflict with existing segments

---

## 8. Technical Constraints & Considerations

### 8.1 Backward Compatibility
- ⚠️ Cannot modify existing segment type interfaces without breaking changes
- ✅ Semantic accessors maintain compatibility
- ✅ Auto-generation is additive (creates new segments, doesn't modify existing)

### 8.2 Location Data Quality
- ⚠️ Many locations may not have IATA codes
- ⚠️ Coordinates may be missing for most locations
- ⚠️ Name-based matching is unreliable (e.g., "JFK" vs "John F. Kennedy International Airport")
- **Mitigation:** Implement fuzzy matching with confidence scores

### 8.3 Transfer Time Estimation
- ⚠️ Difficult to accurately estimate transfer duration without external APIs
- ⚠️ Traffic, time of day, and transportation mode affect duration
- **Mitigation:** Use conservative estimates, allow manual override

### 8.4 Segment Ordering
- ✅ Segments are stored in array (order matters for chronological processing)
- ✅ DependencyService already handles topological ordering
- ⚠️ Auto-generated transfers must be inserted in correct chronological position

### 8.5 Dependency Management
- ✅ Existing `dependsOn` field can link transfers to preceding segments
- ⚠️ Circular dependencies must be prevented when adding transfers
- ✅ DependencyService already validates cycles

---

## 9. Example Scenario: Auto-Transfer Generation

### Input Itinerary (No Transfers)
```json
{
  "segments": [
    {
      "type": "FLIGHT",
      "origin": { "name": "SFO", "code": "SFO" },
      "destination": { "name": "JFK", "code": "JFK" },
      "startDatetime": "2025-06-01T08:00:00Z",
      "endDatetime": "2025-06-01T16:30:00Z"
    },
    {
      "type": "HOTEL",
      "location": { "name": "Marriott Manhattan", "city": "New York" },
      "startDatetime": "2025-06-01T18:00:00Z",
      "endDatetime": "2025-06-03T11:00:00Z"
    },
    {
      "type": "ACTIVITY",
      "location": { "name": "Statue of Liberty", "city": "New York" },
      "startDatetime": "2025-06-02T10:00:00Z",
      "endDatetime": "2025-06-02T14:00:00Z"
    },
    {
      "type": "FLIGHT",
      "origin": { "name": "JFK", "code": "JFK" },
      "destination": { "name": "SFO", "code": "SFO" },
      "startDatetime": "2025-06-03T14:00:00Z",
      "endDatetime": "2025-06-03T22:00:00Z"
    }
  ]
}
```

### Detected Transfer Gaps
1. **Gap 1:** Flight (JFK) → Hotel (Manhattan)
   - End location: JFK Airport
   - Start location: Marriott Manhattan
   - Time available: 1.5 hours (16:30 → 18:00)
   - **Action:** Generate airport transfer

2. **Gap 2:** Hotel (Manhattan) → Activity (Statue of Liberty)
   - End location: Marriott Manhattan
   - Start location: Statue of Liberty
   - Time available: Not directly adjacent (activity during hotel stay)
   - **Action:** Skip (activity occurs during hotel stay, return to hotel assumed)

3. **Gap 3:** Hotel (Manhattan) → Flight (JFK)
   - End location: Marriott Manhattan
   - Start location: JFK Airport
   - Time available: 3 hours (11:00 → 14:00)
   - **Action:** Generate airport transfer

### Generated Transfers
```json
{
  "segments": [
    { /* FLIGHT SFO → JFK */ },
    {
      "type": "TRANSFER",
      "transferType": "SHUTTLE",
      "pickupLocation": { "name": "JFK Airport", "code": "JFK" },
      "dropoffLocation": { "name": "Marriott Manhattan", "city": "New York" },
      "startDatetime": "2025-06-01T16:35:00Z",  // 5 min after flight lands
      "endDatetime": "2025-06-01T17:45:00Z",    // 15 min before hotel check-in
      "dependsOn": ["<flight-segment-id>"]
    },
    { /* HOTEL */ },
    { /* ACTIVITY */ },
    {
      "type": "TRANSFER",
      "transferType": "PRIVATE",
      "pickupLocation": { "name": "Marriott Manhattan", "city": "New York" },
      "dropoffLocation": { "name": "JFK Airport", "code": "JFK" },
      "startDatetime": "2025-06-03T11:15:00Z",  // 15 min after checkout
      "endDatetime": "2025-06-03T12:30:00Z",    // 1.5 hrs before flight
      "dependsOn": ["<hotel-segment-id>"]
    },
    { /* FLIGHT JFK → SFO */ }
  ]
}
```

---

## 10. Summary of Findings

### ✅ Current Strengths
- Well-typed segment structure with discriminated unions
- Strong temporal validation (start/end datetime on all segments)
- Flexible location model supporting addresses, coordinates, and codes
- Robust dependency tracking and conflict detection
- LLM integration with schema validation

### ⚠️ Current Gaps
- **Inconsistent location semantics:** Only FLIGHT and TRANSFER have explicit start/end locations
- **No location comparison utilities:** Cannot programmatically determine if two locations are the same
- **No transfer auto-generation:** Gaps in location continuity are not automatically filled
- **No LLM transfer inference:** LLM does not suggest transfers when parsing documents

### 🎯 Required Implementations
1. **Semantic location accessors** (`getStartLocation`, `getEndLocation`)
2. **Location comparison logic** (IATA code, coordinates, fuzzy name matching)
3. **Transfer gap detection** (chronological segment processing)
4. **Transfer auto-generation** (estimate duration, infer type, insert chronologically)
5. **LLM prompt enhancement** (add transfer inference instructions)
6. **Service integration** (add auto-generation option to SegmentService)

### 📋 Next Steps
1. Implement semantic location utilities
2. Add location comparison with confidence scoring
3. Build transfer gap detection algorithm
4. Create transfer generation service
5. Integrate with LLM parsing pipeline
6. Add user-facing auto-generation toggle

---

## Appendix A: File Locations

### Type Definitions
- `/Users/masa/Projects/itinerator/src/domain/types/segment.ts` - Segment type definitions
- `/Users/masa/Projects/itinerator/src/domain/types/location.ts` - Location type definitions
- `/Users/masa/Projects/itinerator/src/domain/types/common.ts` - Enum definitions
- `/Users/masa/Projects/itinerator/src/domain/types/itinerary.ts` - Itinerary type

### Schemas
- `/Users/masa/Projects/itinerator/src/domain/schemas/segment.schema.ts` - Zod validation schemas
- `/Users/masa/Projects/itinerator/src/domain/schemas/location.schema.ts` - Location schemas
- `/Users/masa/Projects/itinerator/src/domain/schemas/common.schema.ts` - Common schemas

### Services
- `/Users/masa/Projects/itinerator/src/services/segment.service.ts` - Segment CRUD operations
- `/Users/masa/Projects/itinerator/src/services/dependency.service.ts` - Dependency tracking
- `/Users/masa/Projects/itinerator/src/services/llm.service.ts` - LLM parsing integration

---

**Research Completed:** 2025-12-17
**Report Version:** 1.0
