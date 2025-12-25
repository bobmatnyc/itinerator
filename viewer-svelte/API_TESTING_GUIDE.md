# Itinerizer API Testing Guide

## Quick Setup

### 1. Install Dependencies

```bash
cd viewer-svelte
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Access Swagger UI

```
http://localhost:5176/api/docs
```

## Test Scenarios

### Scenario 1: Create and Manage Itinerary

#### Step 1: Create Blank Itinerary

**Endpoint:** `POST /api/v1/itineraries`

```json
{
  "title": "Summer Europe Trip",
  "description": "2-week backpacking adventure",
  "tripType": "LEISURE"
}
```

**Expected Response (201):**
```json
{
  "id": "uuid-here",
  "title": "Summer Europe Trip",
  "status": "DRAFT",
  "createdAt": "2025-12-25T10:00:00Z",
  ...
}
```

#### Step 2: List Your Itineraries

**Endpoint:** `GET /api/v1/itineraries`

**Expected Response (200):**
```json
[
  {
    "id": "uuid-here",
    "title": "Summer Europe Trip",
    ...
  }
]
```

#### Step 3: Update Itinerary

**Endpoint:** `PATCH /api/v1/itineraries/{id}`

```json
{
  "startDate": "2025-07-01",
  "endDate": "2025-07-15",
  "status": "PLANNED"
}
```

#### Step 4: Get Full Itinerary

**Endpoint:** `GET /api/v1/itineraries/{id}`

**Expected Response (200):**
```json
{
  "id": "uuid-here",
  "title": "Summer Europe Trip",
  "startDate": "2025-07-01",
  "endDate": "2025-07-15",
  "status": "PLANNED",
  "segments": []
}
```

### Scenario 2: Add Segments Manually

#### Step 1: Add Flight Segment

**Endpoint:** `POST /api/v1/itineraries/{id}/segments`

```json
{
  "type": "FLIGHT",
  "airline": {
    "name": "Lufthansa",
    "code": "LH"
  },
  "flightNumber": "LH400",
  "origin": {
    "name": "New York JFK",
    "code": "JFK"
  },
  "destination": {
    "name": "Frankfurt",
    "code": "FRA"
  },
  "startDatetime": "2025-07-01T20:00:00Z",
  "endDatetime": "2025-07-02T09:00:00Z",
  "status": "CONFIRMED",
  "cabinClass": "ECONOMY",
  "confirmationNumber": "ABC123"
}
```

**Expected Response (201):**
```json
{
  "id": "segment-uuid",
  "type": "FLIGHT",
  "airline": { "name": "Lufthansa", "code": "LH" },
  ...
}
```

#### Step 2: Add Hotel Segment

**Endpoint:** `POST /api/v1/itineraries/{id}/segments`

```json
{
  "type": "HOTEL",
  "property": {
    "name": "Frankfurt Marriott Hotel"
  },
  "location": {
    "name": "Frankfurt, Germany",
    "code": "FRA",
    "address": {
      "city": "Frankfurt",
      "country": "DE"
    }
  },
  "checkInDate": "2025-07-02",
  "checkOutDate": "2025-07-05",
  "checkInTime": "15:00",
  "checkOutTime": "11:00",
  "startDatetime": "2025-07-02T15:00:00Z",
  "endDatetime": "2025-07-05T11:00:00Z",
  "status": "CONFIRMED",
  "roomType": "Deluxe King",
  "roomCount": 1,
  "boardBasis": "BED_BREAKFAST"
}
```

#### Step 3: Add Activity Segment

**Endpoint:** `POST /api/v1/itineraries/{id}/segments`

```json
{
  "type": "ACTIVITY",
  "name": "Rhine River Cruise",
  "description": "Scenic cruise along the Rhine Valley",
  "location": {
    "name": "Rhine River, Germany"
  },
  "startDatetime": "2025-07-03T10:00:00Z",
  "endDatetime": "2025-07-03T16:00:00Z",
  "status": "CONFIRMED",
  "category": "SIGHTSEEING",
  "voucherNumber": "RHINE123"
}
```

#### Step 4: List All Segments

**Endpoint:** `GET /api/v1/itineraries/{id}/segments`

**Expected Response (200):**
```json
[
  { "id": "seg-1", "type": "FLIGHT", ... },
  { "id": "seg-2", "type": "HOTEL", ... },
  { "id": "seg-3", "type": "ACTIVITY", ... }
]
```

### Scenario 3: AI Trip Designer (Streaming)

#### Step 1: Create Chat Session

**Endpoint:** `POST /api/v1/designer/sessions`

**Headers:**
```
X-API-Key: your-api-key
X-OpenRouter-API-Key: your-openrouter-key
```

**Body:**
```json
{
  "itineraryId": "uuid-from-step-1",
  "mode": "trip-designer"
}
```

**Expected Response (201):**
```json
{
  "sessionId": "session-uuid"
}
```

#### Step 2: Send Message (Streaming)

**Endpoint:** `POST /api/v1/designer/sessions/{sessionId}/messages/stream`

**Body:**
```json
{
  "message": "I need a 3-day trip to Paris with hotels and activities"
}
```

**Expected Events (SSE):**

```
event: connected
data: {"status":"connected"}

