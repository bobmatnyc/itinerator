/**
 * Integration tests for storage layer date validation
 * Tests loading itineraries with and without dates
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { JsonItineraryStorage } from '../../src/storage/json-storage.js';
import type { ItineraryId } from '../../src/domain/types/branded.js';

describe('Storage Layer - Date Validation', () => {
  const storage = new JsonItineraryStorage('./data/itineraries');

  beforeAll(async () => {
    await storage.initialize();
  });

  it('should load existing itinerary without dates', async () => {
    // This is the actual problematic itinerary file
    const id = '0440ba21-21bb-4561-90cc-2ef559c6c6b7' as ItineraryId;

    const result = await storage.load(id);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.id).toBe(id);
      expect(result.value.title).toBe('New Itinerary');
      expect(result.value.startDate).toBeUndefined();
      expect(result.value.endDate).toBeUndefined();
    }
  });

  it('should list all itineraries including those without dates', async () => {
    const result = await storage.list();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.length).toBeGreaterThan(0);

      // Should include itineraries without dates
      const withoutDates = result.value.find(
        (summary) => summary.id === '0440ba21-21bb-4561-90cc-2ef559c6c6b7'
      );
      expect(withoutDates).toBeDefined();
    }
  });
});
