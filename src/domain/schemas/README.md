# Domain Schemas

Runtime validation schemas using Zod for the itinerator CLI.

## Overview

This directory contains Zod schemas that provide:
- **Runtime validation**: Validate input data at runtime
- **Type safety**: Infer TypeScript types from schemas
- **Data transformation**: Parse strings to Dates, normalize case, etc.
- **Helpful error messages**: Clear validation errors for users

## Schema Files

### `common.schema.ts`
Primitive schemas and enums:
- `uuidSchema` - UUID v4 validation
- `dateSchema` - Date coercion (accepts string/Date)
- `isoDateSchema` - YYYY-MM-DD format only
- `timeSchema` - HH:mm format
- Branded ID schemas: `itineraryIdSchema`, `segmentIdSchema`, `travelerIdSchema`
- Enum schemas: `itineraryStatusSchema`, `tripTypeSchema`, etc.

### `location.schema.ts`
Location and address schemas:
- `coordinatesSchema` - Lat/lng with range validation
- `addressSchema` - Physical address with ISO country code
- `locationSchema` - Named location with optional address/coordinates
- `companySchema` - Company/provider information

### `money.schema.ts`
Monetary schemas:
- `currencyCodeSchema` - ISO 4217 3-letter currency code
- `moneySchema` - Amount in cents + currency
- `moneyInputSchema` - Accepts decimals, converts to cents

### `traveler.schema.ts`
Traveler schemas:
- `loyaltyProgramSchema` - Airline loyalty programs
- `travelPreferencesSchema` - Seat, meal, hotel preferences
- `travelerSchema` - Complete traveler information
- `travelerInputSchema` - For creating travelers (ID optional)

### `segment.schema.ts`
Segment discriminated union:
- `flightSegmentSchema` - Flight information
- `hotelSegmentSchema` - Hotel bookings
- `meetingSegmentSchema` - Meeting/appointment
- `activitySegmentSchema` - Activities/tours
- `transferSegmentSchema` - Ground transportation
- `customSegmentSchema` - Custom segment types
- `segmentSchema` - Discriminated union of all segment types

### `itinerary.schema.ts`
Itinerary schemas:
- `itinerarySchema` - Complete itinerary with all fields
- `itineraryCreateSchema` - For creating new itineraries
- `itineraryUpdateSchema` - For partial updates

## Usage Examples

### Basic Validation

