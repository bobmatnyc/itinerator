/**
 * High-level itinerary operations service
 * @module services/itinerary
 */

import { createStorageError, createValidationError } from '../core/errors.js';
import type { StorageError, ValidationError } from '../core/errors.js';
import { err } from '../core/result.js';
import type { Result } from '../core/result.js';
import { itineraryCreateSchema } from '../domain/schemas/itinerary.schema.js';
import type { ItineraryId, TravelerId } from '../domain/types/branded.js';
import { generateItineraryId } from '../domain/types/branded.js';
import { ItineraryStatus } from '../domain/types/common.js';
import type { Itinerary } from '../domain/types/itinerary.js';
import type { Traveler } from '../domain/types/traveler.js';
import type { ItineraryStorage, ItinerarySummary } from '../storage/storage.interface.js';

/**
 * Input for creating a new itinerary
 */
export interface CreateItineraryInput {
  title: string;
  startDate: Date;
  endDate: Date;
  description?: string;
  tripType?: 'LEISURE' | 'BUSINESS' | 'MIXED';
  travelers?: Traveler[];
}

/**
 * Service for high-level itinerary operations
 */
export class ItineraryService {
  constructor(private readonly storage: ItineraryStorage) {}

  /**
   * Create a new itinerary from input
   * @param input - Itinerary creation data
   * @returns Result with created itinerary or validation/storage error
   */
  async create(
    input: CreateItineraryInput
  ): Promise<Result<Itinerary, ValidationError | StorageError>> {
    // Validate input
    const validation = itineraryCreateSchema.safeParse(input);
    if (!validation.success) {
      return err(
        createValidationError(
          'INVALID_DATA',
          `Invalid itinerary data: ${validation.error.message}`,
          validation.error.errors[0]?.path.join('.')
        )
      );
    }

    // Create itinerary object
    const now = new Date();
    const itinerary: Itinerary = {
      id: generateItineraryId(),
      version: 1,
      createdAt: now,
      updatedAt: now,
      title: input.title,
      ...(input.description && { description: input.description }),
      status: ItineraryStatus.DRAFT,
      startDate: input.startDate,
      endDate: input.endDate,
      destinations: [],
      travelers: input.travelers ?? [],
      segments: [],
      tags: [],
      metadata: {},
      ...(input.tripType && { tripType: input.tripType }),
    };

    // Save to storage
    return this.storage.save(itinerary);
  }

  /**
   * Get an itinerary by ID
   * @param id - Itinerary ID to load
   * @returns Result with itinerary or storage error
   */
  async get(id: ItineraryId): Promise<Result<Itinerary, StorageError>> {
    return this.storage.load(id);
  }

  /**
   * Update an itinerary (partial update)
   * @param id - Itinerary ID to update
   * @param updates - Fields to update
   * @returns Result with updated itinerary or error
   */
  async update(
    id: ItineraryId,
    updates: Partial<
      Pick<
        Itinerary,
        'title' | 'description' | 'status' | 'startDate' | 'endDate' | 'tripType' | 'tags'
      >
    >
  ): Promise<Result<Itinerary, StorageError | ValidationError>> {
    // Load existing itinerary
    const loadResult = await this.storage.load(id);
    if (!loadResult.success) {
      return loadResult;
    }

    const existing = loadResult.value;

    // Apply updates
    const updated: Itinerary = {
      ...existing,
      ...updates,
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    // Validate date constraints if dates are being updated
    if (updated.startDate && updated.endDate && updated.endDate < updated.startDate) {
      return err(
        createValidationError(
          'CONSTRAINT_VIOLATION',
          'End date must be on or after start date',
          'endDate'
        )
      );
    }

    // Save updated itinerary
    return this.storage.save(updated);
  }

  /**
   * Delete an itinerary
   * @param id - Itinerary ID to delete
   * @returns Result indicating success or storage error
   */
  async delete(id: ItineraryId): Promise<Result<void, StorageError>> {
    return this.storage.delete(id);
  }

  /**
   * List all itineraries (summaries)
   * @returns Result with array of itinerary summaries or storage error
   */
  async list(): Promise<Result<ItinerarySummary[], StorageError>> {
    return this.storage.list();
  }

  /**
   * Add a traveler to an itinerary
   * @param id - Itinerary ID
   * @param traveler - Traveler to add
   * @returns Result with updated itinerary or storage error
   */
  async addTraveler(id: ItineraryId, traveler: Traveler): Promise<Result<Itinerary, StorageError>> {
    // Load existing itinerary
    const loadResult = await this.storage.load(id);
    if (!loadResult.success) {
      return loadResult;
    }

    const existing = loadResult.value;

    // Check if traveler already exists
    const travelerExists = existing.travelers.some((t) => t.id === traveler.id);
    if (travelerExists) {
      return err(
        createStorageError('VALIDATION_ERROR', `Traveler ${traveler.id} already exists`, {
          travelerId: traveler.id,
        })
      );
    }

    // Add traveler
    const updated: Itinerary = {
      ...existing,
      travelers: [...existing.travelers, traveler],
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    // Save updated itinerary
    return this.storage.save(updated);
  }

  /**
   * Remove a traveler from an itinerary
   * @param id - Itinerary ID
   * @param travelerId - Traveler ID to remove
   * @returns Result with updated itinerary or storage error
   */
  async removeTraveler(
    id: ItineraryId,
    travelerId: TravelerId
  ): Promise<Result<Itinerary, StorageError>> {
    // Load existing itinerary
    const loadResult = await this.storage.load(id);
    if (!loadResult.success) {
      return loadResult;
    }

    const existing = loadResult.value;

    // Check if traveler exists
    const travelerExists = existing.travelers.some((t) => t.id === travelerId);
    if (!travelerExists) {
      return err(
        createStorageError('NOT_FOUND', `Traveler ${travelerId} not found`, {
          travelerId,
        })
      );
    }

    // Remove traveler
    const filteredTravelers = existing.travelers.filter((t) => t.id !== travelerId);

    // Clear primary traveler if it was the removed traveler
    const shouldClearPrimary = existing.primaryTravelerId === travelerId;
    const { primaryTravelerId: _removed, ...baseItinerary } = existing;

    const updated: Itinerary = {
      ...baseItinerary,
      ...(shouldClearPrimary ? {} : { primaryTravelerId: existing.primaryTravelerId }),
      travelers: filteredTravelers,
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    // Save updated itinerary
    return this.storage.save(updated);
  }
}
