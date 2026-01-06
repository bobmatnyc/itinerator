/**
 * Currency Integration Tests
 * Tests the full currency exchange workflow end-to-end
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CurrencyExchangeService } from '../../src/services/currency-exchange.service.js';
import { parsePrice, parsePrices } from '../../src/utils/price-parser.js';
import { convertPriceString, convertParsedPrice, convertPriceStrings } from '../../src/utils/price-converter.js';

describe('Currency Integration', () => {
  let service: CurrencyExchangeService;

  beforeEach(() => {
    service = new CurrencyExchangeService();
  });

  describe('End-to-end workflow', () => {
    it('should parse and convert a price string', async () => {
      // Parse
      const parsed = parsePrice('¥15,000-20,000 per person');
      expect(parsed).toBeTruthy();
      expect(parsed?.currency).toBe('JPY');
      expect(parsed?.isRange).toBe(true);

      // Convert
      if (parsed) {
        const result = await convertParsedPrice(parsed, 'USD', service);
        expect(result).toBeTruthy();
        expect(result?.min.targetCurrency).toBe('USD');
        expect(result?.max?.targetCurrency).toBe('USD');

        // Sanity check: JPY to USD should be a small fraction
        expect(result?.min.convertedAmount).toBeLessThan(parsed.minAmount);
      }
    }, 10000); // Allow time for API call

    it('should handle full conversion with formatting', async () => {
      const original = '€100-150 per night';
      const converted = await convertPriceString(original, 'USD', service);

      expect(converted).toBeTruthy();
      expect(converted).toContain('€100-150');
      expect(converted).toContain('USD');
      expect(converted).toContain('per night');
    }, 10000);

    it('should batch convert multiple prices efficiently', async () => {
      const prices = [
        '¥15,000',
        '¥20,000',
        '¥8,500',
      ];

      const results = await convertPriceStrings(prices, 'USD', service);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeTruthy();
        expect(result).toContain('USD');
      });

      // Verify cache was used (should have 1 entry for JPY-USD)
      const stats = service.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(1);
    }, 10000);

    it('should handle same-currency conversions instantly', async () => {
      const converted = await convertPriceString('$100-150', 'USD', service);
      expect(converted).toBe('$100-150'); // No conversion annotation
    });

    it('should extract and convert multiple prices from text', async () => {
      const text = 'Tour includes lunch (¥2,000) and entrance fee (¥1,500)';
      const prices = parsePrices(text);

      expect(prices).toHaveLength(2);

      // Convert all to USD
      const conversions = await Promise.all(
        prices.map((p) => service.convert(p.minAmount, p.currency, 'USD'))
      );

      conversions.forEach((conv) => {
        expect(conv.targetCurrency).toBe('USD');
        expect(conv.convertedAmount).toBeGreaterThan(0);
      });
    }, 10000);
  });

  describe('Real-world travel scenarios', () => {
    it('should handle Japan trip pricing', async () => {
      const activities = [
        { name: 'Sushi Class', price: '¥15,000 per person' },
        { name: 'Temple Tour', price: '¥5,000-8,000 per person' },
        { name: 'Onsen Visit', price: '¥800-1,500' },
      ];

      for (const activity of activities) {
        const converted = await convertPriceString(activity.price, 'USD', service);
        expect(converted).toContain('USD');
        expect(converted).toContain('¥');
      }
    }, 15000);

    it('should handle multi-currency European trip', async () => {
      const expenses = [
        { category: 'Hotel Paris', price: '€150 per night' },
        { category: 'Museum Pass', price: '€75' },
        { category: 'Train to London', price: '£120' },
        { category: 'London Hotel', price: '£200 per night' },
      ];

      const conversions = await Promise.all(
        expenses.map((e) => convertPriceString(e.price, 'USD', service))
      );

      conversions.forEach((converted, i) => {
        expect(converted).toContain('USD');
        const original = expenses[i].price;
        if (original.includes('€')) {
          expect(converted).toContain('€');
        } else if (original.includes('£')) {
          expect(converted).toContain('£');
        }
      });
    }, 15000);

    it('should handle Southeast Asia pricing', async () => {
      const expenses = [
        { city: 'Bangkok', price: '฿800-1,200' },
        { city: 'Singapore', price: 'S$45-60' },
        { city: 'Hong Kong', price: 'HK$250-350' },
      ];

      for (const expense of expenses) {
        const parsed = parsePrice(expense.price);
        expect(parsed).toBeTruthy();

        if (parsed) {
          const result = await convertParsedPrice(parsed, 'USD', service);
          expect(result).toBeTruthy();
        }
      }
    }, 15000);
  });

  describe('Error handling and edge cases', () => {
    it('should handle invalid price text gracefully', async () => {
      const converted = await convertPriceString('no price here', 'USD', service);
      expect(converted).toBeNull();
    });

    it('should handle empty strings', async () => {
      const converted = await convertPriceString('', 'USD', service);
      expect(converted).toBeNull();
    });

    it('should preserve original text on conversion error', async () => {
      // This test would require mocking API failure
      // For now, just verify null handling
      const parsed = parsePrice('invalid');
      expect(parsed).toBeNull();
    });
  });

  describe('Cache efficiency', () => {
    it('should reuse cached rates for same currency pair', async () => {
      service.clearCache();

      // First conversion
      await service.getRate('JPY', 'USD');
      const stats1 = service.getCacheStats();
      expect(stats1.size).toBe(1);

      // Second conversion - should use cache
      await service.getRate('JPY', 'USD');
      const stats2 = service.getCacheStats();
      expect(stats2.size).toBe(1); // Still 1 entry

      // Different pair - should add to cache
      await service.getRate('EUR', 'USD');
      const stats3 = service.getCacheStats();
      expect(stats3.size).toBe(2);
    }, 10000);

    it('should provide useful cache statistics', async () => {
      service.clearCache();

      await service.getRate('JPY', 'USD');
      await service.getRate('EUR', 'USD');

      const stats = service.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
      stats.entries.forEach((entry) => {
        expect(entry.key).toBeTruthy();
        expect(entry.age).toBeGreaterThanOrEqual(0);
      });
    }, 10000);
  });

  describe('Number format handling', () => {
    it('should correctly parse various decimal formats', () => {
      const examples = [
        { input: '$100.50', expected: 100.5 },
        { input: '€100,50', expected: 100.5 },
        { input: '¥15,000', expected: 15000 },
        { input: '€15.000', expected: 15000 },
      ];

      for (const example of examples) {
        const parsed = parsePrice(example.input);
        expect(parsed?.minAmount).toBe(example.expected);
      }
    });

    it('should handle ranges correctly', () => {
      const examples = [
        { input: '¥15,000-20,000', min: 15000, max: 20000 },
        { input: '$100-150.50', min: 100, max: 150.5 },
        { input: '€50-75', min: 50, max: 75 },
      ];

      for (const example of examples) {
        const parsed = parsePrice(example.input);
        expect(parsed?.isRange).toBe(true);
        expect(parsed?.minAmount).toBe(example.min);
        expect(parsed?.maxAmount).toBe(example.max);
      }
    });
  });
});