\`\`\`typescript
import { locationSchema } from './domain/schemas';

// Valid location
const validLocation = locationSchema.parse({
  name: 'San Francisco International Airport',
  code: 'SFO',
  address: {
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
  },
});

// Invalid location (will throw ZodError)
try {
  locationSchema.parse({
    name: '', // Empty name
    code: 'INVALID', // Must be 3 letters
  });
} catch (error) {
  console.error(error.errors); // Detailed validation errors
}
\`\`\`

### Date Transformation

\`\`\`typescript
import { dateSchema } from './domain/schemas';

// Accepts ISO string
const date1 = dateSchema.parse('2025-12-25T10:00:00Z');
console.log(date1); // Date object

// Accepts Date object
const date2 = dateSchema.parse(new Date());
console.log(date2); // Date object
\`\`\`

### Money Handling

\`\`\`typescript
import { moneyInputSchema, moneySchema } from './domain/schemas';

// Input schema converts decimals to cents
const input = moneyInputSchema.parse({
  amount: 10.50, // Dollars
  currency: 'USD',
});
console.log(input); // { amount: 1050, currency: 'USD' }

// Money schema expects cents
const money = moneySchema.parse({
  amount: 1050, // Cents
  currency: 'USD',
});
\`\`\`

### Discriminated Union (Segments)

\`\`\`typescript
import { segmentSchema } from './domain/schemas';

// Parse a flight segment
const flight = segmentSchema.parse({
  type: 'FLIGHT',
  id: '550e8400-e29b-41d4-a716-446655440000',
  status: 'CONFIRMED',
  startDatetime: '2025-12-25T08:00:00Z',
  endDatetime: '2025-12-25T12:00:00Z',
  travelerIds: ['550e8400-e29b-41d4-a716-446655440001'],
  airline: { name: 'United Airlines', code: 'UA' },
  flightNumber: 'UA123',
  origin: { name: 'SFO', code: 'SFO' },
  destination: { name: 'LAX', code: 'LAX' },
});

// TypeScript knows this is a FlightSegment
if (flight.type === 'FLIGHT') {
  console.log(flight.flightNumber); // Type-safe access
}
\`\`\`

### Safe Parsing

\`\`\`typescript
import { itineraryCreateSchema } from './domain/schemas';

// Use safeParse for error handling without exceptions
const result = itineraryCreateSchema.safeParse({
  title: 'Trip to Europe',
  startDate: '2025-06-01',
  endDate: '2025-06-15',
});

if (result.success) {
  console.log('Valid itinerary:', result.data);
} else {
  console.error('Validation errors:', result.error.errors);
}
\`\`\`

### Type Inference

\`\`\`typescript
import { z } from 'zod';
import { travelerSchema } from './domain/schemas';

// Infer TypeScript types from schemas
type Traveler = z.infer<typeof travelerSchema>;

// Or use exported types
import type { TravelerInput, TravelerOutput } from './domain/schemas';

// Input type (before parsing)
const input: TravelerInput = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  type: 'ADULT',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01', // String accepted
};

// Output type (after parsing)
const traveler: TravelerOutput = travelerSchema.parse(input);
console.log(traveler.dateOfBirth); // Date object
\`\`\`

## Validation Features

### Required vs. Optional

\`\`\`typescript
// Required fields will throw errors if missing
locationSchema.parse({}); // Error: name is required

// Optional fields can be omitted
locationSchema.parse({ name: 'Airport' }); // OK
\`\`\`

### Default Values

\`\`\`typescript
// Some fields have defaults
segmentSchema.parse({
  type: 'FLIGHT',
  // ... other required fields ...
  // status defaults to 'TENTATIVE'
  // metadata defaults to {}
});
\`\`\`

### Custom Refinements

\`\`\`typescript
// Schemas validate business rules
hotelSegmentSchema.parse({
  // ... other fields ...
  checkInDate: '2025-12-25',
  checkOutDate: '2025-12-20', // Error: Check-out must be after check-in
});

itinerarySchema.parse({
  // ... other fields ...
  startDate: '2025-12-25',
  endDate: '2025-12-20', // Error: End date must be after start date
});
\`\`\`

### Case Normalization

\`\`\`typescript
// Codes are automatically uppercased
const location = locationSchema.parse({
  name: 'Airport',
  code: 'sfo', // Transformed to 'SFO'
});

const address = addressSchema.parse({
  country: 'us', // Transformed to 'US'
});
\`\`\`

## Error Handling

### Detailed Error Messages

\`\`\`typescript
import { ZodError } from 'zod';

try {
  flightSegmentSchema.parse(invalidData);
} catch (error) {
  if (error instanceof ZodError) {
    error.errors.forEach((err) => {
      console.log(\`\${err.path.join('.')}: \${err.message}\`);
    });
  }
}
\`\`\`

### Format Errors for Users

\`\`\`typescript
import { fromZodError } from 'zod-validation-error'; // Optional package

try {
  schema.parse(data);
} catch (error) {
  if (error instanceof ZodError) {
    const validationError = fromZodError(error);
    console.error(validationError.message);
  }
}
\`\`\`

## Best Practices

1. **Always use schemas at boundaries**: Validate external input (CLI args, file imports, API responses)
2. **Use `safeParse` for user input**: Avoid throwing exceptions for expected validation failures
3. **Use `parse` for developer errors**: Throw exceptions for unexpected invalid data
4. **Leverage type inference**: Let Zod infer types instead of manually defining them
5. **Keep schemas in sync with types**: Schemas are the source of truth for validation

## Testing

\`\`\`typescript
import { describe, it, expect } from 'vitest';
import { locationSchema } from './location.schema';

describe('locationSchema', () => {
  it('should validate a valid location', () => {
    const result = locationSchema.safeParse({
      name: 'Airport',
      code: 'SFO',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid IATA code', () => {
    const result = locationSchema.safeParse({
      name: 'Airport',
      code: 'INVALID', // Must be 3 letters
    });
    expect(result.success).toBe(false);
  });

  it('should uppercase IATA codes', () => {
    const result = locationSchema.parse({
      name: 'Airport',
      code: 'sfo',
    });
    expect(result.code).toBe('SFO');
  });
});
\`\`\`

## Related Documentation

- [Zod Documentation](https://zod.dev)
- [Domain Types](../types/README.md)
- [Error Handling Guide](../../docs/error-handling.md)
