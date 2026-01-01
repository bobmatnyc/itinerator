# Business Rules and Validation Patterns Analysis

**Research Date:** 2025-12-24
**Scope:** Travel itinerary application validation architecture
**Focus:** Itinerary business rules, validation consistency, and data flow integrity

---

## Executive Summary

This analysis examines the validation patterns across the Itinerator travel itinerary application, covering domain schemas, service layer validation, API route validation, and Trip Designer tool validation. The application demonstrates **strong schema-first design** with Zod schemas at the core, but reveals **critical inconsistencies** in how validation is applied across different layers.

### Key Findings

✅ **Strengths:**
- Well-structured Zod schemas with discriminated unions
- Comprehensive business rules in domain schemas
- Service layer enforces critical constraints
- Clear separation between create/update/full schemas

❌ **Critical Issues:**
1. **API routes bypass schema validation** - Manual field checks instead of Zod
2. **Date validation inconsistency** - Different parsing logic across layers
3. **Duplicate validation logic** - Same rules in schemas AND services
4. **Missing client-side validation** - Most validation happens server-side
5. **Trip Designer tool validation gaps** - No schema validation for tool inputs

---

## 1. Itinerary Business Rules

### 1.1 Domain Schema Validation

**Location:** `src/domain/schemas/itinerary.schema.ts`

#### Full Itinerary Schema Rules

```typescript
export const itinerarySchema = z.object({
  id: itineraryIdSchema,
  version: z.number().int().positive('Version must be positive').default(1),
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  status: itineraryStatusSchema.default('DRAFT'),
  startDate: dateSchema,      // Required for full schema
  endDate: dateSchema,        // Required for full schema
  // ... other fields
})
.refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
})
.refine(
  (data) => !data.primaryTravelerId ||
           data.travelers.some((t) => t.id === data.primaryTravelerId),
  {
    message: 'Primary traveler must be in travelers list',
    path: ['primaryTravelerId'],
  }
);
```

**Business Rules Enforced:**
1. ✅ Title required (1-255 characters)
2. ✅ Version must be positive integer
3. ✅ End date >= start date
4. ✅ Primary traveler must exist in travelers list
5. ✅ Status defaults to 'DRAFT'

#### Create Schema Rules

```typescript
export const itineraryCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().optional(),
  startDate: dateSchema.optional(),    // OPTIONAL for create
  endDate: dateSchema.optional(),      // OPTIONAL for create
  // ... other fields
})
.refine((data) => {
  // Only validate date order if both dates provided
  if (data.startDate && data.endDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});
```

**Business Rules Enforced:**
1. ✅ Title required
2. ✅ Dates optional (trip designer collects them)
3. ✅ Date order validated only when both provided
4. ✅ Allows trips without dates for trip designer workflow

**Key Insight:** The dual schema approach (full vs. create) elegantly supports the trip designer workflow where dates are collected conversationally.

### 1.2 Service Layer Validation

**Location:** `src/services/itinerary-collection.service.ts`

```typescript
async createItinerary(input: CreateItineraryInput) {
  // ✅ USES SCHEMA VALIDATION
  const validation = itineraryCreateSchema.safeParse(input);
  if (!validation.success) {
    return err(createValidationError(
      'INVALID_DATA',
      `Invalid itinerary data: ${validation.error.message}`,
      validation.error.errors[0]?.path.join('.')
    ));
  }
  // Create itinerary with defaults
}

async updateMetadata(id, updates) {
  // ❌ MANUAL VALIDATION (duplicate of schema rule)
  if (updated.startDate && updated.endDate &&
      updated.endDate < updated.startDate) {
    return err(createValidationError(
      'CONSTRAINT_VIOLATION',
      'End date must be on or after start date',
      'endDate'
    ));
  }
  // Save updated itinerary
}
```

**Issues Identified:**
1. ❌ **Duplicate validation**: `updateMetadata` manually checks date order (already in schema)
2. ❌ **No schema validation for updates**: Should use `itineraryUpdateSchema.safeParse()`
3. ✅ **Good error handling**: Uses Result types for error propagation

### 1.3 API Route Validation

**Location:** `viewer-svelte/src/routes/api/v1/itineraries/+server.ts`

