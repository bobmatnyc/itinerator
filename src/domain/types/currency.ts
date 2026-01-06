/**
 * Currency types and utilities
 * @module domain/types/currency
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
 * Currency symbol to ISO code mapping
 */
export const CURRENCY_SYMBOL_MAP: Record<string, CurrencyCode> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '元': 'CNY',
  '₩': 'KRW',
  '฿': 'THB',
  '₫': 'VND',
  'S$': 'SGD',
  'HK$': 'HKD',
  'NT$': 'TWD',
  'RM': 'MYR',
  'Rp': 'IDR',
  '₱': 'PHP',
  '₹': 'INR',
  'A$': 'AUD',
  'NZ$': 'NZD',
  'C$': 'CAD',
  'CHF': 'CHF',
  'kr': 'SEK', // Also NOK, DKK - context dependent
  'zł': 'PLN',
  'Kč': 'CZK',
  'Ft': 'HUF',
  'lei': 'RON',
  'лв': 'BGN',
  'kn': 'HRK',
  '₽': 'RUB',
  '₺': 'TRY',
  'R$': 'BRL',
  'Mex$': 'MXN',
  'ARS$': 'ARS',
  'CLP$': 'CLP',
  'COL$': 'COP',
  'S/.': 'PEN',
  'R': 'ZAR',
  'د.إ': 'AED',
  '﷼': 'SAR',
  '₪': 'ILS',
} as const;

/**
 * Reverse mapping: ISO code to primary symbol
 */
export const CURRENCY_CODE_TO_SYMBOL: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '元',
  KRW: '₩',
  THB: '฿',
  VND: '₫',
  SGD: 'S$',
  HKD: 'HK$',
  TWD: 'NT$',
  MYR: 'RM',
  IDR: 'Rp',
  PHP: '₱',
  INR: '₹',
  AUD: 'A$',
  NZD: 'NZ$',
  CAD: 'C$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  BGN: 'лв',
  HRK: 'kn',
  RUB: '₽',
  TRY: '₺',
  BRL: 'R$',
  MXN: 'Mex$',
  ARS: 'ARS$',
  CLP: 'CLP$',
  COP: 'COL$',
  PEN: 'S/.',
  ZAR: 'R',
  AED: 'د.إ',
  SAR: '﷼',
  ILS: '₪',
} as const;

/**
 * Exchange rate with timestamp
 */
export interface ExchangeRate {
  /** Source currency code */
  from: CurrencyCode;
  /** Target currency code */
  to: CurrencyCode;
  /** Exchange rate (1 unit of 'from' = rate units of 'to') */
  rate: number;
  /** When the rate was fetched (ISO 8601) */
  timestamp: string;
  /** API source that provided the rate */
  source: 'frankfurter' | 'exchangerate-api';
}

/**
 * Parsed price information from text
 */
export interface ParsedPrice {
  /** Original text that was parsed */
  original: string;
  /** Detected currency code */
  currency: CurrencyCode;
  /** Minimum amount (or single amount if not a range) */
  minAmount: number;
  /** Maximum amount (undefined if not a range) */
  maxAmount?: number;
  /** Whether this is a range (e.g., "15,000-20,000") */
  isRange: boolean;
  /** Additional context (e.g., "per person", "per night") */
  context?: string;
}

/**
 * Result of currency conversion
 */
export interface ConversionResult {
  /** Original amount */
  originalAmount: number;
  /** Original currency */
  originalCurrency: CurrencyCode;
  /** Converted amount */
  convertedAmount: number;
  /** Target currency */
  targetCurrency: CurrencyCode;
  /** Exchange rate used */
  rate: number;
  /** When the conversion was performed */
  timestamp: string;
}
