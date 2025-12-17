/**
 * Money type and utilities
 * @module domain/types/money
 */

/**
 * Represents a monetary amount with currency
 * Amount is stored in smallest currency unit (cents) for precision
 */
export interface Money {
  /** Amount in smallest currency unit (e.g., cents for USD) */
  amount: number;
  /** ISO 4217 currency code (3-letter code) */
  currency: string;
}

/**
 * Creates a Money object
 * @param amount - Amount in smallest currency unit
 * @param currency - ISO 4217 currency code
 * @returns A Money object
 */
export function createMoney(amount: number, currency: string): Money {
  return { amount, currency };
}

/**
 * Formats a Money object as a string
 * @param money - The Money object to format
 * @returns Formatted string like "$10.50 USD"
 */
export function formatMoney(money: Money): string {
  const majorUnit = money.amount / 100;
  return `${majorUnit.toFixed(2)} ${money.currency}`;
}

/**
 * Adds two Money objects
 * @param a - First Money object
 * @param b - Second Money object
 * @returns Sum of the two amounts
 * @throws Error if currencies don't match
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add money with different currencies: ${a.currency} and ${b.currency}`);
  }
  return {
    amount: a.amount + b.amount,
    currency: a.currency,
  };
}
