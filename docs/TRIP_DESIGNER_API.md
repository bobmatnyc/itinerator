# Trip Designer API Documentation

The Trip Designer API provides conversational trip planning capabilities for the Itinerizer application. It allows users to chat with an AI agent that can help design and modify their itinerary.

## Prerequisites

The Trip Designer endpoints require an OpenRouter API key to be configured. The API key can be set in:
- `.itinerator/config.yaml` (recommended)
- Environment variable `OPENROUTER_API_KEY`

If no API key is configured, all Trip Designer endpoints will return `503 Service Unavailable`.

## Base URL

All endpoints use the base URL: `http://localhost:5176/api`

## Authentication

No authentication is required for local development. Future versions may add authentication for multi-user deployments.

## Endpoints

### 1. Create Session

Create a new chat session for trip planning.

**Request:**
```http
POST /api/chat/sessions
Content-Type: application/json

{
  "itineraryId": "abc123"
}
```

**Response (201 Created):**
```json
{
  "sessionId": "session_1734541234567_abc123def"
}
```

**Error Responses:**
- `400 Bad Request` - Missing itineraryId
- `404 Not Found` - Itinerary does not exist
- `503 Service Unavailable` - API key not configured

### 2. Send Message

Send a message to an existing chat session and get an AI response.

**Request:**
```http
POST /api/chat/sessions/{sessionId}/messages
Content-Type: application/json

{
  "message": "I want to add a day trip to Kyoto"
}
```

**Response (200 OK):**
```json
{
  "message": "I'd be happy to help you add a day trip to Kyoto! Let me add that to your itinerary...",
  "itineraryUpdated": true,
  "segmentsModified": ["seg_456"],
  "toolCallsMade": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "add_segment",
        "arguments": "{\"type\":\"activity\",\"title\":\"Day trip to Kyoto\"}"
      }
    }
  ],
  "structuredQuestions": [
    {
      "id": "q1",
      "type": "single_choice",
      "question": "What time would you like to depart?",
      "options": [
        { "id": "morning", "label": "Morning (7-9 AM)" },
        { "id": "midday", "label": "Midday (10 AM-12 PM)" }
      ]
    }
  ]
}
```

**Response Fields:**
- `message` (string) - Natural language response from the agent
- `itineraryUpdated` (boolean) - Whether the itinerary was modified
- `segmentsModified` (string[]) - Array of segment IDs that were added/modified
- `toolCallsMade` (ToolCall[]) - Array of tool calls executed by the agent
- `structuredQuestions` (StructuredQuestion[]) - Optional structured questions for UI rendering

**Error Responses:**
- `400 Bad Request` - Invalid or missing message
- `404 Not Found` - Session does not exist
- `429 Too Many Requests` - Rate limit exceeded (includes `retryAfter` in seconds)
- `402 Payment Required` - Session cost limit exceeded
- `500 Internal Server Error` - LLM API error (non-retryable)
- `503 Service Unavailable` - LLM API error (retryable) or API key not configured

### 3. Get Session

Retrieve the full session history and state.

**Request:**
```http
GET /api/chat/sessions/{sessionId}
```

**Response (200 OK):**
```json
{
  "id": "session_1734541234567_abc123def",
  "itineraryId": "abc123",
  "messages": [
    {
      "role": "user",
      "content": "I want to add a day trip to Kyoto",
      "timestamp": "2025-12-18T17:00:00Z"
    },
    {
      "role": "assistant",
      "content": "I'd be happy to help...",
      "timestamp": "2025-12-18T17:00:01Z",
      "tokens": { "input": 150, "output": 300 }
    }
  ],
  "tripProfile": {
    "travelers": { "count": 2 },
    "budget": { "total": 5000, "currency": "USD" },
    "extractedAt": "2025-12-18T17:00:00Z",
    "confidence": 0.85
  },
  "createdAt": "2025-12-18T17:00:00Z",
  "lastActiveAt": "2025-12-18T17:00:01Z",
  "metadata": {
    "messageCount": 2,
    "totalTokens": 450,
    "costUSD": 0.015
  }
}
```

