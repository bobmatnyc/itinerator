/**
 * Price Parser Utility
 * Extracts price information from text strings
 * @module utils/price-parser
 */

import type { ParsedPrice, CurrencyCode } from '../domain/types/currency.js';
import { CURRENCY_SYMBOL_MAP } from '../domain/types/currency.js';

/**
 * Parse price from text like "¥15,000-20,000 per person"
 * Supports ranges, single values, and various currency symbols
 */
export function parsePrice(text: string): ParsedPrice | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  // Try to find currency symbol
  const currency = detectCurrency(trimmed);
  if (!currency) {
    return null;
  }

  // Extract numbers and context
  const { amounts, context } = extractAmountsAndContext(trimmed);
  if (amounts.length === 0) {
    return null;
  }

  // Parse as range or single value
  if (amounts.length === 2) {
    const [min, max] = amounts.sort((a, b) => a - b);
    return {
      original: text,
      currency,
      minAmount: min,
      maxAmount: max,
      isRange: true,
      context,
    };
  }

  // Single value
  return {
    original: text,
    currency,
    minAmount: amounts[0],
    isRange: false,
    context,
  };
}

/**
 * Detect currency from text
 * Looks for currency symbols or ISO codes
 */
function detectCurrency(text: string): CurrencyCode | null {
  // Check for multi-character symbols first (e.g., "S$", "HK$", "NT$")
  const multiCharSymbols = ['S$', 'HK$', 'NT$', 'A$', 'NZ$', 'C$', 'Mex$', 'ARS$', 'CLP$', 'COL$', 'S/.', 'R$'];
  for (const symbol of multiCharSymbols) {
    if (text.includes(symbol)) {
      return CURRENCY_SYMBOL_MAP[symbol];
    }
  }

  // Check for single-character symbols
  const singleCharSymbols = Object.keys(CURRENCY_SYMBOL_MAP).filter((s) => s.length === 1);
  for (const symbol of singleCharSymbols) {
    if (text.includes(symbol)) {
      return CURRENCY_SYMBOL_MAP[symbol];
    }
  }

  // Check for ISO codes (USD, EUR, JPY, etc.)
  const isoMatch = text.match(/\b([A-Z]{3})\b/);
  if (isoMatch) {
    const code = isoMatch[1] as CurrencyCode;
    // Validate it's a known currency
    if (Object.values(CURRENCY_SYMBOL_MAP).includes(code)) {
      return code;
    }
  }

  return null;
}

/**
 * Extract numeric amounts and context from text
 */
function extractAmountsAndContext(text: string): {
  amounts: number[];
  context?: string;
} {
  // Remove currency symbols for easier parsing
  let cleaned = text;
  for (const symbol of Object.keys(CURRENCY_SYMBOL_MAP)) {
    cleaned = cleaned.replace(symbol, ' ');
  }

  // Extract context phrases (per person, per night, etc.)
  const contextMatch = cleaned.match(/\b(per\s+\w+|each|total|pp|pax)\b/i);
  const context = contextMatch ? contextMatch[0] : undefined;

  // Find all numbers (supporting thousands separators and decimals)
  // Matches: 15,000 | 15.000 | 15000 | 15,000.50 | 15.50
  const numberPattern = /\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{1,2})?/g;
  const matches = cleaned.match(numberPattern) || [];

  const amounts = matches
    .map((match) => {
      // Normalize separators
      // Check if this looks like a decimal number (ends with .XX or ,XX where XX is 1-2 digits)
      const decimalDotMatch = match.match(/\.(\d{1,2})$/);
      const decimalCommaMatch = match.match(/,(\d{1,2})$/);

      if (decimalDotMatch) {
        // Has decimal dot at end (e.g., 100.50)
        // Remove any commas (thousands separators), keep the dot
        const normalized = match.replace(/,/g, '');
        return Number.parseFloat(normalized);
      }

      if (decimalCommaMatch) {
        // Has decimal comma at end (e.g., 100,50 European style)
        // Remove dots (thousands separators), replace comma with dot
        const normalized = match.replace(/\./g, '').replace(',', '.');
        return Number.parseFloat(normalized);
      }

      // No decimal part - check if it's thousands formatted
      if (match.includes(',')) {
        // Comma as thousands separator (e.g., 15,000)
        const normalized = match.replace(/,/g, '');
        return Number.parseFloat(normalized);
      }

      if (match.includes('.')) {
        // Dot as thousands separator (e.g., 15.000)
        // Only if it's not a small decimal number
        const withoutDot = match.replace(/\./g, '');
        const asNumber = Number.parseFloat(withoutDot);
        // If removing dots gives us a large number, it was thousands separator
        if (asNumber >= 1000) {
          return asNumber;
        }
        // Otherwise it might be a decimal like "15.0"
        return Number.parseFloat(match);
      }

      // No separators
      return Number.parseFloat(match);
    })
    .filter((n) => !Number.isNaN(n) && n > 0);

  return { amounts, context };
}

/**
 * Format price with conversion
 * Example: "¥15,000-20,000 (~$100-135 USD)"
 */
export function formatPriceWithConversion(
  originalPrice: ParsedPrice,
  convertedMin: number,
  convertedMax: number | undefined,
  targetCurrency: CurrencyCode
): string {
  const original = formatParsedPrice(originalPrice);

  // Format converted amounts
  const convertedFormatted = convertedMax
    ? `${Math.round(convertedMin)}-${Math.round(convertedMax)}`
    : `${Math.round(convertedMin)}`;

  return `${original} (~${convertedFormatted} ${targetCurrency})`;
}

/**
 * Format a ParsedPrice back to readable text
 */
export function formatParsedPrice(price: ParsedPrice): string {
  const symbol = getCurrencySymbol(price.currency);

  const formatted = price.isRange && price.maxAmount
    ? `${symbol}${formatNumber(price.minAmount)}-${formatNumber(price.maxAmount)}`
    : `${symbol}${formatNumber(price.minAmount)}`;

  return price.context ? `${formatted} ${price.context}` : formatted;
}

/**
 * Get currency symbol for a currency code
 */
function getCurrencySymbol(currency: CurrencyCode): string {
  // Try to find the symbol from the reverse map
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOL_MAP)) {
    if (code === currency) {
      return symbol;
    }
  }
  return currency; // Fallback to ISO code
}

/**
 * Format number with thousands separators
 */
function formatNumber(num: number): string {
  // If it has decimals, preserve them
  if (num % 1 !== 0) {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  // Integer
  return num.toLocaleString('en-US');
}

/**
 * Parse multiple prices from text
 * Useful for extracting all prices from a longer description
 */
export function parsePrices(text: string): ParsedPrice[] {
  // Split on common delimiters and parse each part
  const parts = text.split(/[;,]|\band\b|\bor\b/i);
  const prices: ParsedPrice[] = [];

  for (const part of parts) {
    const parsed = parsePrice(part);
    if (parsed) {
      prices.push(parsed);
    }
  }

  return prices;
}
