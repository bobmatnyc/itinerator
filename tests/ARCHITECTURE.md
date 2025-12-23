# E2E Test Framework Architecture

## Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        E2E Test Suite                           │
│  (tests/e2e/trip-designer.test.ts)                             │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ├──> imports
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                    Test Helpers                                 │
│  (tests/helpers/)                                               │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ TestClient   │  │ SSE Parser   │  │ Fixtures     │         │
│  │              │  │              │  │              │         │
│  │ - session    │  │ - parseSSE   │  │ - loadItin() │         │
│  │ - streaming  │  │ - collectEvs │  │ - loadPers() │         │
│  │ - itinerary  │  │ - waitEvent  │  │ - cache      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Assertions                                                │  │
│  │ - assertOneQuestionOnly()  ⭐ ONE question principle     │  │
│  │ - assertValidItinerary()                                  │  │
│  │ - assertNoErrors()                                        │  │
│  │ - assertStreamCompleted()                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ├──> calls
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                   SvelteKit API Routes                          │
│  (viewer-svelte/src/routes/api/v1/)                            │
│                                                                 │
│  POST   /designer/sessions                                     │
│  GET    /designer/sessions/:id                                 │
│  POST   /designer/sessions/:id/messages/stream    (SSE)       │
│  GET    /itineraries/:id                                       │
│  POST   /itineraries                                           │
│  PATCH  /itineraries/:id                                       │
│  DELETE /itineraries/:id                                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ├──> delegates to
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                   Core Services                                 │
│  (src/services/)                                                │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ TripDesignerService  │  │ ItineraryService     │            │
│  │                      │  │                      │            │
│  │ - processMessage()   │  │ - create()           │            │
│  │ - streamResponse()   │  │ - get()              │            │
│  │ - executeTools()     │  │ - update()           │            │
│  └──────────────────────┘  └──────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Creating a Session and Sending a Message

```
Test Code                         TestClient                    API                      Service
    │                                 │                          │                          │
    │─────createSession(itinId)──────>│                          │                          │
    │                                 │                          │                          │
    │                                 │──POST /sessions─────────>│                          │
    │                                 │  {itineraryId, mode}     │                          │
    │                                 │                          │                          │
    │                                 │                          │──createSession()────────>│
    │                                 │                          │                          │
    │                                 │<─{sessionId}─────────────│<─────────────────────────│
    │<────{sessionId}─────────────────│                          │                          │
    │                                 │                          │                          │
    │──streamMessage(sessionId, msg)─>│                          │                          │
    │                                 │                          │                          │
    │                                 │──POST /messages/stream──>│                          │
    │                                 │  {message}               │                          │
    │                                 │                          │                          │
    │                                 │                          │──processMessage()───────>│
    │                                 │                          │                          │
    │                                 │<─────SSE Stream──────────│<─────streaming LLM───────│
    │                                 │  event: text             │                          │
    │                                 │  data: {content}         │                          │
    │<────for await event─────────────│                          │                          │
    │  {type: 'text', content}        │                          │                          │
    │                                 │                          │                          │
    │<────for await event─────────────│<─────SSE Stream──────────│<─────tool execution─────│
    │  {type: 'tool_call', name}      │  event: tool_call        │                          │
    │                                 │                          │                          │
    │<────for await event─────────────│<─────SSE Stream──────────│<─────questions gen──────│
    │  {type: 'structured_questions'} │  event: structured_...   │                          │
    │                                 │                          │                          │
    │<────for await event─────────────│<─────SSE Stream──────────│<─────completion─────────│
    │  {type: 'done', updated: true}  │  event: done             │                          │
    │                                 │  data: {itineraryUpdated}│                          │
```

## Module Responsibilities

### TestClient (test-client.ts)
- **Purpose**: HTTP client wrapper for tests
- **Responsibilities**:
  - Add authentication headers automatically
  - Provide typed methods for all endpoints
  - Handle errors with clear messages
  - Return proper types (no `any`)
- **Key Methods**:
  - `createSession()` - Start Trip Designer session
  - `streamMessage()` - Send message, return async generator
  - `createItinerary()` - Create test itinerary
  - `deleteItinerary()` - Cleanup test data

### SSE Parser (sse-parser.ts)
- **Purpose**: Parse Server-Sent Events
- **Responsibilities**:
  - Handle streaming HTTP responses
  - Buffer partial chunks
  - Parse SSE format (event/data pairs)
  - Yield typed events
- **Key Functions**:
  - `parseSSEStream()` - Async generator for events
  - `collectSSEEvents()` - Get all events as array
  - `collectTextContent()` - Extract only text
  - `waitForEvent()` - Wait for specific event type

### Fixtures (fixtures.ts)
- **Purpose**: Load test data from JSON files
- **Responsibilities**:
  - Read fixture files
  - Cache loaded data
  - Deep clone for isolation
  - Provide type-safe loaders
- **Key Functions**:
  - `loadItinerary()` - Load itinerary fixture
  - `loadPersona()` - Load persona fixture
  - `createMinimalItinerary()` - Generate test data
  - `clearFixtureCache()` - Reset cache

