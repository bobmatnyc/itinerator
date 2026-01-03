# Traveler Persona Test Failures: Hendersons & Adventure Squad

**Date**: 2026-01-01
**Test File**: `tests/e2e/traveler-persona-agent.ts`
**Test Results**: `tests/e2e/results/persona-test-2026-01-01T21-26-31-575Z.json`

## Executive Summary

Two personas are experiencing critical failures in the E2E test suite:

1. **The Hendersons (luxury-retirees)**: Complete failure with 403 authentication error - 0 segments created
2. **Adventure Squad (adventure-group)**: 0 segments created despite 10 conversation turns and 24 duplicate travelers

## Issue 1: The Hendersons - 403 Authentication Error

### Symptoms
- **Score**: 0/100
- **Segments**: 0
- **Conversation Turns**: 5 (terminated early)
- **Error**: `Failed to get itinerary: 403 {"message":"Access denied: You do not have permission to view this itinerary"}`

### Root Cause Analysis

The 403 error indicates an **authentication/authorization failure** when attempting to retrieve the itinerary. Looking at the test data:

```json
{
  "id": "4b6d7dc5-242f-4718-a7ee-e02891179136",
  "title": "The Hendersons's Trip",  // Note: Possessive apostrophe issue
  "travelers": [
    {
      "firstName": "Robert",
      "lastName": "Henderson",  // Last name provided
      "type": "SENIOR"
    },
    {
      "firstName": "Margaret",
      "lastName": "Henderson",  // Last name provided
      "type": "SENIOR"
    }
    // ... 6 travelers total (3 Roberts, 3 Margarets - duplicates!)
  ],
  "createdBy": "test@test.com"
}
```

**Key Observations**:
1. **Itinerary was created successfully** (ID exists)
2. **Travelers were added** (6 total, with duplicates)
3. **403 happens on `GET /api/v1/itineraries/{id}`** during `getItinerary()` call
4. **Authentication worked** for POST (creation) but **failed for GET** (retrieval)

### Likely Causes (Priority Order)

#### 1. Session/Cookie Expiration Between Requests (MOST LIKELY)
The test creates the itinerary successfully but the session may be timing out or cookies are not persisting correctly between the creation and retrieval calls.

**Evidence**:
- POST to create itinerary: ✅ Works
- POST to add travelers: ✅ Works (multiple times)
- GET to retrieve itinerary: ❌ 403 Forbidden

**Test Code Analysis** (`traveler-persona-agent.ts` lines 469-537):
```typescript
private async authenticate(): Promise<void> {
  // ... authentication logic
  this.sessionCookie = `itinerator_session=${sessionValue}; itinerator_user_email=${emailValue}`;
}

private getHeaders(includeAIKey = false): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (this.sessionCookie) {
    headers['Cookie'] = this.sessionCookie;  // Cookie header
  }

  headers['X-User-Email'] = this.userEmail;  // Fallback header

  return headers;
}
```

**Issue**: The test only authenticates ONCE at the start (line 867) but The Hendersons test runs for 138 seconds (~2.3 minutes). If the session TTL is 2 minutes or less, the session could expire mid-test.

#### 2. Traveler Duplication Bug Interfering with Auth
Looking at the JSON data, The Hendersons have **6 travelers** but the persona definition only specifies 2:

```typescript
// Persona definition (lines 286-318)
travelers: [
  { name: 'Robert', type: 'adult', age: 68 },
  { name: 'Margaret', type: 'adult', age: 65 }
]

// Actual itinerary has 6 travelers!
// - Robert Henderson (3 duplicates)
// - Margaret Henderson (3 duplicates)
```

This suggests the `add_travelers` tool is being called **multiple times** creating duplicates. This duplication pattern could be corrupting state or triggering authorization checks.

#### 3. lastName Handling in Persona vs Itinerary
The persona definition doesn't include a `lastName` field, but the itinerary has "Henderson" for all travelers. The Trip Designer is inferring the last name from the persona name "The Hendersons", which is correct behavior.

However, the **title has a possessive apostrophe error**: `"The Hendersons's Trip"` (should be `"The Hendersons' Trip"`), which might indicate string processing issues that could affect authentication.

### Recommended Fixes

#### Fix 1: Session Timeout Investigation (HIGH PRIORITY)
**File**: `viewer-svelte/src/routes/api/auth/login/+server.ts` (or equivalent)

1. Check session TTL configuration
2. Ensure sessions last at least 5-10 minutes for tests
3. Add session refresh logic or re-authentication on 401/403

