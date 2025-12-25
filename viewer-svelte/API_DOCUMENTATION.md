# Itinerizer API Documentation

## Overview

The Itinerizer API is a RESTful API for managing travel itineraries with AI-powered trip planning. It provides comprehensive endpoints for creating, managing, and organizing travel itineraries, segments (flights, hotels, activities, etc.), and AI chat sessions for trip design.

## Documentation Access

### Swagger UI (Interactive Documentation)

Visit the interactive API documentation at:

**Local Development:**
```
http://localhost:5176/api/docs
```

**Production:**
```
https://your-domain.vercel.app/api/docs
```

The Swagger UI provides:
- Interactive API testing ("Try it out" feature)
- Complete request/response schemas
- Authentication testing
- Code generation examples

### OpenAPI Specification

The OpenAPI 3.0 specification file is available at:
```
/openapi.yaml
```

You can use this with any OpenAPI-compatible tool:
- Postman (Import → OpenAPI)
- Insomnia (Import → OpenAPI)
- API testing frameworks
- Code generators

## Quick Start

### 1. Install Dependencies

```bash
cd viewer-svelte
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Access Documentation

Open your browser to:
```
http://localhost:5176/api/docs
```

### 4. Test API Endpoints

#### Set Up Authentication

1. In Swagger UI, click "Authorize" button
2. Enter your API key in the `X-API-Key` field
3. Click "Authorize"

#### Example: Create an Itinerary

```bash
curl -X POST http://localhost:5176/api/v1/itineraries \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "title": "Summer Vacation to Paris",
    "description": "Two-week trip to explore Paris",
    "startDate": "2025-07-01",
    "endDate": "2025-07-15",
    "tripType": "LEISURE"
  }'
```

## API Structure

### Base URL

- **Local:** `http://localhost:5176/api/v1`
- **Production:** `https://your-domain.vercel.app/api/v1`

### Authentication

All endpoints require authentication via API key:

```http
X-API-Key: your-api-key-here
```

For AI features (Trip Designer, Import), you also need:

```http
X-OpenRouter-API-Key: your-openrouter-api-key
```

### Response Format

All responses are in JSON format with consistent error handling:

**Success Response:**
```json
{
  "id": "uuid",
  "title": "Trip Name",
  ...
}
```

