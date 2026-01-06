/**
 * Currency Exchange Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CurrencyExchangeService } from '../../../src/services/currency-exchange.service.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('CurrencyExchangeService', () => {
  let service: CurrencyExchangeService;

  beforeEach(() => {
    service = new CurrencyExchangeService({ cacheDuration: 1000 }); // 1 second for testing
    vi.clearAllMocks();
  });

  describe('getRate', () => {
    it('should return 1 for same currency', async () => {
      const result = await service.getRate('USD', 'USD');
      expect(result.rate).toBe(1);
      expect(result.from).toBe('USD');
      expect(result.to).toBe('USD');
    });

    it('should fetch rate from Frankfurter', async () => {
      const mockResponse = {
        amount: 1,
        base: 'JPY',
        date: '2024-01-01',
        rates: { USD: 0.0067 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getRate('JPY', 'USD');
      expect(result.rate).toBe(0.0067);
      expect(result.source).toBe('frankfurter');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.frankfurter.dev/v1/latest?base=JPY&symbols=USD',
        expect.any(Object)
      );
    });

    it('should cache results', async () => {
      const mockResponse = {
        amount: 1,
        base: 'JPY',
        date: '2024-01-01',
        rates: { USD: 0.0067 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // First call - should fetch
      const result1 = await service.getRate('JPY', 'USD');
      expect(result1.rate).toBe(0.0067);

      // Second call - should use cache
      const result2 = await service.getRate('JPY', 'USD');
      expect(result2.rate).toBe(0.0067);

      // Should only call fetch once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should fallback to ExchangeRate-API on Frankfurter failure', async () => {
      // Frankfurter fails
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      // ExchangeRate-API succeeds
      const mockFallbackResponse = {
        result: 'success',
        base_code: 'JPY',
        conversion_rates: { USD: 0.0068 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFallbackResponse,
      });

      const result = await service.getRate('JPY', 'USD');
      expect(result.rate).toBe(0.0068);
      expect(result.source).toBe('exchangerate-api');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when both APIs fail', async () => {
      // Both fail
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });

      await expect(service.getRate('JPY', 'USD')).rejects.toThrow('Failed to fetch exchange rate');
    });
  });

  describe('convert', () => {
    it('should convert amount correctly', async () => {
      const mockResponse = {
        amount: 1,
        base: 'JPY',
        date: '2024-01-01',
        rates: { USD: 0.0067 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.convert(15000, 'JPY', 'USD');
      expect(result.originalAmount).toBe(15000);
      expect(result.originalCurrency).toBe('JPY');
      expect(result.convertedAmount).toBe(100.5);
      expect(result.targetCurrency).toBe('USD');
      expect(result.rate).toBe(0.0067);
    });

    it('should convert range correctly', async () => {
      const mockResponse = {
        amount: 1,
        base: 'JPY',
        date: '2024-01-01',
        rates: { USD: 0.0067 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const min = await service.convert(15000, 'JPY', 'USD');
      const max = await service.convert(20000, 'JPY', 'USD');

      expect(min.convertedAmount).toBe(100.5);
      expect(max.convertedAmount).toBe(134);
      // Should use cache for second call
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle same currency conversion', async () => {
      const result = await service.convert(100, 'USD', 'USD');
      expect(result.originalAmount).toBe(100);
      expect(result.convertedAmount).toBe(100);
      expect(result.rate).toBe(1);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const mockResponse = {
        amount: 1,
        base: 'JPY',
        date: '2024-01-01',
        rates: { USD: 0.0067 },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Fetch once
      await service.getRate('JPY', 'USD');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearCache();

      // Fetch again - should call API
      await service.getRate('JPY', 'USD');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should provide cache stats', async () => {
      const mockResponse = {
        amount: 1,
        base: 'JPY',
        date: '2024-01-01',
        rates: { USD: 0.0067 },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await service.getRate('JPY', 'USD');
      await service.getRate('EUR', 'USD');

      const stats = service.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0].key).toBeDefined();
      expect(stats.entries[0].age).toBeGreaterThanOrEqual(0);
    });

    it('should expire cache after duration', async () => {
      const shortCacheService = new CurrencyExchangeService({ cacheDuration: 10 }); // 10ms

      const mockResponse = {
        amount: 1,
        base: 'JPY',
        date: '2024-01-01',
        rates: { USD: 0.0067 },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // First call
      await shortCacheService.getRate('JPY', 'USD');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Second call - should fetch again
      await shortCacheService.getRate('JPY', 'USD');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
