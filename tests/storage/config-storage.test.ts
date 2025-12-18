/**
 * Tests for configuration storage
 */

import { mkdir, rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateItineraryId } from '../../src/domain/types/branded.js';
import { type AppConfig, ConfigStorage } from '../../src/storage/config-storage.js';

describe('ConfigStorage', () => {
  const testConfigPath = './test-data-config/.itinerizer/config.json';
  let storage: ConfigStorage;

  beforeEach(async () => {
    // Clean up test directory
    await rm('./test-data-config', { recursive: true, force: true });
    await mkdir('./test-data-config', { recursive: true });
    storage = new ConfigStorage(testConfigPath);
  });

  afterEach(async () => {
    // Clean up test directory
    await rm('./test-data-config', { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should create config directory and default config', async () => {
      const result = await storage.initialize();

      expect(result.success).toBe(true);

      // Should be able to load config
      const loadResult = await storage.load();
      expect(loadResult.success).toBe(true);
    });

    it('should not overwrite existing config', async () => {
      const config: AppConfig = {
        workingItineraryId: generateItineraryId(),
        defaultCurrency: 'USD',
        lastUpdated: new Date(),
      };

      await storage.save(config);

      const result = await storage.initialize();
      expect(result.success).toBe(true);

      const loadResult = await storage.load();
      expect(loadResult.success).toBe(true);

      if (!loadResult.success) return;

      expect(loadResult.value.workingItineraryId).toBe(config.workingItineraryId);
      expect(loadResult.value.defaultCurrency).toBe(config.defaultCurrency);
    });
  });

  describe('save and load', () => {
    it('should save and load configuration', async () => {
      const config: AppConfig = {
        workingItineraryId: generateItineraryId(),
        defaultCurrency: 'EUR',
        lastUpdated: new Date(),
      };

      const saveResult = await storage.save(config);
      expect(saveResult.success).toBe(true);

      const loadResult = await storage.load();
      expect(loadResult.success).toBe(true);

      if (!loadResult.success) return;

      expect(loadResult.value.workingItineraryId).toBe(config.workingItineraryId);
      expect(loadResult.value.defaultCurrency).toBe(config.defaultCurrency);
    });

    it('should preserve Date objects through serialization', async () => {
      const config: AppConfig = {
        lastUpdated: new Date('2025-01-15T10:30:00Z'),
      };

      await storage.save(config);
      const loadResult = await storage.load();

      expect(loadResult.success).toBe(true);
      if (!loadResult.success) return;

      expect(loadResult.value.lastUpdated).toBeInstanceOf(Date);
    });

    it('should update lastUpdated timestamp on save', async () => {
      const config: AppConfig = {
        workingItineraryId: generateItineraryId(),
        lastUpdated: new Date('2025-01-01'),
      };

      const saveResult = await storage.save(config);
      expect(saveResult.success).toBe(true);

      const loadResult = await storage.load();
      expect(loadResult.success).toBe(true);

      if (!loadResult.success) return;

      // lastUpdated should be updated to current time
      expect(loadResult.value.lastUpdated.getTime()).toBeGreaterThan(
        new Date('2025-01-01').getTime()
      );
    });

    it('should return NOT_FOUND when loading non-existent config', async () => {
      const loadResult = await storage.load();

      expect(loadResult.success).toBe(false);
      if (loadResult.success) return;

      expect(loadResult.error.code).toBe('NOT_FOUND');
    });

    it('should handle optional fields', async () => {
      const config: AppConfig = {
        lastUpdated: new Date(),
      };

      await storage.save(config);
      const loadResult = await storage.load();

      expect(loadResult.success).toBe(true);
      if (!loadResult.success) return;

      expect(loadResult.value.workingItineraryId).toBeUndefined();
      expect(loadResult.value.defaultCurrency).toBeUndefined();
    });
  });

  describe('getWorkingItineraryId', () => {
    it('should return working itinerary ID if set', async () => {
      const itineraryId = generateItineraryId();
      const config: AppConfig = {
        workingItineraryId: itineraryId,
        lastUpdated: new Date(),
      };

      await storage.save(config);

      const workingId = await storage.getWorkingItineraryId();
      expect(workingId).toBe(itineraryId);
    });

    it('should return undefined if not set', async () => {
      const config: AppConfig = {
        lastUpdated: new Date(),
      };

      await storage.save(config);

      const workingId = await storage.getWorkingItineraryId();
      expect(workingId).toBeUndefined();
    });

    it('should return undefined if config does not exist', async () => {
      const workingId = await storage.getWorkingItineraryId();
      expect(workingId).toBeUndefined();
    });

    it('should load config if not cached', async () => {
      const itineraryId = generateItineraryId();
      const config: AppConfig = {
        workingItineraryId: itineraryId,
        lastUpdated: new Date(),
      };

      await storage.save(config);

      // Create new storage instance (no cache)
      const newStorage = new ConfigStorage(testConfigPath);
      const workingId = await newStorage.getWorkingItineraryId();

      expect(workingId).toBe(itineraryId);
    });
  });

  describe('setWorkingItineraryId', () => {
    it('should set working itinerary ID', async () => {
      await storage.initialize();

      const itineraryId = generateItineraryId();
      const result = await storage.setWorkingItineraryId(itineraryId);

      expect(result.success).toBe(true);

      const workingId = await storage.getWorkingItineraryId();
      expect(workingId).toBe(itineraryId);
    });

    it('should clear working itinerary ID when set to undefined', async () => {
      const itineraryId = generateItineraryId();
      await storage.setWorkingItineraryId(itineraryId);

      const result = await storage.setWorkingItineraryId(undefined);
      expect(result.success).toBe(true);

      const workingId = await storage.getWorkingItineraryId();
      expect(workingId).toBeUndefined();
    });

    it('should preserve other config fields', async () => {
      const config: AppConfig = {
        defaultCurrency: 'GBP',
        lastUpdated: new Date(),
      };

      await storage.save(config);

      const itineraryId = generateItineraryId();
      await storage.setWorkingItineraryId(itineraryId);

      const loadResult = await storage.load();
      expect(loadResult.success).toBe(true);

      if (!loadResult.success) return;

      expect(loadResult.value.workingItineraryId).toBe(itineraryId);
      expect(loadResult.value.defaultCurrency).toBe('GBP');
    });

    it('should create config if it does not exist', async () => {
      const itineraryId = generateItineraryId();
      const result = await storage.setWorkingItineraryId(itineraryId);

      expect(result.success).toBe(true);

      const workingId = await storage.getWorkingItineraryId();
      expect(workingId).toBe(itineraryId);
    });

    it('should update lastUpdated timestamp', async () => {
      await storage.initialize();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const itineraryId = generateItineraryId();
      await storage.setWorkingItineraryId(itineraryId);

      const loadResult = await storage.load();
      expect(loadResult.success).toBe(true);

      if (!loadResult.success) return;

      // Check that timestamp is recent (within last second)
      const now = Date.now();
      const lastUpdated = loadResult.value.lastUpdated.getTime();
      expect(now - lastUpdated).toBeLessThan(1000);
    });
  });
});