**Error Response:**
```json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Core Resources

### 1. Itineraries

Manage travel itinerary collections.

**Endpoints:**
- `GET /itineraries` - List all itineraries
- `POST /itineraries` - Create new itinerary
- `GET /itineraries/{id}` - Get itinerary details
- `PATCH /itineraries/{id}` - Update itinerary
- `DELETE /itineraries/{id}` - Delete itinerary

**Key Features:**
- User ownership verification
- Automatic timestamps
- Version control for optimistic locking
- Support for multiple travelers
- Flexible date handling (optional for new trips)

### 2. Segments

Manage trip segments (flights, hotels, activities, etc.).

**Segment Types:**
- `FLIGHT` - Flight bookings
- `HOTEL` - Hotel accommodations
- `MEETING` - Business meetings
- `ACTIVITY` - Tours and activities
- `TRANSFER` - Ground transportation
- `CUSTOM` - Custom segment types

**Endpoints:**
- `GET /itineraries/{id}/segments` - List segments
- `POST /itineraries/{id}/segments` - Add segment
- `GET /itineraries/{id}/segments/{segmentId}` - Get segment
- `PATCH /itineraries/{id}/segments/{segmentId}` - Update segment
- `DELETE /itineraries/{id}/segments/{segmentId}` - Delete segment
- `POST /itineraries/{id}/segments/reorder` - Reorder segments

**Features:**
- Discriminated union for type safety
- Automatic validation per segment type
- Source tracking (import, user, agent)
- Price and cost tracking
- Traveler assignment

### 3. Trip Designer (AI Chat)

AI-powered trip planning via chat interface.

**Endpoints:**
- `POST /designer/sessions` - Create chat session
- `GET /designer/sessions/{sessionId}` - Get session details
- `DELETE /designer/sessions/{sessionId}` - Delete session
- `POST /designer/sessions/{sessionId}/messages` - Send message (complete response)
- `POST /designer/sessions/{sessionId}/messages/stream` - Send message (SSE stream)

**Features:**
- Two modes: `trip-designer` (itinerary planning) and `help` (general help)
- Streaming responses via Server-Sent Events
- Tool calling (add/update/delete segments)
- Structured questions for data collection
- Cost tracking per session
- Token usage monitoring

**SSE Event Types:**
- `connected` - Connection established
- `text` - Text chunk from AI
- `tool_call` - AI calling a tool
- `tool_result` - Tool execution result
- `structured_questions` - AI requesting specific info
- `done` - Response complete (includes metadata)
- `error` - Error occurred

### 4. Import

Import itineraries from various sources.

**Endpoints:**
- `POST /import/text` - Import from plain text (emails, confirmations)

**Features:**
- LLM-powered parsing
- Automatic segment detection
- Confidence scoring
- Validation and error handling

## Common Use Cases

### Creating a Trip from Scratch

1. **Create itinerary** (dates optional):
```bash
POST /itineraries
{
  "title": "Paris Adventure"
}
```

2. **Start Trip Designer chat**:
```bash
POST /designer/sessions
{
  "itineraryId": "uuid",
  "mode": "trip-designer"
}
```

3. **Chat with AI** (streaming):
```bash
POST /designer/sessions/{sessionId}/messages/stream
{
  "message": "I want to visit Paris for 5 days in July"
}
```

4. **AI adds segments automatically** via tool calls

### Importing Existing Itinerary

1. **Import from text**:
```bash
POST /import/text
{
  "title": "My Trip",
  "text": "Flight AA123 from JFK to CDG on July 1...",
  "apiKey": "your-openrouter-key"
}
```

2. **Review imported itinerary**:
```bash
GET /itineraries/{id}
```

3. **Edit segments** as needed:
```bash
PATCH /itineraries/{id}/segments/{segmentId}
{
  "status": "CONFIRMED"
}
```

### Manual Trip Building

1. **Create itinerary** with dates:
```bash
POST /itineraries
{
  "title": "Business Trip to Tokyo",
  "startDate": "2025-08-01",
  "endDate": "2025-08-05",
  "tripType": "BUSINESS"
}
```

2. **Add flight segment**:
```bash
POST /itineraries/{id}/segments
{
  "type": "FLIGHT",
  "airline": { "name": "United Airlines", "code": "UA" },
  "flightNumber": "UA123",
  "origin": { "name": "San Francisco", "code": "SFO" },
  "destination": { "name": "Tokyo", "code": "NRT" },
  "startDatetime": "2025-08-01T10:00:00Z",
  "endDatetime": "2025-08-02T14:00:00Z",
  "status": "CONFIRMED"
}
```

3. **Add hotel segment**:
```bash
POST /itineraries/{id}/segments
{
  "type": "HOTEL",
  "property": { "name": "Tokyo Grand Hotel" },
  "location": { "name": "Shibuya, Tokyo", "code": "TYO" },
  "checkInDate": "2025-08-02",
  "checkOutDate": "2025-08-05",
  "status": "CONFIRMED"
}
```

## Advanced Features

### Streaming Responses

For real-time AI interactions, use the streaming endpoint:

```javascript
const eventSource = new EventSource(
  '/api/v1/designer/sessions/${sessionId}/messages/stream',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-OpenRouter-API-Key': openRouterKey
    },
    body: JSON.stringify({ message: 'Plan a trip to Paris' })
  }
);

eventSource.addEventListener('text', (event) => {
  const data = JSON.parse(event.data);
  console.log('AI:', data.content);
});

eventSource.addEventListener('tool_call', (event) => {
  const data = JSON.parse(event.data);
  console.log('Tool:', data.name, data.arguments);
});

eventSource.addEventListener('done', (event) => {
  const data = JSON.parse(event.data);
  console.log('Complete. Tokens:', data.tokens, 'Cost:', data.cost);
  eventSource.close();
});
```

### Segment Reordering

Reorder segments by providing new order:

```bash
POST /itineraries/{id}/segments/reorder
{
  "segmentIds": [
    "uuid-1",  # Flight
    "uuid-3",  # Transfer
    "uuid-2",  # Hotel
    "uuid-4"   # Activity
  ]
}
```

### Ownership Verification

The API automatically verifies user ownership for:
- GET/PATCH/DELETE itinerary operations
- All segment operations
- Session operations

Users can only access their own itineraries (filtered by `createdBy` field).

### Version Control

Itineraries include a `version` field for optimistic locking:

```javascript
// Get current version
const itinerary = await get('/itineraries/{id}');

