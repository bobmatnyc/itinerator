/**
 * Tests for core validation rules
 * @module domain/rules/core-rules.test
 */

import { describe, it, expect } from 'vitest';
import {
  noFlightOverlapRule,
  noHotelOverlapRule,
  chronologicalOrderRule,
  segmentWithinTripDatesRule,
} from '../../../../src/domain/rules/core-rules.js';
import type { RuleContext } from '../../../../src/domain/rules/itinerary-rules.js';
import { SegmentType } from '../../../../src/domain/types/common.js';
import type { FlightSegment, HotelSegment } from '../../../../src/domain/types/segment.js';
import type { Itinerary } from '../../../../src/domain/types/itinerary.js';
import { generateSegmentId, generateItineraryId, generateTravelerId } from '../../../../src/domain/types/branded.js';

// Helper to create minimal test data
const createFlightSegment = (overrides: Partial<FlightSegment> = {}): FlightSegment => ({
  id: generateSegmentId(),
  type: SegmentType.FLIGHT,
  status: 'CONFIRMED',
  startDatetime: new Date('2024-01-15T10:00:00Z'),
  endDatetime: new Date('2024-01-15T14:00:00Z'),
  travelerIds: [generateTravelerId()],
  source: 'user',
  metadata: {},
  airline: { name: 'Test Airlines', iataCode: 'TA' },
  flightNumber: 'TA123',
  origin: { city: 'New York', country: 'USA', iataCode: 'JFK' },
  destination: { city: 'Los Angeles', country: 'USA', iataCode: 'LAX' },
  ...overrides,
});

const createHotelSegment = (overrides: Partial<HotelSegment> = {}): HotelSegment => ({
  id: generateSegmentId(),
  type: SegmentType.HOTEL,
  status: 'CONFIRMED',
  startDatetime: new Date('2024-01-15T15:00:00Z'),
  endDatetime: new Date('2024-01-17T11:00:00Z'),
  travelerIds: [generateTravelerId()],
  source: 'user',
  metadata: {},
  property: { name: 'Test Hotel' },
  location: { city: 'Los Angeles', country: 'USA' },
  checkInDate: new Date('2024-01-15'),
  checkOutDate: new Date('2024-01-17'),
  roomCount: 1,
  amenities: [],
  ...overrides,
});

const createItinerary = (overrides: Partial<Itinerary> = {}): Itinerary => ({
  id: generateItineraryId(),
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  title: 'Test Trip',
  status: 'PLANNED',
  destinations: [],
  travelers: [],
  segments: [],
  tags: [],
  metadata: {},
  ...overrides,
});

