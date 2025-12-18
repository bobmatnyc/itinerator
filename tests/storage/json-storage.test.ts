/**
 * Tests for JSON storage implementation
 */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateItineraryId, generateTravelerId } from '../../src/domain/types/branded.js';
import type { Itinerary } from '../../src/domain/types/itinerary.js';
import { JsonItineraryStorage } from '../../src/storage/json-storage.js';

describe('JsonItineraryStorage', () => {
  const testDir = './test-data-json/itineraries';
  let storage: JsonItineraryStorage;

  // Helper to create a minimal valid itinerary
  const createTestItinerary = (): Itinerary => {
    const now = new Date();
    const travelerId = generateTravelerId();

    return {
      id: generateItineraryId(),
      version: 1,
      createdAt: now,
      updatedAt: now,
      title: 'Test Trip',
      description: 'A test itinerary',
      status: 'DRAFT',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-10'),
      destinations: [],
      travelers: [
        {
          id: travelerId,
          type: 'ADULT',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-01'),
          email: 'john@example.com',
          nationality: 'US',
          passportNumber: 'X12345678',
          passportExpiry: new Date('2030-01-01'),
          passportCountry: 'US',
          createdAt: now,
          updatedAt: now,
        },
      ],
      segments: [],
      tags: [],
      metadata: {},
    };
  };

  beforeEach(async () => {
    // Create clean test directory
    await rm('./test-data-json', { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
    storage = new JsonItineraryStorage(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await rm('./test-data-json', { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should create the storage directory', async () => {
      const result = await storage.initialize();

      expect(result.success).toBe(true);
    });

    it('should succeed if directory already exists', async () => {
      await storage.initialize();
      const result = await storage.initialize();

      expect(result.success).toBe(true);
    });
  });

  describe('save and load', () => {
    it('should save and load an itinerary', async () => {
      await storage.initialize();
      const itinerary = createTestItinerary();

      const saveResult = await storage.save(itinerary);
      expect(saveResult.success).toBe(true);

      if (!saveResult.success) return;

      const loadResult = await storage.load(itinerary.id);
      expect(loadResult.success).toBe(true);

      if (!loadResult.success) return;

      const loaded = loadResult.value;
      expect(loaded.id).toBe(itinerary.id);
      expect(loaded.title).toBe(itinerary.title);
      expect(loaded.status).toBe(itinerary.status);
      expect(loaded.version).toBe(2); // Version incremented
    });

    it('should preserve Date objects through serialization', async () => {
      await storage.initialize();
      const itinerary = createTestItinerary();

      const saveResult = await storage.save(itinerary);
      expect(saveResult.success).toBe(true);

      const loadResult = await storage.load(itinerary.id);
      expect(loadResult.success).toBe(true);

      if (!loadResult.success) return;

      const loaded = loadResult.value;
      expect(loaded.startDate).toBeInstanceOf(Date);
      expect(loaded.endDate).toBeInstanceOf(Date);
      expect(loaded.createdAt).toBeInstanceOf(Date);
      expect(loaded.updatedAt).toBeInstanceOf(Date);
      expect(loaded.travelers[0]?.dateOfBirth).toBeInstanceOf(Date);
    });

    it('should increment version on save', async () => {
      await storage.initialize();
      const itinerary = createTestItinerary();

      const save1 = await storage.save(itinerary);
      expect(save1.success).toBe(true);

      if (!save1.success) return;

      const save2 = await storage.save(save1.value);
      expect(save2.success).toBe(true);

      if (!save2.success) return;

      expect(save2.value.version).toBe(3); // 1 -> 2 -> 3
    });

    it('should update updatedAt timestamp on save', async () => {
      await storage.initialize();
      const itinerary = createTestItinerary();
      const originalUpdatedAt = itinerary.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const saveResult = await storage.save(itinerary);
      expect(saveResult.success).toBe(true);

      if (!saveResult.success) return;

      expect(saveResult.value.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should return NOT_FOUND error when loading non-existent itinerary', async () => {
      await storage.initialize();
      const fakeId = generateItineraryId();

      const loadResult = await storage.load(fakeId);

      expect(loadResult.success).toBe(false);
      if (loadResult.success) return;

      expect(loadResult.error.code).toBe('NOT_FOUND');
    });

    it('should return VALIDATION_ERROR for invalid data', async () => {
      await storage.initialize();
      const itinerary = createTestItinerary();

      // Save valid itinerary
      await storage.save(itinerary);

      // Manually corrupt the file
      const filePath = join(testDir, `${itinerary.id}.json`);
      const fs = await import('node:fs/promises');
      await fs.writeFile(filePath, JSON.stringify({ invalid: 'data' }), 'utf-8');

      // Try to load corrupted data
      const loadResult = await storage.load(itinerary.id);

      expect(loadResult.success).toBe(false);
      if (loadResult.success) return;

      expect(loadResult.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('delete', () => {
    it('should delete an existing itinerary', async () => {
      await storage.initialize();
      const itinerary = createTestItinerary();

      await storage.save(itinerary);

      const deleteResult = await storage.delete(itinerary.id);
      expect(deleteResult.success).toBe(true);

      const loadResult = await storage.load(itinerary.id);
      expect(loadResult.success).toBe(false);
    });

    it('should return NOT_FOUND when deleting non-existent itinerary', async () => {
      await storage.initialize();
      const fakeId = generateItineraryId();

      const deleteResult = await storage.delete(fakeId);

      expect(deleteResult.success).toBe(false);
      if (deleteResult.success) return;

      expect(deleteResult.error.code).toBe('NOT_FOUND');
    });
  });

  describe('list', () => {
    it('should return empty array when no itineraries exist', async () => {
      await storage.initialize();

      const listResult = await storage.list();

      expect(listResult.success).toBe(true);
      if (!listResult.success) return;

      expect(listResult.value).toEqual([]);
    });

    it('should list all itineraries', async () => {
      await storage.initialize();

      const itinerary1 = createTestItinerary();
      const itinerary2 = createTestItinerary();

      await storage.save(itinerary1);
      await storage.save(itinerary2);

      const listResult = await storage.list();

      expect(listResult.success).toBe(true);
      if (!listResult.success) return;

      expect(listResult.value).toHaveLength(2);
      expect(listResult.value.map((s) => s.id)).toContain(itinerary1.id);
      expect(listResult.value.map((s) => s.id)).toContain(itinerary2.id);
    });

    it('should include summary information', async () => {
      await storage.initialize();
      const itinerary = createTestItinerary();

      await storage.save(itinerary);

      const listResult = await storage.list();

      expect(listResult.success).toBe(true);
      if (!listResult.success) return;

      const summary = listResult.value[0];
      expect(summary).toBeDefined();
      if (!summary) return;

      expect(summary.id).toBe(itinerary.id);
      expect(summary.title).toBe(itinerary.title);
      expect(summary.status).toBe(itinerary.status);
      expect(summary.travelerCount).toBe(1);
      expect(summary.segmentCount).toBe(0);
      expect(summary.startDate).toBeInstanceOf(Date);
      expect(summary.endDate).toBeInstanceOf(Date);
      expect(summary.updatedAt).toBeInstanceOf(Date);
    });

    it('should sort by updatedAt descending', async () => {
      await storage.initialize();

      const itinerary1 = createTestItinerary();
      const itinerary2 = createTestItinerary();

      // Save first itinerary
      await storage.save(itinerary1);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Save second itinerary (will have later updatedAt)
      await storage.save(itinerary2);

      const listResult = await storage.list();

      expect(listResult.success).toBe(true);
      if (!listResult.success) return;

      expect(listResult.value).toHaveLength(2);
      // Most recently updated should be first
      expect(listResult.value[0]?.id).toBe(itinerary2.id);
      expect(listResult.value[1]?.id).toBe(itinerary1.id);
    });

    it('should skip invalid files', async () => {
      await storage.initialize();

      const itinerary = createTestItinerary();
      await storage.save(itinerary);

      // Create an invalid file
      const fs = await import('node:fs/promises');
      await fs.writeFile(join(testDir, 'invalid.json'), 'invalid json', 'utf-8');

      const listResult = await storage.list();

      expect(listResult.success).toBe(true);
      if (!listResult.success) return;

      // Should only contain valid itinerary
      expect(listResult.value).toHaveLength(1);
      expect(listResult.value[0]?.id).toBe(itinerary.id);
    });
  });

  describe('exists', () => {
    it('should return true for existing itinerary', async () => {
      await storage.initialize();
      const itinerary = createTestItinerary();

      await storage.save(itinerary);

      const exists = await storage.exists(itinerary.id);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent itinerary', async () => {
      await storage.initialize();
      const fakeId = generateItineraryId();

      const exists = await storage.exists(fakeId);
      expect(exists).toBe(false);
    });
  });
});
