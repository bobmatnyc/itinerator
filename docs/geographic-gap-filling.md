# Geographic Gap Filling

## Overview

The geographic gap filling feature automatically detects and fills missing transportation segments in imported itineraries. This ensures that the itinerary has geographic continuity—there are no "teleportation" gaps where travelers jump between locations without transportation.

## How It Works

The gap filling process operates in two phases:

### Phase 1: LLM-Powered Source Document Search

The LLM prompt has been enhanced to actively search the source PDF for any transportation that may have been missed during initial parsing:

- **Flight detection**: Searches for airline names, flight numbers, airport codes
- **Transfer detection**: Looks for car rentals, shuttle services, taxi mentions, transfers
- **Other transportation**: Identifies trains, ferries, buses mentioned in the document

The LLM includes any found transportation as proper segments in the parsed result.

### Phase 2: Post-Processing Placeholder Creation

After LLM parsing, if geographic gaps still exist, the system automatically creates placeholder segments:

1. **Gap Detection**: Uses `SegmentContinuityService.detectLocationGaps()` to identify missing connections
2. **Gap Classification**: Determines gap type based on location data:
   - `LOCAL_TRANSFER`: Same city, different locations → Creates TRANSFER segment
   - `DOMESTIC_GAP`: Different cities, same country → Creates FLIGHT segment
   - `INTERNATIONAL_GAP`: Different countries → Creates FLIGHT segment
   - `UNKNOWN`: Insufficient location data → Creates TRANSFER segment (conservative)
3. **Placeholder Generation**: Creates segments with:
   - `inferred: true` flag
   - `inferredReason` explaining why the segment was created
   - Reasonable timestamps based on adjacent segments
   - Correct location fields (origin/destination for flights, pickup/dropoff for transfers)
   - Status set to `TENTATIVE` to indicate need for verification

## Usage

### Basic Import with Gap Filling (Default)

```typescript
import { DocumentImportService } from 'itinerator';

const importService = new DocumentImportService(config);
await importService.initialize();

// Gap filling is enabled by default
const result = await importService.importWithValidation('trip.pdf');

if (result.success) {
  console.log('Segments:', result.value.parsedItinerary.segments);

  // Check for inferred segments
  const inferredSegments = result.value.parsedItinerary.segments.filter(
    seg => seg.inferred
  );

  console.log('Placeholder segments:', inferredSegments.length);
  inferredSegments.forEach(seg => {
    console.log(`- ${seg.inferredReason}`);
  });
}
```

### Disable Gap Filling

```typescript
// Import without automatic gap filling
const result = await importService.importWithValidation('trip.pdf', {
  fillGaps: false,
  validateContinuity: true, // Still validate to see gaps
});

if (result.success && result.value.continuityValidation) {
  const validation = result.value.continuityValidation;
  console.log('Valid:', validation.valid);
  console.log('Gaps found:', validation.gaps.length);
  console.log('Summary:', validation.summary);
}
```

### Manual Gap Validation

```typescript
import { SegmentContinuityService } from 'itinerator';

const continuityService = new SegmentContinuityService();

// Detect gaps in any itinerary
const gaps = continuityService.detectLocationGaps(itinerary.segments);

gaps.forEach(gap => {
  console.log(`Gap: ${gap.description}`);
  console.log(`Type: ${gap.gapType}`);
  console.log(`Suggested segment: ${gap.suggestedType}`);
});
```

## Placeholder Segment Structure

### Transfer Placeholder

```json
{
  "id": "uuid",
  "type": "TRANSFER",
  "status": "TENTATIVE",
  "startDatetime": "2025-01-10T17:30:00Z",
  "endDatetime": "2025-01-10T18:00:00Z",
  "travelerIds": [],
  "transferType": "PRIVATE",
  "pickupLocation": {
    "name": "JFK Airport",
    "code": "JFK",
    "type": "AIRPORT"
  },
  "dropoffLocation": {
    "name": "Manhattan Grand Hotel",
    "city": "New York",
    "type": "HOTEL"
  },
  "notes": "Placeholder transfer - please verify and update with actual transfer details",
  "inferred": true,
  "inferredReason": "Local transfer needed from JFK Airport (JFK) to Manhattan Grand Hotel, New York",
  "metadata": {}
}
```

### Flight Placeholder

