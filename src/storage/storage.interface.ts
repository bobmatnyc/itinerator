/**
 * Storage interface definitions
 * @module storage/storage.interface
 */

import type { StorageError } from '../core/errors.js';
import type { Result } from '../core/result.js';
import type { ItineraryId } from '../domain/types/branded.js';
import type { Itinerary } from '../domain/types/itinerary.js';

/**
 * Interface for itinerary storage operations
 */
export interface ItineraryStorage {
  /** Initialize storage (create directories if needed) */
  initialize(): Promise<Result<void, StorageError>>;

  /** Save an itinerary (create or update) */
  save(itinerary: Itinerary): Promise<Result<Itinerary, StorageError>>;

  /** Load an itinerary by ID */
  load(id: ItineraryId): Promise<Result<Itinerary, StorageError>>;

  /** Delete an itinerary */
  delete(id: ItineraryId): Promise<Result<void, StorageError>>;

  /** List all itinerary summaries (id, title, status, dates) */
  list(): Promise<Result<ItinerarySummary[], StorageError>>;

  /** List itineraries for a specific user */
  listByUser(userEmail: string): Promise<Result<ItinerarySummary[], StorageError>>;

  /** Check if an itinerary exists */
  exists(id: ItineraryId): Promise<boolean>;
}

/**
 * Summary information for an itinerary (used in list views)
 */
export interface ItinerarySummary {
  /** Itinerary ID */
  id: ItineraryId;
  /** Itinerary title */
  title: string;
  /** Current status */
  status: string;
  /** Trip start date - optional, collected by trip designer */
  startDate?: Date;
  /** Trip end date - optional, collected by trip designer */
  endDate?: Date;
  /** Number of travelers */
  travelerCount: number;
  /** Number of segments */
  segmentCount: number;
  /** Last updated timestamp */
  updatedAt: Date;
  /** User who created the itinerary */
  createdBy?: string;
  /** User's permission role (owner/editor/viewer) - populated by listByUser() */
  role?: 'owner' | 'editor' | 'viewer';
}
