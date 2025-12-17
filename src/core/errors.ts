/**
 * Domain error definitions
 * @module core/errors
 */

/**
 * Base error interface for all domain errors
 */
export interface DomainError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Storage-related errors
 */
export type StorageError = DomainError & {
  code: 'NOT_FOUND' | 'WRITE_ERROR' | 'READ_ERROR' | 'VALIDATION_ERROR';
};

/**
 * Validation errors
 */
export type ValidationError = DomainError & {
  code: 'INVALID_DATA' | 'MISSING_FIELD' | 'CONSTRAINT_VIOLATION';
  field?: string;
};

/**
 * Dependency-related errors
 */
export type DependencyError = DomainError & {
  code: 'CIRCULAR_DEPENDENCY' | 'MISSING_DEPENDENCY' | 'ADJUSTMENT_FAILED';
  affectedSegments?: string[];
};

/**
 * Creates a storage error
 * @param code - The error code
 * @param message - Human-readable error message
 * @param details - Optional additional error details
 * @returns A StorageError instance
 */
export function createStorageError(
  code: StorageError['code'],
  message: string,
  details?: Record<string, unknown>
): StorageError {
  return {
    code,
    message,
    ...(details && { details }),
  };
}

/**
 * Creates a validation error
 * @param code - The error code
 * @param message - Human-readable error message
 * @param field - The field that failed validation
 * @returns A ValidationError instance
 */
export function createValidationError(
  code: ValidationError['code'],
  message: string,
  field?: string
): ValidationError {
  return {
    code,
    message,
    ...(field && { field }),
  };
}

/**
 * Creates a dependency error
 * @param code - The error code
 * @param message - Human-readable error message
 * @param affectedSegments - IDs of segments affected by the error
 * @returns A DependencyError instance
 */
export function createDependencyError(
  code: DependencyError['code'],
  message: string,
  affectedSegments?: string[]
): DependencyError {
  return {
    code,
    message,
    ...(affectedSegments && { affectedSegments }),
  };
}
