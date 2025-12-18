/**
 * Tests for ItineraryService
 */

import { mkdir, rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createItineraryId, generateTravelerId } from '../../src/domain/types/branded.js';
import { ItineraryStatus, TravelerType } from '../../src/domain/types/common.js';
import type { Traveler } from '../../src/domain/types/traveler.js';
import { ItineraryService } from '../../src/services/itinerary.service.js';
import { JsonItineraryStorage } from '../../src/storage/json-storage.js';

describe('ItineraryService', () => {
  const testDataDir = './test-data-itinerary-service';
  let storage: JsonItineraryStorage;
  let service: ItineraryService;

  beforeEach(async () => {
    await rm(testDataDir, { recursive: true, force: true });
    await mkdir(testDataDir, { recursive: true });
    storage = new JsonItineraryStorage(testDataDir);
    await storage.initialize();
    service = new ItineraryService(storage);
  });

  afterEach(async () => {
    await rm(testDataDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('should create a new itinerary with required fields', async () => {
      const result = await service.create({
        title: 'Tokyo Adventure',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.value.title).toBe('Tokyo Adventure');
      expect(result.value.status).toBe(ItineraryStatus.DRAFT);
      expect(result.value.startDate).toEqual(new Date('2025-06-01'));
      expect(result.value.endDate).toEqual(new Date('2025-06-10'));
      expect(result.value.version).toBe(1);
      expect(result.value.segments).toEqual([]);
      expect(result.value.tags).toEqual([]);
    });

    it('should create itinerary with optional fields', async () => {
      const traveler: Traveler = {
        id: generateTravelerId(),
        type: TravelerType.ADULT,
        firstName: 'John',
        lastName: 'Doe',
        loyaltyPrograms: [],
        specialRequests: [],
        metadata: {},
      };

      const result = await service.create({
        title: 'Business Trip',
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-07-05'),
        description: 'Important client meeting',
        tripType: 'BUSINESS',
        travelers: [traveler],
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.value.description).toBe('Important client meeting');
      expect(result.value.tripType).toBe('BUSINESS');
      expect(result.value.travelers).toHaveLength(1);
      expect(result.value.travelers[0]?.id).toBe(traveler.id);
    });

    it('should reject invalid date range', async () => {
      const result = await service.create({
        title: 'Invalid Trip',
        startDate: new Date('2025-06-10'),
        endDate: new Date('2025-06-01'), // End before start
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('INVALID_DATA');
    });

    it('should reject empty title', async () => {
      const result = await service.create({
        title: '',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('INVALID_DATA');
    });
  });

  describe('get', () => {
    it('should retrieve an existing itinerary', async () => {
      const createResult = await service.create({
        title: 'Paris Vacation',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-08-15'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const getResult = await service.get(createResult.value.id);

      expect(getResult.success).toBe(true);
      if (!getResult.success) return;

      expect(getResult.value.id).toBe(createResult.value.id);
      expect(getResult.value.title).toBe('Paris Vacation');
    });

    it('should return NOT_FOUND for non-existent itinerary', async () => {
      const fakeId = createItineraryId('12345678-1234-1234-1234-123456789012');
      const result = await service.get(fakeId);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('update', () => {
    it('should update itinerary fields', async () => {
      const createResult = await service.create({
        title: 'Original Title',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2025-09-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const updateResult = await service.update(createResult.value.id, {
        title: 'Updated Title',
        description: 'Now with a description',
        status: ItineraryStatus.PLANNED,
      });

      expect(updateResult.success).toBe(true);
      if (!updateResult.success) return;

      expect(updateResult.value.title).toBe('Updated Title');
      expect(updateResult.value.description).toBe('Now with a description');
      expect(updateResult.value.status).toBe(ItineraryStatus.PLANNED);
      expect(updateResult.value.version).toBe(2); // Version incremented
    });

    it('should reject invalid date range update', async () => {
      const createResult = await service.create({
        title: 'Test Trip',
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-10-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const updateResult = await service.update(createResult.value.id, {
        startDate: new Date('2025-10-15'),
        endDate: new Date('2025-10-10'), // End before start
      });

      expect(updateResult.success).toBe(false);
      if (updateResult.success) return;

      expect(updateResult.error.code).toBe('CONSTRAINT_VIOLATION');
    });

    it('should return NOT_FOUND for non-existent itinerary', async () => {
      const fakeId = createItineraryId('12345678-1234-1234-1234-123456789012');
      const result = await service.update(fakeId, {
        title: 'Should Fail',
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('delete', () => {
    it('should delete an existing itinerary', async () => {
      const createResult = await service.create({
        title: 'To Be Deleted',
        startDate: new Date('2025-11-01'),
        endDate: new Date('2025-11-05'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const deleteResult = await service.delete(createResult.value.id);
      expect(deleteResult.success).toBe(true);

      // Verify it's gone
      const getResult = await service.get(createResult.value.id);
      expect(getResult.success).toBe(false);
    });

    it('should return NOT_FOUND for non-existent itinerary', async () => {
      const fakeId = createItineraryId('12345678-1234-1234-1234-123456789012');
      const result = await service.delete(fakeId);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('list', () => {
    it('should list all itineraries', async () => {
      await service.create({
        title: 'Trip 1',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      await service.create({
        title: 'Trip 2',
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-07-10'),
      });

      const listResult = await service.list();

      expect(listResult.success).toBe(true);
      if (!listResult.success) return;

      expect(listResult.value).toHaveLength(2);
      expect(listResult.value.map((s) => s.title).sort()).toEqual(['Trip 1', 'Trip 2']);
    });

    it('should return empty array when no itineraries exist', async () => {
      const listResult = await service.list();

      expect(listResult.success).toBe(true);
      if (!listResult.success) return;

      expect(listResult.value).toEqual([]);
    });
  });

  describe('addTraveler', () => {
    it('should add a traveler to an itinerary', async () => {
      const createResult = await service.create({
        title: 'Group Trip',
        startDate: new Date('2025-12-01'),
        endDate: new Date('2025-12-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const traveler: Traveler = {
        id: generateTravelerId(),
        type: TravelerType.ADULT,
        firstName: 'Alice',
        lastName: 'Smith',
        loyaltyPrograms: [],
        specialRequests: [],
        metadata: {},
      };

      const addResult = await service.addTraveler(createResult.value.id, traveler);

      expect(addResult.success).toBe(true);
      if (!addResult.success) return;

      expect(addResult.value.travelers).toHaveLength(1);
      expect(addResult.value.travelers[0]?.id).toBe(traveler.id);
      expect(addResult.value.travelers[0]?.firstName).toBe('Alice');
    });

    it('should reject duplicate traveler', async () => {
      const createResult = await service.create({
        title: 'Test Trip',
        startDate: new Date('2025-12-01'),
        endDate: new Date('2025-12-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const traveler: Traveler = {
        id: generateTravelerId(),
        type: TravelerType.ADULT,
        firstName: 'Bob',
        lastName: 'Jones',
        loyaltyPrograms: [],
        specialRequests: [],
        metadata: {},
      };

      await service.addTraveler(createResult.value.id, traveler);
      const duplicateResult = await service.addTraveler(createResult.value.id, traveler);

      expect(duplicateResult.success).toBe(false);
      if (duplicateResult.success) return;

      expect(duplicateResult.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('removeTraveler', () => {
    it('should remove a traveler from an itinerary', async () => {
      const traveler: Traveler = {
        id: generateTravelerId(),
        type: TravelerType.ADULT,
        firstName: 'Charlie',
        lastName: 'Brown',
        loyaltyPrograms: [],
        specialRequests: [],
        metadata: {},
      };

      const createResult = await service.create({
        title: 'Test Trip',
        startDate: new Date('2025-12-01'),
        endDate: new Date('2025-12-10'),
        travelers: [traveler],
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const removeResult = await service.removeTraveler(createResult.value.id, traveler.id);

      expect(removeResult.success).toBe(true);
      if (!removeResult.success) return;

      expect(removeResult.value.travelers).toHaveLength(0);
    });

    it('should return NOT_FOUND for non-existent traveler', async () => {
      const createResult = await service.create({
        title: 'Test Trip',
        startDate: new Date('2025-12-01'),
        endDate: new Date('2025-12-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const fakeTravelerId = generateTravelerId();
      const removeResult = await service.removeTraveler(createResult.value.id, fakeTravelerId);

      expect(removeResult.success).toBe(false);
      if (removeResult.success) return;

      expect(removeResult.error.code).toBe('NOT_FOUND');
    });

    it('should clear primary traveler if removed', async () => {
      const traveler: Traveler = {
        id: generateTravelerId(),
        type: TravelerType.ADULT,
        firstName: 'David',
        lastName: 'Lee',
        loyaltyPrograms: [],
        specialRequests: [],
        metadata: {},
      };

      const createResult = await service.create({
        title: 'Test Trip',
        startDate: new Date('2025-12-01'),
        endDate: new Date('2025-12-10'),
        travelers: [traveler],
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      // Set as primary traveler
      await service.update(createResult.value.id, {
        primaryTravelerId: traveler.id,
      });

      // Remove traveler
      const removeResult = await service.removeTraveler(createResult.value.id, traveler.id);

      expect(removeResult.success).toBe(true);
      if (!removeResult.success) return;

      expect(removeResult.value.primaryTravelerId).toBeUndefined();
    });
  });
});
