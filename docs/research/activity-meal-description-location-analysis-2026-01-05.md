# Activity and Meal Segment: Description and Location Analysis

**Research Date:** 2026-01-05
**Focus:** How activities and meals currently handle descriptions and geographic locations
**Status:** ✅ Complete

---

## Executive Summary

This research investigates how the itinerator project handles descriptions and geographic locations for activities and meals segments. Key findings:

1. **No dedicated MEAL segment type** - meals/restaurants are stored as ACTIVITY segments with `category: "dining"`
2. **Rich location schema exists but underutilized in UI** - Location schema supports full addresses, coordinates, and timezone but SegmentCard only displays basic city/name
3. **Description field exists but NOT displayed** - ACTIVITY segments have optional `description` field that is captured but never shown to users
4. **Geographic data available but hidden** - Coordinates, addresses, and timezones can be stored but are not visualized

---

## 1. Current Schema Fields for Location and Description

### 1.1 Activity Segment Schema

**File:** `src/domain/schemas/segment.schema.ts` (lines 258-287)

```typescript
const activitySegmentBaseSchema = z.object({
  ...baseSegmentFields,
  type: z.literal('ACTIVITY'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),  // ⚠️ CAPTURED BUT NOT DISPLAYED
  location: locationSchema,             // ⚠️ RICH DATA BUT UNDERUTILIZED
  category: z.string().optional(),
  voucherNumber: z.string().optional(),
  bookingUrl: z.string().url().optional(),
  bookingProvider: z.string().optional(),
});
```

**Key Fields:**
- ✅ `name` - Displayed in SegmentCard title
- ⚠️ `description` - **Captured but NOT displayed anywhere**
- ✅ `location` - **Has rich schema but only basic display**
- ✅ `category` - Used to identify dining vs other activities

### 1.2 Location Schema (Full Capabilities)

**File:** `src/domain/schemas/location.schema.ts` (lines 41-64)

```typescript
export const locationSchema = z.object({
  name: z.string().min(1).optional(),           // Venue/address name
  code: z.string().max(3).optional(),           // IATA airport code (for flights)
  city: z.string().min(1).optional(),           // City name
  country: z.string().optional(),               // Country name
  address: addressSchema.optional(),            // ⚠️ Full street address schema
  coordinates: coordinatesSchema.optional(),    // ⚠️ Lat/long coordinates
  timezone: z.string().optional(),              // ⚠️ IANA timezone identifier
});
```

**Address Schema (Available but Underutilized):**
```typescript
export const addressSchema = z.object({
  street: z.string().optional(),        // ⚠️ NOT DISPLAYED
  city: z.string().optional(),          // ✅ Displayed
  state: z.string().optional(),         // ⚠️ NOT DISPLAYED
  postalCode: z.string().optional(),    // ⚠️ NOT DISPLAYED
  country: z.string().length(2),        // ISO 3166-1 alpha-2 code
});
```

**Coordinates Schema (Available but Underutilized):**
```typescript
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),   // ⚠️ NOT DISPLAYED
  longitude: z.number().min(-180).max(180), // ⚠️ NOT DISPLAYED
});
```

---

## 2. How Descriptions Are Currently Displayed

### 2.1 SegmentCard Component Analysis

**File:** `viewer-svelte/src/lib/components/SegmentCard.svelte`

**Lines 203-210 - Title Display:**
```svelte
<h4 class="font-medium text-minimal-text">
  {getSegmentTitle(segment)}
</h4>
{#if getSegmentSubtitle(segment)}
  <p class="text-sm text-minimal-text-muted mt-0.5">
    {getSegmentSubtitle(segment)}
  </p>
{/if}
```

**Lines 54-67 - Subtitle Logic:**
```typescript
function getSegmentSubtitle(segment: Segment): string {
  switch (segment.type) {
    case 'FLIGHT':
      return `${segment.airline.name} ${segment.flightNumber}`;
    case 'HOTEL':
      return segment.location.city || segment.location.name || '';
    case 'ACTIVITY':
      // ⚠️ ONLY SHOWS LOCATION - DESCRIPTION IS IGNORED
      return segment.location.city || segment.location.name || '';
    case 'TRANSFER':
      return segment.transferType;
    default:
      return '';
  }
}
```