describe('Core Rules', () => {
  describe('noFlightOverlapRule', () => {
    it('should pass when flights do not overlap', () => {
      const flight1 = createFlightSegment({
        startDatetime: new Date('2024-01-15T10:00:00Z'),
        endDatetime: new Date('2024-01-15T14:00:00Z'),
      });

      const flight2 = createFlightSegment({
        startDatetime: new Date('2024-01-15T16:00:00Z'),
        endDatetime: new Date('2024-01-15T20:00:00Z'),
      });

      const context: RuleContext = {
        segment: flight1,
        itinerary: createItinerary(),
        allSegments: [flight1, flight2],
        operation: 'add',
      };

      const result = noFlightOverlapRule.validate(context);
      expect(result.passed).toBe(true);
    });

    it('should fail when flights overlap', () => {
      const flight1 = createFlightSegment({
        startDatetime: new Date('2024-01-15T10:00:00Z'),
        endDatetime: new Date('2024-01-15T14:00:00Z'),
      });

      const flight2 = createFlightSegment({
        startDatetime: new Date('2024-01-15T12:00:00Z'),
        endDatetime: new Date('2024-01-15T16:00:00Z'),
      });

      const context: RuleContext = {
        segment: flight1,
        itinerary: createItinerary(),
        allSegments: [flight1, flight2],
        operation: 'add',
      };

      const result = noFlightOverlapRule.validate(context);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('overlaps');
    });

    it('should fail when flight overlaps with hotel', () => {
      const flight = createFlightSegment({
        startDatetime: new Date('2024-01-15T10:00:00Z'),
        endDatetime: new Date('2024-01-15T14:00:00Z'),
      });

      const hotel = createHotelSegment({
        startDatetime: new Date('2024-01-15T12:00:00Z'),
        endDatetime: new Date('2024-01-16T11:00:00Z'),
      });

      const context: RuleContext = {
        segment: flight,
        itinerary: createItinerary(),
        allSegments: [flight, hotel],
        operation: 'add',
      };

      const result = noFlightOverlapRule.validate(context);
      expect(result.passed).toBe(false);
      expect(result.relatedSegmentIds).toContain(hotel.id);
    });
  });

  describe('noHotelOverlapRule', () => {
    it('should pass when hotels do not overlap', () => {
      const hotel1 = createHotelSegment({
        checkInDate: new Date('2024-01-15'),
        checkOutDate: new Date('2024-01-17'),
      });

      const hotel2 = createHotelSegment({
        checkInDate: new Date('2024-01-17'),
        checkOutDate: new Date('2024-01-19'),
      });

      const context: RuleContext = {
        segment: hotel1,
        itinerary: createItinerary(),
        allSegments: [hotel1, hotel2],
        operation: 'add',
      };

      const result = noHotelOverlapRule.validate(context);
      expect(result.passed).toBe(true);
    });

    it('should fail when hotels overlap', () => {
      const hotel1 = createHotelSegment({
        checkInDate: new Date('2024-01-15'),
        checkOutDate: new Date('2024-01-17'),
      });

      const hotel2 = createHotelSegment({
        checkInDate: new Date('2024-01-16'),
        checkOutDate: new Date('2024-01-18'),
      });

      const context: RuleContext = {
        segment: hotel1,
        itinerary: createItinerary(),
        allSegments: [hotel1, hotel2],
        operation: 'add',
      };

      const result = noHotelOverlapRule.validate(context);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('overlaps');
    });
  });

  describe('chronologicalOrderRule', () => {
    it('should pass when start is before end', () => {
      const segment = createFlightSegment({
        startDatetime: new Date('2024-01-15T10:00:00Z'),
        endDatetime: new Date('2024-01-15T14:00:00Z'),
      });

      const context: RuleContext = {
        segment,
        itinerary: createItinerary(),
        allSegments: [segment],
        operation: 'add',
      };

      const result = chronologicalOrderRule.validate(context);
      expect(result.passed).toBe(true);
    });

    it('should fail when start is after end', () => {
      const segment = createFlightSegment({
        startDatetime: new Date('2024-01-15T14:00:00Z'),
        endDatetime: new Date('2024-01-15T10:00:00Z'),
      });

      const context: RuleContext = {
        segment,
        itinerary: createItinerary(),
        allSegments: [segment],
        operation: 'add',
      };

      const result = chronologicalOrderRule.validate(context);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('start datetime must be before end datetime');
    });
  });

  describe('segmentWithinTripDatesRule', () => {
    it('should pass when segment is within trip dates', () => {
      const segment = createFlightSegment({
        startDatetime: new Date('2024-01-16T10:00:00Z'),
        endDatetime: new Date('2024-01-16T14:00:00Z'),
      });

      const itinerary = createItinerary({
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-20'),
      });

      const context: RuleContext = {
        segment,
        itinerary,
        allSegments: [segment],
        operation: 'add',
      };

      const result = segmentWithinTripDatesRule.validate(context);
      expect(result.passed).toBe(true);
    });

    it('should fail when segment is outside trip dates', () => {
      const segment = createFlightSegment({
        startDatetime: new Date('2024-01-14T10:00:00Z'),
        endDatetime: new Date('2024-01-14T14:00:00Z'),
      });

      const itinerary = createItinerary({
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-20'),
      });

      const context: RuleContext = {
        segment,
        itinerary,
        allSegments: [segment],
        operation: 'add',
      };

      const result = segmentWithinTripDatesRule.validate(context);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('outside the trip date range');
    });

    it('should pass when itinerary has no dates set', () => {
      const segment = createFlightSegment({
        startDatetime: new Date('2024-01-14T10:00:00Z'),
        endDatetime: new Date('2024-01-14T14:00:00Z'),
      });

      const itinerary = createItinerary(); // No dates

      const context: RuleContext = {
        segment,
        itinerary,
        allSegments: [segment],
        operation: 'add',
      };

      const result = segmentWithinTripDatesRule.validate(context);
      expect(result.passed).toBe(true);
    });
  });
});
