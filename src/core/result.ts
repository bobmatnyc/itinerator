/**
 * Result type for error handling - discriminated union pattern
 * @module core/result
 */

/**
 * Represents the result of an operation that can succeed or fail
 */
export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };

/**
 * Creates a successful result
 * @param value - The success value
 * @returns A successful Result
 */
export const ok = <T>(value: T): Result<T, never> => ({
  success: true,
  value,
});

/**
 * Creates a failed result
 * @param error - The error value
 * @returns A failed Result
 */
export const err = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
});

/**
 * Maps a successful result value through a function
 * @param result - The result to map
 * @param fn - The mapping function
 * @returns A new Result with the mapped value, or the original error
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.success) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * FlatMaps a successful result value through a function that returns a Result
 * @param result - The result to flatMap
 * @param fn - The mapping function that returns a Result
 * @returns The Result returned by fn, or the original error
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.success) {
    return fn(result.value);
  }
  return result;
}

/**
 * Unwraps a Result, returning the value or a default
 * @param result - The result to unwrap
 * @param defaultValue - The default value to return on error
 * @returns The result value or the default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.success) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Type guard to check if a Result is successful
 * @param result - The result to check
 * @returns True if the result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

/**
 * Type guard to check if a Result is a failure
 * @param result - The result to check
 * @returns True if the result is a failure
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}
