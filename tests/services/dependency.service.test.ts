/**
 * Tests for DependencyService
 */

import { describe, expect, it } from 'vitest';
import { generateSegmentId } from '../../src/domain/types/branded.js';
import { SegmentStatus, SegmentType } from '../../src/domain/types/common.js';
import type { Segment } from '../../src/domain/types/segment.js';
import { DependencyService } from '../../src/services/dependency.service.js';

describe('DependencyService', () => {
  const service = new DependencyService();

  describe('buildGraph', () => {
    it('should build a dependency graph from segments', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();
      const seg3Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
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
        },
        {
          id: seg2Id,
          type: SegmentType.TRANSFER,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T14:30:00Z'),
          endDatetime: new Date('2025-06-01T15:30:00Z'),
          travelerIds: [],
          metadata: {},
          transferType: 'TAXI',
          pickupLocation: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
          dropoffLocation: { name: 'Hotel', type: 'BUILDING' },
          dependsOn: [seg1Id],
        },
        {
          id: seg3Id,
          type: SegmentType.HOTEL,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T16:00:00Z'),
          endDatetime: new Date('2025-06-02T11:00:00Z'),
          travelerIds: [],
          metadata: {},
          property: { name: 'Hotel', code: 'H' },
          location: { name: 'Downtown', type: 'CITY' },
          checkInDate: new Date('2025-06-01'),
          checkOutDate: new Date('2025-06-02'),
          roomCount: 1,
          amenities: [],
          dependsOn: [seg2Id],
        },
      ];

      const graph = service.buildGraph(segments);

      expect(graph.nodes.size).toBe(3);
      expect(graph.edges.get(seg1Id)).toEqual([seg2Id]);
      expect(graph.edges.get(seg2Id)).toEqual([seg3Id]);
    });
  });

  describe('validateNoCycles', () => {
    it('should pass validation when no cycles exist', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
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
        },
        {
          id: seg2Id,
          type: SegmentType.TRANSFER,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T14:30:00Z'),
          endDatetime: new Date('2025-06-01T15:30:00Z'),
          travelerIds: [],
          metadata: {},
          transferType: 'TAXI',
          pickupLocation: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
          dropoffLocation: { name: 'Hotel', type: 'BUILDING' },
          dependsOn: [seg1Id],
        },
      ];

      const result = service.validateNoCycles(segments);

      expect(result.success).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();
      const seg3Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T10:00:00Z'),
          endDatetime: new Date('2025-06-01T12:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity 1',
          location: { name: 'Location 1', type: 'ATTRACTION' },
          dependsOn: [seg3Id], // Creates cycle
        },
        {
          id: seg2Id,
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T13:00:00Z'),
          endDatetime: new Date('2025-06-01T15:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity 2',
          location: { name: 'Location 2', type: 'ATTRACTION' },
          dependsOn: [seg1Id],
        },
        {
          id: seg3Id,
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T16:00:00Z'),
          endDatetime: new Date('2025-06-01T18:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity 3',
          location: { name: 'Location 3', type: 'ATTRACTION' },
          dependsOn: [seg2Id],
        },
      ];

      const result = service.validateNoCycles(segments);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
    });
  });

  describe('getTopologicalOrder', () => {
    it('should return segments in topological order', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();
      const seg3Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg2Id,
          type: SegmentType.TRANSFER,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T14:30:00Z'),
          endDatetime: new Date('2025-06-01T15:30:00Z'),
          travelerIds: [],
          metadata: {},
          transferType: 'TAXI',
          pickupLocation: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
          dropoffLocation: { name: 'Hotel', type: 'BUILDING' },
          dependsOn: [seg1Id],
        },
        {
          id: seg3Id,
          type: SegmentType.HOTEL,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T16:00:00Z'),
          endDatetime: new Date('2025-06-02T11:00:00Z'),
          travelerIds: [],
          metadata: {},
          property: { name: 'Hotel', code: 'H' },
          location: { name: 'Downtown', type: 'CITY' },
          checkInDate: new Date('2025-06-01'),
          checkOutDate: new Date('2025-06-02'),
          roomCount: 1,
          amenities: [],
          dependsOn: [seg2Id],
        },
        {
          id: seg1Id,
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
        },
      ];

      const result = service.getTopologicalOrder(segments);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const order = result.value.map((s) => s.id);
      const seg1Index = order.indexOf(seg1Id);
      const seg2Index = order.indexOf(seg2Id);
      const seg3Index = order.indexOf(seg3Id);

      // seg1 should come before seg2, seg2 before seg3
      expect(seg1Index).toBeLessThan(seg2Index);
      expect(seg2Index).toBeLessThan(seg3Index);
    });

    it('should fail on circular dependencies', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T10:00:00Z'),
          endDatetime: new Date('2025-06-01T12:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity 1',
          location: { name: 'Location 1', type: 'ATTRACTION' },
          dependsOn: [seg2Id],
        },
        {
          id: seg2Id,
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T13:00:00Z'),
          endDatetime: new Date('2025-06-01T15:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity 2',
          location: { name: 'Location 2', type: 'ATTRACTION' },
          dependsOn: [seg1Id],
        },
      ];

      const result = service.getTopologicalOrder(segments);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('CIRCULAR_DEPENDENCY');
    });
  });

  describe('findDependents', () => {
    it('should find all direct and transitive dependents', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();
      const seg3Id = generateSegmentId();
      const seg4Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
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
        },
        {
          id: seg2Id,
          type: SegmentType.TRANSFER,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T14:30:00Z'),
          endDatetime: new Date('2025-06-01T15:30:00Z'),
          travelerIds: [],
          metadata: {},
          transferType: 'TAXI',
          pickupLocation: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
          dropoffLocation: { name: 'Hotel', type: 'BUILDING' },
          dependsOn: [seg1Id],
        },
        {
          id: seg3Id,
          type: SegmentType.HOTEL,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T16:00:00Z'),
          endDatetime: new Date('2025-06-02T11:00:00Z'),
          travelerIds: [],
          metadata: {},
          property: { name: 'Hotel', code: 'H' },
          location: { name: 'Downtown', type: 'CITY' },
          checkInDate: new Date('2025-06-01'),
          checkOutDate: new Date('2025-06-02'),
          roomCount: 1,
          amenities: [],
          dependsOn: [seg2Id],
        },
        {
          id: seg4Id,
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-02T14:00:00Z'),
          endDatetime: new Date('2025-06-02T16:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity',
          location: { name: 'Museum', type: 'ATTRACTION' },
          dependsOn: [seg3Id],
        },
      ];

      const dependents = service.findDependents(segments, seg1Id);

      expect(dependents).toHaveLength(3);
      expect(dependents).toContain(seg2Id);
      expect(dependents).toContain(seg3Id);
      expect(dependents).toContain(seg4Id);
    });

    it('should return empty array for segment with no dependents', () => {
      const seg1Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
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
        },
      ];

      const dependents = service.findDependents(segments, seg1Id);

      expect(dependents).toEqual([]);
    });
  });

  describe('inferChronologicalDependencies', () => {
    it('should infer dependencies for segments within 30 minutes', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
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
        },
        {
          id: seg2Id,
          type: SegmentType.TRANSFER,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T14:15:00Z'), // 15 minutes after flight
          endDatetime: new Date('2025-06-01T15:15:00Z'),
          travelerIds: [],
          metadata: {},
          transferType: 'TAXI',
          pickupLocation: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
          dropoffLocation: { name: 'Hotel', type: 'BUILDING' },
        },
      ];

      const chronoDeps = service.inferChronologicalDependencies(segments);

      expect(chronoDeps.get(seg2Id)).toContain(seg1Id);
    });

    it('should not infer dependencies for segments more than 30 minutes apart', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
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
        },
        {
          id: seg2Id,
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T16:00:00Z'), // 2 hours after flight
          endDatetime: new Date('2025-06-01T18:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity',
          location: { name: 'Museum', type: 'ATTRACTION' },
        },
      ];

      const chronoDeps = service.inferChronologicalDependencies(segments);

      expect(chronoDeps.get(seg2Id)).toBeUndefined();
    });

    it('should skip hotel segments as they are background', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();
      const seg3Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
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
        },
        {
          id: seg2Id,
          type: SegmentType.HOTEL,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T15:00:00Z'),
          endDatetime: new Date('2025-06-02T11:00:00Z'),
          travelerIds: [],
          metadata: {},
          property: { name: 'Hotel', code: 'H' },
          location: { name: 'Downtown', type: 'CITY' },
          checkInDate: new Date('2025-06-01'),
          checkOutDate: new Date('2025-06-02'),
          roomCount: 1,
          amenities: [],
        },
        {
          id: seg3Id,
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-02T11:15:00Z'), // 15 minutes after hotel checkout
          endDatetime: new Date('2025-06-02T13:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity',
          location: { name: 'Park', type: 'ATTRACTION' },
        },
      ];

      const chronoDeps = service.inferChronologicalDependencies(segments);

      // Hotel should not create dependencies
      expect(chronoDeps.get(seg2Id)).toBeUndefined();
      // Activity should not depend on hotel (hotel is background)
      expect(chronoDeps.get(seg3Id)).toBeUndefined();
    });
  });

  describe('wouldOverlap', () => {
    it('should detect overlap for exclusive segments', () => {
      const flight1: Segment = {
        id: generateSegmentId(),
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

      const flight2: Segment = {
        id: generateSegmentId(),
        type: SegmentType.FLIGHT,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-01T12:00:00Z'),
        endDatetime: new Date('2025-06-01T16:00:00Z'),
        travelerIds: [],
        metadata: {},
        airline: { name: 'Test Airlines', code: 'TA' },
        flightNumber: 'TA456',
        origin: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
        destination: { name: 'SFO', code: 'SFO', type: 'AIRPORT' },
      };

      expect(service.wouldOverlap(flight1, flight2)).toBe(true);
    });

    it('should allow overlap for non-exclusive segments', () => {
      const hotel: Segment = {
        id: generateSegmentId(),
        type: SegmentType.HOTEL,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-01T15:00:00Z'),
        endDatetime: new Date('2025-06-02T11:00:00Z'),
        travelerIds: [],
        metadata: {},
        property: { name: 'Hotel', code: 'H' },
        location: { name: 'Downtown', type: 'CITY' },
        checkInDate: new Date('2025-06-01'),
        checkOutDate: new Date('2025-06-02'),
        roomCount: 1,
        amenities: [],
      };

      const meeting: Segment = {
        id: generateSegmentId(),
        type: SegmentType.MEETING,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-01T18:00:00Z'),
        endDatetime: new Date('2025-06-01T20:00:00Z'),
        travelerIds: [],
        metadata: {},
        title: 'Evening Meeting',
        location: { name: 'Hotel Conference Room', type: 'BUILDING' },
        attendees: [],
      };

      expect(service.wouldOverlap(hotel, meeting)).toBe(false);
    });

    it('should not overlap for non-overlapping times', () => {
      const flight1: Segment = {
        id: generateSegmentId(),
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

      const flight2: Segment = {
        id: generateSegmentId(),
        type: SegmentType.FLIGHT,
        status: SegmentStatus.CONFIRMED,
        startDatetime: new Date('2025-06-01T15:00:00Z'),
        endDatetime: new Date('2025-06-01T19:00:00Z'),
        travelerIds: [],
        metadata: {},
        airline: { name: 'Test Airlines', code: 'TA' },
        flightNumber: 'TA456',
        origin: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
        destination: { name: 'SFO', code: 'SFO', type: 'AIRPORT' },
      };

      expect(service.wouldOverlap(flight1, flight2)).toBe(false);
    });
  });

  describe('validateNoConflicts', () => {
    it('should pass when no exclusive segments overlap', () => {
      const segments: Segment[] = [
        {
          id: generateSegmentId(),
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
        },
        {
          id: generateSegmentId(),
          type: SegmentType.TRANSFER,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T14:30:00Z'),
          endDatetime: new Date('2025-06-01T15:30:00Z'),
          travelerIds: [],
          metadata: {},
          transferType: 'TAXI',
          pickupLocation: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
          dropoffLocation: { name: 'Hotel', type: 'BUILDING' },
        },
      ];

      const result = service.validateNoConflicts(segments);

      expect(result.success).toBe(true);
    });

    it('should fail when exclusive segments overlap', () => {
      const segments: Segment[] = [
        {
          id: generateSegmentId(),
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
        },
        {
          id: generateSegmentId(),
          type: SegmentType.FLIGHT,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T12:00:00Z'),
          endDatetime: new Date('2025-06-01T16:00:00Z'),
          travelerIds: [],
          metadata: {},
          airline: { name: 'Test Airlines', code: 'TA' },
          flightNumber: 'TA456',
          origin: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
          destination: { name: 'SFO', code: 'SFO', type: 'AIRPORT' },
        },
      ];

      const result = service.validateNoConflicts(segments);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('ADJUSTMENT_FAILED');
    });
  });

  describe('adjustDependentSegments', () => {
    it('should adjust dependent segments when a segment is moved', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();
      const seg3Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
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
        },
        {
          id: seg2Id,
          type: SegmentType.TRANSFER,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T14:30:00Z'),
          endDatetime: new Date('2025-06-01T15:30:00Z'),
          travelerIds: [],
          metadata: {},
          transferType: 'TAXI',
          pickupLocation: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
          dropoffLocation: { name: 'Hotel', type: 'BUILDING' },
          dependsOn: [seg1Id],
        },
        {
          id: seg3Id,
          type: SegmentType.ACTIVITY,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T16:00:00Z'),
          endDatetime: new Date('2025-06-01T18:00:00Z'),
          travelerIds: [],
          metadata: {},
          name: 'Activity',
          location: { name: 'Museum', type: 'ATTRACTION' },
          dependsOn: [seg2Id],
        },
      ];

      // Move flight 2 hours later
      const timeDelta = 2 * 60 * 60 * 1000;
      const result = service.adjustDependentSegments(segments, seg1Id, timeDelta);

      expect(result.success).toBe(true);
      if (!result.success) return;

      // biome-ignore lint/style/noNonNullAssertion: safe in test context after successful result check
      const adjustedSeg1 = result.value.find((s) => s.id === seg1Id)!;
      // biome-ignore lint/style/noNonNullAssertion: safe in test context after successful result check
      const adjustedSeg2 = result.value.find((s) => s.id === seg2Id)!;
      // biome-ignore lint/style/noNonNullAssertion: safe in test context after successful result check
      const adjustedSeg3 = result.value.find((s) => s.id === seg3Id)!;

      expect(adjustedSeg1.startDatetime).toEqual(new Date('2025-06-01T12:00:00Z'));
      expect(adjustedSeg2.startDatetime).toEqual(new Date('2025-06-01T16:30:00Z'));
      expect(adjustedSeg3.startDatetime).toEqual(new Date('2025-06-01T18:00:00Z'));
    });

    it('should return error for non-existent segment', () => {
      const fakeId = generateSegmentId();
      const segments: Segment[] = [];

      const result = service.adjustDependentSegments(segments, fakeId, 1000);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('MISSING_DEPENDENCY');
    });

    it('should fail if adjustment creates conflicts', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
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
        },
        {
          id: seg2Id,
          type: SegmentType.FLIGHT,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T16:00:00Z'),
          endDatetime: new Date('2025-06-01T20:00:00Z'),
          travelerIds: [],
          metadata: {},
          airline: { name: 'Test Airlines', code: 'TA' },
          flightNumber: 'TA456',
          origin: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
          destination: { name: 'SFO', code: 'SFO', type: 'AIRPORT' },
        },
      ];

      // Move first flight to overlap with second
      const timeDelta = 4 * 60 * 60 * 1000; // 4 hours later
      const result = service.adjustDependentSegments(segments, seg1Id, timeDelta);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('ADJUSTMENT_FAILED');
    });

    it('should use chronological dependencies when explicit ones are missing', () => {
      const seg1Id = generateSegmentId();
      const seg2Id = generateSegmentId();

      const segments: Segment[] = [
        {
          id: seg1Id,
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
        },
        {
          id: seg2Id,
          type: SegmentType.TRANSFER,
          status: SegmentStatus.CONFIRMED,
          startDatetime: new Date('2025-06-01T14:15:00Z'), // 15 minutes after flight
          endDatetime: new Date('2025-06-01T15:15:00Z'),
          travelerIds: [],
          metadata: {},
          transferType: 'TAXI',
          pickupLocation: { name: 'LAX', code: 'LAX', type: 'AIRPORT' },
          dropoffLocation: { name: 'Hotel', type: 'BUILDING' },
          // No explicit dependsOn
        },
      ];

      // Move flight 1 hour later
      const timeDelta = 60 * 60 * 1000;
      const result = service.adjustDependentSegments(segments, seg1Id, timeDelta);

      expect(result.success).toBe(true);
      if (!result.success) return;

      // biome-ignore lint/style/noNonNullAssertion: safe in test context after successful result check
      const adjustedSeg2 = result.value.find((s) => s.id === seg2Id)!;
      // Transfer should be adjusted due to chronological dependency
      expect(adjustedSeg2.startDatetime).toEqual(new Date('2025-06-01T15:15:00Z'));
    });
  });
});
