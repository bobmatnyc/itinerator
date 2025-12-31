/**
 * Itinerary summarizer integration tests
 * Tests the complete flow of preferences capture and session compression
 * @module tests/services/trip-designer/itinerary-summarizer
 */

import { describe, it, expect } from 'vitest';
import { summarizeItinerary, summarizeItineraryMinimal, detectTitleDestinationMismatch } from '../../../src/services/trip-designer/itinerary-summarizer.js';
import type { Itinerary } from '../../../src/domain/types/itinerary.js';
import type { Segment } from '../../../src/domain/types/segment.js';
import { SegmentType, SegmentStatus } from '../../../src/domain/types/common.js';

describe('ItinerarySummarizer', () => {
  // Helper to create a test itinerary with preferences
  function createTestItinerary(overrides?: Partial<Itinerary>): Itinerary {
    const baseItinerary: Itinerary = {
      id: 'test-itin-123' as any,
      version: 1,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      title: 'Portugal Adventure',
      description: '10 day trip to Portugal',
      status: 'DRAFT',
      startDate: new Date('2025-01-03T12:00:00Z'),
      endDate: new Date('2025-01-12T12:00:00Z'),
      destinations: [
        {
          name: 'Lisbon',
          city: 'Lisbon',
          type: 'CITY',
        },
        {
          name: 'Porto',
          city: 'Porto',
          type: 'CITY',
        },
      ],
      travelers: [
        {
          id: 'traveler-1' as any,
          type: 'ADULT',
          firstName: 'John',
          lastName: 'Doe',
          loyaltyPrograms: [],
          specialRequests: [],
          metadata: {},
        },
      ],
      segments: [],
      tags: [],
      metadata: {},
      tripPreferences: {
        travelStyle: 'moderate',
        pace: 'balanced',
        interests: ['food', 'history', 'culture'],
        budgetFlexibility: 3,
        dietaryRestrictions: 'vegetarian',
        mobilityRestrictions: 'none',
        origin: 'New York',
        accommodationPreference: 'boutique',
        activityPreferences: ['museums', 'local experiences', 'food tours'],
        avoidances: ['crowds', 'long walks'],
      },
      ...overrides,
    };
    return baseItinerary;
  }

  // Helper to create test segments
  function createFlightSegment(): Segment {
    return {
      id: 'seg-flight-1' as any,
      type: SegmentType.FLIGHT,
      status: SegmentStatus.CONFIRMED,
      startDatetime: new Date('2025-01-03T09:45:00Z'),
      endDatetime: new Date('2025-01-03T21:30:00Z'),
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'chat',
        timestamp: new Date(),
      },
      airline: {
        name: 'TAP Air Portugal',
        code: 'TP',
      },
      flightNumber: 'TP201',
      origin: {
        name: 'John F. Kennedy International Airport',
        code: 'JFK',
        city: 'New York',
        country: 'USA',
        type: 'AIRPORT',
      },
      destination: {
        name: 'Lisbon Portela Airport',
        code: 'LIS',
        city: 'Lisbon',
        country: 'Portugal',
        type: 'AIRPORT',
      },
      cabinClass: 'ECONOMY',
      price: {
        amount: 850,
        currency: 'USD',
      },
      metadata: {
        route: 'JFK-LIS',
      },
    } as Segment;
  }

  function createHotelSegment(): Segment {
    return {
      id: 'seg-hotel-1' as any,
      type: SegmentType.HOTEL,
      status: SegmentStatus.CONFIRMED,
      startDatetime: new Date('2025-01-03T15:00:00Z'),
      endDatetime: new Date('2025-01-10T11:00:00Z'),
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'chat',
        timestamp: new Date(),
      },
      property: {
        name: 'Hotel da Estrela',
        code: 'HDE',
      },
      location: {
        name: 'Estrela, Lisbon',
        city: 'Lisbon',
        country: 'Portugal',
        type: 'HOTEL',
      },
      checkInDate: new Date('2025-01-03'),
      checkOutDate: new Date('2025-01-10'),
      checkInTime: '15:00',
      checkOutTime: '11:00',
      roomType: 'Superior Double Room',
      roomCount: 1,
      boardBasis: 'BED_BREAKFAST',
      amenities: [],
      price: {
        amount: 1400,
        currency: 'USD',
      },
      metadata: {
        nights: 7,
        name: 'Hotel da Estrela',
      },
    } as Segment;
  }

  function createActivitySegment(): Segment {
    return {
      id: 'seg-activity-1' as any,
      type: SegmentType.ACTIVITY,
      status: SegmentStatus.CONFIRMED,
      startDatetime: new Date('2025-01-04T10:00:00Z'),
      endDatetime: new Date('2025-01-04T13:00:00Z'),
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'chat',
        timestamp: new Date(),
      },
      name: 'Lisbon Food Tour',
      description: 'Guided food tour through historic neighborhoods',
      location: {
        name: 'Alfama District',
        city: 'Lisbon',
        country: 'Portugal',
        type: 'ATTRACTION',
      },
      category: 'food_tour',
      provider: {
        name: 'Taste of Lisboa',
      },
      price: {
        amount: 95,
        currency: 'USD',
      },
      metadata: {
        name: 'Lisbon Food Tour',
      },
    } as Segment;
  }

  describe('summarizeItinerary', () => {
    it('should generate a full summary with all preferences', () => {
      const itinerary = createTestItinerary();
      const summary = summarizeItinerary(itinerary);

      // Check basic trip info
      expect(summary).toContain('Portugal Adventure');
      expect(summary).toContain('Jan 3-12, 2025');
      expect(summary).toContain('9 days'); // Jan 3-12 is 9 days (ceil of time difference)

      // Check travelers
      expect(summary).toContain('John Doe');

      // Check destinations
      expect(summary).toContain('Lisbon, Porto');

      // Check preferences section
      expect(summary).toContain('**Preferences**:');
      expect(summary).toContain('Style: moderate budget, balanced pace');
      expect(summary).toContain('Interests: food, history, culture');
      expect(summary).toContain('Traveling from: New York');
      expect(summary).toContain('Diet: vegetarian');
      expect(summary).toContain('Mobility: none');
      expect(summary).toContain('Accommodation: boutique');
      expect(summary).toContain('Budget flexibility: moderate');
    });

    it('should include segment summary', () => {
      const itinerary = createTestItinerary({
        segments: [
          createFlightSegment(),
          createHotelSegment(),
          createActivitySegment(),
        ],
      });

      const summary = summarizeItinerary(itinerary);

      // Check segment counts
      expect(summary).toContain('**Segments**:');
      expect(summary).toContain('1 flight');
      expect(summary).toContain('1 hotel');
      expect(summary).toContain('1 activity');

      // Check segment details
      expect(summary).toContain('Flight:');
      expect(summary).toContain('JFK-LIS');
      expect(summary).toContain('Hotel:');
      expect(summary).toContain('7 nights');
      expect(summary).toContain('Activity:');
      expect(summary).toContain('Lisbon Food Tour');
    });

    it('should include budget if available', () => {
      const itinerary = createTestItinerary({
        totalPrice: {
          amount: 3500,
          currency: 'USD',
        },
      });

      const summary = summarizeItinerary(itinerary);

      expect(summary).toContain('**Budget**: 3500 USD');
    });

    it('should handle missing preferences gracefully', () => {
      const itinerary = createTestItinerary({
        tripPreferences: undefined,
      });

      const summary = summarizeItinerary(itinerary);

      // Should still have basic info
      expect(summary).toContain('Portugal Adventure');
      expect(summary).toContain('Jan 3-12, 2025');

      // Should not have preferences section
      expect(summary).not.toContain('**Preferences**:');
    });

    it('should handle partial preferences', () => {
      const itinerary = createTestItinerary({
        tripPreferences: {
          travelStyle: 'luxury',
          interests: ['art', 'architecture'],
        },
      });

      const summary = summarizeItinerary(itinerary);

      expect(summary).toContain('Style: luxury budget');
      expect(summary).toContain('Interests: art, architecture');
      expect(summary).not.toContain('Mobility:');
      expect(summary).not.toContain('Diet:');
    });
  });

  describe('summarizeItineraryMinimal', () => {
    it('should generate a compact one-line summary', () => {
      const itinerary = createTestItinerary();
      const summary = summarizeItineraryMinimal(itinerary);

      // Check format: "Title (Dates) | Destinations: X, Y | segments"
      expect(summary).toContain('Portugal Adventure');
      expect(summary).toContain('Jan 3-12, 2025');
      expect(summary).toContain('Destinations: Lisbon, Porto');
    });

    it('should include segment counts in minimal format', () => {
      const itinerary = createTestItinerary({
        segments: [
          createFlightSegment(),
          createHotelSegment(),
          createActivitySegment(),
        ],
      });

      const summary = summarizeItineraryMinimal(itinerary);

      expect(summary).toContain('1 flight, 1 hotel, 1 activity');
    });

    it('should use pipe separators', () => {
      const itinerary = createTestItinerary({
        segments: [createFlightSegment()],
      });

      const summary = summarizeItineraryMinimal(itinerary);

      // Should have pipe separators
      const pipeCount = (summary.match(/\|/g) || []).length;
      expect(pipeCount).toBeGreaterThanOrEqual(2);
    });

    it('should be significantly shorter than full summary', () => {
      const itinerary = createTestItinerary({
        segments: [
          createFlightSegment(),
          createHotelSegment(),
          createActivitySegment(),
        ],
      });

      const fullSummary = summarizeItinerary(itinerary);
      const minimalSummary = summarizeItineraryMinimal(itinerary);

      // Minimal should be much shorter
      expect(minimalSummary.length).toBeLessThan(fullSummary.length / 3);
    });
  });

  describe('preferences integration', () => {
    it('should preserve all preference fields in full summary', () => {
      const itinerary = createTestItinerary({
        tripPreferences: {
          travelStyle: 'luxury',
          pace: 'leisurely',
          interests: ['food', 'wine', 'spas'],
          budgetFlexibility: 5,
          dietaryRestrictions: 'gluten-free',
          mobilityRestrictions: 'wheelchair accessible',
          origin: 'San Francisco',
          accommodationPreference: 'resort',
          activityPreferences: ['wine tasting', 'spa treatments'],
          avoidances: ['early mornings', 'group tours'],
        },
      });

      const summary = summarizeItinerary(itinerary);

      expect(summary).toContain('luxury budget, leisurely pace');
      expect(summary).toContain('food, wine, spas');
      expect(summary).toContain('very flexible');
      expect(summary).toContain('gluten-free');
      expect(summary).toContain('wheelchair accessible');
      expect(summary).toContain('San Francisco');
      expect(summary).toContain('resort');
    });

    it('should format budget flexibility correctly', () => {
      const testCases = [
        { value: 1, expected: 'very strict' },
        { value: 2, expected: 'strict' },
        { value: 3, expected: 'moderate' },
        { value: 4, expected: 'flexible' },
        { value: 5, expected: 'very flexible' },
      ];

      for (const { value, expected } of testCases) {
        const itinerary = createTestItinerary({
          tripPreferences: {
            budgetFlexibility: value,
          },
        });

        const summary = summarizeItinerary(itinerary);
        expect(summary).toContain(`Budget flexibility: ${expected}`);
      }
    });
  });

  describe('session compression context', () => {
    it('should provide context for compaction with preferences', () => {
      const itinerary = createTestItinerary({
        segments: [
          createFlightSegment(),
          createHotelSegment(),
          createActivitySegment(),
        ],
      });

      // Simulate what gets passed to compaction
      const minimalSummary = summarizeItineraryMinimal(itinerary);

      // Minimal summary should contain essential trip context
      expect(minimalSummary).toContain('Portugal Adventure');
      expect(minimalSummary).toContain('Lisbon, Porto');
      expect(minimalSummary).toContain('flight');
      expect(minimalSummary).toContain('hotel');
      expect(minimalSummary).toContain('activity');

      // Full summary should be injected into system prompt with preferences
      const fullSummary = summarizeItinerary(itinerary);
      expect(fullSummary).toContain('moderate budget, balanced pace');
      expect(fullSummary).toContain('vegetarian');
      expect(fullSummary).toContain('New York');
    });

    it('should support compaction system prompt format', () => {
      const itinerary = createTestItinerary({
        segments: [createFlightSegment()],
      });

      const minimalSummary = summarizeItineraryMinimal(itinerary);

      // Should be suitable for insertion into prompt
      expect(minimalSummary).not.toContain('\n');
      expect(minimalSummary).not.toContain('**');
      expect(minimalSummary.length).toBeLessThan(300);
    });
  });

  describe('edge cases', () => {
    it('should handle empty segments array', () => {
      const itinerary = createTestItinerary({
        segments: [],
      });

      const summary = summarizeItinerary(itinerary);
      expect(summary).toBeDefined();
      expect(summary).toContain('Portugal Adventure');
    });

    it('should handle no travelers', () => {
      const itinerary = createTestItinerary({
        travelers: [],
      });

      const summary = summarizeItinerary(itinerary);
      expect(summary).toContain('**Travelers**: Not specified');
    });

    it('should handle many segments with truncation', () => {
      const segments = Array.from({ length: 20 }, (_, i) =>
        i % 3 === 0
          ? createFlightSegment()
          : i % 3 === 1
            ? createHotelSegment()
            : createActivitySegment()
      );

      const itinerary = createTestItinerary({ segments });

      const summary = summarizeItinerary(itinerary);

      // Should show first 8 segments and indicate more
      expect(summary).toContain('and 12 more segments');
      expect(summary).toContain('20 total');
    });

    it('should handle date ranges in same month', () => {
      const itinerary = createTestItinerary({
        startDate: new Date('2025-03-10T12:00:00Z'),
        endDate: new Date('2025-03-15T12:00:00Z'),
      });

      const summary = summarizeItinerary(itinerary);

      // Should abbreviate when same month
      expect(summary).toContain('Mar 10-15, 2025');
    });

    it('should handle date ranges across months', () => {
      const itinerary = createTestItinerary({
        startDate: new Date('2025-03-28T12:00:00Z'),
        endDate: new Date('2025-04-05T12:00:00Z'),
      });

      const summary = summarizeItinerary(itinerary);

      // Should show full dates when different months
      expect(summary).toContain('Mar 28');
      expect(summary).toContain('Apr 5');
    });
  });

  describe('detectTitleDestinationMismatch', () => {
    it('should detect when title mentions origin instead of destination (round trip)', () => {
      // Create itinerary with title mentioning origin (New York)
      // but flights going to St. Maarten
      const itinerary = createTestItinerary({
        title: 'New York Winter Getaway',
        description: 'Winter trip to New York City',
        segments: [
          {
            id: 'seg-flight-1' as any,
            type: SegmentType.FLIGHT,
            status: SegmentStatus.CONFIRMED,
            startDatetime: new Date('2025-01-10T08:00:00Z'),
            endDatetime: new Date('2025-01-10T14:00:00Z'),
            travelerIds: [],
            source: 'import',
            airline: { name: 'JetBlue', code: 'B6' },
            flightNumber: 'B6123',
            origin: {
              name: 'John F. Kennedy International Airport',
              code: 'JFK',
              city: 'New York',
              country: 'USA',
              type: 'AIRPORT',
            },
            destination: {
              name: 'Princess Juliana International Airport',
              code: 'SXM',
              city: 'St. Maarten',
              country: 'Sint Maarten',
              type: 'AIRPORT',
            },
            metadata: {},
          } as Segment,
          {
            id: 'seg-flight-2' as any,
            type: SegmentType.FLIGHT,
            status: SegmentStatus.CONFIRMED,
            startDatetime: new Date('2025-01-17T15:00:00Z'),
            endDatetime: new Date('2025-01-17T19:00:00Z'),
            travelerIds: [],
            source: 'import',
            airline: { name: 'JetBlue', code: 'B6' },
            flightNumber: 'B6124',
            origin: {
              name: 'Princess Juliana International Airport',
              code: 'SXM',
              city: 'St. Maarten',
              country: 'Sint Maarten',
              type: 'AIRPORT',
            },
            destination: {
              name: 'John F. Kennedy International Airport',
              code: 'JFK',
              city: 'New York',
              country: 'USA',
              type: 'AIRPORT',
            },
            metadata: {},
          } as Segment,
        ],
      });

      const mismatch = detectTitleDestinationMismatch(itinerary);

      expect(mismatch).not.toBeNull();
      expect(mismatch!.hasMismatch).toBe(true);
      expect(mismatch!.titleMentions).toBe('New York');
      expect(mismatch!.actualDestination).toBe('St. Maarten');
      expect(mismatch!.suggestedTitle).toContain('St. Maarten');
      expect(mismatch!.suggestedTitle).toContain('Winter Getaway');
      expect(mismatch!.explanation).toContain('departure city');
    });

    it('should NOT detect mismatch when title correctly mentions destination', () => {
      const itinerary = createTestItinerary({
        title: 'St. Maarten Beach Vacation',
        segments: [
          {
            id: 'seg-flight-1' as any,
            type: SegmentType.FLIGHT,
            status: SegmentStatus.CONFIRMED,
            startDatetime: new Date('2025-01-10T08:00:00Z'),
            endDatetime: new Date('2025-01-10T14:00:00Z'),
            travelerIds: [],
            source: 'import',
            airline: { name: 'JetBlue', code: 'B6' },
            flightNumber: 'B6123',
            origin: {
              name: 'John F. Kennedy International Airport',
              code: 'JFK',
              city: 'New York',
              country: 'USA',
              type: 'AIRPORT',
            },
            destination: {
              name: 'Princess Juliana International Airport',
              code: 'SXM',
              city: 'St. Maarten',
              country: 'Sint Maarten',
              type: 'AIRPORT',
            },
            metadata: {},
          } as Segment,
        ],
      });

      const mismatch = detectTitleDestinationMismatch(itinerary);

      expect(mismatch).not.toBeNull();
      expect(mismatch!.hasMismatch).toBe(false);
    });

    it('should handle case when no flights exist', () => {
      const itinerary = createTestItinerary({
        title: 'City Tour',
        segments: [createHotelSegment(), createActivitySegment()],
      });

      const mismatch = detectTitleDestinationMismatch(itinerary);

      expect(mismatch).toBeNull(); // Can't detect without flights
    });

    it('should detect mismatch using airport codes', () => {
      const itinerary = createTestItinerary({
        title: 'JFK Weekend Trip', // Mentions origin code
        segments: [
          {
            id: 'seg-flight-1' as any,
            type: SegmentType.FLIGHT,
            status: SegmentStatus.CONFIRMED,
            startDatetime: new Date('2025-01-10T08:00:00Z'),
            endDatetime: new Date('2025-01-10T14:00:00Z'),
            travelerIds: [],
            source: 'import',
            airline: { name: 'JetBlue', code: 'B6' },
            flightNumber: 'B6123',
            origin: {
              name: 'John F. Kennedy International Airport',
              code: 'JFK',
              city: 'New York',
              country: 'USA',
              type: 'AIRPORT',
            },
            destination: {
              name: 'Miami International Airport',
              code: 'MIA',
              city: 'Miami',
              country: 'USA',
              type: 'AIRPORT',
            },
            metadata: {},
          } as Segment,
        ],
      });

      const mismatch = detectTitleDestinationMismatch(itinerary);

      expect(mismatch).not.toBeNull();
      expect(mismatch!.hasMismatch).toBe(true);
      expect(mismatch!.actualDestination).toBe('Miami');
    });

    it('should generate appropriate suggested titles', () => {
      const itinerary = createTestItinerary({
        title: 'New York Summer Adventure',
        segments: [
          {
            id: 'seg-flight-1' as any,
            type: SegmentType.FLIGHT,
            status: SegmentStatus.CONFIRMED,
            startDatetime: new Date('2025-01-10T08:00:00Z'),
            endDatetime: new Date('2025-01-10T14:00:00Z'),
            travelerIds: [],
            source: 'import',
            airline: { name: 'Delta', code: 'DL' },
            flightNumber: 'DL100',
            origin: {
              code: 'JFK',
              city: 'New York',
              type: 'AIRPORT',
            },
            destination: {
              code: 'CDG',
              city: 'Paris',
              type: 'AIRPORT',
            },
            metadata: {},
          } as Segment,
        ],
      });

      const mismatch = detectTitleDestinationMismatch(itinerary);

      expect(mismatch).not.toBeNull();
      expect(mismatch!.hasMismatch).toBe(true);
      expect(mismatch!.suggestedTitle).toBe('Paris Summer Adventure');
    });
  });

  describe('summarizeItinerary with mismatch detection', () => {
    it('should include mismatch warning in summary when detected', () => {
      const itinerary = createTestItinerary({
        title: 'New York Winter Getaway',
        segments: [
          {
            id: 'seg-flight-1' as any,
            type: SegmentType.FLIGHT,
            status: SegmentStatus.CONFIRMED,
            startDatetime: new Date('2025-01-10T08:00:00Z'),
            endDatetime: new Date('2025-01-10T14:00:00Z'),
            travelerIds: [],
            source: 'import',
            airline: { name: 'JetBlue', code: 'B6' },
            flightNumber: 'B6123',
            origin: {
              code: 'JFK',
              city: 'New York',
              type: 'AIRPORT',
            },
            destination: {
              code: 'SXM',
              city: 'St. Maarten',
              type: 'AIRPORT',
            },
            metadata: {},
          } as Segment,
        ],
      });

      const summary = summarizeItinerary(itinerary);

      // Check that mismatch warning appears FIRST
      expect(summary).toContain('⚠️ **TITLE/DESTINATION MISMATCH DETECTED**');
      expect(summary).toContain('Current title: "New York Winter Getaway"');
      expect(summary).toContain('Title mentions: "New York" (departure city)');
      expect(summary).toContain('Actual destination: "St. Maarten"');
      expect(summary).toContain('Suggested title: "St. Maarten Winter Getaway"');
      expect(summary).toContain('**ACTION REQUIRED**');
      expect(summary).toContain('acknowledge this mismatch');

      // Warning should appear before trip details
      const warningIndex = summary.indexOf('⚠️');
      const tripIndex = summary.indexOf('**Trip**:');
      expect(warningIndex).toBeLessThan(tripIndex);
    });

    it('should NOT include mismatch warning when no mismatch exists', () => {
      const itinerary = createTestItinerary({
        title: 'Portugal Adventure',
        segments: [createFlightSegment()],
      });

      const summary = summarizeItinerary(itinerary);

      expect(summary).not.toContain('⚠️ **TITLE/DESTINATION MISMATCH DETECTED**');
      expect(summary).not.toContain('ACTION REQUIRED');
    });
  });
});