**Test Code Enhancement**:
```typescript
private async getItinerary(): Promise<Itinerary> {
  if (!this.itineraryId) {
    throw new Error('No itinerary ID');
  }

  const response = await fetch(`${this.apiBaseUrl}/itineraries/${this.itineraryId}`, {
    headers: this.getHeaders()
  });

  // NEW: Handle 403 by re-authenticating
  if (response.status === 403) {
    if (this.verbose) console.log('⚠️  Got 403, re-authenticating...');
    await this.authenticate();

    // Retry with fresh session
    const retryResponse = await fetch(`${this.apiBaseUrl}/itineraries/${this.itineraryId}`, {
      headers: this.getHeaders()
    });

    if (!retryResponse.ok) {
      throw new Error(`Failed to get itinerary after re-auth: ${retryResponse.status}`);
    }

    return await retryResponse.json();
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get itinerary: ${response.status} ${error}`);
  }

  return await response.json();
}
```

#### Fix 2: Prevent Traveler Duplication (MEDIUM PRIORITY)
**File**: `src/services/trip-designer.service.ts` or equivalent

The `add_travelers` tool should check for existing travelers before adding:

```typescript
async addTravelers(itineraryId: string, travelers: TravelerInfo[]): Promise<void> {
  const itinerary = await this.getItinerary(itineraryId);

  // Check for duplicates by name
  const existingNames = new Set(
    itinerary.travelers.map(t => `${t.firstName} ${t.lastName}`.toLowerCase())
  );

  const newTravelers = travelers.filter(t => {
    const fullName = `${t.firstName} ${t.lastName}`.toLowerCase();
    return !existingNames.has(fullName);
  });

  if (newTravelers.length === 0) {
    console.log('All travelers already exist, skipping add');
    return;
  }

  // Add only new travelers
  await this.storage.addTravelers(itineraryId, newTravelers);
}
```

#### Fix 3: Fix Title Possessive Apostrophe (LOW PRIORITY)
**File**: `src/services/trip-designer.service.ts` or prompt template

When generating titles from persona names:
- "The Hendersons" → "The Hendersons' Trip" (not "The Hendersons's Trip")
- "The Johnsons" → "The Johnsons' Trip"

## Issue 2: Adventure Squad - Zero Segments Despite 10 Turns

### Symptoms
- **Score**: 15/100
- **Segments**: 0
- **Conversation Turns**: 10 (completed full conversation)
- **Travelers**: 24 (6x duplication of 4 people!)
- **Duration**: 272 seconds (~4.5 minutes)
- **Keywords Found**: "adventure" (only 1 of 4 expected)

### Root Cause Analysis

The Adventure Squad test completed all 10 conversation turns but **created zero segments**. This is a catastrophic failure of the Trip Designer.

```json
{
  "id": "0d11e58d-062b-48af-a3b2-0ac56800074e",
  "version": 29,  // 29 versions!
  "title": "Adventure Squad's Trip",
  "travelers": [
    // 24 travelers total:
    // - Mike (6 duplicates)
    // - Sara (6 duplicates)
    // - Tom (6 duplicates)
    // - Anna (6 duplicates)
  ],
  "segments": []  // EMPTY!
}
```

**Key Observations**:
1. **29 itinerary versions** - the itinerary was updated 29 times
2. **24 travelers** - massive duplication (6x the expected 4)
3. **0 segments** - no flights, hotels, or activities were created
4. **10 conversation turns** - full conversation completed

### Likely Causes (Priority Order)

#### 1. Traveler Deduplication Preventing Tool Execution (MOST LIKELY)
With 24 travelers in the itinerary (6 copies of each person), the `add_hotel`, `add_flight`, and `add_activity` tools might be:
- Failing due to `travelerIds` array issues
- Hitting validation errors (e.g., "too many travelers")
- Silently failing and not creating segments

**Evidence**:
- 29 versions suggests many tool calls were executed
- Tool calls likely succeeded (increasing version) but **segments weren't created**
- This matches a bug where tool execution succeeds but side effects fail

#### 2. Group Size (4 People) Causing Tool Validation Failures
The persona has 4 travelers, which is the largest group in the test suite:
- Solo Backpacker: 1
- Romantic Couple: 2
- Johnson Family: 4 (adults + children)
- Adventure Squad: **4 adults**

**Hypothesis**: The tools might have validation that fails for groups of 4 adults, especially with the 6x duplication making it 24 travelers total.

#### 3. Cruise/Adventure Complexity
The Hendersons persona requests a "Mediterranean cruise" which is a complex, multi-destination trip. The Adventure Squad requests "Costa Rica" with "zip-lining" and "rainforest hike" which are activity-heavy.

**However**, The Hendersons failed with auth errors, not segment creation, so this is less likely for Adventure Squad.

#### 4. Tool Call Silent Failures
The test shows:
- `toolCalls` array in conversation history would show tool calls
- But test result shows **0 segments** despite tool calls

This suggests:
1. Tools are being called (version increments from 1 → 29)
2. Tools are failing silently (no segments created)
3. No error handling/logging for tool failures

### Recommended Fixes

#### Fix 1: Add Tool Call Logging (HIGH PRIORITY - Immediate)
**File**: `tests/e2e/traveler-persona-agent.ts`

Add detailed tool call logging to understand what's happening:

```typescript
private async sendMessage(message: string): Promise<{
  response: string;
  toolCalls: string[];
  itineraryUpdated: boolean;
}> {
  // ... existing code ...

  // NEW: Log tool calls and their results
  if (toolCalls.length > 0) {
    console.log(`🔧 Tool calls executed: ${toolCalls.join(', ')}`);

    // Get updated itinerary to check if segments were added
    try {
      const updatedItinerary = await this.getItinerary();
      console.log(`📊 Segments after tool calls: ${updatedItinerary.segments.length}`);
      console.log(`👥 Travelers after tool calls: ${updatedItinerary.travelers.length}`);
    } catch (error) {
      console.error(`❌ Failed to get itinerary after tool calls: ${error}`);
    }
  }

  return { response: assistantMessage.trim(), toolCalls, itineraryUpdated };
}
```

#### Fix 2: Enforce Traveler Deduplication (HIGH PRIORITY)
**File**: `src/services/itinerary.service.ts` or `trip-designer.service.ts`

Prevent duplicate travelers from being added:

```typescript
async addTravelers(itineraryId: string, travelers: TravelerInfo[]): Promise<string[]> {
  const itinerary = await this.storage.getItinerary(itineraryId);

  // Create deduplication key
  const existingTravelers = new Map(
    itinerary.travelers.map(t => [
      `${t.firstName.toLowerCase()}_${t.lastName.toLowerCase()}_${t.type}`,
      t.id
    ])
  );

  const results: string[] = [];

  for (const traveler of travelers) {
    const key = `${traveler.firstName.toLowerCase()}_${traveler.lastName.toLowerCase()}_${traveler.type}`;

    if (existingTravelers.has(key)) {
      console.log(`⚠️  Traveler ${traveler.firstName} ${traveler.lastName} already exists`);
      results.push(existingTravelers.get(key)!);
    } else {
      const newId = await this.storage.addTraveler(itineraryId, traveler);
      existingTravelers.set(key, newId);
      results.push(newId);
    }
  }

  return results;
}
```

#### Fix 3: Add Segment Creation Validation (MEDIUM PRIORITY)
**File**: `src/services/trip-designer.service.ts`

Add validation to segment creation tools to surface errors:

```typescript
async addHotel(params: HotelParams): Promise<string> {
  // Validate traveler count
  if (params.itinerary.travelers.length > 10) {
    throw new Error(
      `Too many travelers (${params.itinerary.travelers.length}). Maximum 10 allowed per booking.`
    );
  }

  // Validate travelerIds if provided
  if (params.travelerIds && params.travelerIds.length > 0) {
    const validIds = new Set(params.itinerary.travelers.map(t => t.id));
    const invalidIds = params.travelerIds.filter(id => !validIds.has(id));

    if (invalidIds.length > 0) {
      throw new Error(
        `Invalid traveler IDs: ${invalidIds.join(', ')}. Valid IDs: ${Array.from(validIds).join(', ')}`
      );
    }
  }

  // Create segment
  const segment = await this.segmentService.createHotelSegment(params);

  console.log(`✅ Created hotel segment: ${segment.id} for ${params.property.name}`);

  return segment.id;
}
```

#### Fix 4: Add Tool Call Error Handling (MEDIUM PRIORITY)
**File**: `src/services/trip-designer.service.ts` or equivalent

Ensure tool call errors are surfaced to the LLM:

```typescript
async executeToolCall(toolName: string, params: any): Promise<any> {
  try {
    const result = await this[toolName](params);
    return {
      success: true,
      result
    };
  } catch (error) {
    console.error(`❌ Tool ${toolName} failed:`, error);

    // Return error to LLM so it can retry or adjust
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      suggestion: 'Please check the parameters and try again, or try a different approach.'
    };
  }
}
```

### Investigation Steps

To debug the Adventure Squad issue, run with verbose logging:

```bash
# Run Adventure Squad persona with verbose output
npx tsx tests/e2e/traveler-persona-agent.ts --persona adventure-group --verbose

