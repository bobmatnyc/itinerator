/**
 * Currency Exchange Service (Viewer)
 * Provides exchange rates and currency conversion using free APIs
 * Adapted from core library for SvelteKit viewer
 */

import type { CurrencyCode, ConversionResult } from '$lib/types/currency';

/**
 * Cache entry for exchange rates
 */
interface CacheEntry {
  rate: number;
  timestamp: number;
  source: 'frankfurter' | 'exchangerate-api';
}

/**
 * Frankfurter API response format
 */
interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

/**
 * ExchangeRate-API response format
 */
interface ExchangeRateApiResponse {
  result: string;
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  base_code: string;
  conversion_rates: Record<string, number>;
}

/**
 * Currency Exchange Service configuration
 */
export interface CurrencyExchangeConfig {
  /** Cache duration in milliseconds (default: 24 hours) */
  cacheDuration?: number;
  /** Timeout for API requests in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * Service for fetching exchange rates and converting currencies
 */
export class CurrencyExchangeService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly cacheDuration: number;
  private readonly timeout: number;

  constructor(config: CurrencyExchangeConfig = {}) {
    // Default to 24-hour cache
    this.cacheDuration = config.cacheDuration ?? 24 * 60 * 60 * 1000;
    this.timeout = config.timeout ?? 5000;
  }

  /**
   * Get exchange rate between two currencies
   * Uses 24-hour cache to minimize API calls
   */
  async getRate(from: CurrencyCode, to: CurrencyCode): Promise<{ rate: number; source: string }> {
    // Same currency
    if (from === to) {
      return {
        rate: 1,
        source: 'frankfurter',
      };
    }

    const cacheKey = `${from}-${to}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // Check cache
    if (cached && now - cached.timestamp < this.cacheDuration) {
      return {
        rate: cached.rate,
        source: cached.source,
      };
    }

    // Fetch fresh rate
    try {
      const rate = await this.fetchFromFrankfurter(from, to);
      this.cache.set(cacheKey, {
        rate,
        timestamp: now,
        source: 'frankfurter',
      });
      return {
        rate,
        source: 'frankfurter',
      };
    } catch (error) {
      // Fallback to exchangerate-api
      try {
        const rate = await this.fetchFromExchangeRateApi(from, to);
        this.cache.set(cacheKey, {
          rate,
          timestamp: now,
          source: 'exchangerate-api',
        });
        return {
          rate,
          source: 'exchangerate-api',
        };
      } catch (fallbackError) {
        throw new Error(
          `Failed to fetch exchange rate for ${from} to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convert(amount: number, from: CurrencyCode, to: CurrencyCode): Promise<ConversionResult> {
    const exchangeRate = await this.getRate(from, to);
    const convertedAmount = amount * exchangeRate.rate;

    return {
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount,
      targetCurrency: to,
      rate: exchangeRate.rate,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Fetch rate from Frankfurter API (primary source)
   * Free, no API key required, EU-based
   */
  private async fetchFromFrankfurter(from: CurrencyCode, to: CurrencyCode): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`;
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as FrankfurterResponse;
      const rate = data.rates[to];

      if (rate === undefined) {
        throw new Error(`No rate found for ${from} to ${to}`);
      }

      return rate;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch rate from ExchangeRate-API (fallback source)
   * Free tier: 1,500 requests/month, no API key required
   */
  private async fetchFromExchangeRateApi(from: CurrencyCode, to: CurrencyCode): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `https://open.er-api.com/v6/latest/${from}`;
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`ExchangeRate-API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ExchangeRateApiResponse;
      const rate = data.conversion_rates[to];

      if (rate === undefined) {
        throw new Error(`No rate found for ${from} to ${to}`);
      }

      return rate;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Clear the cache
   * Useful for testing or forcing fresh rates
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ key: string; age: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      age: now - value.timestamp,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}