**Lines 274-279 - Notes Display (Notes ≠ Description):**
```svelte
<!-- Notes -->
{#if segment.notes}
  <p class="text-xs text-minimal-text-muted italic ml-11">
    {segment.notes}
  </p>
{/if}
```

**❌ Description Field is NEVER displayed** - Only `notes` field is shown, but `description` is captured and stored.

### 2.2 CalendarView Component

**File:** `viewer-svelte/src/lib/components/CalendarView.svelte` (lines 186-189)

```typescript
function getSegmentTooltip(segment: Segment): string | undefined {
  if (segment.type === 'ACTIVITY' || segment.type === 'CUSTOM') {
    return segment.description;  // ✅ Shows description in tooltip only
  }
  return undefined;
}
```

**✅ Description IS used in calendar tooltips** - But this is hidden behind a hover interaction.

### 2.3 SegmentEditor Component

**File:** `viewer-svelte/src/lib/components/SegmentEditor.svelte` (lines 90-92)

```typescript
case 'ACTIVITY':
  activityDescription = segment.description || '';
  activityLocationName = segment.location.name;
  activityCity = segment.location.city || '';
```

**✅ Description IS editable** - Users can add/edit descriptions via the segment editor.

---

## 3. What Data Is Captured by Trip Designer

### 3.1 ADD_ACTIVITY_TOOL Schema

**File:** `src/services/trip-designer/tools.ts` (lines 218-297)

```typescript
export const ADD_ACTIVITY_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_activity',
    description: 'Add a RECOMMENDED activity, tour, dining experience, or attraction...',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },  // ✅ CAPTURED
        location: {                       // ✅ CAPTURED (but only basic fields)
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Venue or location name' },
            city: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['name'],
        },
        // ... other fields
      },
      required: ['name', 'location', 'startTime'],
    },
  },
};
```

**What Trip Designer Captures:**
- ✅ `name` - Activity/restaurant name
- ✅ `description` - **Description of what the activity involves** (CAPTURED)
- ✅ `location.name` - Venue name
- ✅ `location.city` - City name
- ✅ `location.country` - Country name
- ⚠️ **NO coordinates** - Trip Designer does NOT capture lat/long
- ⚠️ **NO full address** - Street address not captured
- ⚠️ **NO timezone** - Timezone not captured

### 3.2 DINING_ACTIVITY_TOOL_ENFORCEMENT

**File:** `DINING_ACTIVITY_TOOL_ENFORCEMENT.md`

**Example of Captured Data:**
```typescript
{
  name: "Dinner at Le Tastevin",
  location: { name: "Grand Case", city: "Grand Case", country: "St. Martin" },
  startTime: "2025-01-10T19:30:00",
  durationHours: 2,
  category: "dining"  // ✅ Distinguishes meals from other activities
}
```

**Notes:**
- Meals are activities with `category: "dining"`
- Description field is optional and often omitted
- Location is basic (name, city, country) - no coordinates

---

## 4. Geographic Data Available But Underutilized

### 4.1 Location Schema Capabilities vs Usage

| Field | Schema Support | Trip Designer Captures | SegmentCard Displays | Potential Use Cases |
|-------|----------------|------------------------|----------------------|---------------------|
| `name` | ✅ Yes | ✅ Yes | ✅ Yes (subtitle) | Venue name |
| `city` | ✅ Yes | ✅ Yes | ✅ Yes (subtitle) | Geographic context |
| `country` | ✅ Yes | ✅ Yes | ❌ No | International trips |
| `coordinates.latitude` | ✅ Yes | ❌ No | ❌ No | **Maps, distance calc** |
| `coordinates.longitude` | ✅ Yes | ❌ No | ❌ No | **Maps, distance calc** |
| `address.street` | ✅ Yes | ❌ No | ❌ No | **Navigation, directions** |
| `address.state` | ✅ Yes | ❌ No | ❌ No | **US travel details** |
| `address.postalCode` | ✅ Yes | ❌ No | ❌ No | **Precise location** |
| `timezone` | ✅ Yes | ❌ No | ❌ No | **Multi-timezone trips** |

### 4.2 Geographic Data Gaps

**What's Missing in Data Capture:**

1. **No Geocoding** - When Trip Designer adds a restaurant like "Le Tastevin, Grand Case", it does NOT:
   - Look up coordinates via geocoding API
   - Capture full street address
   - Determine timezone

