/**
 * Branded ID types for type-safe identifiers
 * @module domain/types/branded
 */

import { generateId, isValidUUID } from '../../core/id-generator.js';

/**
 * Brand symbol for nominal typing
 */
declare const brand: unique symbol;

/**
 * Brand a base type with a unique identifier
 */
type Brand<T, B> = T & { readonly [brand]: B };

/**
 * Branded type for Itinerary IDs
 */
export type ItineraryId = Brand<string, 'ItineraryId'>;

/**
 * Branded type for Segment IDs
 */
export type SegmentId = Brand<string, 'SegmentId'>;

/**
 * Branded type for Traveler IDs
 */
export type TravelerId = Brand<string, 'TravelerId'>;

/**
 * Creates an ItineraryId from a string, validating UUID format
 * @param value - The UUID string
 * @returns An ItineraryId
 * @throws Error if the value is not a valid UUID
 */
export function createItineraryId(value: string): ItineraryId {
  if (!isValidUUID(value)) {
    throw new Error(`Invalid UUID for ItineraryId: ${value}`);
  }
  return value as ItineraryId;
}

/**
 * Creates a SegmentId from a string, validating UUID format
 * @param value - The UUID string
 * @returns A SegmentId
 * @throws Error if the value is not a valid UUID
 */
export function createSegmentId(value: string): SegmentId {
  if (!isValidUUID(value)) {
    throw new Error(`Invalid UUID for SegmentId: ${value}`);
  }
  return value as SegmentId;
}

/**
 * Creates a TravelerId from a string, validating UUID format
 * @param value - The UUID string
 * @returns A TravelerId
 * @throws Error if the value is not a valid UUID
 */
export function createTravelerId(value: string): TravelerId {
  if (!isValidUUID(value)) {
    throw new Error(`Invalid UUID for TravelerId: ${value}`);
  }
  return value as TravelerId;
}

/**
 * Generates a new ItineraryId
 * @returns A new ItineraryId
 */
export function generateItineraryId(): ItineraryId {
  return generateId() as ItineraryId;
}

/**
 * Generates a new SegmentId
 * @returns A new SegmentId
 */
export function generateSegmentId(): SegmentId {
  return generateId() as SegmentId;
}

/**
 * Generates a new TravelerId
 * @returns A new TravelerId
 */
export function generateTravelerId(): TravelerId {
  return generateId() as TravelerId;
}
