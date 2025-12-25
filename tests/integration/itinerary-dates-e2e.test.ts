/**
 * End-to-end tests for itinerary date handling
 * Verifies create -> save -> load -> update flow with optional dates
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ItineraryCollectionService } from '../../src/services/itinerary-collection.service.js';
import { JsonItineraryStorage } from '../../src/storage/json-storage.js';
import type { ItineraryId } from '../../src/domain/types/branded.js';

describe('Itinerary Dates - End-to-End', () => {
  const storage = new JsonItineraryStorage('./data/itineraries-test');
  const service = new ItineraryCollectionService(storage);
  const createdIds: ItineraryId[] = [];

  beforeAll(async () => {
    await storage.initialize();
  });

  afterAll(async () => {
    // Cleanup test itineraries
    for (const id of createdIds) {
      await storage.delete(id);
    }
  });

  it('should create itinerary without dates', async () => {
    const result = await service.createItinerary({
      title: 'Trip Without Dates',
      description: 'Testing optional dates',
      createdBy: 'test@example.com',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      createdIds.push(result.value.id);
      expect(result.value.startDate).toBeUndefined();
      expect(result.value.endDate).toBeUndefined();
    }
  });

  it('should load itinerary without dates', async () => {
    const createResult = await service.createItinerary({
      title: 'Another Trip Without Dates',
      createdBy: 'test@example.com',
    });

    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const id = createResult.value.id;
    createdIds.push(id);

    // Load the itinerary
    const loadResult = await storage.load(id);

    expect(loadResult.success).toBe(true);
    if (loadResult.success) {
      expect(loadResult.value.id).toBe(id);
      expect(loadResult.value.title).toBe('Another Trip Without Dates');
      expect(loadResult.value.startDate).toBeUndefined();
      expect(loadResult.value.endDate).toBeUndefined();
    }
  });

  it('should create itinerary with dates', async () => {
    const result = await service.createItinerary({
      title: 'Trip With Dates',
      startDate: new Date('2025-12-25'),
      endDate: new Date('2025-12-30'),
      createdBy: 'test@example.com',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      createdIds.push(result.value.id);
      expect(result.value.startDate).toBeInstanceOf(Date);
      expect(result.value.endDate).toBeInstanceOf(Date);
    }
  });

  it('should update itinerary to add dates', async () => {
    // Create without dates
    const createResult = await service.createItinerary({
      title: 'Trip to Update',
      createdBy: 'test@example.com',
    });

    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const id = createResult.value.id;
    createdIds.push(id);

    // Update to add dates
    const updateResult = await service.updateMetadata(id, {
      startDate: new Date('2025-12-25'),
      endDate: new Date('2025-12-30'),
    });

    expect(updateResult.success).toBe(true);
    if (updateResult.success) {
      expect(updateResult.value.startDate).toBeInstanceOf(Date);
      expect(updateResult.value.endDate).toBeInstanceOf(Date);
    }
  });

  it('should update itinerary to remove dates', async () => {
    // Create with dates
    const createResult = await service.createItinerary({
      title: 'Trip to Clear Dates',
      startDate: new Date('2025-12-25'),
      endDate: new Date('2025-12-30'),
      createdBy: 'test@example.com',
    });

    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    const id = createResult.value.id;
    createdIds.push(id);

    // Update to clear dates (set to undefined)
    const updateResult = await service.updateMetadata(id, {
      startDate: undefined,
      endDate: undefined,
    });

    expect(updateResult.success).toBe(true);
    if (updateResult.success) {
      expect(updateResult.value.startDate).toBeUndefined();
      expect(updateResult.value.endDate).toBeUndefined();
    }
  });

  it('should list itineraries with and without dates', async () => {
    // Create one with dates and one without
    const withDates = await service.createItinerary({
      title: 'With Dates',
      startDate: new Date('2025-12-25'),
      endDate: new Date('2025-12-30'),
      createdBy: 'test@example.com',
    });

    const withoutDates = await service.createItinerary({
      title: 'Without Dates',
      createdBy: 'test@example.com',
    });

    expect(withDates.success).toBe(true);
    expect(withoutDates.success).toBe(true);

    if (withDates.success) createdIds.push(withDates.value.id);
    if (withoutDates.success) createdIds.push(withoutDates.value.id);

    // List all
    const listResult = await service.listItineraries();

    expect(listResult.success).toBe(true);
    if (listResult.success) {
      expect(listResult.value.length).toBeGreaterThan(0);

      // Both should be in the list
      if (withDates.success) {
        const found1 = listResult.value.find((s) => s.id === withDates.value.id);
        expect(found1).toBeDefined();
        expect(found1?.startDate).toBeInstanceOf(Date);
      }

      if (withoutDates.success) {
        const found2 = listResult.value.find((s) => s.id === withoutDates.value.id);
        expect(found2).toBeDefined();
        expect(found2?.startDate).toBeUndefined();
      }
    }
  });
});
