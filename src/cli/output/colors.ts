/**
 * Color utilities for CLI output
 * @module cli/output/colors
 */

import pc from 'picocolors';

/**
 * Color utility functions for consistent CLI output
 */
export const colors = {
  success: pc.green,
  error: pc.red,
  warning: pc.yellow,
  info: pc.blue,
  dim: pc.dim,
  bold: pc.bold,
  heading: (s: string): string => pc.bold(pc.cyan(s)),
  id: pc.cyan,
  date: pc.yellow,
  status: {
    DRAFT: pc.dim,
    PLANNED: pc.blue,
    CONFIRMED: pc.green,
    IN_PROGRESS: pc.cyan,
    COMPLETED: (s: string): string => pc.dim(pc.green(s)),
    CANCELLED: (s: string): string => pc.dim(pc.red(s)),
  },
  segmentType: {
    FLIGHT: pc.magenta,
    HOTEL: pc.blue,
    MEETING: pc.yellow,
    ACTIVITY: pc.green,
    TRANSFER: pc.cyan,
    CUSTOM: pc.dim,
  },
} as const;

/**
 * Print a success message
 * @param message - Success message to print
 */
export function printSuccess(message: string): void {
  console.log(colors.success(`✓ ${message}`));
}

/**
 * Print an error message
 * @param message - Error message to print
 */
export function printError(message: string): void {
  console.error(colors.error(`✗ ${message}`));
}

/**
 * Print a warning message
 * @param message - Warning message to print
 */
export function printWarning(message: string): void {
  console.warn(colors.warning(`⚠ ${message}`));
}

/**
 * Print an info message
 * @param message - Info message to print
 */
export function printInfo(message: string): void {
  console.log(colors.info(`ℹ ${message}`));
}
