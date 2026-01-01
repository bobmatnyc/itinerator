# Geographic Continuity Validation

This document explains the semantic segment validation and geographic continuity features in Itinerator.

## Overview

The geographic continuity validation system automatically detects missing transportation segments in itineraries by analyzing location transitions between consecutive segments. This ensures that travelers don't "teleport" between locations without appropriate transportation.

## Key Concepts

### Location Gaps

A location gap occurs when:
- Segment N ends at location A
- Segment N+1 starts at location B
- Location A ≠ Location B
- No transportation segment exists between them

### Gap Types

The system classifies gaps into four categories:

1. **LOCAL_TRANSFER**: Same city, different locations
   - Example: JFK Airport → Manhattan Hotel
   - Suggested segment: TRANSFER (taxi, shuttle, ride-share)
   - Estimated duration: 30-60 minutes

2. **DOMESTIC_GAP**: Different cities, same country
   - Example: New York → Los Angeles
   - Suggested segment: FLIGHT or long-distance TRANSFER
   - Estimated duration: 1-3 hours (transfer) or 3-6 hours (flight)

3. **INTERNATIONAL_GAP**: Different countries
   - Example: Philadelphia → Milan
   - Suggested segment: FLIGHT (international)
   - Estimated duration: 2-12 hours

4. **UNKNOWN**: Insufficient location data to classify
   - Missing country or city information
   - Conservative suggestion: TRANSFER

## Architecture

### Core Service: SegmentContinuityService

Located at: `/src/services/segment-continuity.service.ts`

#### Key Methods

```typescript
// Extract start location from any segment type
getStartLocation(segment: Segment): Location | null

// Extract end location from any segment type
getEndLocation(segment: Segment): Location | null

// Detect all location gaps in an itinerary
detectLocationGaps(segments: Segment[]): LocationGap[]

// Classify gap type between two locations
classifyGap(endLoc: Location, startLoc: Location): GapType

// Sort segments chronologically
sortSegments(segments: Segment[]): Segment[]
```

#### Location Extraction Logic

**Flight Segments:**
- Start: `origin` airport
- End: `destination` airport

**Transfer Segments:**
- Start: `pickupLocation`
- End: `dropoffLocation`

**Hotel Segments:**
- Start: `location`
- End: `location` (stays end where they start)

**Activity/Meeting Segments:**
- Start: `location`
- End: `location` (activities end where they start)

**Custom Segments:**
- Start/End: `location` if defined, else `null`

### Enhanced LLM Prompts

The LLM system prompt (`src/services/llm.service.ts`) now includes:

1. **Phase 3 Instructions**: Geographic continuity validation
2. **Gap Detection Rules**: How to identify location discontinuities
3. **Document Search**: Look for transportation mentions in source text
4. **Inferred Segments**: Generate placeholder segments when gaps are found

#### LLM Gap Filling Process

The LLM is instructed to:

1. **Sort segments chronologically**
2. **Check each consecutive pair** for location continuity
3. **Search source document** for missing transportation:
   - Transfer keywords: taxi, shuttle, car service, Uber, Lyft
   - Flight keywords: flight, airline, departure, arrival
   - Train/bus keywords: train, bus, rail, coach
4. **If found in document**: Add as normal segment
5. **If NOT found**: Add with `inferred: true` flag

### Inferred Segments

New optional fields added to `BaseSegment`:

```typescript
interface BaseSegment {
  // ... existing fields ...

  /** True if auto-generated to fill geographic gap */
  inferred?: boolean;

  /** Explanation of why segment was inferred */
  inferredReason?: string;
}
```

**Example inferred segment:**

```json
{
  "type": "TRANSFER",
  "startDatetime": "2024-06-15T10:00:00-04:00",
  "endDatetime": "2024-06-15T11:00:00-04:00",
  "transferType": "TAXI",
  "pickupLocation": {
    "name": "JFK Airport",
    "code": "JFK"
  },
  "dropoffLocation": {
    "name": "Manhattan Grand Hotel",
    "address": { "city": "New York", "country": "US" }
  },
  "inferred": true,
  "inferredReason": "Geographic gap: Flight arrived at JFK, next segment starts at Manhattan Grand Hotel",
  "notes": "Auto-generated: Transportation not explicitly mentioned in source document"
}
```

