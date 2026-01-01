/**
 * Tests for WorkingContextService
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateItineraryId } from '../../src/domain/types/branded.js';
import { ItineraryService } from '../../src/services/itinerary.service.js';
import { WorkingContextService } from '../../src/services/working-context.service.js';
import { ConfigStorage } from '../../src/storage/config-storage.js';
import { JsonItineraryStorage } from '../../src/storage/json-storage.js';

describe('WorkingContextService', () => {
  const testDataDir = './test-data-working-context-service';
  const testConfigPath = `${testDataDir}/.itinerator/config.json`;
  let itineraryStorage: JsonItineraryStorage;
  let configStorage: ConfigStorage;
  let itineraryService: ItineraryService;
  let workingContextService: WorkingContextService;

  beforeEach(async () => {
    await rm(testDataDir, { recursive: true, force: true });
    await mkdir(testDataDir, { recursive: true });

    itineraryStorage = new JsonItineraryStorage(testDataDir);
    await itineraryStorage.initialize();

    configStorage = new ConfigStorage(testConfigPath);
    await configStorage.initialize();

    itineraryService = new ItineraryService(itineraryStorage);
    workingContextService = new WorkingContextService(configStorage, itineraryStorage);
  });

  afterEach(async () => {
    await rm(testDataDir, { recursive: true, force: true });
  });

  describe('getWorkingItinerary', () => {
    it('should return null when no working itinerary is set', async () => {
      const result = await workingContextService.getWorkingItinerary();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.value).toBeNull();
    });

    it('should return the working itinerary when set', async () => {
      const createResult = await itineraryService.create({
        title: 'Working Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      await workingContextService.setWorkingItinerary(createResult.value.id);

      const getResult = await workingContextService.getWorkingItinerary();

      expect(getResult.success).toBe(true);
      if (!getResult.success) return;

      expect(getResult.value).not.toBeNull();
      expect(getResult.value?.id).toBe(createResult.value.id);
      expect(getResult.value?.title).toBe('Working Trip');
    });

    it('should clear working context if itinerary not found', async () => {
      const fakeId = generateItineraryId();

      // Set working itinerary to non-existent ID
      await configStorage.setWorkingItineraryId(fakeId);

      const result = await workingContextService.getWorkingItinerary();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.value).toBeNull();

      // Verify working context was cleared
      const workingId = await configStorage.getWorkingItineraryId();
      expect(workingId).toBeUndefined();
    });

    it('should return error for other storage errors', async () => {
      // Create an itinerary and set it as working
      const createResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      await workingContextService.setWorkingItinerary(createResult.value.id);

      // Corrupt the file to cause a validation error (not NOT_FOUND)
      const filePath = join(testDataDir, `${createResult.value.id}.json`);
      await writeFile(filePath, '{ "invalid": "data" }', 'utf-8');

      const result = await workingContextService.getWorkingItinerary();

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('setWorkingItinerary', () => {
    it('should set the working itinerary', async () => {
      const createResult = await itineraryService.create({
        title: 'New Working Trip',
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-07-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const setResult = await workingContextService.setWorkingItinerary(createResult.value.id);

      expect(setResult.success).toBe(true);
      if (!setResult.success) return;

      expect(setResult.value.id).toBe(createResult.value.id);

      // Verify it was persisted to config
      const workingId = await configStorage.getWorkingItineraryId();
      expect(workingId).toBe(createResult.value.id);
    });

    it('should return NOT_FOUND for non-existent itinerary', async () => {
      const fakeId = generateItineraryId();

      const result = await workingContextService.setWorkingItinerary(fakeId);

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('should replace existing working itinerary', async () => {
      const create1Result = await itineraryService.create({
        title: 'First Trip',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-10'),
      });

      const create2Result = await itineraryService.create({
        title: 'Second Trip',
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-07-10'),
      });

      expect(create1Result.success).toBe(true);
      expect(create2Result.success).toBe(true);
      if (!create1Result.success || !create2Result.success) return;

      await workingContextService.setWorkingItinerary(create1Result.value.id);
      const set2Result = await workingContextService.setWorkingItinerary(create2Result.value.id);

      expect(set2Result.success).toBe(true);
      if (!set2Result.success) return;

      expect(set2Result.value.id).toBe(create2Result.value.id);

      const workingId = await configStorage.getWorkingItineraryId();
      expect(workingId).toBe(create2Result.value.id);
    });
  });

  describe('clearWorkingItinerary', () => {
    it('should clear the working itinerary', async () => {
      const createResult = await itineraryService.create({
        title: 'To Be Cleared',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-08-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      await workingContextService.setWorkingItinerary(createResult.value.id);

      const clearResult = await workingContextService.clearWorkingItinerary();

      expect(clearResult.success).toBe(true);

      const workingId = await configStorage.getWorkingItineraryId();
      expect(workingId).toBeUndefined();
    });

    it('should succeed even when no working itinerary is set', async () => {
      const result = await workingContextService.clearWorkingItinerary();

      expect(result.success).toBe(true);
    });
  });

  describe('getWorkingItineraryId', () => {
    it('should return undefined when no working itinerary is set', async () => {
      const workingId = await workingContextService.getWorkingItineraryId();

      expect(workingId).toBeUndefined();
    });

    it('should return the working itinerary ID when set', async () => {
      const createResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2025-09-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      await workingContextService.setWorkingItinerary(createResult.value.id);

      const workingId = await workingContextService.getWorkingItineraryId();

      expect(workingId).toBe(createResult.value.id);
    });
  });

  describe('hasWorkingItinerary', () => {
    it('should return false when no working itinerary is set', async () => {
      const hasWorking = await workingContextService.hasWorkingItinerary();

      expect(hasWorking).toBe(false);
    });

    it('should return true when working itinerary is set', async () => {
      const createResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-10-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      await workingContextService.setWorkingItinerary(createResult.value.id);

      const hasWorking = await workingContextService.hasWorkingItinerary();

      expect(hasWorking).toBe(true);
    });

    it('should return false after clearing working itinerary', async () => {
      const createResult = await itineraryService.create({
        title: 'Test Trip',
        startDate: new Date('2025-11-01'),
        endDate: new Date('2025-11-10'),
      });

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      await workingContextService.setWorkingItinerary(createResult.value.id);
      await workingContextService.clearWorkingItinerary();

      const hasWorking = await workingContextService.hasWorkingItinerary();

      expect(hasWorking).toBe(false);
    });
  });
});
