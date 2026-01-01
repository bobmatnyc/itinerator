# Text-Based Geographic Location Detection

## Summary

Added automatic map visualization triggered by detecting geographic content (airports and cities) in AI assistant text responses.

## Implementation

### File Modified
- `/Users/masa/Projects/itinerator/viewer-svelte/src/lib/stores/chat.ts`

### Changes Made

1. **Added Known Locations Database** (lines 27-81):
   - `KNOWN_AIRPORTS`: 23 major international airports with IATA codes
   - `KNOWN_CITIES`: 25 major cities worldwide
   - Each entry includes precise latitude/longitude coordinates

2. **Created Location Detection Function** (`detectLocationsInText`, lines 83-130):
   - Detects 3-letter airport codes (e.g., JFK, NRT, LAX)
   - Detects city names (e.g., Tokyo, New York, Paris)
   - Avoids duplicates using a Set-based tracking system
   - Returns array of `MapMarker` objects

3. **Integrated into Streaming Flow**:
   - Added to `sendMessageStreaming` (lines 384-399)
   - Added to `sendContextMessage` (lines 537-552)
   - Triggers when message finalization completes (`case 'done'`)
   - Only triggers if 2+ locations detected (creates meaningful route)

## How It Works

### Detection Rules

**Airport Codes:**
- Regex pattern: `/\b([A-Z]{3})\b/g`
- Matches word-bounded 3-letter uppercase codes
- Examples: JFK, LAX, NRT, HND, SFO

**City Names:**
- Case-sensitive exact match
- Examples: "Tokyo", "New York", "Paris"
- Prevents duplicates within 0.5° lat/lng radius

### Visualization Trigger

When an AI message is finalized:
1. Clean the message content (remove JSON blocks)
2. Scan for airport codes and city names
3. If 2+ locations found:
   - Create map markers for each location
   - Create polyline connecting all locations
   - Trigger visualization with label: "Route: JFK → NRT → Tokyo"

### Example Scenarios

**Scenario 1: Flight Discussion**
```
AI: "I'd recommend flying from JFK to NRT (Tokyo Narita)..."
```
**Result:** Map shows JFK and NRT markers with connecting polyline

**Scenario 2: Multi-City Tour**
```
AI: "Your tour will visit Tokyo, Kyoto, and Osaka..."
```
**Result:** Map shows 3 city markers with connecting route

**Scenario 3: Single Location**
```
AI: "Paris is a great destination..."
```
**Result:** No map triggered (needs 2+ locations)

## Complementary to Tool Results

This feature **complements** (not replaces) the existing tool_result visualization:
- Tool results still trigger visualizations (lines 345-353, 479-487)
- Text detection adds additional coverage for mentions in prose
- Both can trigger independently in the same conversation

## Known Airports & Cities

### Airports (23 total)
- **North America:** JFK, LAX, SFO, ORD, YVR, YYZ
- **Europe:** LHR, CDG, AMS, FRA, MUC, FCO, MAD, BCN
- **Asia:** NRT, HND, SIN, ICN, BKK, HKG
- **Middle East:** DXB
- **Oceania:** SYD, MEL

### Cities (25 total)
- **Asia:** Tokyo, Yokohama, Kyoto, Osaka, Seoul, Bangkok, Hong Kong, Singapore
- **Europe:** London, Paris, Rome, Barcelona, Amsterdam, Frankfurt, Munich, Madrid
- **North America:** New York, Los Angeles, San Francisco, Chicago, Vancouver, Toronto
- **Middle East:** Dubai
- **Oceania:** Sydney, Melbourne

## Extensibility

To add more locations, update the constants:

```typescript
const KNOWN_AIRPORTS: Record<string, { lat: number; lng: number; city: string }> = {
  'BOS': { lat: 42.3656, lng: -71.0096, city: 'Boston Logan' },
  // Add more...
};

const KNOWN_CITIES: Record<string, { lat: number; lng: number }> = {
  'Boston': { lat: 42.3601, lng: -71.0589 },
  // Add more...
};
```

## Benefits

1. **Automatic Visualization**: No need for AI to call tools explicitly
2. **Better UX**: Maps appear when discussing routes/locations
3. **Fallback Coverage**: Works even if AI doesn't use map tools
4. **Minimal False Positives**: Requires 2+ locations to trigger
5. **Error Handling**: Try-catch prevents failures from breaking chat

## LOC Delta

- **Added:** ~120 lines (location databases + detection function + integration)
- **Removed:** 0 lines
- **Net Change:** +120 lines

## Testing Recommendations

1. **Test airport code detection:**
   - User: "I want to fly from JFK to Tokyo"
   - Expected: Map with JFK and Tokyo markers

2. **Test city name detection:**
   - User: "Plan a tour of Paris, Rome, and Barcelona"
   - Expected: Map with 3 city markers and route

3. **Test mixed detection:**
   - User: "Fly from LAX to London, then visit Paris"
   - Expected: Map with LAX, London, Paris

4. **Test single location (no trigger):**
   - User: "Tell me about New York"
   - Expected: No map (only 1 location)

5. **Test with tool results:**
   - User triggers flight search tool
   - Expected: Both tool_result map AND text-based map (if different)