```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  const { title, description, startDate, endDate, draft } = body;

  // ❌ MANUAL VALIDATION - Should use schema!
  if (!title) {
    throw error(400, {
      message: 'Missing required field: title is required'
    });
  }

  // ❌ NO SCHEMA VALIDATION AT API LAYER
  const result = await collectionService.createItinerary({
    title,
    description: description || '',
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    draft: draft === true,
    createdBy: userEmail
  });
}
```

**Critical Issues:**
1. ❌ **No Zod schema validation** at API boundary
2. ❌ **Manual field checking** duplicates schema rules
3. ❌ **Unsafe date parsing** - `new Date(startDate)` can fail silently
4. ❌ **No type safety** - Input could have unexpected fields
5. ❌ **Inconsistent with service layer** which uses schemas

**PATCH Route Issues:**

```typescript
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const body = await request.json();
  const { title, description, startDate, endDate, status, tripType, tags } = body;

  // ❌ Manual field extraction - no validation
  const updates: Parameters<typeof collectionService.updateMetadata>[1] = {};

  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (startDate !== undefined) updates.startDate = new Date(startDate);
  if (endDate !== undefined) updates.endDate = new Date(endDate);
  // ...
}
```

**Issues:**
1. ❌ No input validation before passing to service
2. ❌ Unsafe date parsing
3. ❌ No validation of field values (e.g., status enum)

---

## 2. Segment Business Rules

### 2.1 Domain Schema Validation

**Location:** `src/domain/schemas/segment.schema.ts`

#### Base Segment Rules

```typescript
const baseSegmentFields = {
  id: segmentIdSchema,
  status: segmentStatusSchema.default('TENTATIVE'),
  startDatetime: dateSchema,        // Required
  endDatetime: dateSchema,          // Required
  travelerIds: z.array(travelerIdSchema).default([]),
  source: segmentSourceSchema.optional().default('import'),
  // ... other fields
};
```

#### Type-Specific Refinements

```typescript
export const flightSegmentSchema = flightSegmentBaseSchema.refine(
  (data) => data.endDatetime > data.startDatetime,
  {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  }
);

export const hotelSegmentSchema = hotelSegmentBaseSchema
  .refine((data) => data.endDatetime > data.startDatetime, {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  })
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  });
```

**Business Rules Enforced:**
1. ✅ Start datetime < end datetime (all types)
2. ✅ Flight number format: `/^[A-Z0-9]{2,3}\d{1,4}$/`
3. ✅ Hotel check-out > check-in
4. ✅ Hotel times in HH:mm format
5. ✅ Discriminated union by segment type

### 2.2 Service Layer Validation

**Location:** `src/services/segment.service.ts`

```typescript
async add(itineraryId, segment) {
  // ❌ DUPLICATE: Schema already validates this
  if (segmentWithId.startDatetime >= segmentWithId.endDatetime) {
    return err(createValidationError(
      'CONSTRAINT_VIOLATION',
      'Segment start datetime must be before end datetime',
      'endDatetime'
    ));
  }

  // ✅ ADDITIONAL BUSINESS RULE: Not in schema
  if (existing.startDate && existing.endDate) {
    if (segmentWithId.startDatetime < existing.startDate ||
        segmentWithId.endDatetime > existing.endDate) {
      return err(createValidationError(
        'CONSTRAINT_VIOLATION',
        'Segment dates must be within itinerary date range',
        'startDatetime'
      ));
    }
  }

  // ✅ ADDITIONAL: Check for duplicate IDs
  const segmentExists = existing.segments.some((s) => s.id === segmentWithId.id);
  if (segmentExists) {
    return err(createStorageError(
      'VALIDATION_ERROR',
      `Segment ${segmentWithId.id} already exists`
    ));
  }
}
```

**Issues:**
1. ❌ **Duplicate validation**: Start < end already in schema
2. ✅ **Valid business rule**: Segment within itinerary date range
3. ✅ **Valid business rule**: No duplicate segment IDs
4. ❌ **No schema validation**: Should call `segmentSchema.safeParse()` first

### 2.3 API Route Validation

**Location:** `viewer-svelte/src/routes/api/v1/itineraries/[id]/segments/+server.ts`