**Error Responses:**
- `404 Not Found` - Session does not exist
- `503 Service Unavailable` - API key not configured

### 4. Server-Sent Events (SSE) - Itinerary Updates

Establish a real-time event stream to receive itinerary updates as they happen.

**Request:**
```http
GET /api/itineraries/{id}/events
Accept: text/event-stream
```

**Response (200 OK - SSE Stream):**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"connected","itineraryId":"abc123"}

:ping

data: {"type":"segment_added","segmentId":"seg_456","itineraryId":"abc123"}

:ping
```

**Event Types:**
- `connected` - Initial connection established
- `ping` - Keep-alive ping (sent every 30 seconds)
- `segment_added` - New segment added (future)
- `segment_modified` - Segment updated (future)
- `segment_deleted` - Segment removed (future)

**Error Responses:**
- `404 Not Found` - Itinerary does not exist

**Notes:**
- The connection remains open until the client closes it
- Ping messages (`:ping`) keep the connection alive
- Actual change notifications are not yet implemented (marked with TODO)

### 5. Get Statistics

Get statistics about active Trip Designer sessions.

**Request:**
```http
GET /api/chat/stats
```

**Response (200 OK):**
```json
{
  "activeSessions": 3
}
```

**Error Responses:**
- `503 Service Unavailable` - API key not configured

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "hint": "Optional suggestion for fixing the error"
}
```

### HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `402 Payment Required` - Cost/quota limit exceeded
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error (non-retryable)
- `503 Service Unavailable` - Service temporarily unavailable (retryable)

## Rate Limiting

OpenRouter applies rate limits based on your API key tier. When rate limited:
- Response status: `429 Too Many Requests`
- `retryAfter` field indicates seconds to wait before retrying

## Cost Management

Sessions have a default cost limit of $2.00 USD. When exceeded:
- Response status: `402 Payment Required`
- Session cannot process new messages
- Create a new session to continue

## Example Usage

### Complete Chat Flow

```javascript
// 1. Create a session
const sessionResponse = await fetch('http://localhost:5176/api/chat/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ itineraryId: 'abc123' })
});
const { sessionId } = await sessionResponse.json();

// 2. Send a message
const messageResponse = await fetch(
  `http://localhost:5176/api/chat/sessions/${sessionId}/messages`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Help me plan a trip to Tokyo' })
  }
);
const agentResponse = await messageResponse.json();

console.log('Agent:', agentResponse.message);

// 3. Subscribe to itinerary updates
const eventSource = new EventSource(`http://localhost:5176/api/itineraries/abc123/events`);

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('Itinerary update:', data);
});

// 4. Get session history
const sessionDetailsResponse = await fetch(
  `http://localhost:5176/api/chat/sessions/${sessionId}`
);
const session = await sessionDetailsResponse.json();

console.log('Message count:', session.metadata.messageCount);
console.log('Total cost:', session.metadata.costUSD);
```

## Tool Calls

The Trip Designer agent can execute the following tools:

### Itinerary Tools
- `add_segment` - Add a new segment (flight, hotel, activity, etc.)
- `update_segment` - Modify an existing segment
- `delete_segment` - Remove a segment
- `move_segment` - Reorder segments
- `get_segments` - Retrieve segment details

### Search Tools (requires SerpAPI key)
- `search_flights` - Search for flight options
- `search_hotels` - Search for hotel options
- `search_activities` - Search for things to do

### Profile Tools
- `update_trip_profile` - Update traveler preferences and budget

## Future Enhancements

- [ ] Real-time itinerary change notifications via SSE
- [ ] Streaming responses for long messages
- [ ] Session persistence to database
- [ ] Multi-user authentication
- [ ] Cost analytics and budgeting
- [ ] Export chat history
- [ ] Session archiving and cleanup
