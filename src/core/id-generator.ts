/**
 * UUID generation and validation utilities
 * @module core/id-generator
 */

import { randomUUID } from 'node:crypto';

/**
 * Generates a new UUID v4
 * @returns A UUID string
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * UUID v4 validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates whether a string is a valid UUID v4
 * @param value - The string to validate
 * @returns True if the value is a valid UUID v4
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