```typescript
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const segmentData = await request.json();

  // ❌ MANUAL VALIDATION
  if (!segmentData.startDatetime || !segmentData.endDatetime || !segmentData.type) {
    throw error(400, {
      message: 'Missing required fields: startDatetime, endDatetime, and type are required'
    });
  }

  // ❌ UNSAFE DATE PARSING
  const segment = {
    ...segmentData,
    startDatetime: new Date(segmentData.startDatetime),
    endDatetime: new Date(segmentData.endDatetime)
  };

  const result = await segmentService.add(itineraryId, segment);
}
```

**Critical Issues:**
1. ❌ **No schema validation** - Should use `segmentSchema.safeParse()`
2. ❌ **Incomplete field checking** - Only checks 3 fields, ignores type-specific requirements
3. ❌ **No type discrimination** - Doesn't validate FLIGHT vs HOTEL specific fields
4. ❌ **Unsafe date parsing** - Silent failures possible

---

## 3. Trip Designer Tool Validation

### 3.1 Tool Definitions

**Location:** `src/services/trip-designer/tools.ts`

Tool definitions specify parameters using JSON Schema format:

```typescript
export const ADD_FLIGHT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_flight',
    description: 'Add a flight segment...',
    parameters: {
      type: 'object',
      properties: {
        airline: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            code: { type: 'string' },
          },
          required: ['name', 'code'],
        },
        flightNumber: { type: 'string' },
        departureTime: {
          type: 'string',
          format: 'date-time'
        },
        // ...
      },
      required: ['airline', 'flightNumber', 'origin', 'destination',
                 'departureTime', 'arrivalTime'],
    },
  },
};
```

**Issues:**
1. ❌ **JSON Schema, not Zod** - Different validation system than domain
2. ❌ **No format validation enforcement** - `format: 'date-time'` is informational only
3. ❌ **Validation only at LLM level** - OpenRouter may or may not enforce
4. ⚠️ **Duplicate definitions** - Redefines what's in Zod schemas

### 3.2 Tool Execution

**Location:** `src/services/trip-designer/tool-executor.ts`

```typescript
async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
  const { toolCall, itineraryId } = context;
  const { name, arguments: argsJson } = toolCall.function;

  // ❌ MANUAL JSON PARSING - No schema validation
  let args: any = {};
  if (argsJson && argsJson.trim().length > 0) {
    try {
      args = JSON.parse(argsJson);
    } catch (parseError) {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: `Failed to parse tool arguments: ${parseError.message}`,
      };
    }
  }

  // Route to handler without validation
  switch (name) {
    case 'add_flight':
      result = await this.handleAddFlight(itineraryId, args);
      break;
    // ...
  }
}
```

**Critical Issues:**
1. ❌ **No schema validation** of tool arguments
2. ❌ **Type unsafe** - `args: any` bypasses TypeScript
3. ❌ **Relies on LLM correctness** - Assumes OpenRouter provides valid data
4. ❌ **Error-prone** - Invalid data discovered only during service call

### 3.3 Date Validation in Tools

**Special Date Parser:** `src/utils/date-parser.ts`

```typescript
export function parseLocalDate(isoDateString: string): Date {
  if (!isoDateString) return new Date();

  if (isoDateString.includes('T')) {
    return new Date(isoDateString);
  }

  // Parse as local noon to avoid timezone rollover
  const parts = isoDateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}
```

**Issues:**
1. ⚠️ **Inconsistent with API routes** - API uses `new Date()` directly
2. ⚠️ **Inconsistent with schemas** - Schemas use `z.coerce.date()`
3. ✅ **Solves timezone issue** - Prevents date rollover in US timezones
4. ❌ **Not used everywhere** - Only in tool executor, not API routes

---

## 4. Validation Consistency Analysis

### 4.1 Validation Layers

| Layer | Zod Schemas Used? | Validation Type | Date Parsing |
|-------|-------------------|-----------------|--------------|
| **Domain Schemas** | ✅ Yes (defined) | Comprehensive | `z.coerce.date()` |
| **Service Layer** | ⚠️ Partial (create only) | Manual + Schema | Accepts Date objects |
| **API Routes** | ❌ No | Manual field checks | `new Date()` |
| **Trip Designer Tools** | ❌ No | JSON Schema (LLM-level) | `parseLocalDate()` |
| **Client Components** | ❌ No | None (server-side only) | N/A |

### 4.2 Duplicate Validation Logic

#### Example: Date Order Validation

