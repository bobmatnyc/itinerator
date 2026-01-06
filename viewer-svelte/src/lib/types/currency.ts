/**
 * Currency types (subset from core domain)
 * @module lib/types/currency
 */

/**
 * ISO 4217 currency codes
 */
export type CurrencyCode =
  | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'KRW' | 'THB' | 'VND'
  | 'SGD' | 'HKD' | 'TWD' | 'MYR' | 'IDR' | 'PHP' | 'INR' | 'AUD'
  | 'NZD' | 'CAD' | 'CHF' | 'SEK' | 'NOK' | 'DKK' | 'PLN' | 'CZK'
  | 'HUF' | 'RON' | 'BGN' | 'HRK' | 'RUB' | 'TRY' | 'BRL' | 'MXN'
  | 'ARS' | 'CLP' | 'COP' | 'PEN' | 'ZAR' | 'AED' | 'SAR' | 'ILS';

/**
 * Result of currency conversion
 */
export interface ConversionResult {
  originalAmount: number;
  originalCurrency: CurrencyCode;
  convertedAmount: number;
  targetCurrency: CurrencyCode;
  rate: number;
  timestamp: string;
}
