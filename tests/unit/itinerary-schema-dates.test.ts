/**
 * Unit tests for itinerary schema date validation
 * Tests that dates are optional and validation works correctly
 */

import { describe, it, expect } from 'vitest';
import { itinerarySchema } from '../../src/domain/schemas/itinerary.schema.js';

describe('Itinerary Schema - Date Validation', () => {
  const baseItinerary = {
    id: '0440ba21-21bb-4561-90cc-2ef559c6c6b7',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    title: 'Test Itinerary',
    status: 'DRAFT' as const,
    destinations: [],
    travelers: [],
    segments: [],
    tags: [],
    metadata: {},
  };

  it('should validate itinerary without dates', () => {
    const result = itinerarySchema.safeParse(baseItinerary);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeUndefined();
      expect(result.data.endDate).toBeUndefined();
    }
  });

  it('should validate itinerary with both dates', () => {
    const withDates = {
      ...baseItinerary,
      startDate: new Date('2025-12-25'),
      endDate: new Date('2025-12-30'),
    };

    const result = itinerarySchema.safeParse(withDates);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeInstanceOf(Date);
      expect(result.data.endDate).toBeInstanceOf(Date);
    }
  });

  it('should validate itinerary with only startDate', () => {
    const withStartDate = {
      ...baseItinerary,
      startDate: new Date('2025-12-25'),
    };

    const result = itinerarySchema.safeParse(withStartDate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeInstanceOf(Date);
      expect(result.data.endDate).toBeUndefined();
    }
  });

  it('should validate itinerary with only endDate', () => {
    const withEndDate = {
      ...baseItinerary,
      endDate: new Date('2025-12-30'),
    };

    const result = itinerarySchema.safeParse(withEndDate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeUndefined();
      expect(result.data.endDate).toBeInstanceOf(Date);
    }
  });

  it('should reject when endDate is before startDate', () => {
    const invalidDates = {
      ...baseItinerary,
      startDate: new Date('2025-12-30'),
      endDate: new Date('2025-12-25'),
    };

    const result = itinerarySchema.safeParse(invalidDates);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('End date must be on or after start date');
    }
  });

  it('should allow same startDate and endDate', () => {
    const sameDate = new Date('2025-12-25');
    const sameDates = {
      ...baseItinerary,
      startDate: sameDate,
      endDate: sameDate,
    };

    const result = itinerarySchema.safeParse(sameDates);
    expect(result.success).toBe(true);
  });
});