**Domain Schema (itinerary.schema.ts):**
```typescript
.refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
})
```

**Service Layer (itinerary-collection.service.ts):**
```typescript
if (updated.startDate && updated.endDate && updated.endDate < updated.startDate) {
  return err(createValidationError(
    'CONSTRAINT_VIOLATION',
    'End date must be on or after start date',
    'endDate'
  ));
}
```

**Trip Designer Prompt (system.md):**
```markdown
**Date Validation Rules:**
1. **Past dates**: If the START date has already passed (before today),
   suggest alternative dates
2. **Same-day trips**: Trips starting TODAY are VALID
```

**Count:** Same rule in **3 different places** with **3 different implementations**.

#### Example: Segment DateTime Validation

**Segment Schema (segment.schema.ts):**
```typescript
.refine((data) => data.endDatetime > data.startDatetime, {
  message: 'End datetime must be after start datetime',
  path: ['endDatetime'],
})
```

**Segment Service (segment.service.ts):**
```typescript
if (segmentWithId.startDatetime >= segmentWithId.endDatetime) {
  return err(createValidationError(
    'CONSTRAINT_VIOLATION',
    'Segment start datetime must be before end datetime',
    'endDatetime'
  ));
}
```

**Count:** Same rule in **2 places** with **inconsistent operators** (`>` vs `>=`).

### 4.3 Missing Validations

#### API Routes - No Schema Validation

**Segment POST API:**
- ❌ Missing: Type-specific field validation (e.g., flight number format)
- ❌ Missing: Cabin class enum validation
- ❌ Missing: Price amount validation (positive numbers)
- ❌ Missing: Location code length validation

**Itinerary PATCH API:**
- ❌ Missing: Status enum validation
- ❌ Missing: Trip type enum validation
- ❌ Missing: Title length validation (1-255 chars)

#### Trip Designer Tools - No Schema Validation

**Tool Argument Validation:**
- ❌ Missing: All Zod schema validations
- ❌ Missing: Format enforcement (date-time, email, URL)
- ❌ Missing: Range validation (latitude/longitude)
- ❌ Missing: Pattern validation (flight numbers, IATA codes)

### 4.4 Date/Time Handling Inconsistencies

| Location | Parsing Method | Timezone Handling | Validation |
|----------|----------------|-------------------|------------|
| **Domain Schemas** | `z.coerce.date()` | UTC (default) | None |
| **API Routes** | `new Date(str)` | UTC | None |
| **Tool Executor** | `parseLocalDate()` | Local (noon) | None |
| **Segment Service** | Accepts `Date` | N/A | Manual checks |

**Problem:** Three different parsing methods can produce different `Date` objects for the same input string.

**Example:**
```typescript
// Input: "2025-12-25"
z.coerce.date().parse("2025-12-25")      // 2025-12-25T00:00:00Z (UTC midnight)
new Date("2025-12-25")                   // 2025-12-25T00:00:00Z (UTC midnight)
parseLocalDate("2025-12-25")             // 2025-12-25T20:00:00Z (noon PST)
```

In PST timezone, midnight UTC is the **previous day** at 4:00 PM PST, causing date rollover bugs.

---

## 5. Recommendations

### 5.1 Critical (High Priority)

#### 1. Add Schema Validation to API Routes

**Problem:** API routes manually check fields instead of using Zod schemas.

**Solution:**
```typescript
// ✅ RECOMMENDED: API route with schema validation
export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();

  // Validate with create schema
  const validation = itineraryCreateSchema.safeParse(body);
  if (!validation.success) {
    throw error(400, {
      message: 'Invalid input data',
      errors: validation.error.errors,
    });
  }

  const result = await collectionService.createItinerary({
    ...validation.data,
    createdBy: userEmail,
  });
}
```

**Files to Update:**
- `viewer-svelte/src/routes/api/v1/itineraries/+server.ts`
- `viewer-svelte/src/routes/api/v1/itineraries/[id]/+server.ts`
- `viewer-svelte/src/routes/api/v1/itineraries/[id]/segments/+server.ts`
- `viewer-svelte/src/routes/api/v1/itineraries/[id]/segments/[segmentId]/+server.ts`

#### 2. Add Schema Validation to Tool Executor

**Problem:** Tool executor accepts `any` type arguments without validation.

