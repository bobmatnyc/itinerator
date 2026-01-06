/**
 * Price Converter Utility
 * Combines price parsing and currency conversion
 * @module utils/price-converter
 */

import type { CurrencyCode, ParsedPrice, ConversionResult } from '../domain/types/currency.js';
import { CurrencyExchangeService } from '../services/currency-exchange.service.js';
import { parsePrice, formatPriceWithConversion } from './price-parser.js';

/**
 * Convert a price string to another currency with formatting
 * Example: "¥15,000-20,000 per person" → "¥15,000-20,000 (~$100-135 USD) per person"
 */
export async function convertPriceString(
  priceText: string,
  targetCurrency: CurrencyCode,
  exchangeService?: CurrencyExchangeService
): Promise<string | null> {
  const parsed = parsePrice(priceText);
  if (!parsed) {
    return null;
  }

  // Use provided service or create a new one
  const service = exchangeService ?? new CurrencyExchangeService();

  // Same currency - no conversion needed
  if (parsed.currency === targetCurrency) {
    return priceText;
  }

  try {
    // Convert min amount
    const minConversion = await service.convert(parsed.minAmount, parsed.currency, targetCurrency);

    // Convert max amount if range
    let maxConversion: ConversionResult | undefined;
    if (parsed.isRange && parsed.maxAmount) {
      maxConversion = await service.convert(parsed.maxAmount, parsed.currency, targetCurrency);
    }

    return formatPriceWithConversion(
      parsed,
      minConversion.convertedAmount,
      maxConversion?.convertedAmount,
      targetCurrency
    );
  } catch (error) {
    console.error('Price conversion failed:', error);
    return priceText; // Return original on error
  }
}

/**
 * Convert a parsed price to another currency
 */
export async function convertParsedPrice(
  parsedPrice: ParsedPrice,
  targetCurrency: CurrencyCode,
  exchangeService?: CurrencyExchangeService
): Promise<{ min: ConversionResult; max?: ConversionResult } | null> {
  // Same currency - no conversion needed
  if (parsedPrice.currency === targetCurrency) {
    return {
      min: {
        originalAmount: parsedPrice.minAmount,
        originalCurrency: parsedPrice.currency,
        convertedAmount: parsedPrice.minAmount,
        targetCurrency,
        rate: 1,
        timestamp: new Date().toISOString(),
      },
      max: parsedPrice.maxAmount
        ? {
            originalAmount: parsedPrice.maxAmount,
            originalCurrency: parsedPrice.currency,
            convertedAmount: parsedPrice.maxAmount,
            targetCurrency,
            rate: 1,
            timestamp: new Date().toISOString(),
          }
        : undefined,
    };
  }

  // Use provided service or create a new one
  const service = exchangeService ?? new CurrencyExchangeService();

  try {
    const min = await service.convert(parsedPrice.minAmount, parsedPrice.currency, targetCurrency);

    let max: ConversionResult | undefined;
    if (parsedPrice.isRange && parsedPrice.maxAmount) {
      max = await service.convert(parsedPrice.maxAmount, parsedPrice.currency, targetCurrency);
    }

    return { min, max };
  } catch (error) {
    console.error('Price conversion failed:', error);
    return null;
  }
}

/**
 * Batch convert multiple price strings
 */
export async function convertPriceStrings(
  priceTexts: string[],
  targetCurrency: CurrencyCode,
  exchangeService?: CurrencyExchangeService
): Promise<Array<string | null>> {
  // Share service instance for cache benefits
  const service = exchangeService ?? new CurrencyExchangeService();

  return Promise.all(priceTexts.map((text) => convertPriceString(text, targetCurrency, service)));
}
