/**
 * Working context service for tracking current working itinerary
 * @module services/working-context
 */

import { createStorageError } from '../core/errors.js';
import type { StorageError } from '../core/errors.js';
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';
import type { ItineraryId } from '../domain/types/branded.js';
import type { Itinerary } from '../domain/types/itinerary.js';
import type { ConfigStorage } from '../storage/config-storage.js';
import type { ItineraryStorage } from '../storage/storage.interface.js';

/**
 * Service for managing the working context (current itinerary)
 */
export class WorkingContextService {
  constructor(
    private readonly configStorage: ConfigStorage,
    private readonly itineraryStorage: ItineraryStorage
  ) {}

  /**
   * Get the current working itinerary
   * @returns Result with itinerary or null if none set, or storage error
   */
  async getWorkingItinerary(): Promise<Result<Itinerary | null, StorageError>> {
    // Get working itinerary ID from config
    const workingId = await this.configStorage.getWorkingItineraryId();

    if (!workingId) {
      return ok(null);
    }

    // Load the itinerary
    const loadResult = await this.itineraryStorage.load(workingId);

    if (!loadResult.success) {
      // If itinerary not found, clear the working context
      if (loadResult.error.code === 'NOT_FOUND') {
        await this.configStorage.setWorkingItineraryId(undefined);
        return ok(null);
      }

      return loadResult;
    }

    return ok(loadResult.value);
  }

  /**
   * Set the working itinerary by ID
   * @param id - Itinerary ID to set as working
   * @returns Result with the loaded itinerary or storage error
   */
  async setWorkingItinerary(id: ItineraryId): Promise<Result<Itinerary, StorageError>> {
    // Verify itinerary exists
    const loadResult = await this.itineraryStorage.load(id);
    if (!loadResult.success) {
      return loadResult;
    }

    // Set working itinerary ID in config
    const setResult = await this.configStorage.setWorkingItineraryId(id);
    if (!setResult.success) {
      return err(
        createStorageError(
          'WRITE_ERROR',
          'Failed to set working itinerary',
          setResult.error.details
        )
      );
    }

    return ok(loadResult.value);
  }

  /**
   * Clear the working itinerary
   * @returns Result indicating success or storage error
   */
  async clearWorkingItinerary(): Promise<Result<void, StorageError>> {
    return this.configStorage.setWorkingItineraryId(undefined);
  }

  /**
   * Get just the working itinerary ID (without loading the full itinerary)
   * @returns Working itinerary ID or undefined if none set
   */
  async getWorkingItineraryId(): Promise<ItineraryId | undefined> {
    return this.configStorage.getWorkingItineraryId();
  }

  /**
   * Check if there's a working itinerary set
   * @returns True if a working itinerary is set
   */
  async hasWorkingItinerary(): Promise<boolean> {
    const id = await this.configStorage.getWorkingItineraryId();
    return id !== undefined;
  }
}