**Solution:**
```typescript
// Create Zod schemas for tool arguments
const addFlightArgsSchema = z.object({
  airline: companySchema,
  flightNumber: z.string().regex(/^[A-Z0-9]{2,3}\d{1,4}$/),
  origin: locationSchema,
  destination: locationSchema,
  departureTime: dateSchema,
  arrivalTime: dateSchema,
  cabinClass: cabinClassSchema.optional(),
  price: moneyInputSchema.optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
});

// Validate in handler
private async handleAddFlight(itineraryId: ItineraryId, args: unknown) {
  // Validate arguments
  const validation = addFlightArgsSchema.safeParse(args);
  if (!validation.success) {
    throw new Error(`Invalid flight arguments: ${validation.error.message}`);
  }

  const flightArgs = validation.data;
  // ... create segment
}
```

**Files to Update:**
- `src/services/trip-designer/tool-executor.ts` (all handlers)

#### 3. Standardize Date Parsing

**Problem:** Three different date parsing methods across codebase.

**Solution:**
```typescript
// Create centralized date parsing utility
export const dateParsingSchema = z.coerce.date().transform((date) => {
  // Ensure consistent timezone handling
  // Option 1: Always use UTC
  // Option 2: Always use parseLocalDate logic
  return date;
});

// Use in all schemas
export const itinerarySchema = z.object({
  startDate: dateParsingSchema,
  endDate: dateParsingSchema,
  // ...
});
```

**Alternative:** Standardize on `parseLocalDate()` everywhere to avoid timezone rollover.

**Files to Update:**
- `src/domain/schemas/common.schema.ts` (update `dateSchema`)
- `viewer-svelte/src/routes/api/v1/**/*.ts` (remove `new Date()` calls)
- Document the chosen date parsing strategy

### 5.2 Important (Medium Priority)

#### 4. Remove Duplicate Validation from Services

**Problem:** Service layer manually validates rules already in schemas.

**Solution:**
```typescript
// ❌ BEFORE: Duplicate validation
async updateMetadata(id, updates) {
  // Manual date validation (duplicate of schema)
  if (updated.startDate && updated.endDate &&
      updated.endDate < updated.startDate) {
    return err(createValidationError(...));
  }
}

// ✅ AFTER: Use schema validation
async updateMetadata(id, updates) {
  // Validate updates with schema
  const validation = itineraryUpdateSchema.safeParse(updates);
  if (!validation.success) {
    return err(createValidationError(
      'INVALID_DATA',
      validation.error.message,
      validation.error.errors[0]?.path.join('.')
    ));
  }

  const validated = validation.data;
  // ... apply updates
}
```

**Files to Update:**
- `src/services/itinerary-collection.service.ts` (`updateMetadata`)
- `src/services/segment.service.ts` (`add`, `update`)

**Keep These Service Validations:**
- Segment within itinerary date range (business rule not in schema)
- Duplicate ID checks (business rule)
- Dependency cycle validation (complex business rule)

#### 5. Create Update Schemas

**Problem:** No dedicated schemas for update operations.

**Solution:**
```typescript
// ✅ Already exists for itinerary
export const itineraryUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  // ... all fields optional
});

// ❌ MISSING: Segment update schema
export const segmentUpdateSchema = z.object({
  status: segmentStatusSchema.optional(),
  startDatetime: dateSchema.optional(),
  endDatetime: dateSchema.optional(),
  notes: z.string().optional(),
  // ... type-specific fields
}).refine((data) => {
  // Only validate if both datetimes provided
  if (data.startDatetime && data.endDatetime) {
    return data.endDatetime > data.startDatetime;
  }
  return true;
});
```

**Files to Update:**
- `src/domain/schemas/segment.schema.ts` (add update schemas)

#### 6. Add Client-Side Validation

**Problem:** All validation happens server-side, causing poor UX.

**Solution:**
```svelte
<!-- ✅ Add client-side validation in components -->
<script lang="ts">
  import { itineraryCreateSchema } from '$domain/schemas';

  let formData = { title: '', description: '' };
  let errors: Record<string, string> = {};

  function validateForm() {
    const result = itineraryCreateSchema.safeParse(formData);
    if (!result.success) {
      errors = result.error.errors.reduce((acc, err) => ({
        ...acc,
        [err.path[0]]: err.message,
      }), {});
      return false;
    }
    errors = {};
    return true;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    // Submit to API
  }
</script>
```