```json
{
  "id": "uuid",
  "type": "FLIGHT",
  "status": "TENTATIVE",
  "startDatetime": "2025-01-12T12:00:00Z",
  "endDatetime": "2025-01-12T14:00:00Z",
  "travelerIds": [],
  "airline": {
    "name": "Unknown",
    "code": "XX"
  },
  "flightNumber": "XX0000",
  "origin": {
    "name": "Unknown Origin",
    "code": "XXX",
    "type": "AIRPORT"
  },
  "destination": {
    "name": "Unknown Destination",
    "code": "XXX",
    "type": "AIRPORT"
  },
  "notes": "Placeholder flight - please verify and update with actual flight details",
  "inferred": true,
  "inferredReason": "Domestic transportation needed from New York to Miami",
  "metadata": {}
}
```

## Gap Classification Logic

The system classifies gaps based on available location information:

| From Location | To Location | Gap Type | Suggested Segment |
|---------------|-------------|----------|-------------------|
| Airport A | Hotel in same city | LOCAL_TRANSFER | TRANSFER |
| Hotel in City A | Hotel in City B (same country) | DOMESTIC_GAP | FLIGHT |
| Hotel in Country A | Hotel in Country B | INTERNATIONAL_GAP | FLIGHT |
| Location without country data | Any location | UNKNOWN | TRANSFER |

## Timestamp Calculation

Placeholder segments are assigned timestamps that:

1. **Start Time**:
   - If gap > 2 hours: 1/3 into the gap (after previous segment ends)
   - If gap < 2 hours: 30 minutes before next segment starts

2. **End Time**:
   - Transfer: 30 minutes after start
   - Domestic flight: 1 hour after start
   - International flight: 2 hours after start
   - Adjusted to not exceed next segment's start time

## Best Practices

1. **Review Inferred Segments**: Always verify placeholder segments and update with actual details
2. **Check inferredReason**: Provides context about why the segment was created
3. **Update Status**: Change from `TENTATIVE` to `CONFIRMED` once verified
4. **Add Details**: Fill in missing information (flight numbers, airline names, exact times)
5. **Delete if Unnecessary**: If a gap is intentional (e.g., self-drive), delete the placeholder

## Example Workflow

```typescript
// 1. Import with gap filling
const result = await importService.importWithValidation('trip.pdf');

if (!result.success) {
  console.error('Import failed:', result.error);
  return;
}

const itinerary = result.value.parsedItinerary;

// 2. Identify inferred segments
const placeholders = itinerary.segments.filter(seg => seg.inferred);

console.log(`Found ${placeholders.length} placeholder segments to review`);

// 3. Review and update each placeholder
for (const placeholder of placeholders) {
  console.log(`\nReview: ${placeholder.inferredReason}`);

  if (placeholder.type === 'FLIGHT') {
    // User provides actual flight details
    placeholder.airline = { name: 'United Airlines', code: 'UA' };
    placeholder.flightNumber = 'UA1234';
    placeholder.origin!.code = 'JFK';
    placeholder.destination!.code = 'MIA';
    placeholder.startDatetime = new Date('2025-01-12T10:00:00Z');
    placeholder.endDatetime = new Date('2025-01-12T13:00:00Z');
    placeholder.status = 'CONFIRMED';
    delete placeholder.inferred;
    delete placeholder.inferredReason;
  }

  if (placeholder.type === 'TRANSFER') {
    // User confirms transfer is correct or provides details
    placeholder.transferType = 'SHUTTLE';
    placeholder.status = 'CONFIRMED';
    delete placeholder.inferred;
    delete placeholder.inferredReason;
  }
}

// 4. Save updated itinerary
await itineraryService.update(itinerary.id, itinerary);
```

## Configuration

Gap filling can be configured per import:

```typescript
interface ImportOptions {
  model?: string;              // LLM model to use
  saveToStorage?: boolean;     // Save to storage
  validateContinuity?: boolean; // Run continuity validation (default: true)
  fillGaps?: boolean;          // Auto-fill gaps with placeholders (default: true)
}
```

## Testing

See `tests/services/gap-filling.test.ts` for comprehensive test coverage:

- Gap detection between different segment types
- Placeholder segment generation
- Chronological ordering after insertion
- Gap type classification (LOCAL_TRANSFER, DOMESTIC_GAP, INTERNATIONAL_GAP)
