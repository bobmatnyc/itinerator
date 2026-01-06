/**
 * Tests for scratchpad utilities
 */

import { describe, expect, it } from 'vitest';
import { generateItineraryId, generateSegmentId } from '../../../src/domain/types/branded.js';
import { SegmentStatus, SegmentType } from '../../../src/domain/types/common.js';
import type { Itinerary } from '../../../src/domain/types/itinerary.js';
import type { FlightSegment, HotelSegment } from '../../../src/domain/types/segment.js';
import type { ScratchpadItemId } from '../../../src/domain/types/scratchpad.js';
import {
  addToScratchpad,
  countByType,
  createEmptyScratchpad,
  getByPriority,
  getByTag,
  getByType,
  getRelatedItems,
  rebuildByTypeIndex,
  removeFromScratchpad,
  swapSegment,
} from '../../../src/utils/scratchpad.js';

describe('scratchpad utilities', () => {
  // Helper to create a minimal itinerary
  const createTestItinerary = (): Itinerary => ({
    id: generateItineraryId(),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    title: 'Test Trip',
    status: 'DRAFT',
    destinations: [],
    travelers: [],
    segments: [],
    tags: [],
    metadata: {},
  });

  // Helper to create a test flight segment
  const createTestFlight = (): FlightSegment => ({
    id: generateSegmentId(),
    type: SegmentType.FLIGHT,
    status: SegmentStatus.TENTATIVE,
    startDatetime: new Date('2025-06-01T10:00:00Z'),
    endDatetime: new Date('2025-06-01T14:00:00Z'),
    travelerIds: [],
    source: 'agent',
    metadata: {},
  });

  // Helper to create a test hotel segment
  const createTestHotel = (): HotelSegment => ({
    id: generateSegmentId(),
    type: SegmentType.HOTEL,
    status: SegmentStatus.TENTATIVE,
    startDatetime: new Date('2025-06-01T15:00:00Z'),
    endDatetime: new Date('2025-06-03T11:00:00Z'),
    travelerIds: [],
    source: 'agent',
    property: { name: 'Test Hotel' },
    location: { name: 'Paris' },
    checkInDate: new Date('2025-06-01'),
    checkOutDate: new Date('2025-06-03'),
    roomCount: 1,
    amenities: [],
    metadata: {},
  });

  describe('createEmptyScratchpad', () => {
    it('should create an empty scratchpad with correct structure', () => {
      const itineraryId = generateItineraryId();
      const scratchpad = createEmptyScratchpad(itineraryId);

      expect(scratchpad.itineraryId).toBe(itineraryId);
      expect(scratchpad.items).toEqual([]);
      expect(scratchpad.byType.FLIGHT).toEqual([]);
      expect(scratchpad.byType.HOTEL).toEqual([]);
      expect(scratchpad.byType.ACTIVITY).toEqual([]);
      expect(scratchpad.byType.TRANSFER).toEqual([]);
      expect(scratchpad.byType.MEETING).toEqual([]);
      expect(scratchpad.byType.CUSTOM).toEqual([]);
    });
  });

  describe('addToScratchpad', () => {
    it('should add a segment to empty scratchpad', () => {
      const itinerary = createTestItinerary();
      const flight = createTestFlight();

      const updated = addToScratchpad(itinerary, flight, {
        source: 'designer',
        notes: 'Alternative flight option',
        priority: 'high',
        tags: ['backup', 'cheaper'],
      });

      expect(updated.scratchpad).toBeDefined();
      expect(updated.scratchpad!.items).toHaveLength(1);
      expect(updated.scratchpad!.byType.FLIGHT).toHaveLength(1);

      const item = updated.scratchpad!.items[0];
      expect(item.segment).toEqual(flight);
      expect(item.source).toBe('designer');
      expect(item.notes).toBe('Alternative flight option');
      expect(item.priority).toBe('high');
      expect(item.tags).toEqual(['backup', 'cheaper']);
    });

    it('should add multiple segments to scratchpad', () => {
      const itinerary = createTestItinerary();
      const flight = createTestFlight();
      const hotel = createTestHotel();

      let updated = addToScratchpad(itinerary, flight, { source: 'designer' });
      updated = addToScratchpad(updated, hotel, { source: 'agent' });

      expect(updated.scratchpad!.items).toHaveLength(2);
      expect(updated.scratchpad!.byType.FLIGHT).toHaveLength(1);
      expect(updated.scratchpad!.byType.HOTEL).toHaveLength(1);
    });

    it('should update updatedAt timestamp', () => {
      const itinerary = createTestItinerary();
      const originalTime = itinerary.updatedAt;
      const flight = createTestFlight();

      // Small delay to ensure timestamp difference
      const updated = addToScratchpad(itinerary, flight, { source: 'user' });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalTime.getTime());
    });
  });

  describe('removeFromScratchpad', () => {
    it('should remove an item from scratchpad', () => {
      const itinerary = createTestItinerary();
      const flight = createTestFlight();

      const updated = addToScratchpad(itinerary, flight, { source: 'designer' });
      const itemId = updated.scratchpad!.items[0].id;

      const removed = removeFromScratchpad(updated, itemId);

      expect(removed.scratchpad!.items).toHaveLength(0);
      expect(removed.scratchpad!.byType.FLIGHT).toHaveLength(0);
    });

    it('should throw error if scratchpad does not exist', () => {
      const itinerary = createTestItinerary();
      const fakeId = 'fake-id' as ScratchpadItemId;

      expect(() => removeFromScratchpad(itinerary, fakeId)).toThrow(
        'Scratchpad does not exist'
      );
    });

    it('should throw error if item not found', () => {
      const itinerary = createTestItinerary();
      const flight = createTestFlight();
      const updated = addToScratchpad(itinerary, flight, { source: 'designer' });

      const fakeId = 'non-existent-id' as ScratchpadItemId;

      expect(() => removeFromScratchpad(updated, fakeId)).toThrow('not found');
    });
  });

  describe('getByType', () => {
    it('should filter items by segment type', () => {
      const itinerary = createTestItinerary();
      const flight1 = createTestFlight();
      const flight2 = createTestFlight();
      const hotel = createTestHotel();

      let updated = addToScratchpad(itinerary, flight1, { source: 'designer' });
      updated = addToScratchpad(updated, flight2, { source: 'agent' });
      updated = addToScratchpad(updated, hotel, { source: 'user' });

      const flights = getByType(updated.scratchpad, SegmentType.FLIGHT);
      const hotels = getByType(updated.scratchpad, SegmentType.HOTEL);

      expect(flights).toHaveLength(2);
      expect(hotels).toHaveLength(1);
    });

    it('should return empty array if scratchpad undefined', () => {
      const items = getByType(undefined, SegmentType.FLIGHT);
      expect(items).toEqual([]);
    });
  });

  describe('getByTag', () => {
    it('should filter items by tag', () => {
      const itinerary = createTestItinerary();
      const flight1 = createTestFlight();
      const flight2 = createTestFlight();

      let updated = addToScratchpad(itinerary, flight1, {
        source: 'designer',
        tags: ['backup', 'cheaper'],
      });
      updated = addToScratchpad(updated, flight2, {
        source: 'agent',
        tags: ['premium'],
      });

      const backups = getByTag(updated.scratchpad, 'backup');
      const premium = getByTag(updated.scratchpad, 'premium');

      expect(backups).toHaveLength(1);
      expect(premium).toHaveLength(1);
    });
  });

  describe('getByPriority', () => {
    it('should filter items by priority', () => {
      const itinerary = createTestItinerary();
      const flight1 = createTestFlight();
      const flight2 = createTestFlight();

      let updated = addToScratchpad(itinerary, flight1, {
        source: 'designer',
        priority: 'high',
      });
      updated = addToScratchpad(updated, flight2, {
        source: 'agent',
        priority: 'low',
      });

      const highPriority = getByPriority(updated.scratchpad, 'high');
      const lowPriority = getByPriority(updated.scratchpad, 'low');

      expect(highPriority).toHaveLength(1);
      expect(lowPriority).toHaveLength(1);
    });
  });

  describe('getRelatedItems', () => {
    it('should find items related to a segment', () => {
      const itinerary = createTestItinerary();
      const existingSegmentId = generateSegmentId();
      const flight = createTestFlight();

      const updated = addToScratchpad(itinerary, flight, {
        source: 'designer',
        relatedSegmentId: existingSegmentId,
      });

      const related = getRelatedItems(updated.scratchpad, existingSegmentId);

      expect(related).toHaveLength(1);
      expect(related[0].relatedSegmentId).toBe(existingSegmentId);
    });
  });

  describe('swapSegment', () => {
    it('should swap scratchpad item with existing segment', () => {
      const itinerary = createTestItinerary();
      const existingFlight = createTestFlight();
      const alternativeFlight = createTestFlight();

      // Add existing segment to itinerary
      itinerary.segments = [existingFlight];

      // Add alternative to scratchpad
      const withScratchpad = addToScratchpad(itinerary, alternativeFlight, {
        source: 'designer',
      });
      const scratchpadItemId = withScratchpad.scratchpad!.items[0].id;

      // Perform swap
      const { itinerary: updated, result } = swapSegment(
        withScratchpad,
        scratchpadItemId,
        existingFlight.id
      );

      // Check itinerary segments
      expect(updated.segments).toHaveLength(1);
      expect(updated.segments[0]).toEqual(alternativeFlight);

      // Check scratchpad item removed
      expect(updated.scratchpad!.items).toHaveLength(0);
      expect(updated.scratchpad!.byType.FLIGHT).toHaveLength(0);

      // Check swap result
      expect(result.removedSegment).toEqual(existingFlight);
      expect(result.addedSegment).toEqual(alternativeFlight);
    });

    it('should throw error if scratchpad does not exist', () => {
      const itinerary = createTestItinerary();
      const fakeItemId = 'fake-id' as ScratchpadItemId;
      const fakeSegmentId = generateSegmentId();

      expect(() => swapSegment(itinerary, fakeItemId, fakeSegmentId)).toThrow(
        'Scratchpad does not exist'
      );
    });

    it('should throw error if scratchpad item not found', () => {
      const itinerary = createTestItinerary();
      const flight = createTestFlight();
      const updated = addToScratchpad(itinerary, flight, { source: 'designer' });

      const fakeItemId = 'non-existent' as ScratchpadItemId;
      const fakeSegmentId = generateSegmentId();

      expect(() => swapSegment(updated, fakeItemId, fakeSegmentId)).toThrow(
        'Scratchpad item'
      );
    });

    it('should throw error if segment not found in itinerary', () => {
      const itinerary = createTestItinerary();
      const flight = createTestFlight();
      const updated = addToScratchpad(itinerary, flight, { source: 'designer' });
      const itemId = updated.scratchpad!.items[0].id;

      const nonExistentSegmentId = generateSegmentId();

      expect(() => swapSegment(updated, itemId, nonExistentSegmentId)).toThrow(
        'Segment'
      );
    });
  });

  describe('rebuildByTypeIndex', () => {
    it('should rebuild byType index from items', () => {
      const itinerary = createTestItinerary();
      const flight = createTestFlight();
      const hotel = createTestHotel();

      let updated = addToScratchpad(itinerary, flight, { source: 'designer' });
      updated = addToScratchpad(updated, hotel, { source: 'agent' });

      // Manually corrupt byType index
      const corrupted = {
        ...updated.scratchpad!,
        byType: createEmptyScratchpad(itinerary.id).byType,
      };

      // Rebuild
      const rebuilt = rebuildByTypeIndex(corrupted);

      expect(rebuilt.byType.FLIGHT).toHaveLength(1);
      expect(rebuilt.byType.HOTEL).toHaveLength(1);
      expect(rebuilt.byType.ACTIVITY).toHaveLength(0);
    });
  });

  describe('countByType', () => {
    it('should count items by type', () => {
      const itinerary = createTestItinerary();
      const flight1 = createTestFlight();
      const flight2 = createTestFlight();
      const hotel = createTestHotel();

      let updated = addToScratchpad(itinerary, flight1, { source: 'designer' });
      updated = addToScratchpad(updated, flight2, { source: 'agent' });
      updated = addToScratchpad(updated, hotel, { source: 'user' });

      const counts = countByType(updated.scratchpad);

      expect(counts.FLIGHT).toBe(2);
      expect(counts.HOTEL).toBe(1);
      expect(counts.ACTIVITY).toBe(0);
      expect(counts.TRANSFER).toBe(0);
      expect(counts.MEETING).toBe(0);
      expect(counts.CUSTOM).toBe(0);
    });

    it('should return zero counts if scratchpad undefined', () => {
      const counts = countByType(undefined);

      expect(counts.FLIGHT).toBe(0);
      expect(counts.HOTEL).toBe(0);
    });
  });
});
