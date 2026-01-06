/**
 * Price Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parsePrice, formatParsedPrice, parsePrices, formatPriceWithConversion } from '../../../src/utils/price-parser.js';

describe('parsePrice', () => {
  it('should parse single JPY amount', () => {
    const result = parsePrice('¥15,000');
    expect(result).toEqual({
      original: '¥15,000',
      currency: 'JPY',
      minAmount: 15000,
      isRange: false,
      context: undefined,
    });
  });

  it('should parse JPY range', () => {
    const result = parsePrice('¥15,000-20,000 per person');
    expect(result).toEqual({
      original: '¥15,000-20,000 per person',
      currency: 'JPY',
      minAmount: 15000,
      maxAmount: 20000,
      isRange: true,
      context: 'per person',
    });
  });

  it('should parse USD amount with symbol', () => {
    const result = parsePrice('$100.50');
    expect(result).toEqual({
      original: '$100.50',
      currency: 'USD',
      minAmount: 100.5,
      isRange: false,
      context: undefined,
    });
  });

  it('should parse EUR amount', () => {
    const result = parsePrice('€50-75 per night');
    expect(result).toEqual({
      original: '€50-75 per night',
      currency: 'EUR',
      minAmount: 50,
      maxAmount: 75,
      isRange: true,
      context: 'per night',
    });
  });

  it('should parse GBP amount', () => {
    const result = parsePrice('£25.99 each');
    expect(result).toEqual({
      original: '£25.99 each',
      currency: 'GBP',
      minAmount: 25.99,
      isRange: false,
      context: 'each',
    });
  });

  it('should parse KRW amount', () => {
    const result = parsePrice('₩50,000');
    expect(result).toEqual({
      original: '₩50,000',
      currency: 'KRW',
      minAmount: 50000,
      isRange: false,
      context: undefined,
    });
  });

  it('should parse THB amount', () => {
    const result = parsePrice('฿800-1,200');
    expect(result).toEqual({
      original: '฿800-1,200',
      currency: 'THB',
      minAmount: 800,
      maxAmount: 1200,
      isRange: true,
      context: undefined,
    });
  });

  it('should parse SGD with multi-char symbol', () => {
    const result = parsePrice('S$45.00');
    expect(result).toEqual({
      original: 'S$45.00',
      currency: 'SGD',
      minAmount: 45,
      isRange: false,
      context: undefined,
    });
  });

  it('should parse HKD amount', () => {
    const result = parsePrice('HK$250-350');
    expect(result).toEqual({
      original: 'HK$250-350',
      currency: 'HKD',
      minAmount: 250,
      maxAmount: 350,
      isRange: true,
      context: undefined,
    });
  });

  it('should parse amount with ISO code', () => {
    const result = parsePrice('1,500 JPY');
    expect(result).toEqual({
      original: '1,500 JPY',
      currency: 'JPY',
      minAmount: 1500,
      isRange: false,
      context: undefined,
    });
  });

  it('should handle European number format', () => {
    // Note: This is tricky - 15.000 could be 15,000 or 15.000
    // Our parser treats dot as thousands separator unless followed by 1-2 digits
    const result = parsePrice('€15.000');
    expect(result?.minAmount).toBe(15000);
  });

  it('should return null for text without currency', () => {
    const result = parsePrice('15000 per person');
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = parsePrice('');
    expect(result).toBeNull();
  });

  it('should handle "pp" context', () => {
    const result = parsePrice('$50 pp');
    expect(result?.context).toBe('pp');
  });

  it('should handle "pax" context', () => {
    const result = parsePrice('€100 pax');
    expect(result?.context).toBe('pax');
  });
});

describe('formatParsedPrice', () => {
  it('should format single amount', () => {
    const parsed = {
      original: '¥15,000',
      currency: 'JPY' as const,
      minAmount: 15000,
      isRange: false,
    };
    const result = formatParsedPrice(parsed);
    expect(result).toBe('¥15,000');
  });

  it('should format range', () => {
    const parsed = {
      original: '¥15,000-20,000',
      currency: 'JPY' as const,
      minAmount: 15000,
      maxAmount: 20000,
      isRange: true,
    };
    const result = formatParsedPrice(parsed);
    expect(result).toBe('¥15,000-20,000');
  });

  it('should include context', () => {
    const parsed = {
      original: '¥15,000 per person',
      currency: 'JPY' as const,
      minAmount: 15000,
      isRange: false,
      context: 'per person',
    };
    const result = formatParsedPrice(parsed);
    expect(result).toBe('¥15,000 per person');
  });

  it('should format decimals', () => {
    const parsed = {
      original: '$100.50',
      currency: 'USD' as const,
      minAmount: 100.5,
      isRange: false,
    };
    const result = formatParsedPrice(parsed);
    expect(result).toBe('$100.50');
  });
});

describe('formatPriceWithConversion', () => {
  it('should format single value conversion', () => {
    const parsed = {
      original: '¥15,000',
      currency: 'JPY' as const,
      minAmount: 15000,
      isRange: false,
    };
    const result = formatPriceWithConversion(parsed, 100.5, undefined, 'USD');
    expect(result).toBe('¥15,000 (~101 USD)');
  });

  it('should format range conversion', () => {
    const parsed = {
      original: '¥15,000-20,000',
      currency: 'JPY' as const,
      minAmount: 15000,
      maxAmount: 20000,
      isRange: true,
    };
    const result = formatPriceWithConversion(parsed, 100.5, 134, 'USD');
    expect(result).toBe('¥15,000-20,000 (~101-134 USD)');
  });

  it('should preserve context in conversion', () => {
    const parsed = {
      original: '¥15,000 per person',
      currency: 'JPY' as const,
      minAmount: 15000,
      isRange: false,
      context: 'per person',
    };
    const result = formatPriceWithConversion(parsed, 100.5, undefined, 'USD');
    expect(result).toBe('¥15,000 per person (~101 USD)');
  });
});

describe('parsePrices', () => {
  it('should parse multiple prices', () => {
    const result = parsePrices('¥15,000 per person and €50 per night');
    expect(result).toHaveLength(2);
    expect(result[0].currency).toBe('JPY');
    expect(result[1].currency).toBe('EUR');
  });

  it('should parse prices separated by commas', () => {
    const result = parsePrices('$100, £75, €85');
    expect(result).toHaveLength(3);
    expect(result[0].currency).toBe('USD');
    expect(result[1].currency).toBe('GBP');
    expect(result[2].currency).toBe('EUR');
  });

  it('should parse prices separated by "or"', () => {
    const result = parsePrices('$50 or €45');
    expect(result).toHaveLength(2);
  });

  it('should return empty array for no prices', () => {
    const result = parsePrices('No prices here');
    expect(result).toEqual([]);
  });
});
