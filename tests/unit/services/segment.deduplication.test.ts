/**
 * Tests for segment deduplication logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SegmentService } from '../../../src/services/segment.service.js';
import { JsonItineraryStorage } from '../../../src/storage/json-storage.js';
import { createItineraryId, createTravelerId } from '../../../src/domain/types/branded.js';
import { SegmentStatus, SegmentType } from '../../../src/domain/types/common.js';
import type { Itinerary } from '../../../src/domain/types/itinerary.js';
import type { ActivitySegment, FlightSegment, HotelSegment, TransferSegment } from '../../../src/domain/types/segment.js';

describe('SegmentService - Deduplication', () => {
  let testItinerary: Itinerary;

  beforeEach(() => {
    // Create a test itinerary
    testItinerary = {
      id: createItineraryId(randomUUID()),
      version: 1,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      title: 'Test Trip',
      status: 'DRAFT',
      startDate: new Date('2025-01-10'),
      endDate: new Date('2025-01-16'), // Extended to allow segments ending on 01-15
      destinations: [],
      travelers: [],
      segments: [],
      tags: [],
      metadata: {},
    };
  });

  describe('Activity Segment Deduplication', () => {
    it('should prevent adding duplicate restaurant on same date', async () => {
      const activity1: Omit<ActivitySegment, 'id'> = {
        type: SegmentType.ACTIVITY,
        status: SegmentStatus.CONFIRMED,
        name: 'La Villa Restaurant',
        startDatetime: new Date('2025-01-10T19:00:00Z'),
        endDatetime: new Date('2025-01-10T21:00:00Z'),
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        location: {
          name: 'La Villa',
        },
        metadata: {},
      };

      const storage = new JsonItineraryStorage(':memory:');
      await storage.save(testItinerary);
      const segService = new SegmentService(storage);

      const result1 = await segService.add(testItinerary.id, activity1);
      expect(result1.success).toBe(true);

      // Try to add duplicate
      const activity2: Omit<ActivitySegment, 'id'> = {
        ...activity1,
        name: 'La Villa Restaurant', // Same name
        startDatetime: new Date('2025-01-10T19:30:00Z'), // Same date, slightly different time
      };

      const result2 = await segService.add(testItinerary.id, activity2);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.message).toContain('Duplicate detected');
        expect(result2.error.message).toContain('La Villa Restaurant');
        expect(result2.error.message).toContain('January 10');
      }
    });

    it('should allow same restaurant on different dates', async () => {
      const activity1: Omit<ActivitySegment, 'id'> = {
        type: SegmentType.ACTIVITY,
        status: SegmentStatus.CONFIRMED,
        name: 'La Villa Restaurant',
        startDatetime: new Date('2025-01-10T19:00:00Z'),
        endDatetime: new Date('2025-01-10T21:00:00Z'),
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        location: {
          name: 'La Villa',
        },
        metadata: {},
      };

      const storage = new JsonItineraryStorage(':memory:');
      await storage.save(testItinerary);
      const segService = new SegmentService(storage);

      const result1 = await segService.add(testItinerary.id, activity1);
      expect(result1.success).toBe(true);

      // Add same restaurant on different date
      const activity2: Omit<ActivitySegment, 'id'> = {
        ...activity1,
        startDatetime: new Date('2025-01-11T19:00:00Z'), // Different date
        endDatetime: new Date('2025-01-11T21:00:00Z'),
      };

      const result2 = await segService.add(testItinerary.id, activity2);
      expect(result2.success).toBe(true);
    });

    it('should normalize restaurant names for comparison', async () => {
      const activity1: Omit<ActivitySegment, 'id'> = {
        type: SegmentType.ACTIVITY,
        status: SegmentStatus.CONFIRMED,
        name: 'La Villa',
        startDatetime: new Date('2025-01-10T19:00:00Z'),
        endDatetime: new Date('2025-01-10T21:00:00Z'),
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        location: {
          name: 'La Villa',
        },
        metadata: {},
      };

      const storage = new JsonItineraryStorage(':memory:');
      await storage.save(testItinerary);
      const segService = new SegmentService(storage);

      const result1 = await segService.add(testItinerary.id, activity1);
      expect(result1.success).toBe(true);

      // Try with different formatting (spaces, punctuation)
      const activity2: Omit<ActivitySegment, 'id'> = {
        ...activity1,
        name: '  LA-VILLA!  ', // Different formatting
      };

      const result2 = await segService.add(testItinerary.id, activity2);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.message).toContain('Duplicate detected');
      }
    });
  });

  describe('Hotel Segment Deduplication', () => {
    it('should prevent adding duplicate hotel with overlapping dates', async () => {
      const hotel1: Omit<HotelSegment, 'id'> = {
        type: SegmentType.HOTEL,
        status: SegmentStatus.CONFIRMED,
        property: {
          name: 'Grand Hotel',
        },
        location: {
          name: 'Grand Hotel',
        },
        checkInDate: new Date('2025-01-10'),
        checkOutDate: new Date('2025-01-12'),
        startDatetime: new Date('2025-01-10T15:00:00Z'),
        endDatetime: new Date('2025-01-12T11:00:00Z'),
        roomCount: 1,
        amenities: [],
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        metadata: {},
      };

      const storage = new JsonItineraryStorage(':memory:');
      await storage.save(testItinerary);
      const segService = new SegmentService(storage);

      const result1 = await segService.add(testItinerary.id, hotel1);
      expect(result1.success).toBe(true);

      // Try to add overlapping booking
      const hotel2: Omit<HotelSegment, 'id'> = {
        ...hotel1,
        checkInDate: new Date('2025-01-11'), // Overlaps with first booking
        checkOutDate: new Date('2025-01-13'),
        startDatetime: new Date('2025-01-11T15:00:00Z'),
        endDatetime: new Date('2025-01-13T11:00:00Z'),
      };

      const result2 = await segService.add(testItinerary.id, hotel2);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.message).toContain('Duplicate detected');
        expect(result2.error.message).toContain('Grand Hotel');
        expect(result2.error.message).toContain('overlapping dates');
      }
    });

    it('should allow same hotel with non-overlapping dates', async () => {
      const hotel1: Omit<HotelSegment, 'id'> = {
        type: SegmentType.HOTEL,
        status: SegmentStatus.CONFIRMED,
        property: {
          name: 'Grand Hotel',
        },
        location: {
          name: 'Grand Hotel',
        },
        checkInDate: new Date('2025-01-10'),
        checkOutDate: new Date('2025-01-12'),
        startDatetime: new Date('2025-01-10T15:00:00Z'),
        endDatetime: new Date('2025-01-12T11:00:00Z'),
        roomCount: 1,
        amenities: [],
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        metadata: {},
      };

      const storage = new JsonItineraryStorage(':memory:');
      await storage.save(testItinerary);
      const segService = new SegmentService(storage);

      const result1 = await segService.add(testItinerary.id, hotel1);
      expect(result1.success).toBe(true);

      // Add same hotel with non-overlapping dates
      const hotel2: Omit<HotelSegment, 'id'> = {
        ...hotel1,
        checkInDate: new Date('2025-01-13'), // Day after checkout
        checkOutDate: new Date('2025-01-15'),
        startDatetime: new Date('2025-01-13T15:00:00Z'),
        endDatetime: new Date('2025-01-15T11:00:00Z'),
      };

      const result2 = await segService.add(testItinerary.id, hotel2);
      expect(result2.success).toBe(true);
    });
  });

  describe('Flight Segment Deduplication', () => {
    it('should prevent adding duplicate flight (same number and date)', async () => {
      const flight1: Omit<FlightSegment, 'id'> = {
        type: SegmentType.FLIGHT,
        status: SegmentStatus.CONFIRMED,
        airline: {
          name: 'United Airlines',
        },
        flightNumber: 'UA123',
        origin: {
          name: 'JFK',
        },
        destination: {
          name: 'LAX',
        },
        startDatetime: new Date('2025-01-10T08:00:00Z'),
        endDatetime: new Date('2025-01-10T11:00:00Z'),
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        metadata: {},
      };

      const storage = new JsonItineraryStorage(':memory:');
      await storage.save(testItinerary);
      const segService = new SegmentService(storage);

      const result1 = await segService.add(testItinerary.id, flight1);
      expect(result1.success).toBe(true);

      // Try to add same flight
      const flight2: Omit<FlightSegment, 'id'> = {
        ...flight1,
      };

      const result2 = await segService.add(testItinerary.id, flight2);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.message).toContain('Duplicate detected');
        expect(result2.error.message).toContain('UA123');
        expect(result2.error.message).toContain('January 10');
      }
    });

    it('should allow same flight number on different dates', async () => {
      const flight1: Omit<FlightSegment, 'id'> = {
        type: SegmentType.FLIGHT,
        status: SegmentStatus.CONFIRMED,
        airline: {
          name: 'United Airlines',
        },
        flightNumber: 'UA123',
        origin: {
          name: 'JFK',
        },
        destination: {
          name: 'LAX',
        },
        startDatetime: new Date('2025-01-10T08:00:00Z'),
        endDatetime: new Date('2025-01-10T11:00:00Z'),
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        metadata: {},
      };

      const storage = new JsonItineraryStorage(':memory:');
      await storage.save(testItinerary);
      const segService = new SegmentService(storage);

      const result1 = await segService.add(testItinerary.id, flight1);
      expect(result1.success).toBe(true);

      // Add same flight number on different date
      const flight2: Omit<FlightSegment, 'id'> = {
        ...flight1,
        startDatetime: new Date('2025-01-11T08:00:00Z'), // Different date
        endDatetime: new Date('2025-01-11T11:00:00Z'),
      };

      const result2 = await segService.add(testItinerary.id, flight2);
      expect(result2.success).toBe(true);
    });
  });

  describe('Transfer Segment Deduplication', () => {
    it('should prevent adding duplicate transfer on same date', async () => {
      const transfer1: Omit<TransferSegment, 'id'> = {
        type: SegmentType.TRANSFER,
        status: SegmentStatus.CONFIRMED,
        transferType: 'PRIVATE',
        pickupLocation: {
          name: 'JFK Airport',
        },
        dropoffLocation: {
          name: 'Grand Hotel',
        },
        startDatetime: new Date('2025-01-10T10:00:00Z'),
        endDatetime: new Date('2025-01-10T11:00:00Z'),
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        metadata: {},
      };

      const storage = new JsonItineraryStorage(':memory:');
      await storage.save(testItinerary);
      const segService = new SegmentService(storage);

      const result1 = await segService.add(testItinerary.id, transfer1);
      expect(result1.success).toBe(true);

      // Try to add duplicate
      const transfer2: Omit<TransferSegment, 'id'> = {
        ...transfer1,
        startDatetime: new Date('2025-01-10T10:30:00Z'), // Same date, slightly different time
        endDatetime: new Date('2025-01-10T11:30:00Z'),
      };

      const result2 = await segService.add(testItinerary.id, transfer2);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.message).toContain('Duplicate detected');
        expect(result2.error.message).toContain('transfer');
      }
    });

    it('should allow same transfer on different dates', async () => {
      const transfer1: Omit<TransferSegment, 'id'> = {
        type: SegmentType.TRANSFER,
        status: SegmentStatus.CONFIRMED,
        transferType: 'PRIVATE',
        pickupLocation: {
          name: 'JFK Airport',
        },
        dropoffLocation: {
          name: 'Grand Hotel',
        },
        startDatetime: new Date('2025-01-10T10:00:00Z'),
        endDatetime: new Date('2025-01-10T11:00:00Z'),
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        metadata: {},
      };

      const storage = new JsonItineraryStorage(':memory:');
      await storage.save(testItinerary);
      const segService = new SegmentService(storage);

      const result1 = await segService.add(testItinerary.id, transfer1);
      expect(result1.success).toBe(true);

      // Add same transfer on different date
      const transfer2: Omit<TransferSegment, 'id'> = {
        ...transfer1,
        startDatetime: new Date('2025-01-11T10:00:00Z'), // Different date
        endDatetime: new Date('2025-01-11T11:00:00Z'),
      };

      const result2 = await segService.add(testItinerary.id, transfer2);
      expect(result2.success).toBe(true);
    });
  });

  describe('Cross-Type Segments', () => {
    it('should allow different segment types with same name/location', async () => {
      const activity: Omit<ActivitySegment, 'id'> = {
        type: SegmentType.ACTIVITY,
        status: SegmentStatus.CONFIRMED,
        name: 'Grand Hotel',
        startDatetime: new Date('2025-01-10T19:00:00Z'),
        endDatetime: new Date('2025-01-10T21:00:00Z'),
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        location: {
          name: 'Grand Hotel',
        },
        metadata: {},
      };

      const hotel: Omit<HotelSegment, 'id'> = {
        type: SegmentType.HOTEL,
        status: SegmentStatus.CONFIRMED,
        property: {
          name: 'Grand Hotel',
        },
        location: {
          name: 'Grand Hotel',
        },
        checkInDate: new Date('2025-01-10'),
        checkOutDate: new Date('2025-01-12'),
        startDatetime: new Date('2025-01-10T15:00:00Z'),
        endDatetime: new Date('2025-01-12T11:00:00Z'),
        roomCount: 1,
        amenities: [],
        travelerIds: [createTravelerId(randomUUID())],
        source: 'agent',
        metadata: {},
      };

      const storage = new JsonItineraryStorage(':memory:');
      await storage.save(testItinerary);
      const segService = new SegmentService(storage);

      const result1 = await segService.add(testItinerary.id, activity);
      expect(result1.success).toBe(true);

      // Should allow hotel even though same name (different type)
      const result2 = await segService.add(testItinerary.id, hotel);
      expect(result2.success).toBe(true);
    });
  });
});