event: text
data: {"content":"I'll help you plan"}

event: text
data: {"content":" a 3-day trip to Paris."}

event: tool_call
data: {"name":"add_segment","arguments":{"type":"HOTEL",...}}

event: tool_result
data: {"name":"add_segment","result":{"id":"seg-xyz"},"success":true}

event: done
data: {"itineraryUpdated":true,"segmentsModified":["seg-xyz"],"tokens":1200,"cost":0.002}
```

#### Step 3: Get Session Details

**Endpoint:** `GET /api/v1/designer/sessions/{sessionId}`

**Expected Response (200):**
```json
{
  "sessionId": "session-uuid",
  "itineraryId": "itinerary-uuid",
  "mode": "trip-designer",
  "messages": [
    {
      "role": "user",
      "content": "I need a 3-day trip...",
      "timestamp": "2025-12-25T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "I'll help you plan...",
      "timestamp": "2025-12-25T10:00:02Z",
      "tokens": 1200,
      "cost": 0.002
    }
  ],
  "totalTokens": 1200,
  "totalCost": 0.002
}
```

### Scenario 4: Import from Text

#### Import Travel Email

**Endpoint:** `POST /api/v1/import/text`

**Body:**
```json
{
  "title": "Vegas Business Trip",
  "text": "Flight Confirmation AA456 from LAX to LAS on Aug 10, 2025 at 8:00 AM. Hotel: Bellagio, check-in Aug 10, check-out Aug 12. Conference at Las Vegas Convention Center, Aug 11, 9:00 AM - 5:00 PM.",
  "apiKey": "your-openrouter-key"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "itineraryId": "new-itinerary-uuid"
}
```

Then verify:

**Endpoint:** `GET /api/v1/itineraries/{itineraryId}`

**Expected:** Itinerary with parsed flight, hotel, and meeting segments.

### Scenario 5: Segment Operations

#### Update Segment Status

**Endpoint:** `PATCH /api/v1/itineraries/{id}/segments/{segmentId}`

```json
{
  "status": "CONFIRMED",
  "confirmationNumber": "XYZ789"
}
```

#### Reorder Segments

**Endpoint:** `POST /api/v1/itineraries/{id}/segments/reorder`

```json
{
  "segmentIds": [
    "flight-seg-id",
    "transfer-seg-id",
    "hotel-seg-id",
    "activity-seg-id"
  ]
}
```

#### Delete Segment

**Endpoint:** `DELETE /api/v1/itineraries/{id}/segments/{segmentId}`

**Expected Response (200):**
Updated itinerary without the deleted segment.

### Scenario 6: Error Handling

#### Test Validation Error

**Endpoint:** `POST /api/v1/itineraries/{id}/segments`

**Bad Request:**
```json
{
  "type": "FLIGHT",
  "flightNumber": "INVALID"
}
```

**Expected Response (400):**
```json
{
  "message": "Invalid segment data: airline: Required; origin: Required; destination: Required; flightNumber: Invalid flight number format"
}
```

#### Test Ownership Error

**Scenario:** Try to access another user's itinerary

**Expected Response (403):**
```json
{
  "message": "Access denied: You do not have permission to view this itinerary"
}
```

#### Test Not Found

**Endpoint:** `GET /api/v1/itineraries/non-existent-uuid`

**Expected Response (404):**
```json
{
  "message": "Itinerary not found: ..."
}
```

#### Test API Key Missing

**Scenario:** Omit `X-OpenRouter-API-Key` header for Trip Designer

**Expected Response (503):**
```json
{
  "message": "Trip Designer disabled: No API key provided. Set your OpenRouter API key in Profile settings."
}
```

## Testing Tools

### Using Swagger UI

1. Navigate to `http://localhost:5176/api/docs`
2. Click **Authorize** button
3. Enter your API keys:
   - `X-API-Key`: Your user API key
   - `X-OpenRouter-API-Key`: Your OpenRouter key (for AI features)