## Integration with Import Pipeline

### DocumentImportService

New methods in `/src/services/document-import.service.ts`:

```typescript
// Validate geographic continuity of an itinerary
validateGeographicContinuity(itinerary: Itinerary): ContinuityValidationResult

// Import with automatic validation
importWithValidation(
  filePath: string,
  options?: {
    model?: string;
    saveToStorage?: boolean;
    validateContinuity?: boolean;
  }
): Promise<Result<ImportResult & { continuityValidation? }>>
```

### Validation Result

```typescript
interface ContinuityValidationResult {
  /** True if no gaps detected */
  valid: boolean;

  /** Array of detected gaps */
  gaps: LocationGap[];

  /** Total number of segments validated */
  segmentCount: number;

  /** Human-readable summary */
  summary: string;
}
```

### LocationGap Structure

```typescript
interface LocationGap {
  /** Index of segment before gap */
  beforeIndex: number;

  /** Index of segment after gap */
  afterIndex: number;

  /** Segment before gap */
  beforeSegment: Segment;

  /** Segment after gap */
  afterSegment: Segment;

  /** End location of before segment */
  endLocation: Location | null;

  /** Start location of after segment */
  startLocation: Location | null;

  /** Type of gap detected */
  gapType: GapType;

  /** Human-readable description */
  description: string;

  /** Suggested segment type to fill gap */
  suggestedType: 'FLIGHT' | 'TRANSFER';
}
```

## Usage Examples

### Example 1: Detecting Missing Transfer

```typescript
import { SegmentContinuityService } from './services/segment-continuity.service.js';

const service = new SegmentContinuityService();

const segments = [
  {
    type: 'FLIGHT',
    origin: { name: 'JFK Airport', code: 'JFK' },
    destination: { name: 'LAX Airport', code: 'LAX' },
    // ...
  },
  {
    type: 'HOTEL',
    location: { name: 'Beverly Hills Hotel', city: 'Los Angeles' },
    // ...
  }
];

const gaps = service.detectLocationGaps(segments);

// Output:
// [
//   {
//     gapType: 'LOCAL_TRANSFER',
//     description: 'Local transfer needed from LAX Airport to Beverly Hills Hotel',
//     suggestedType: 'TRANSFER'
//   }
// ]
```

### Example 2: Import with Validation

```typescript
import { DocumentImportService } from './services/document-import.service.js';

const importService = new DocumentImportService(config);

const result = await importService.importWithValidation(
  './itinerary.pdf',
  { validateContinuity: true }
);

if (result.success) {
  const { parsedItinerary, continuityValidation } = result.value;

  if (continuityValidation?.valid) {
    console.log('✓ All segments are geographically continuous');
  } else {
    console.log('⚠ Geographic gaps detected:');
    continuityValidation.gaps.forEach(gap => {
      console.log(`  - ${gap.description}`);
    });
  }
}
```

### Example 3: LLM Auto-Fill

When the LLM processes a document with this content:

```
Day 1:
- Flight AA100 arrives JFK at 10:00 AM
- Check-in at The Manhattan Grand at 3:00 PM
```

The LLM will automatically infer and add:

```json
{
  "segments": [
    {
      "type": "FLIGHT",
      "flightNumber": "AA100",
      "destination": { "code": "JFK" },
      "endDatetime": "2024-06-15T10:00:00-04:00"
    },
    {
      "type": "TRANSFER",
      "transferType": "TAXI",
      "pickupLocation": { "code": "JFK" },
      "dropoffLocation": { "name": "The Manhattan Grand" },
      "startDatetime": "2024-06-15T10:00:00-04:00",
      "endDatetime": "2024-06-15T11:00:00-04:00",
      "inferred": true,
      "inferredReason": "Geographic gap between JFK arrival and hotel check-in"
    },
    {
      "type": "HOTEL",
      "property": { "name": "The Manhattan Grand" },
      "startDatetime": "2024-06-15T15:00:00-04:00"
    }
  ]
}
```

## Gap Detection Algorithm

### 1. Location Comparison

Locations are considered the same if:
- Airport codes match (case-insensitive): `JFK` === `jfk`
- Location names match (normalized): `"JFK Airport"` === `"jfk airport"`
- City + Country combination matches