2. **No Geographic Enrichment** - Location data remains as entered:
   ```typescript
   // What's captured:
   { name: "Grand Case", city: "Grand Case", country: "St. Martin" }

   // What COULD be captured with geocoding:
   {
     name: "Le Tastevin",
     city: "Grand Case",
     country: "St. Martin",
     address: { street: "86 Boulevard de Grand Case", postalCode: "97150" },
     coordinates: { latitude: 18.1047, longitude: -63.0547 },
     timezone: "America/Marigot"
   }
   ```

3. **No Map Integration** - SegmentCard shows background images (Unsplash) but NOT:
   - Embedded map with marker
   - Distance from previous segment
   - Walking/driving directions

---

## 5. Recommendations for Improvements

### 5.1 Display Enhancements (High Priority)

**RECOMMENDATION 1: Show Description in SegmentCard**

```svelte
<!-- AFTER subtitle, BEFORE time/source -->
{#if segment.type === 'ACTIVITY' && segment.description}
  <p class="text-sm text-minimal-text-muted mt-1 ml-11">
    {segment.description}
  </p>
{/if}
```

**Impact:**
- ✅ Users see WHY this activity is recommended
- ✅ Provides context for dining/tour experiences
- ✅ Helps distinguish between similar activities
- 🎯 **Most impactful improvement for user experience**

---

**RECOMMENDATION 2: Enhanced Location Display**

```svelte
<!-- Show full location hierarchy -->
{#if segment.type === 'ACTIVITY'}
  <div class="text-sm text-minimal-text-muted">
    {#if segment.location.address?.street}
      📍 {segment.location.address.street}, {segment.location.city}
    {:else}
      📍 {segment.location.name}{segment.location.city ? `, ${segment.location.city}` : ''}
    {/if}
    {#if segment.location.country}
      • {segment.location.country}
    {/if}
  </div>
{/if}
```

**Impact:**
- ✅ Full address when available
- ✅ Clear geographic hierarchy
- ✅ Better for navigation

---

### 5.2 Data Capture Enhancements (Medium Priority)

**RECOMMENDATION 3: Add Geocoding to Trip Designer**

**Option A: Geocode on Segment Creation**
```typescript
// In tool-executor.ts, after add_activity tool call:
if (result.location && !result.location.coordinates) {
  const geocoded = await geocodeLocation(
    `${result.location.name}, ${result.location.city}, ${result.location.country}`
  );
  result.location.coordinates = geocoded.coordinates;
  result.location.address = geocoded.address;
  result.location.timezone = geocoded.timezone;
}
```

**Option B: Background Enrichment**
- Add segments without coordinates initially
- Background job geocodes and enriches location data
- Avoids slowing down Trip Designer responses

**Impact:**
- ✅ Enables map features
- ✅ Distance/direction calculations
- ✅ Timezone-aware scheduling
- ⚠️ Adds API costs (Google Geocoding or similar)

---

**RECOMMENDATION 4: Prompt Trip Designer for Better Descriptions**

**Update system prompt (`src/prompts/trip-designer/system.md`):**
```markdown
## Activity Description Best Practices

When adding activities/dining:
- **Include WHY this is recommended** (e.g., "Michelin-starred French cuisine")
- **Mention key features** (e.g., "beachfront location", "historic building")
- **Note what's special** (e.g., "famous for lobster", "sunset views")

Example:
{
  name: "Lunch at Ocean 82",
  description: "Beachfront seafood restaurant famous for grilled lobster and fresh catch. Stunning ocean views make it perfect for a leisurely lunch.", // ✅ Rich description
  location: { name: "Grand Case Beach", city: "Grand Case" }
}
```

**Impact:**
- ✅ Better descriptions without code changes
- ✅ More informative itineraries
- ✅ Users understand recommendations

---

### 5.3 UI/UX Enhancements (Lower Priority)

**RECOMMENDATION 5: Map View for Activities**

Add map visualization in ItineraryDetail:
- Show all activities/meals on a map
- Cluster by day
- Show routes between locations

**RECOMMENDATION 6: Distance/Travel Time Display**

```svelte
<!-- Show distance from previous segment -->
{#if previousSegment && segment.location.coordinates}
  <div class="text-xs text-minimal-text-muted ml-11">
    📏 {calculateDistance(previousSegment.location, segment.location)}
    • ~{estimateTravelTime()} drive
  </div>
{/if}
```