4. Click **Authorize** and **Close**
5. Expand any endpoint
6. Click **Try it out**
7. Fill in parameters
8. Click **Execute**
9. View response below

### Using cURL

#### Create Itinerary
```bash
curl -X POST http://localhost:5176/api/v1/itineraries \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"title":"Test Trip","tripType":"LEISURE"}'
```

#### List Itineraries
```bash
curl http://localhost:5176/api/v1/itineraries \
  -H "X-API-Key: your-key"
```

#### Add Segment
```bash
curl -X POST http://localhost:5176/api/v1/itineraries/{id}/segments \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d @flight-segment.json
```

#### Test Streaming (SSE)
```bash
curl -N -X POST http://localhost:5176/api/v1/designer/sessions/{sessionId}/messages/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -H "X-OpenRouter-API-Key: your-openrouter-key" \
  -d '{"message":"Plan a trip to Tokyo"}'
```

### Using Postman

1. **Import OpenAPI Spec:**
   - File → Import
   - Select `/openapi.yaml`
   - Collection is created automatically

2. **Set Up Environment:**
   - Create new environment
   - Add variables:
     - `base_url`: `http://localhost:5176/api/v1`
     - `api_key`: Your API key
     - `openrouter_key`: Your OpenRouter key

3. **Configure Authorization:**
   - Collection → Authorization
   - Type: API Key
   - Key: `X-API-Key`
   - Value: `{{api_key}}`

4. **Test Endpoints:**
   - Select endpoint
   - Click Send
   - View response

### Automated Testing

Create a test suite using the OpenAPI spec:

```javascript
// tests/api.test.ts
import { test, expect } from '@playwright/test';

test('Create and retrieve itinerary', async ({ request }) => {
  // Create
  const createResponse = await request.post('/api/v1/itineraries', {
    headers: { 'X-API-Key': process.env.API_KEY },
    data: { title: 'Test Trip' }
  });
  expect(createResponse.ok()).toBeTruthy();
  const itinerary = await createResponse.json();

  // Retrieve
  const getResponse = await request.get(`/api/v1/itineraries/${itinerary.id}`, {
    headers: { 'X-API-Key': process.env.API_KEY }
  });
  expect(getResponse.ok()).toBeTruthy();
  const retrieved = await getResponse.json();
  expect(retrieved.title).toBe('Test Trip');
});
```

## Common Issues

### Issue: 401 Unauthorized

**Cause:** Missing or invalid API key

**Solution:**
- Check `X-API-Key` header is set
- Verify API key is valid
- In Swagger UI, click "Authorize" first

### Issue: 503 Service Unavailable (Trip Designer)

**Cause:** No OpenRouter API key provided

**Solution:**
- Add `X-OpenRouter-API-Key` header
- Or set `OPENROUTER_API_KEY` environment variable

### Issue: 400 Bad Request (Validation Error)

**Cause:** Invalid data format

**Solution:**
- Check error message for specific fields
- Refer to schema in OpenAPI spec
- Validate against Zod schemas

### Issue: 403 Forbidden

**Cause:** Trying to access another user's resource

**Solution:**
- Verify you're using correct API key
- Confirm itinerary belongs to authenticated user
- Check `createdBy` field matches your user email

### Issue: SSE Stream Not Working

**Cause:** Buffering or connection issues

**Solution:**
- Use `-N` flag with cURL
- Disable buffering in nginx/proxy
- Check `X-Accel-Buffering: no` header

## Performance Testing

### Load Test Itinerary Creation

```bash
# Using Apache Bench
ab -n 100 -c 10 -H "X-API-Key: your-key" \
  -p itinerary.json -T application/json \
  http://localhost:5176/api/v1/itineraries
```

### Monitor Token Usage

Track AI costs across multiple requests:

```javascript
let totalCost = 0;
let totalTokens = 0;

const response = await chat(sessionId, message);
totalTokens += response.tokens;
totalCost += response.cost;

console.log(`Total: ${totalTokens} tokens, $${totalCost.toFixed(4)}`);
```

## Next Steps

1. **Run through all test scenarios** in Swagger UI
2. **Create automated test suite** using Playwright
3. **Test error cases** thoroughly
4. **Measure performance** under load
5. **Document any edge cases** found during testing

## Resources

- **API Documentation:** `API_DOCUMENTATION.md`
- **OpenAPI Spec:** `/openapi.yaml`
- **Swagger UI:** `http://localhost:5176/api/docs`
- **GitHub Issues:** Report bugs and request features
