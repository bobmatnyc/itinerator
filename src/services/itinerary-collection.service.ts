/**
 * Itinerary Collection Service - collection-level operations
 * @module services/itinerary-collection
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
  /** Optional - trip designer will collect dates during discovery */
  startDate?: Date;
  /** Optional - trip designer will collect dates during discovery */
  endDate?: Date;
  description?: string;
  tripType?: 'LEISURE' | 'BUSINESS' | 'MIXED';
  travelers?: Traveler[];
  /** If true, keeps itinerary in memory only until content is added */
  draft?: boolean;
  /** User email who created the itinerary */
  createdBy?: string;
}

/**
 * Service for collection-level itinerary operations
 * Handles: list, create, delete itineraries, and metadata updates
 * Does NOT handle: segment operations (see ItineraryService)
 */
export class ItineraryCollectionService {
  /** In-memory store for draft itineraries (not yet persisted) */
  private drafts: Map<ItineraryId, Itinerary> = new Map();

  constructor(private readonly storage: ItineraryStorage) {}

  /**
   * List all itineraries (summaries only)
   * @returns Result with array of itinerary summaries or storage error
   */
  async listItineraries(): Promise<Result<ItinerarySummary[], StorageError>> {
    return this.storage.list();
  }

  /**
   * List itineraries for a specific user (summaries only)
   * @param email - User email to filter by
   * @returns Result with array of itinerary summaries or storage error
   */
  async listItinerariesByUser(email: string): Promise<Result<ItinerarySummary[], StorageError>> {
    return this.storage.listByUser(email);
  }

  /**
   * Create a new itinerary
   * @param input - Itinerary creation data
   * @returns Result with created itinerary or validation/storage error
   */
  async createItinerary(
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
      ...(input.createdBy && { createdBy: input.createdBy }),
    };

    // If draft mode, keep in memory only
    if (input.draft) {
      this.drafts.set(itinerary.id, itinerary);
      return { success: true, value: itinerary };
    }

    // Save to storage
    return this.storage.save(itinerary);
  }

  /**
   * Delete an itinerary
   * @param id - Itinerary ID to delete
   * @returns Result indicating success or storage error
   */
  async deleteItinerary(id: ItineraryId): Promise<Result<void, StorageError>> {
    // Delete from drafts if present
    this.drafts.delete(id);

    // Delete from storage
    return this.storage.delete(id);
  }

  /**
   * Get itinerary summary (metadata without segments)
   * @param id - Itinerary ID
   * @returns Result with summary or storage error
   */
  async getItinerarySummary(id: ItineraryId): Promise<Result<ItinerarySummary, StorageError>> {
    // Check drafts first
    const draft = this.drafts.get(id);
    if (draft) {
      return {
        success: true,
        value: {
          id: draft.id,
          title: draft.title,
          status: draft.status,
          startDate: draft.startDate,
          endDate: draft.endDate,
          travelerCount: draft.travelers.length,
          segmentCount: draft.segments.length,
          updatedAt: draft.updatedAt,
          createdBy: draft.createdBy,
        },
      };
    }

    // Load from storage and return summary
    const result = await this.storage.load(id);
    if (!result.success) {
      return result;
    }

    const itinerary = result.value;
    return {
      success: true,
      value: {
        id: itinerary.id,
        title: itinerary.title,
        status: itinerary.status,
        startDate: itinerary.startDate,
        endDate: itinerary.endDate,
        travelerCount: itinerary.travelers.length,
        segmentCount: itinerary.segments.length,
        updatedAt: itinerary.updatedAt,
        createdBy: itinerary.createdBy,
      },
    };
  }

  /**
   * Update itinerary metadata (does not modify segments)
   * @param id - Itinerary ID to update
   * @param updates - Metadata fields to update
   * @returns Result with updated itinerary or error
   */
  async updateMetadata(
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

  /**
   * Check if an itinerary is a draft (in-memory only)
   */
  isDraft(id: ItineraryId): boolean {
    return this.drafts.has(id);
  }

  /**
   * Persist a draft itinerary to storage
   * Called automatically when content is added via chat
   */
  async persistDraft(id: ItineraryId): Promise<Result<Itinerary, StorageError>> {
    const draft = this.drafts.get(id);
    if (!draft) {
      return err(createStorageError('NOT_FOUND', `Draft ${id} not found`));
    }

    // Save to storage
    const result = await this.storage.save(draft);
    if (result.success) {
      // Remove from drafts
      this.drafts.delete(id);
    }
    return result;
  }

  /**
   * Delete a draft without persisting
   */
  deleteDraft(id: ItineraryId): boolean {
    return this.drafts.delete(id);
  }
}
