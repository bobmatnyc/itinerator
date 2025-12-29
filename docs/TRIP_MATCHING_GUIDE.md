# Trip Matching Guide

Intelligent trip matching for importing segments to existing itineraries (TripIt-style).

## Overview

The trip matching service automatically identifies which itinerary imported travel segments should be added to, similar to how TripIt manages your trips. It uses date overlap and location matching to suggest the best trip, or prompts the user to select when confidence is low.

## Architecture

```
┌─────────────────────┐
│  Import Request     │
│  (PDF/Email/ICS)    │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  ImportService      │
│  - Parse content    │
│  - Extract segments │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  TripMatcher        │
│  - Get user trips   │
│  - Calculate scores │
│  - Rank matches     │
└──────────┬──────────┘
           │
           v
    ┌──────┴──────┐
    │             │
    v             v
┌───────┐    ┌────────┐
│ Auto  │    │ Ask    │
│ Match │    │ User   │
└───────┘    └────────┘
```

## Matching Algorithm

### 1. Date Overlap Score (60% weight)

Calculates percentage of segment date range that overlaps with trip dates:

```typescript
// Example: 5-day segment, 3 days overlap = 60% overlap
overlapPercent = overlapDays / totalSegmentDays;
dateScore = overlapPercent * 0.6;
```

**Cases:**
- **100% overlap**: Segment entirely within trip dates → `score = 0.6`
- **Partial overlap**: 50% of segment overlaps → `score = 0.3`
- **Adjacent dates**: Within 2 days of trip → `score = 0.18` (30% of max)
- **No overlap**: No proximity → `score = 0`

### 2. Location Match Score (40% weight)

Compares destination/city names from segments with trip title/destinations:

```typescript
// Exact city match
if (tripDestination.includes(segmentCity)) {
  locationScore = 0.4; // Full location score
}
```

**Future enhancements:**
- Fuzzy string matching
- Geocoding API for city/country detection
- Airport code → city mapping

### 3. Combined Score

```typescript
matchScore = (dateScore * 0.6) + (locationScore * 0.4);
```

### 4. Confidence Thresholds

| Score | Suggested Action | Auto-Execute |
|-------|------------------|--------------|
| ≥ 0.7 | `add_to_existing` | Yes (if `autoMatch=true`) |
| 0.3-0.7 | `ask_user` | No |
| < 0.3 | `create_new` | Yes (if `createNewIfNoMatch=true`) |

## API Usage

### 1. Upload with Auto-Matching

```bash
POST /api/v1/import/upload?userId=user@example.com&autoMatch=true
Content-Type: multipart/form-data

file: confirmation.pdf
```

**Response (high confidence match):**
```json
{
  "success": true,
  "action": "added_to_existing",
  "selectedItinerary": {
    "id": "itin_abc123",
    "name": "Trip to Paris"
  },
  "segments": [...],
  "deduplication": {
    "added": 3,
    "skipped": 0,
    "duplicates": []
  }
}
```

**Response (low confidence - needs user selection):**
```json
{
  "success": true,
  "action": "pending_selection",
  "tripMatches": [
    {
      "itineraryId": "itin_abc123",
      "itineraryName": "Europe Summer 2025",
      "destination": "Europe",
      "dateRange": { "start": "2025-06-01", "end": "2025-06-15" },
      "matchScore": 0.65,
      "matchReasons": [
        "Date overlap: 80% (8 days)",
        "Destination match: Paris"
      ]
    },
    {
      "itineraryId": "itin_def456",
      "itineraryName": "Weekend in London",
      "dateRange": { "start": "2025-06-20", "end": "2025-06-22" },
      "matchScore": 0.2,
      "matchReasons": ["No date overlap", "Different destination"]
    }
  ],
  "segments": [...]
}
```

### 2. Manual Trip Selection

After receiving `pending_selection` response:

```bash
POST /api/v1/import/confirm
Content-Type: application/json

{
  "segments": [...],
  "itineraryId": "itin_abc123",
  "userId": "user@example.com"
}
```

### 3. Create New Trip

```bash
POST /api/v1/import/confirm
Content-Type: application/json

{
  "segments": [...],
  "createNew": true,
  "tripName": "Weekend in Amsterdam",
  "userId": "user@example.com"
}
```

### 4. Direct Import to Specific Trip

```bash
POST /api/v1/import/upload?userId=user@example.com&itineraryId=itin_abc123
Content-Type: multipart/form-data

file: confirmation.pdf
```

Skips matching and adds directly to specified itinerary.

## Deduplication

When adding segments, the service checks for duplicates:

### Duplicate Detection Rules

1. **Same confirmation number** (exact match)
2. **Same flight number + date** (for flights)
3. **Same hotel + check-in date** (for hotels)

### Deduplication Response

```json
{
  "deduplication": {
    "added": 2,        // New segments added
    "skipped": 1,      // Duplicates skipped
    "updated": 0,      // Existing segments updated
    "duplicates": [    // Confirmation numbers skipped
      "ABC123DEF"
    ]
  }
}
```