**Impact:**
- ✅ Helps with trip logistics
- ✅ Identifies tight connections
- ⚠️ Requires coordinates data

---

## 6. Comparison: What Users See vs What's Stored

### Example: Restaurant Segment

**What's Stored in Database:**
```json
{
  "type": "ACTIVITY",
  "name": "Dinner at Le Tastevin",
  "description": "Fine French dining with Michelin-quality cuisine. Famous for their duck confit and extensive wine list. Romantic atmosphere perfect for special occasions.",
  "location": {
    "name": "Le Tastevin",
    "city": "Grand Case",
    "country": "St. Martin"
  },
  "category": "dining",
  "startDatetime": "2025-01-10T19:30:00",
  "notes": "Reservation confirmed for 7:30 PM"
}
```

**What Users Currently See (SegmentCard):**
```
🍽️ Dinner at Le Tastevin
    Grand Case
    7:30 PM • 🤖 Auto-generated

    Reservation confirmed for 7:30 PM  [notes displayed]

    [Links: TripAdvisor, Yelp, Google]
```

**What Users DON'T See:**
- ❌ **Description** - "Fine French dining with Michelin-quality cuisine..."
- ❌ **Country** - "St. Martin"
- ❌ **Category** - "dining" (implicit in emoji but not explicit)

**What's Completely Missing (Not Captured):**
- ❌ **Full Address** - "86 Boulevard de Grand Case"
- ❌ **Coordinates** - (18.1047, -63.0547)
- ❌ **Timezone** - "America/Marigot"

---

## 7. Technical Implementation Notes

### 7.1 Where to Add Description Display

**File to Modify:** `viewer-svelte/src/lib/components/SegmentCard.svelte`

**Insertion Point:** After subtitle (line 210), before time/source (line 244)

```svelte
      {#if getSegmentSubtitle(segment)}
        <p class="text-sm text-minimal-text-muted mt-0.5">
          {getSegmentSubtitle(segment)}
        </p>
      {/if}

      <!-- NEW: Show description for activities -->
      {#if segment.type === 'ACTIVITY' && segment.description}
        <p class="text-sm text-minimal-text mt-1 ml-11">
          {segment.description}
        </p>
      {/if}
    </div>
```

### 7.2 Where to Add Geocoding

**Option 1: In Tool Executor (Synchronous)**
**File:** `src/services/trip-designer/tool-executor.ts`
- After `add_activity` tool execution
- Before saving segment to itinerary
- Blocks response until geocoding complete

**Option 2: Background Service (Asynchronous)**
**New File:** `src/services/geocoding.service.ts`
- Queue segments for enrichment
- Geocode in background
- Update segments when complete
- Better for performance, adds complexity

### 7.3 Geocoding API Options

| Service | Free Tier | Accuracy | Setup Complexity |
|---------|-----------|----------|------------------|
| Google Geocoding API | $200/month credit | ⭐⭐⭐⭐⭐ | Medium |
| Mapbox Geocoding | 100k requests/month | ⭐⭐⭐⭐ | Easy |
| OpenStreetMap Nominatim | Unlimited (fair use) | ⭐⭐⭐ | Easy |
| HERE Geocoding | 250k transactions/month | ⭐⭐⭐⭐ | Medium |

**Recommendation:** Start with **Mapbox Geocoding**
- Generous free tier
- Good documentation
- Already using Mapbox in project (potential)

---

## 8. Migration Strategy

### Phase 1: Display Existing Data (Quick Win) 🎯
**Effort:** 1-2 hours
**Impact:** High

1. Modify SegmentCard to show `description` field
2. Test with existing itineraries
3. Deploy immediately

**Acceptance Criteria:**
- ✅ Description displays for activities/meals with description
- ✅ Gracefully handles missing descriptions
- ✅ No layout issues on mobile/desktop

---

### Phase 2: Improve Trip Designer Prompts (Medium Win)
**Effort:** 2-3 hours
**Impact:** Medium

1. Update system prompt to encourage better descriptions
2. Add few-shot examples with rich descriptions
3. Test with Trip Designer conversations
4. Measure description quality in evals

**Acceptance Criteria:**
- ✅ 80%+ of new activities have descriptions
- ✅ Descriptions include "why" not just "what"
- ✅ No negative impact on response time

---

### Phase 3: Add Geocoding (Major Feature)
**Effort:** 1-2 days
**Impact:** High (enables future features)

