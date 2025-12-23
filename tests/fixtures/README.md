# Test Fixtures

This directory contains test fixtures for E2E testing, integration testing, and LLM evaluation workflows.

## Directory Structure

```
fixtures/
├── itineraries/     # Sample itinerary data at various stages
│   ├── empty-new.json
│   ├── planning-phase.json
│   ├── partial-segments.json
│   ├── complete-trip.json
│   └── past-trip.json
└── personas/        # User personas for testing different travel scenarios
    ├── solo-traveler.json
    ├── family-vacation.json
    ├── business-trip.json
    └── group-adventure.json
```

## Itinerary Fixtures

### empty-new.json
- **Purpose**: Test creation of brand new itineraries
- **State**: Minimal data - just ID, title, empty segments
- **Use Cases**: 
  - Testing itinerary creation flow
  - Validating schema defaults
  - Testing empty state UI

### planning-phase.json
- **Purpose**: Test itinerary in planning stage
- **State**: Has dates, destinations, travelers, preferences, but NO segments
- **Use Cases**:
  - Testing Trip Designer with basic trip parameters
  - Validating planning workflow
  - Testing date/destination validation

### partial-segments.json
- **Purpose**: Test partially-complete itinerary
- **State**: Has 1 flight, 1 hotel, 2 activities (Tokyo cherry blossom trip)
- **Use Cases**:
  - Testing segment addition/editing
  - Testing mixed segment statuses (CONFIRMED/TENTATIVE)
  - Testing incomplete itinerary scenarios

### complete-trip.json
- **Purpose**: Test fully-planned itinerary
- **State**: Full 2-week Japan trip (Tokyo + Kyoto) with all segments
- **Segments**: 2 flights, 3 transfers, 2 hotels, 8 activities
- **Use Cases**:
  - Testing complete itinerary display
  - Testing timeline/calendar views
  - Testing export/sharing features
  - Performance testing with realistic data

### past-trip.json
- **Purpose**: Test completed historical itinerary
- **State**: Completed Barcelona trip (March 2024) with all segments
- **Status**: All segments marked COMPLETED
- **Use Cases**:
  - Testing read-only completed trip views
  - Testing trip archive/history features
  - Testing "copy itinerary" workflows

## Persona Fixtures

Personas represent different types of travelers with specific preferences, budgets, and travel styles. These are used for:
- Testing Trip Designer prompts
- Evaluating LLM responses for different user types
- Testing personalization features

### solo-traveler.json
- **Name**: Alex Chen
- **Type**: Solo traveler, tech professional
- **Budget**: Flexible (0.8)
- **Interests**: Culture, food, technology, photography
- **Accommodation**: Boutique hotels or nice Airbnb
- **Use Cases**:
  - Testing solo travel recommendations
  - Testing cultural/food-focused itineraries
  - Testing moderate budget scenarios

### family-vacation.json
- **Name**: Sarah Johnson
- **Type**: Family of 4 (2 adults, 2 kids ages 6 & 9)
- **Budget**: Moderate (0.5)
- **Interests**: Family-friendly activities, beaches, nature
- **Accommodation**: Family-friendly hotels or vacation rentals
- **Special Needs**: One child vegetarian
- **Use Cases**:
  - Testing family travel recommendations
  - Testing child-appropriate activities
  - Testing dietary restriction handling

### business-trip.json
- **Name**: Marcus Williams
- **Type**: Business executive
- **Budget**: Premium (1.0)
- **Interests**: Efficiency, networking, premium dining
- **Accommodation**: 5-star business hotels
- **Pace**: Packed, time-efficient
- **Use Cases**:
  - Testing business travel scenarios
  - Testing premium/luxury recommendations
  - Testing time-constrained itineraries

### group-adventure.json
- **Name**: Adventure Friends Group
- **Type**: Group of 6 friends (ages 25-32)
- **Budget**: Budget-conscious (0.3)
- **Interests**: Outdoor adventures, hiking, water sports
- **Accommodation**: Hostels, shared rentals, camping
- **Use Cases**:
  - Testing group travel recommendations
  - Testing adventure/outdoor activities
  - Testing budget travel scenarios

## Usage in Tests

### Unit Tests
```typescript
import emptyItinerary from '../fixtures/itineraries/empty-new.json';

test('should create new itinerary with defaults', () => {
  const itinerary = createItinerary(emptyItinerary);
  expect(itinerary.segments).toHaveLength(0);
});
```

### Integration Tests
```typescript
import completeTrip from '../fixtures/itineraries/complete-trip.json';

test('should export complete itinerary to PDF', async () => {
  const pdf = await exportToPDF(completeTrip);
  expect(pdf).toBeDefined();
});
```

### E2E Tests
```typescript
import soloTraveler from '../fixtures/personas/solo-traveler.json';

test('Trip Designer generates appropriate itinerary for solo traveler', async () => {
  await page.goto('/designer');
  await fillPersonaDetails(soloTraveler);
  const itinerary = await generateItinerary();
  expect(itinerary.tripPreferences.travelStyle).toBe('moderate');
});
```

### LLM Evaluation
```typescript
import businessTraveler from '../fixtures/personas/business-trip.json';

test('LLM suggests premium hotels for business traveler', async () => {
  const response = await tripDesigner.chat({
    persona: businessTraveler,
    prompt: 'Suggest a hotel in Tokyo'
  });
  expect(response.hotels).toContainMatch(/5-star|luxury|premium/i);
});
```

## Maintenance

- **Keep fixtures realistic**: Use actual location coordinates, real airline codes, plausible dates
- **Update for schema changes**: When domain types change, update fixtures accordingly
- **Add new scenarios**: As new features are added, create fixtures that test those features
- **Document test usage**: When adding new fixtures, document their purpose and use cases here

## Validation

All fixtures should validate against their respective schemas:

```bash
# Validate itinerary fixtures
npm run test:fixtures:itineraries

# Validate persona fixtures  
npm run test:fixtures:personas
```
