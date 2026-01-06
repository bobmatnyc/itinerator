/**
 * Unit tests for travel preferences schema validation
 * Tests new home country/currency and travel style fields
 */

import { describe, it, expect } from 'vitest';
import { travelPreferencesSchema, travelStyleSchema } from '../../src/domain/schemas/traveler.schema.js';

describe('Travel Preferences Schema', () => {
  describe('Default values', () => {
    it('should use USA and USD as defaults', () => {
      const result = travelPreferencesSchema.parse({});
      expect(result.homeCountry).toBe('USA');
      expect(result.homeCurrency).toBe('USD');
    });

    it('should not require travelStyle', () => {
      const result = travelPreferencesSchema.parse({});
      expect(result.travelStyle).toBeUndefined();
    });
  });

  describe('Home country validation', () => {
    it('should accept any country string', () => {
      const result = travelPreferencesSchema.parse({ homeCountry: 'Japan' });
      expect(result.homeCountry).toBe('Japan');
    });

    it('should accept empty string', () => {
      const result = travelPreferencesSchema.parse({ homeCountry: '' });
      expect(result.homeCountry).toBe('');
    });
  });

  describe('Currency validation', () => {
    it('should uppercase currency codes', () => {
      const result = travelPreferencesSchema.parse({ homeCurrency: 'jpy' });
      expect(result.homeCurrency).toBe('JPY');
    });

    it('should accept uppercase currency codes', () => {
      const result = travelPreferencesSchema.parse({ homeCurrency: 'EUR' });
      expect(result.homeCurrency).toBe('EUR');
    });

    it('should reject currency codes shorter than 3 characters', () => {
      const result = travelPreferencesSchema.safeParse({ homeCurrency: 'US' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('3-letter');
      }
    });

    it('should reject currency codes longer than 3 characters', () => {
      const result = travelPreferencesSchema.safeParse({ homeCurrency: 'USDD' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('3-letter');
      }
    });
  });

  describe('Travel style validation', () => {
    it('should accept valid travel style object', () => {
      const travelStyle = {
        budget: 'luxury' as const,
        pace: 'relaxed' as const,
        interests: ['food', 'art'],
        diningPreferences: ['fine dining'],
        accommodationPreferences: ['boutique hotels'],
      };
      const result = travelPreferencesSchema.parse({ travelStyle });
      expect(result.travelStyle).toEqual(travelStyle);
    });

    it('should use defaults for travel style when provided as empty object', () => {
      const result = travelPreferencesSchema.parse({ travelStyle: {} });
      expect(result.travelStyle?.budget).toBe('moderate');
      expect(result.travelStyle?.pace).toBe('moderate');
      expect(result.travelStyle?.interests).toEqual([]);
      expect(result.travelStyle?.diningPreferences).toEqual([]);
      expect(result.travelStyle?.accommodationPreferences).toEqual([]);
    });

    it('should reject invalid budget values', () => {
      const result = travelPreferencesSchema.safeParse({
        travelStyle: { budget: 'super-luxury' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid pace values', () => {
      const result = travelPreferencesSchema.safeParse({
        travelStyle: { pace: 'super-fast' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Complex preferences', () => {
    it('should accept all fields together', () => {
      const prefs = {
        homeCountry: 'United Kingdom',
        homeCurrency: 'gbp',
        seatPreference: 'WINDOW' as const,
        mealPreference: 'Vegetarian',
        hotelChainPreference: ['Marriott', 'Hilton'],
        accessibility: ['wheelchair'],
        travelStyle: {
          budget: 'moderate' as const,
          pace: 'packed' as const,
          interests: ['history', 'museums', 'food'],
          diningPreferences: ['local cuisine', 'street food'],
          accommodationPreferences: ['hotels', 'airbnb'],
        },
      };

      const result = travelPreferencesSchema.parse(prefs);
      expect(result.homeCountry).toBe('United Kingdom');
      expect(result.homeCurrency).toBe('GBP'); // Uppercased
      expect(result.seatPreference).toBe('WINDOW');
      expect(result.travelStyle?.budget).toBe('moderate');
      expect(result.travelStyle?.interests).toEqual(['history', 'museums', 'food']);
    });
  });
});

describe('Travel Style Schema', () => {
  it('should accept all valid budget levels', () => {
    const budgets = ['budget', 'moderate', 'luxury', 'ultra-luxury'] as const;
    for (const budget of budgets) {
      const result = travelStyleSchema.parse({ budget });
      expect(result.budget).toBe(budget);
    }
  });

  it('should accept all valid pace levels', () => {
    const paces = ['relaxed', 'moderate', 'packed'] as const;
    for (const pace of paces) {
      const result = travelStyleSchema.parse({ pace });
      expect(result.pace).toBe(pace);
    }
  });

  it('should accept arrays for interests, dining, and accommodation', () => {
    const style = {
      interests: ['food', 'art', 'nature'],
      diningPreferences: ['fine dining', 'street food'],
      accommodationPreferences: ['ryokans', 'hostels'],
    };
    const result = travelStyleSchema.parse(style);
    expect(result.interests).toEqual(style.interests);
    expect(result.diningPreferences).toEqual(style.diningPreferences);
    expect(result.accommodationPreferences).toEqual(style.accommodationPreferences);
  });
});