**Benefits:**
- Immediate feedback without server round-trip
- Consistent error messages (same as server)
- Better UX

**Files to Update:**
- `viewer-svelte/src/lib/components/EditItineraryModal.svelte`
- `viewer-svelte/src/lib/components/ImportModal.svelte`
- Any form components

### 5.3 Nice to Have (Low Priority)

#### 7. Convert Tool Definitions to Zod

**Problem:** Tool definitions use JSON Schema instead of Zod.

**Solution:**
```typescript
// Define tool argument schemas with Zod
export const addFlightToolArgsSchema = z.object({
  airline: companySchema,
  flightNumber: z.string().regex(/^[A-Z0-9]{2,3}\d{1,4}$/),
  origin: locationSchema,
  destination: locationSchema,
  departureTime: dateSchema,
  arrivalTime: dateSchema,
  cabinClass: cabinClassSchema.optional(),
  price: moneyInputSchema.optional(),
});

// Generate JSON Schema from Zod for OpenRouter
import { zodToJsonSchema } from 'zod-to-json-schema';

export const ADD_FLIGHT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_flight',
    description: 'Add a flight segment...',
    parameters: zodToJsonSchema(addFlightToolArgsSchema),
  },
};
```

**Benefits:**
- Single source of truth for validation
- Zod schemas can be used for runtime validation
- Automatic JSON Schema generation

**Files to Update:**
- `src/services/trip-designer/tools.ts`
- Add dependency: `zod-to-json-schema`

#### 8. Add Integration Tests for Validation

**Problem:** No tests verifying validation consistency across layers.

**Solution:**
```typescript
// Test validation at all layers
describe('Itinerary Validation Integration', () => {
  it('should reject invalid itinerary at API layer', async () => {
    const response = await fetch('/api/v1/itineraries', {
      method: 'POST',
      body: JSON.stringify({ title: '' }), // Too short
    });
    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.message).toContain('Title is required');
  });

  it('should reject invalid dates at service layer', async () => {
    const result = await collectionService.createItinerary({
      title: 'Test',
      startDate: new Date('2025-12-25'),
      endDate: new Date('2025-12-20'), // Before start
    });
    expect(result.success).toBe(false);
    expect(result.error.message).toContain('End date must be on or after start date');
  });
});
```

**Files to Create:**
- `tests/integration/validation-consistency.test.ts`

---

## 6. Validation Architecture Recommendations

### 6.1 Proposed Validation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  - Optional client-side validation (immediate feedback)         │
│  - Same Zod schemas as server (shared via import)               │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                 │
│  ✅ Zod schema validation (itineraryCreateSchema, etc.)         │
│  ✅ Authentication/authorization checks                          │
│  ✅ Standardized date parsing (dateSchema)                      │
│  ❌ NO manual field validation                                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                              │
│  ✅ Business rule validation (not in schemas)                   │
│    - Segment within itinerary dates                             │
│    - No duplicate IDs                                            │
│    - Dependency cycles                                           │
│  ❌ NO schema validation (already done at API)                  │
│  ❌ NO duplicate checks (endDate >= startDate)                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       STORAGE LAYER                              │
│  - Data persistence only                                         │
│  - No validation (trust service layer)                           │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Validation Responsibility Matrix

| Validation Type | Schema | API | Service | Storage |
|----------------|--------|-----|---------|---------|
| **Field presence** | ✅ | ✅ (via schema) | ❌ | ❌ |
| **Field types** | ✅ | ✅ (via schema) | ❌ | ❌ |
| **Field formats** (email, URL) | ✅ | ✅ (via schema) | ❌ | ❌ |
| **Field ranges** (min/max) | ✅ | ✅ (via schema) | ❌ | ❌ |
| **Simple constraints** (end >= start) | ✅ | ✅ (via schema) | ❌ | ❌ |
| **Cross-entity rules** (segment in itinerary) | ❌ | ❌ | ✅ | ❌ |
| **Uniqueness** (duplicate IDs) | ❌ | ❌ | ✅ | ❌ |
| **Dependencies** (circular deps) | ❌ | ❌ | ✅ | ❌ |
| **Authorization** (user owns resource) | ❌ | ✅ | ❌ | ❌ |