## Frontend Integration Example

```typescript
// Step 1: Upload with matching
async function importFile(file: File, userId: string) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `/api/v1/import/upload?userId=${userId}&autoMatch=true`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const result = await response.json();

  if (result.action === 'added_to_existing') {
    // Success! Show confirmation
    showToast(`Added ${result.deduplication.added} segments to ${result.selectedItinerary.name}`);
    return result.selectedItinerary.id;
  }

  if (result.action === 'pending_selection') {
    // Show trip selection UI
    const selectedTrip = await showTripSelectionModal(result.tripMatches);

    // Confirm selection
    return confirmImport(result.segments, selectedTrip.id, userId);
  }
}

// Step 2: Confirm user selection
async function confirmImport(segments, itineraryId, userId) {
  const response = await fetch('/api/v1/import/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments, itineraryId, userId }),
  });

  const result = await response.json();
  showToast(`Added ${result.deduplication.added} segments`);
  return result.selectedItinerary.id;
}

// Step 3: Or create new trip
async function createNewTrip(segments, tripName, userId) {
  const response = await fetch('/api/v1/import/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments, createNew: true, tripName, userId }),
  });

  const result = await response.json();
  showToast(`Created new trip: ${result.selectedItinerary.name}`);
  return result.selectedItinerary.id;
}
```

## Configuration Options

### Import Options

```typescript
interface ImportOptions {
  userId: string;                  // Required for trip lookup
  itineraryId?: string;            // Skip matching, add directly
  autoMatch?: boolean;             // Auto-add if confidence > 0.8 (default: true)
  createNewIfNoMatch?: boolean;    // Auto-create trip if no match (default: false)
}
```

### Service Configuration

```typescript
const importService = new ImportService({
  apiKey: OPENROUTER_API_KEY,
  itineraryCollection,  // Required for matching
  segmentService,       // Required for matching
});
```

## Best Practices

### 1. User Experience
- **Auto-match high confidence**: Reduces friction for obvious matches
- **Ask for medium confidence**: Prevents errors from incorrect guesses
- **Show match reasons**: Helps users understand why trips were suggested

### 2. Error Handling
- Gracefully handle missing trip dates (common for new trips)
- Fall back to manual selection if matching fails
- Validate user permissions before adding segments

### 3. Performance
- Cache user itineraries for repeated imports
- Limit match calculation to recent trips (last 12 months)
- Batch segment additions to reduce storage operations

### 4. Privacy
- Only show user's own trips for matching
- Validate `userId` matches authenticated user
- Don't expose other users' trip data

## Testing

### Unit Tests

```typescript
describe('TripMatcher', () => {
  it('should match 100% overlapping dates', async () => {
    const segments = [createFlightSegment('2025-06-05', '2025-06-10')];
    const trips = [createTrip('2025-06-01', '2025-06-15')];

    const result = await matcher.findMatches(segments, trips);

    expect(result.matches[0].matchScore).toBeGreaterThan(0.6);
    expect(result.suggestedAction).toBe('add_to_existing');
  });

  it('should suggest create_new for no overlap', async () => {
    const segments = [createFlightSegment('2025-12-01', '2025-12-05')];
    const trips = [createTrip('2025-06-01', '2025-06-15')];

    const result = await matcher.findMatches(segments, trips);

    expect(result.suggestedAction).toBe('create_new');
  });
});
```

### Integration Tests

Test the full flow:
1. Upload file with matching enabled
2. Verify trip matches returned
3. Confirm import to selected trip
4. Verify segments added to itinerary
5. Check deduplication worked

## Future Enhancements

1. **Smarter Location Matching**
   - Geocoding API integration
   - Airport code → city mapping
   - Country-level fallback matching

2. **Machine Learning**
   - Learn from user's past selections
   - Adjust weights based on user preferences
   - Personalized confidence thresholds

3. **Multi-Trip Detection**
   - Split segments across multiple trips automatically
   - Detect connecting flights spanning trips

4. **Email Context**
   - Use email sender (airline, hotel) for matching
   - Parse forwarded confirmations
   - Thread-based grouping

## Troubleshooting

### No matches found
- **Cause**: Trip has no dates set, or dates are far from segments
- **Solution**: Allow manual trip creation or update trip dates

### Wrong trip matched
- **Cause**: Date overlap exists but wrong destination
- **Solution**: Increase location weight or improve location extraction

### Duplicate segments created
- **Cause**: Deduplication logic too loose
- **Solution**: Tighten duplicate detection (exact confirmation numbers only)

### Performance issues
- **Cause**: Too many trips to compare
- **Solution**: Limit to recent trips, add caching

## Related Documentation

- [Import Service](../src/services/import/README.md)
- [API Routes](../viewer-svelte/src/routes/api/v1/import/)
- [Segment Service](../src/services/segment.service.ts)