### Assertions (assertions.ts)
- **Purpose**: Custom validation helpers
- **Responsibilities**:
  - Validate domain object structure
  - Enforce design principles (ONE question)
  - Check stream integrity
  - Provide clear error messages
- **Key Functions**:
  - `assertOneQuestionOnly()` - ⭐ Enforce ONE question
  - `assertValidItinerary()` - Type guard for Itinerary
  - `assertNoErrors()` - No error events
  - `assertStreamCompleted()` - Has done event

## Event Flow in Streaming

```
┌─────────────────────────────────────────────────────────────────┐
│                     SSE Event Timeline                          │
└─────────────────────────────────────────────────────────────────┘

Time │ Event Type              │ Data
─────┼─────────────────────────┼────────────────────────────────
  0  │ (connection opens)      │
  1  │ text                    │ "Let me help you plan..."
  2  │ text                    │ "your trip to Tokyo."
  3  │ tool_call               │ {name: "search_hotels", args}
  4  │ tool_result             │ {name: "search_hotels", result}
  5  │ text                    │ "I found some great hotels."
  6  │ structured_questions    │ [{id, type, question}]  ⭐ ONE
  7  │ done                    │ {itineraryUpdated: true}
  8  │ (connection closes)     │

Key Validation Points:
  ✓ No 'error' events
  ✓ Exactly ONE 'structured_questions' event
  ✓ That event has exactly ONE question
  ✓ Stream ends with 'done' event
```

## Type System

```typescript
// Core types imported from domain layer
import type { Itinerary, Segment } from 'src/domain/types';
import type { TripDesignerSession, StructuredQuestion } from 'src/domain/types/trip-designer';

// Test-specific types
type SSEEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: unknown; success: boolean }
  | { type: 'structured_questions'; questions: StructuredQuestion[] }
  | { type: 'done'; itineraryUpdated: boolean; tokens?: TokenUsage }
  | { type: 'error'; message: string };

// Type safety throughout:
// - TestClient methods return domain types
// - SSE parser yields typed events
// - Fixtures return domain types
// - Assertions are type guards
```

## File Organization

```
tests/
├── helpers/                    # Reusable test utilities
│   ├── test-client.ts         # API client (226 lines)
│   ├── sse-parser.ts          # SSE parsing (142 lines)
│   ├── fixtures.ts            # Data loading (163 lines)
│   ├── assertions.ts          # Validation (260 lines)
│   └── index.ts               # Clean exports (43 lines)
│
├── fixtures/                   # Test data (JSON)
│   ├── itineraries/
│   │   ├── empty-new.json
│   │   ├── planning-phase.json
│   │   └── partial-segments.json
│   └── personas/
│       ├── solo-traveler.json
│       └── family-vacation.json
│
├── e2e/                        # E2E test suites
│   └── trip-designer.test.ts  # Main test suite (237 lines)
│
├── examples/                   # Usage examples
│   └── basic-usage.ts         # Interactive demo (153 lines)
│
└── docs/                       # Documentation
    ├── README.md              # Full documentation
    ├── QUICK_START.md         # Quick reference
    └── ARCHITECTURE.md        # This file
```

## Design Principles

### 1. Type Safety
All helpers return proper domain types, no `any`:
```typescript
async createItinerary(data: Partial<Itinerary>): Promise<Itinerary>
async *streamMessage(sessionId: string, message: string): AsyncGenerator<SSEEvent>
```

### 2. Isolation
Fixtures are deep-cloned to prevent test pollution:
```typescript
// Each test gets a fresh copy
const itinerary1 = loadItinerary('planning-phase');
const itinerary2 = loadItinerary('planning-phase');
itinerary1 !== itinerary2; // true
```

### 3. Progressive Disclosure
Tests validate conversation flows:
```typescript
// 1st message: High-level question (dates)
// 2nd message: More specific (accommodation)
// 3rd message: Details (preferences)
```

### 4. ONE Question Principle
Enforced via assertion:
```typescript
if (event.type === 'structured_questions') {
  assertOneQuestionOnly(event.questions);
  // Throws if questions.length !== 1
}
```

## Integration Points

### With Core Domain
```typescript
// Import domain types directly
import type { Itinerary, Segment, Location } from 'src/domain/types';
import type { TripDesignerSession, StructuredQuestion } from 'src/domain/types/trip-designer';

// Tests validate against actual types
assertValidItinerary(itinerary); // Type guard using domain types
```

### With API Layer
```typescript
// TestClient mirrors actual API routes
POST   /api/v1/designer/sessions           → createSession()
POST   /api/v1/designer/sessions/:id/messages/stream → streamMessage()
GET    /api/v1/itineraries/:id             → getItinerary()
```

### With Services
```typescript
// Tests validate service behavior indirectly
// Through API layer, ensuring integration works
TestClient → API Routes → Services → Storage
```

## Conclusion

The E2E test framework provides:
- **Type-safe** helpers for all common operations
- **Fixture-based** testing for consistency
- **Streaming support** for SSE responses
- **Custom assertions** for domain validation
- **Clean API** with minimal boilerplate

All components work together to make testing the Trip Designer straightforward and maintainable.