### 6.3 Schema Organization

```
src/domain/schemas/
├── common.schema.ts           # Primitives, enums, IDs
├── location.schema.ts         # Location, address, coordinates
├── money.schema.ts            # Money, currency
├── traveler.schema.ts         # Traveler, preferences
├── segment.schema.ts          # All segment types + discriminated union
├── itinerary.schema.ts        # Itinerary (full, create, update)
└── index.ts                   # Re-exports

src/domain/schemas/tools/      # NEW: Tool argument schemas
├── flight-tool.schema.ts      # add_flight arguments
├── hotel-tool.schema.ts       # add_hotel arguments
├── activity-tool.schema.ts    # add_activity arguments
└── index.ts
```

---

## 7. Implementation Plan

### Phase 1: Critical Fixes (Week 1)

**Priority:** Security and data integrity

1. ✅ Add schema validation to all API routes
   - `POST /api/v1/itineraries` - use `itineraryCreateSchema`
   - `PATCH /api/v1/itineraries/:id` - use `itineraryUpdateSchema`
   - `POST /api/v1/itineraries/:id/segments` - use `segmentSchema`
   - `PATCH /api/v1/itineraries/:id/segments/:id` - use `segmentUpdateSchema` (create it)

2. ✅ Standardize date parsing across all layers
   - Decide: Use `parseLocalDate()` everywhere or fix `z.coerce.date()`
   - Update all API routes to use chosen method
   - Document timezone handling strategy

3. ✅ Add schema validation to tool executor
   - Create tool argument schemas in `src/domain/schemas/tools/`
   - Validate arguments in each `handle*` method
   - Remove `any` types

### Phase 2: Remove Duplicates (Week 2)

**Priority:** Code maintainability

1. ✅ Remove duplicate validation from service layer
   - `itinerary-collection.service.ts` - remove date order check
   - `segment.service.ts` - remove start < end check
   - Keep business rules (segment in range, no duplicate IDs)

2. ✅ Create missing schemas
   - `segmentUpdateSchema` for partial segment updates
   - Update schemas with any missing validations

3. ✅ Add validation tests
   - Unit tests for each schema
   - Integration tests for validation consistency
   - Test date parsing edge cases

### Phase 3: Client Validation (Week 3)

**Priority:** User experience

1. ✅ Add client-side validation to forms
   - Import Zod schemas in Svelte components
   - Validate on input/blur for immediate feedback
   - Show errors inline

2. ✅ Add date picker validation
   - Prevent selecting invalid dates (past, end before start)
   - Use same validation logic as server

### Phase 4: Tool Schema Migration (Week 4)

**Priority:** Consistency (optional)

1. ⚠️ Convert tool definitions to Zod
   - Define Zod schemas for tool arguments
   - Use `zod-to-json-schema` to generate JSON Schema
   - Update tool definitions

2. ✅ Add tool validation tests
   - Test tool argument validation
   - Test invalid LLM responses

---

## 8. Risk Assessment

### High Risk Issues

| Issue | Risk | Impact | Mitigation |
|-------|------|--------|------------|
| **No API validation** | 🔴 High | Invalid data in database, crashes | Add schema validation (Phase 1) |
| **Unsafe date parsing** | 🔴 High | Date rollover bugs, wrong dates | Standardize parsing (Phase 1) |
| **No tool validation** | 🟡 Medium | Invalid segments from LLM | Add validation (Phase 1) |

### Medium Risk Issues

| Issue | Risk | Impact | Mitigation |
|-------|------|--------|------------|
| **Duplicate validation** | 🟡 Medium | Bugs if rules diverge | Remove duplicates (Phase 2) |
| **No client validation** | 🟡 Medium | Poor UX, wasted requests | Add client validation (Phase 3) |

### Low Risk Issues

| Issue | Risk | Impact | Mitigation |
|-------|------|--------|------------|
| **JSON Schema tools** | 🟢 Low | Inconsistency, harder maintenance | Convert to Zod (Phase 4) |

---

## 9. Appendix: Code Examples

### Example 1: API Route with Proper Validation