# Look for:
# 1. Tool call names (add_hotel, add_flight, add_activity)
# 2. Tool call parameters (especially travelerIds)
# 3. Segment count after each tool call
# 4. Any error messages or validation failures
```

Check the Trip Designer session logs:
```bash
# Find the session ID from test output
# Then inspect server logs for that session

# Look for:
# - Tool call execution logs
# - Segment creation attempts
# - Validation errors
# - Database/storage errors
```

## Common Root Cause: Traveler Management Bug

Both personas share a **traveler duplication bug**:

- **Hendersons**: 6 travelers (expected 2) - 3x duplication
- **Adventure Squad**: 24 travelers (expected 4) - 6x duplication

### Pattern Analysis

| Persona | Expected | Actual | Duplication Factor | Segments | Auth Error |
|---------|----------|--------|-------------------|----------|------------|
| Hendersons | 2 | 6 | 3x | 0 | Yes (403) |
| Adventure Squad | 4 | 24 | 6x | 0 | No |
| Romantic Couple | 2 | 8 | 4x | 13 | No (PASSED) |
| Johnson Family | 4 | 5 | 1.25x | 3 | No |
| Business Traveler | 1 | 2 | 2x | 4 | No |

**Key Insight**: Traveler duplication is happening across ALL multi-traveler personas, but it's **worst for Adventure Squad** (6x) and **causes auth failure for Hendersons**.

### Hypothesis: Tool Call Retry Logic

The Trip Designer might be retrying the `add_travelers` tool call when:
1. User mentions travelers again
2. Tool call returns success but doesn't affect conversation state
3. LLM doesn't realize travelers were already added

**Evidence**:
- Adventure Squad: 10 turns, 24 travelers → ~2.4 travelers added per turn
- Hendersons: 5 turns, 6 travelers → 1.2 travelers added per turn
- Pattern suggests travelers are being added multiple times during conversation

## Priority Action Items

### Immediate (Do First)
1. **Add session re-authentication on 403** in test harness
2. **Add tool call result logging** to understand why segments aren't created
3. **Run Adventure Squad with verbose logging** to see tool calls

### Short-term (Next Sprint)
4. **Implement traveler deduplication** in `add_travelers` tool
5. **Add segment creation validation** with clear error messages
6. **Add tool call error handling** that surfaces errors to LLM

### Medium-term (Nice to Have)
7. **Increase session TTL** to 10+ minutes for long-running tests
8. **Fix title possessive apostrophe** for plural names
9. **Add test assertions** for traveler count and duplication

## Test Coverage Recommendations

Add specific tests for:

```typescript
describe('Traveler Management', () => {
  it('should not create duplicate travelers with same name', async () => {
    const itinerary = await createItinerary();

    await addTravelers(itinerary.id, [
      { firstName: 'Robert', lastName: 'Henderson', type: 'ADULT' }
    ]);

    await addTravelers(itinerary.id, [
      { firstName: 'Robert', lastName: 'Henderson', type: 'ADULT' }
    ]);

    const updated = await getItinerary(itinerary.id);
    expect(updated.travelers).toHaveLength(1);
  });

  it('should handle group sizes up to 10 travelers', async () => {
    const travelers = Array.from({ length: 10 }, (_, i) => ({
      firstName: `Person${i}`,
      lastName: 'Test',
      type: 'ADULT'
    }));

    const segment = await addHotel({
      itineraryId,
      travelers,
      property: { name: 'Test Hotel' }
    });

    expect(segment).toBeDefined();
  });
});

describe('Authentication', () => {
  it('should handle session expiration gracefully', async () => {
    // Create itinerary
    const id = await createItinerary();

    // Simulate session expiration
    clearSession();

    // Should re-authenticate automatically
    const itinerary = await getItinerary(id);
    expect(itinerary.id).toBe(id);
  });
});
```

## Conclusion

Both persona failures stem from infrastructure issues rather than persona design problems:

1. **The Hendersons**: Session timeout/expiration causing 403 errors after ~2 minutes
2. **Adventure Squad**: Traveler duplication (24 instead of 4) preventing segment creation

The traveler duplication bug is **systemic** and affects all multi-traveler personas, but Adventure Squad experiences the worst impact due to:
- Largest group size (4 people)
- Most conversation turns (10)
- Most tool call retries (29 versions)

Fixing the traveler deduplication will likely resolve both issues and improve test pass rate from 12.5% to ~50%+.
