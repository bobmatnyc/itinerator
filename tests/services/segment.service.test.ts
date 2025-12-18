/**
 * Tests for SegmentService
 */

import { mkdir, rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createItineraryId, generateSegmentId } from '../../src/domain/types/branded.js';
import { SegmentStatus, SegmentType } from '../../src/domain/types/common.js';
import type { Segment } from '../../src/domain/types/segment.js';
import { ItineraryService } from '../../src/services/itinerary.service.js';
import { SegmentService } from '../../src/services/segment.service.js';
import { JsonItineraryStorage } from '../../src/storage/json-storage.js';

describe('SegmentService', () => {
  const testDataDir = './test-data-segment-service';
  let storage: JsonItineraryStorage;
  let itineraryService: ItineraryService;
  let segmentService: SegmentService;

  beforeEach(async () => {
    await rm(testDataDir, { recursive: true, force: true });
    await mkdir(testDataDir, { recursive: true });
    storage = new JsonItineraryStorage(testDataDir);
    await storage.initialize();
    itineraryService = new ItineraryService(storage);
    segmentService = new SegmentService(storage);
  });

  afterEach(async () => {
    await rm(testDataDir, { recursive: true, force: true });
  });

  describe('add', () => {
    it('should add a segment to an itinerary', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const segment: Omit<Segment, 'id'> = {
        type: SegmentType.FLIGHT,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-01T10:00:00Z'),
        endDatetime: new Date('2025-06-01T14:00:00Z'),
        travelerIds: [],
        metadata: {},
        airline: { name: 'Test Airlines', code: 'TA' },
        flightNumber: 'TA123',
        origin: { name: 'JFK Airport', code: 'JFK', type: 'AIRPORT' },
        destination: { name: 'LAX Airport', code: 'LAX', type: 'AIRPORT' },
      };

      const addResult = await segmentService.add(itineraryResult.value.id, segment);

      expect(addResult.success).toBe(true);
      if (!addResult.success) return;

      expect(addResult.value.segments).toHaveLength(1);
      expect(addResult.value.segments[0]?.type).toBe(SegmentType.FLIGHT);
    });

    it('should generate ID if not provided', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const segment: Omit<Segment, 'id'> = {
        type: SegmentType.HOTEL,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-01T15:00:00Z'),
        endDatetime: new Date('2025-06-02T11:00:00Z'),
        travelerIds: [],
        metadata: {},
        property: { name: 'Test Hotel', code: 'TH' },
        location: { name: 'Downtown', type: 'CITY' },
        checkInDate: new Date('2025-06-01'),
        checkOutDate: new Date('2025-06-02'),
        roomCount: 1,
        amenities: [],
      };

      const addResult = await segmentService.add(itineraryResult.value.id, segment);

      expect(addResult.success).toBe(true);
      if (!addResult.success) return;

      expect(addResult.value.segments[0]?.id).toBeDefined();
    });

    it('should reject segment with dates outside itinerary range', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const segment: Omit<Segment, 'id'> = {
        type: SegmentType.ACTIVITY,
        status: SegmentStatus.TENTATIVE,
        startDatetime: new Date('2025-05-30T10:00:00Z'), // Before itinerary start
        endDatetime: new Date('2025-05-30T12:00:00Z'),
        travelerIds: [],
        metadata: {},
        name: 'Pre-trip Activity',
        location: { name: 'Somewhere', type: 'CITY' },
      };

      const addResult = await segmentService.add(itineraryResult.value.id, segment);

      expect(addResult.success).toBe(false);
      if (addResult.success) return;

      expect(addResult.error.code).toBe('CONSTRAINT_VIOLATION');
    });

    it('should reject segment with end before start', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const segment: Omit<Segment, 'id'> = {
        type: SegmentType.MEETING,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-02T14:00:00Z'),
        endDatetime: new Date('2025-06-02T10:00:00Z'), // End before start
        travelerIds: [],
        metadata: {},
        title: 'Invalid Meeting',
        location: { name: 'Office', type: 'BUILDING' },
        attendees: [],
      };

      const addResult = await segmentService.add(itineraryResult.value.id, segment);

      expect(addResult.success).toBe(false);
      if (addResult.success) return;

      expect(addResult.error.code).toBe('CONSTRAINT_VIOLATION');
    });

    it('should reject duplicate segment ID', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const segmentId = generateSegmentId();
      const segment1: Omit<Segment, 'id'> & { id: typeof segmentId } = {
        id: segmentId,
        type: SegmentType.CUSTOM,
        status: SegmentStatus.TENTATIVE,
        startDatetime: new Date('2025-06-03T10:00:00Z'),
        endDatetime: new Date('2025-06-03T12:00:00Z'),
        travelerIds: [],
        metadata: {},
        title: 'First Segment',
        customData: {},
      };

      await segmentService.add(itineraryResult.value.id, segment1);

      const segment2: Omit<Segment, 'id'> & { id: typeof segmentId } = {
        ...segment1,
        title: 'Duplicate Segment',
      };

      const duplicateResult = await segmentService.add(itineraryResult.value.id, segment2);

      expect(duplicateResult.success).toBe(false);
      if (duplicateResult.success) return;

      expect(duplicateResult.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('update', () => {
    it('should update a segment', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const segment: Omit<Segment, 'id'> = {
        type: SegmentType.TRANSFER,
        status: SegmentStatus.TENTATIVE,
        startDatetime: new Date('2025-06-01T16:00:00Z'),
        endDatetime: new Date('2025-06-01T17:00:00Z'),
        travelerIds: [],
        metadata: {},
        transferType: 'TAXI',
        pickupLocation: { name: 'Airport', type: 'AIRPORT' },
        dropoffLocation: { name: 'Hotel', type: 'BUILDING' },
      };

      const addResult = await segmentService.add(itineraryResult.value.id, segment);

      expect(addResult.success).toBe(true);
      if (!addResult.success) return;

      const segmentId = addResult.value.segments[0]?.id;

      const updateResult = await segmentService.update(itineraryResult.value.id, segmentId, {
        status: SegmentStatus.CONFIRMED,
        notes: 'Driver name: John',
      });

      expect(updateResult.success).toBe(true);
      if (!updateResult.success) return;

      const updatedSegment = updateResult.value.segments[0];
      expect(updatedSegment?.status).toBe(SegmentStatus.CONFIRMED);
      expect(updatedSegment?.notes).toBe('Driver name: John');
    });

    it('should return NOT_FOUND for non-existent segment', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const fakeSegmentId = generateSegmentId();
      const updateResult = await segmentService.update(itineraryResult.value.id, fakeSegmentId, {
        notes: 'Should fail',
      });

      expect(updateResult.success).toBe(false);
      if (updateResult.success) return;

      expect(updateResult.error.code).toBe('NOT_FOUND');
    });
  });

  describe('delete', () => {
    it('should delete a segment', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const segment: Omit<Segment, 'id'> = {
        type: SegmentType.ACTIVITY,
        status: SegmentStatus.TENTATIVE,
        startDatetime: new Date('2025-06-05T10:00:00Z'),
        endDatetime: new Date('2025-06-05T12:00:00Z'),
        travelerIds: [],
        metadata: {},
        name: 'To Be Deleted',
        location: { name: 'Park', type: 'ATTRACTION' },
      };

      const addResult = await segmentService.add(itineraryResult.value.id, segment);

      expect(addResult.success).toBe(true);
      if (!addResult.success) return;

      const segmentId = addResult.value.segments[0]?.id;

      const deleteResult = await segmentService.delete(itineraryResult.value.id, segmentId);

      expect(deleteResult.success).toBe(true);
      if (!deleteResult.success) return;

      expect(deleteResult.value.segments).toHaveLength(0);
    });

    it('should remove dependencies on deleted segment', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const segment1: Omit<Segment, 'id'> = {
        type: SegmentType.FLIGHT,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-01T10:00:00Z'),
        endDatetime: new Date('2025-06-01T14:00:00Z'),
        travelerIds: [],
        metadata: {},
        airline: { name: 'Test Airlines', code: 'TA' },
        flightNumber: 'TA123',
        origin: { name: 'JFK', code: 'JFK', type: 'AIRPORT' },
        destination: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
      };

      const add1Result = await segmentService.add(itineraryResult.value.id, segment1);
      expect(add1Result.success).toBe(true);
      if (!add1Result.success) return;

      const segment1Id = add1Result.value.segments[0]?.id;

      const segment2: Omit<Segment, 'id'> = {
        type: SegmentType.TRANSFER,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-01T14:30:00Z'),
        endDatetime: new Date('2025-06-01T15:30:00Z'),
        travelerIds: [],
        metadata: {},
        transferType: 'TAXI',
        pickupLocation: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
        dropoffLocation: { name: 'Hotel', type: 'BUILDING' },
        dependsOn: [segment1Id],
      };

      const add2Result = await segmentService.add(itineraryResult.value.id, segment2);
      expect(add2Result.success).toBe(true);
      if (!add2Result.success) return;

      // Delete first segment
      const deleteResult = await segmentService.delete(itineraryResult.value.id, segment1Id);
      expect(deleteResult.success).toBe(true);
      if (!deleteResult.success) return;

      // Check that second segment no longer has dependency
      const remainingSegment = deleteResult.value.segments[0];
      expect(remainingSegment?.dependsOn).toEqual([]);
    });
  });

  describe('get', () => {
    it('should retrieve a specific segment', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const segment: Omit<Segment, 'id'> = {
        type: SegmentType.HOTEL,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-01T15:00:00Z'),
        endDatetime: new Date('2025-06-02T11:00:00Z'),
        travelerIds: [],
        metadata: {},
        property: { name: 'Grand Hotel', code: 'GH' },
        location: { name: 'Downtown', type: 'CITY' },
        checkInDate: new Date('2025-06-01'),
        checkOutDate: new Date('2025-06-02'),
        roomCount: 1,
        amenities: ['WiFi', 'Pool'],
      };

      const addResult = await segmentService.add(itineraryResult.value.id, segment);
      expect(addResult.success).toBe(true);
      if (!addResult.success) return;

      const segmentId = addResult.value.segments[0]?.id;

      const getResult = await segmentService.get(itineraryResult.value.id, segmentId);

      expect(getResult.success).toBe(true);
      if (!getResult.success) return;

      expect(getResult.value.id).toBe(segmentId);
      expect(getResult.value.type).toBe(SegmentType.HOTEL);
    });

    it('should return NOT_FOUND for non-existent segment', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const fakeSegmentId = generateSegmentId();
      const getResult = await segmentService.get(itineraryResult.value.id, fakeSegmentId);

      expect(getResult.success).toBe(false);
      if (getResult.success) return;

      expect(getResult.error.code).toBe('NOT_FOUND');
    });
  });

  describe('reorder', () => {
    it('should reorder segments', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      // Add three segments
      const segments: Array<Omit<Segment, 'id'>> = [
        {
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-02T10:00:00Z'),
          endDatetime: new Date('2025-06-02T12:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity A',
          location: { name: 'Location A', type: 'ATTRACTION' },
        },
        {
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-03T10:00:00Z'),
          endDatetime: new Date('2025-06-03T12:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity B',
          location: { name: 'Location B', type: 'ATTRACTION' },
        },
        {
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-04T10:00:00Z'),
          endDatetime: new Date('2025-06-04T12:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity C',
          location: { name: 'Location C', type: 'ATTRACTION' },
        },
      ];

      let currentItinerary = itineraryResult.value;
      for (const segment of segments) {
        const addResult = await segmentService.add(currentItinerary.id, segment);
        expect(addResult.success).toBe(true);
        if (!addResult.success) return;
        currentItinerary = addResult.value;
      }

      const [seg1, seg2, seg3] = currentItinerary.segments;
      expect(seg1).toBeDefined();
      expect(seg2).toBeDefined();
      expect(seg3).toBeDefined();

      // Reorder: C, A, B
      const reorderResult = await segmentService.reorder(currentItinerary.id, [
        seg3?.id,
        seg1?.id,
        seg2?.id,
      ]);

      expect(reorderResult.success).toBe(true);
      if (!reorderResult.success) return;

      expect(reorderResult.value.segments[0]?.id).toBe(seg3?.id);
      expect(reorderResult.value.segments[1]?.id).toBe(seg1?.id);
      expect(reorderResult.value.segments[2]?.id).toBe(seg2?.id);
    });

    it('should reject reorder with missing segment IDs', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const segment: Omit<Segment, 'id'> = {
        type: SegmentType.ACTIVITY,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-02T10:00:00Z'),
        endDatetime: new Date('2025-06-02T12:00:00Z'),
        travelerIds: [],
        metadata: {},
        name: 'Activity',
        location: { name: 'Location', type: 'ATTRACTION' },
      };

      const addResult = await segmentService.add(itineraryResult.value.id, segment);
      expect(addResult.success).toBe(true);
      if (!addResult.success) return;

      // Try to reorder with wrong number of segments
      const reorderResult = await segmentService.reorder(itineraryResult.value.id, []);

      expect(reorderResult.success).toBe(false);
      if (reorderResult.success) return;

      expect(reorderResult.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject reorder with non-existent segment ID', async () => {
      const itineraryResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(itineraryResult.success).toBe(true);
      if (!itineraryResult.success) return;

      const fakeSegmentId = generateSegmentId();
      const reorderResult = await segmentService.reorder(itineraryResult.value.id, [fakeSegmentId]);

      expect(reorderResult.success).toBe(false);
      if (reorderResult.success) return;

      expect(reorderResult.error.code).toBe('NOT_FOUND');
    });
  });
});