// Update with version check
await patch('/itineraries/{id}', {
  version: itinerary.version,
  title: 'Updated Title'
});
```

## Data Models

### Discriminated Unions

Segments use TypeScript discriminated unions for type safety:

```typescript
type Segment =
  | FlightSegment
  | HotelSegment
  | MeetingSegment
  | ActivitySegment
  | TransferSegment
  | CustomSegment;
```

Each segment type has:
- **Shared fields:** id, status, dates, pricing, notes
- **Type-specific fields:** airline/hotel/location details

### Branded Types

The API uses branded types for type safety:

```typescript
type ItineraryId = string & { __brand: 'ItineraryId' };
type SegmentId = string & { __brand: 'SegmentId' };
type TravelerId = string & { __brand: 'TravelerId' };
```

### Money Representation

Monetary amounts use smallest currency unit (cents):

```json
{
  "amount": 12599,      // $125.99
  "currency": "USD"
}
```

### Date Handling

The API uses safe date parsing to avoid timezone issues:
- Date-only strings (`2025-07-01`) → parsed as local noon
- DateTime strings (`2025-07-01T10:00:00Z`) → preserved as-is

## Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid API key)
- `402` - Payment Required (cost limit exceeded)
- `403` - Forbidden (access denied)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error
- `503` - Service Unavailable (feature disabled)

### Error Response Format

```json
{
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Validation Errors

Zod validation errors include detailed field-level messages:

```json
{
  "message": "Invalid segment data: type: Required; startDatetime: Invalid date; flightNumber: Invalid flight number format"
}
```

## Rate Limiting & Costs

### Trip Designer Costs

AI chat sessions track token usage and costs:

```json
{
  "tokens": 1500,
  "cost": 0.0025  // USD
}
```

### Session Limits

Sessions are automatically cleaned up:
- When associated itinerary is deleted
- When explicitly deleted via DELETE endpoint
- After inactivity period (implementation-specific)

## Testing

### Using Swagger UI

1. Navigate to `/api/docs`
2. Click "Authorize" and enter API keys
3. Expand an endpoint
4. Click "Try it out"
5. Fill in parameters
6. Click "Execute"
7. View response

### Using cURL

```bash
# List itineraries
curl -H "X-API-Key: your-key" \
  http://localhost:5176/api/v1/itineraries

# Create itinerary
curl -X POST \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Trip"}' \
  http://localhost:5176/api/v1/itineraries
```

### Using Postman

1. Import `/openapi.yaml` into Postman
2. Set up environment variables for API keys
3. Use collection runner for automated testing

## Best Practices

### 1. Always Handle Errors

```typescript
try {
  const response = await fetch('/api/v1/itineraries');
  if (!response.ok) {
    const error = await response.json();
    console.error('API Error:', error.message);
  }
} catch (err) {
  console.error('Network Error:', err);
}
```

### 2. Use Streaming for Real-Time Updates

For AI chat, always use the streaming endpoint for better UX:
- `/messages/stream` - Better user experience
- `/messages` - Use only when streaming not supported

### 3. Validate Input Client-Side

Use the same Zod schemas client-side for early validation:

```typescript
import { itineraryCreateSchema } from '$domain/schemas/itinerary.schema';

const result = itineraryCreateSchema.safeParse(formData);
if (!result.success) {
  // Show validation errors
}
```

### 4. Handle Ownership Correctly

Always check for 403 Forbidden responses:

```typescript
if (response.status === 403) {
  // Redirect to login or show access denied
}
```

### 5. Implement Optimistic Updates

Update UI optimistically, then sync with server:

```typescript
// 1. Update UI immediately
updateLocalState(newData);

// 2. Sync with server
const response = await patch('/itineraries/{id}', newData);

// 3. Reconcile if needed
if (!response.ok) {
  revertLocalState();
}
```

## Support & Resources

- **OpenAPI Spec:** `/openapi.yaml`
- **Swagger UI:** `/api/docs`
- **GitHub:** https://github.com/yourusername/itinerizer-ts
- **Issues:** https://github.com/yourusername/itinerizer-ts/issues

## Version History

- **v1.0.0** - Initial release
  - Complete CRUD for itineraries and segments
  - AI-powered Trip Designer with streaming
  - Text import functionality
  - Comprehensive authentication and authorization
