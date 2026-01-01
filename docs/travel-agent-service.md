# Travel Agent Service

The Travel Agent Service uses SerpAPI to intelligently find real travel options to fill missing segments in imported itineraries.

## Configuration

Add your SerpAPI key to `.itinerator/config.yaml`:

```yaml
serpapi:
  apiKey: YOUR_SERPAPI_KEY_HERE
```

## Features

### 1. Intelligent Class Inference

The service analyzes existing trip segments to determine travel preferences:

- **Flight Class**: Infers cabin class (ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST) from existing flights
- **Hotel Tier**: Determines preferred star rating (1-5) from existing hotels
- **Budget Tier**: Classifies overall budget (economy, premium, luxury) based on segment quality

### 2. Real-Time Flight Search

Uses SerpAPI Google Flights to find actual flights matching:
- Origin/destination from gap locations (IATA codes)
- Dates from gap timing
- Inferred class preference
- Returns best matching flight with airline, flight number, times, and price

### 3. Hotel Search

Uses SerpAPI Google Hotels to find accommodations matching:
- Location from segment
- Check-in/check-out dates
- Star rating based on inferred class
- Returns best hotel with name, address, rating, and pricing

### 4. Ground Transportation

Creates intelligent transfer segments for local gaps:
- Private transfers for luxury tier
- Shuttle/taxi for economy tier
- Appropriate timing between segments

## How It Works

### Automatic Gap Filling

When importing a PDF with the `fillGaps` option enabled:

1. **Detect Gaps**: The system identifies missing transportation segments
2. **Infer Preferences**: Analyzes existing segments to understand travel style
3. **Search Options**:
   - If SerpAPI is configured → Search for real travel options
   - If search succeeds → Insert real flight/hotel segment
   - If search fails or no API → Fall back to placeholder segment
4. **Insert Segments**: Adds gap-filling segments at correct positions

### Example Usage

```typescript
import { DocumentImportService } from './services/document-import.service.js';
import { YamlConfigStorage } from './storage/yaml-config.ts';

// Load config with SerpAPI key
const configStorage = new YamlConfigStorage();
const config = await configStorage.getImportConfig();

// Create import service
const importService = new DocumentImportService(config);

// Import with intelligent gap filling
const result = await importService.importWithValidation('trip.pdf', {
  fillGaps: true,  // Enable gap filling
  validateContinuity: true,
});

if (result.success) {
  console.log('Itinerary imported with gaps filled!');
  console.log(`Total segments: ${result.value.parsedItinerary.segments.length}`);

  // Check which segments were auto-filled
  const inferredSegments = result.value.parsedItinerary.segments
    .filter(s => s.inferred);

  console.log(`Auto-filled segments: ${inferredSegments.length}`);

  for (const segment of inferredSegments) {
    console.log(`- ${segment.type}: ${segment.inferredReason}`);
    console.log(`  Source: ${segment.metadata.source || 'placeholder'}`);
  }
}
```

## Segment Metadata

Auto-filled segments include metadata to track their source:

```typescript
{
  type: 'FLIGHT',
  inferred: true,
  inferredReason: 'International flight needed from JFK Airport to MXP Airport',
  metadata: {
    source: 'serpapi-google-flights',
    gapType: 'INTERNATIONAL_GAP'
  },
  notes: 'Found via SerpAPI Google Flights - Please verify and book'
}
```

## Error Handling

The service gracefully handles failures:
- **API Rate Limits**: Retries with exponential backoff
- **No Results**: Falls back to placeholder segments
- **Network Errors**: Creates placeholder with error logged
- **Missing Config**: Skips SerpAPI and uses placeholders only

## Limitations

- **Airport Codes**: Flight search requires IATA codes (JFK, LAX, etc.)
- **Location Data**: Hotel search needs city names or coordinates
- **Booking**: Found segments are suggestions only - manual booking required
- **Availability**: Real-time availability not guaranteed
- **Pricing**: Prices are estimates and may change

## API Costs

SerpAPI usage is tracked separately from LLM costs. Monitor your SerpAPI dashboard for:
- Google Flights searches: ~$0.002 per search
- Google Hotels searches: ~$0.002 per search
- Rate limits: Check your plan's monthly limits

## Future Enhancements

Planned features:
- Car rental search via SerpAPI Maps
- Bus/train route search
- Multi-segment flight options
- Hotel availability verification
- Price tracking and alerts
- Direct booking integration

## Best Practices

1. **Verify All Auto-Filled Segments**: Always check SerpAPI-found options before booking
2. **Monitor Costs**: Track SerpAPI usage to stay within budget
3. **Provide Context**: More detailed existing segments = better inference
4. **Update Placeholders**: Replace placeholder segments with actual bookings
5. **Test Configuration**: Verify SerpAPI key works before bulk imports

## Troubleshooting

### "Could not determine airport codes"
- Ensure locations include IATA codes (JFK, LAX, MXP, etc.)
- Add airport codes to location names: "New York (JFK)"

### "No suitable hotels found"
- Check if location has valid city name
- Verify check-in/out dates are correct
- Try adjusting inferred hotel tier preferences

### "SerpAPI request failed: 429"
- You've hit rate limits - wait before retrying
- Upgrade your SerpAPI plan for higher limits
- Reduce import frequency

### Segments still showing as placeholders
- Check SerpAPI key is valid in config.yaml
- Verify internet connectivity
- Check console logs for specific errors
- Ensure location data is complete (codes, city names)

## Support

For issues or questions:
- Check SerpAPI documentation: https://serpapi.com/docs
- Review existing segment data quality
- Examine continuity validation results
- Check application logs for detailed errors