Normalization:
- Lowercase conversion
- Whitespace trimming and collapsing
- Removal of common suffixes: "airport", "international", "city"
- Punctuation removal

### 2. Country Inference

When location data lacks country information, the system attempts to infer from IATA airport codes:

```typescript
const codeToCountry = {
  'JFK': 'US', 'LAX': 'US', 'ORD': 'US', // USA
  'MXP': 'IT', 'FCO': 'IT', 'VCE': 'IT', // Italy
  'LHR': 'GB', 'LGW': 'GB',              // UK
  'CDG': 'FR', 'ORY': 'FR',              // France
  // ... expandable
};
```

### 3. Gap Classification Logic

```
if (endCountry !== startCountry):
  return INTERNATIONAL_GAP

if (endCity !== startCity):
  return DOMESTIC_GAP

if (endLocation !== startLocation):
  return LOCAL_TRANSFER

return NO_GAP
```

## Best Practices

### For Users

1. **Review Inferred Segments**: Check segments with `inferred: true`
2. **Verify Timings**: Inferred segments use estimated durations
3. **Add Details**: Enhance inferred segments with actual booking info
4. **Re-validate**: After manual edits, run validation again

### For Developers

1. **Expand Airport Code Database**: Add more IATA code mappings
2. **Enhance Location Normalization**: Handle more city name variants
3. **Improve Duration Estimates**: Use distance-based calculations
4. **Add Geocoding**: Use coordinates for precise distance calculation

## Testing

### Unit Tests

Location: `/src/services/__tests__/segment-continuity.service.test.ts`

Test coverage:
- ✓ Start/end location extraction for all segment types
- ✓ Gap classification (local, domestic, international)
- ✓ Airport code-based country inference
- ✓ Gap detection in various itinerary scenarios
- ✓ Chronological sorting

### Example Script

Run the example validation:

```bash
npx tsx examples/continuity-validation-example.ts
```

This demonstrates:
1. Missing local transfer (JFK → Manhattan)
2. Missing international flight (Philadelphia → Milan)
3. Complete itinerary with proper transfers

## Limitations

### Current Limitations

1. **Airport Code Coverage**: Limited to major airports (expandable)
2. **Location Fuzzy Matching**: Simple string normalization (can be enhanced)
3. **Distance Calculation**: No actual distance computation
4. **Time Estimates**: Static ranges, not distance-based
5. **Multi-modal Transport**: No train/bus/ferry differentiation

### Future Enhancements

1. **Geocoding Integration**: Use Google Maps/OpenStreetMap APIs
2. **Distance-Based Classification**: Calculate actual distances
3. **Transport Mode Detection**: Differentiate train vs. flight for domestic gaps
4. **Custom Rules Engine**: User-defined gap classification rules
5. **Historical Data**: Learn typical transfer times from past itineraries

## Troubleshooting

### "Unknown gap type" appearing frequently

**Cause**: Locations lack city and country information

**Solution**: Enhance location objects with complete address data:

```typescript
{
  name: "Hotel Name",
  address: {
    city: "Milan",
    country: "IT"  // ISO 3166-1 alpha-2 code
  }
}
```

### False positives (detecting gaps where none exist)

**Cause**: Location name variations not recognized as same location

**Solution**:
1. Use consistent location naming
2. Add airport codes where applicable
3. Ensure city and country fields match exactly

### LLM not inferring segments

**Cause**: LLM may miss gaps if prompt context is unclear

**Solution**:
1. Use post-import validation: `importWithValidation()`
2. Review validation results
3. Manually add missing segments or re-run with clearer source document

## API Reference

See:
- [SegmentContinuityService API](../src/services/segment-continuity.service.ts)
- [DocumentImportService API](../src/services/document-import.service.ts)
- [Segment Types](../src/domain/types/segment.ts)
- [Segment Schemas](../src/domain/schemas/segment.schema.ts)

## Contributing

To extend the geographic continuity features:

1. **Add Airport Codes**: Update `inferCountryFromCode()` in SegmentContinuityService
2. **Improve Normalization**: Enhance `normalizeLocationName()` and `normalizeCity()`
3. **Add Tests**: Cover new scenarios in `segment-continuity.service.test.ts`
4. **Update Prompts**: Refine LLM instructions in `llm.service.ts`

## License

Same as Itinerator project license.