1. Add Mapbox Geocoding API integration
2. Geocode locations on segment creation
3. Store coordinates, address, timezone
4. Update schemas to make fields non-optional where appropriate
5. Backfill existing segments (optional)

**Acceptance Criteria:**
- ✅ New activity segments have coordinates
- ✅ Addresses captured when available
- ✅ Timezone stored for multi-timezone trips
- ✅ Fallback gracefully if geocoding fails

---

### Phase 4: Map Visualization (Future)
**Effort:** 3-5 days
**Impact:** High (user engagement)

1. Add Mapbox GL JS to viewer
2. Show activities/meals on embedded map
3. Cluster by day
4. Show routes between locations
5. Enable "Directions" button for each segment

**Acceptance Criteria:**
- ✅ Map view available in ItineraryDetail
- ✅ All segments with coordinates displayed
- ✅ Interactive (click segment to highlight on map)
- ✅ Mobile-responsive map controls

---

## 9. Key Findings Summary

### ✅ What Works Well
1. **Schema is comprehensive** - Location schema supports all needed fields
2. **Description field exists** - Already captured and stored
3. **Category distinguishes meals** - `category: "dining"` works well
4. **Notes field is displayed** - Users can add free-form notes
5. **Editor supports descriptions** - Users can edit descriptions

### ⚠️ What's Underutilized
1. **Description never displayed** - Captured but hidden from users
2. **Location data is basic** - No coordinates, full address, or timezone
3. **Geographic capabilities unused** - No maps, distances, or directions
4. **Rich location schema ignored** - Address/coordinates schemas not leveraged

### ❌ What's Missing
1. **Geocoding integration** - Locations remain text-only
2. **Map visualization** - No spatial view of itinerary
3. **Distance calculations** - Can't estimate travel time between segments
4. **Timezone awareness** - Multi-timezone trips not handled

---

## 10. Recommended Next Steps

### Immediate (This Week)
1. **Add description display to SegmentCard** - 1-2 hours, high impact
2. **Update Trip Designer prompts** - Encourage richer descriptions

### Short Term (This Month)
3. **Add Mapbox Geocoding integration** - Enable future map features
4. **Store coordinates for new segments** - Build foundation for maps

### Medium Term (Next Quarter)
5. **Implement map view** - Visualize itinerary spatially
6. **Add distance/travel time** - Show logistics between segments
7. **Backfill coordinates** - Geocode existing segments

### Long Term (Future)
8. **Timezone-aware scheduling** - Handle multi-timezone trips properly
9. **Navigation integration** - "Get Directions" buttons
10. **Offline map support** - Download maps for mobile use

---

## 11. Files Referenced

### Schema Files
- `src/domain/schemas/segment.schema.ts` - Activity segment schema
- `src/domain/schemas/location.schema.ts` - Location and address schemas
- `src/domain/types/segment.ts` - TypeScript types
- `src/domain/types/common.ts` - Segment type enum

### UI Components
- `viewer-svelte/src/lib/components/SegmentCard.svelte` - Main segment display
- `viewer-svelte/src/lib/components/CalendarView.svelte` - Calendar tooltips
- `viewer-svelte/src/lib/components/SegmentEditor.svelte` - Segment editing

### Trip Designer
- `src/services/trip-designer/tools.ts` - Tool definitions
- `src/prompts/trip-designer/system.md` - System prompt

### Documentation
- `DINING_ACTIVITY_TOOL_ENFORCEMENT.md` - Meal/activity enforcement

---

## 12. Conclusion

The itinerator project has a **strong foundation** for rich activity/meal data:
- ✅ Comprehensive location schema with address, coordinates, timezone
- ✅ Description field already captured and stored
- ✅ Meal/activity distinction via category field

However, this capability is **significantly underutilized**:
- ❌ Description field never displayed to users
- ❌ Geographic data (coordinates, full address) not captured
- ❌ Location schema capabilities (address, timezone) ignored

**High-Impact Quick Win:** Display the description field in SegmentCard (1-2 hours)
**Strategic Investment:** Add geocoding to enable map features (1-2 days)

The data model is ready - we just need to **surface what's already there** and **enrich locations with coordinates** to unlock the full potential of the system.

---

**Research Complete** ✅
**Next Action:** Implement description display in SegmentCard (Recommendation 1)