```typescript
// ✅ RECOMMENDED: viewer-svelte/src/routes/api/v1/itineraries/+server.ts
import { json, error } from '@sveltejs/kit';
import { itineraryCreateSchema } from '$domain/schemas';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const { collectionService } = locals.services;
  const { userEmail } = locals;

  if (!userEmail) {
    throw error(401, { message: 'Authentication required' });
  }

  // Parse and validate request body
  const body = await request.json();
  const validation = itineraryCreateSchema.safeParse(body);

  if (!validation.success) {
    throw error(400, {
      message: 'Invalid itinerary data',
      errors: validation.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // Create itinerary with validated data
  const result = await collectionService.createItinerary({
    ...validation.data,
    createdBy: userEmail,
  });

  if (!result.success) {
    throw error(500, {
      message: 'Failed to create itinerary: ' + result.error.message,
    });
  }

  return json(result.value, { status: 201 });
};
```

### Example 2: Service Without Duplicate Validation

```typescript
// ✅ RECOMMENDED: src/services/itinerary-collection.service.ts
async updateMetadata(id: ItineraryId, updates: unknown) {
  // Validate updates with schema
  const validation = itineraryUpdateSchema.safeParse(updates);
  if (!validation.success) {
    return err(createValidationError(
      'INVALID_DATA',
      validation.error.message,
      validation.error.errors[0]?.path.join('.')
    ));
  }

  // Load existing itinerary
  const loadResult = await this.storage.load(id);
  if (!loadResult.success) {
    return loadResult;
  }

  const existing = loadResult.value;

  // Apply validated updates
  const updated: Itinerary = {
    ...existing,
    ...validation.data,
    version: existing.version + 1,
    updatedAt: new Date(),
  };

  // NO manual validation - schema already validated everything!

  // Save updated itinerary
  return this.storage.save(updated);
}
```

### Example 3: Tool Handler with Validation

```typescript
// ✅ RECOMMENDED: src/services/trip-designer/tool-executor.ts
import { addFlightArgsSchema } from '../../domain/schemas/tools';

private async handleAddFlight(
  itineraryId: ItineraryId,
  args: unknown
): Promise<unknown> {
  // Validate arguments with schema
  const validation = addFlightArgsSchema.safeParse(args);
  if (!validation.success) {
    throw new Error(
      `Invalid flight arguments: ${validation.error.message}`
    );
  }

  const flightArgs = validation.data;

  // Create flight segment
  const segment: FlightSegment = {
    id: generateSegmentId(),
    type: SegmentType.FLIGHT,
    status: SegmentStatus.TENTATIVE,
    startDatetime: flightArgs.departureTime,
    endDatetime: flightArgs.arrivalTime,
    airline: flightArgs.airline,
    flightNumber: flightArgs.flightNumber,
    origin: flightArgs.origin,
    destination: flightArgs.destination,
    cabinClass: flightArgs.cabinClass,
    price: flightArgs.price,
    confirmationNumber: flightArgs.confirmationNumber,
    notes: flightArgs.notes,
    travelerIds: [],
    source: 'agent',
    sourceDetails: {
      mode: 'chat',
      timestamp: new Date(),
    },
    metadata: {},
  };

  // Add to itinerary
  const result = await this.deps.segmentService?.add(itineraryId, segment);
  if (!result?.success) {
    throw new Error(`Failed to add flight: ${result?.error.message}`);
  }

  return { success: true, segmentId: segment.id };
}
```

---

## Conclusion

The Itinerator application has a **solid foundation** with well-designed Zod schemas, but suffers from **inconsistent application** of validation across layers. The most critical issues are:

1. **API routes bypass schemas** - Creates security and data integrity risks
2. **Date parsing inconsistencies** - Causes timezone rollover bugs
3. **Duplicate validation logic** - Maintenance burden and bug potential

Implementing the **Phase 1 recommendations** (schema validation in API routes, standardized date parsing, tool validation) will address the highest-risk issues and establish a consistent validation architecture.

The proposed validation architecture follows the **"validate early, validate once"** principle:
- Schemas define all validation rules
- API layer validates using schemas
- Service layer enforces business rules not expressible in schemas
- Storage layer trusts validated data

This approach eliminates duplication, ensures consistency, and provides a single source of truth for all business rules.

---

**Research completed:** 2025-12-24
**Tools used:** mcp-vector-search, Grep, Read, Glob
**Files analyzed:** 25+ files across domain, services, API routes, and Trip Designer
