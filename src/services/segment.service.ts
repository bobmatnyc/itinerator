/**
 * Segment CRUD operations service
 * @module services/segment
 */

import { createStorageError, createValidationError } from '../core/errors.js';
import type { StorageError, ValidationError } from '../core/errors.js';
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';
import type { ItineraryId, SegmentId } from '../domain/types/branded.js';
import { generateSegmentId } from '../domain/types/branded.js';
import type { Itinerary } from '../domain/types/itinerary.js';
import type { Segment } from '../domain/types/segment.js';
import type { ItineraryStorage } from '../storage/storage.interface.js';

/**
 * Service for segment CRUD operations
 */
export class SegmentService {
  constructor(private readonly storage: ItineraryStorage) {}

  /**
   * Add a segment to an itinerary
   * @param itineraryId - Itinerary ID
   * @param segment - Segment to add (optionally without ID)
   * @returns Result with updated itinerary or error
   */
  async add(
    itineraryId: ItineraryId,
    segment: Omit<Segment, 'id'> & { id?: SegmentId }
  ): Promise<Result<Itinerary, StorageError | ValidationError>> {
    // Load existing itinerary
    const loadResult = await this.storage.load(itineraryId);
    if (!loadResult.success) {
      return loadResult;
    }

    const existing = loadResult.value;

    // Generate ID if not provided
    const segmentWithId: Segment = {
      ...segment,
      id: segment.id ?? generateSegmentId(),
    } as Segment;

    // Validate segment dates are within itinerary date range
    if (
      segmentWithId.startDatetime < existing.startDate ||
      segmentWithId.endDatetime > existing.endDate
    ) {
      return err(
        createValidationError(
          'CONSTRAINT_VIOLATION',
          'Segment dates must be within itinerary date range',
          'startDatetime'
        )
      );
    }

    // Validate start is before end
    if (segmentWithId.startDatetime >= segmentWithId.endDatetime) {
      return err(
        createValidationError(
          'CONSTRAINT_VIOLATION',
          'Segment start datetime must be before end datetime',
          'endDatetime'
        )
      );
    }

    // Check if segment ID already exists
    const segmentExists = existing.segments.some((s) => s.id === segmentWithId.id);
    if (segmentExists) {
      return err(
        createStorageError('VALIDATION_ERROR', `Segment ${segmentWithId.id} already exists`, {
          segmentId: segmentWithId.id,
        })
      );
    }

    // Add segment
    const updated: Itinerary = {
      ...existing,
      segments: [...existing.segments, segmentWithId],
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    // Save updated itinerary
    return this.storage.save(updated);
  }

  /**
   * Update a segment
   * @param itineraryId - Itinerary ID
   * @param segmentId - Segment ID to update
   * @param updates - Partial segment updates
   * @returns Result with updated itinerary or error
   */
  async update(
    itineraryId: ItineraryId,
    segmentId: SegmentId,
    updates: Partial<Segment>
  ): Promise<Result<Itinerary, StorageError | ValidationError>> {
    // Load existing itinerary
    const loadResult = await this.storage.load(itineraryId);
    if (!loadResult.success) {
      return loadResult;
    }

    const existing = loadResult.value;

    // Find segment
    const segmentIndex = existing.segments.findIndex((s) => s.id === segmentId);
    if (segmentIndex === -1) {
      return err(
        createStorageError('NOT_FOUND', `Segment ${segmentId} not found`, {
          segmentId,
        })
      );
    }

    const existingSegment = existing.segments[segmentIndex];

    // Apply updates
    const updatedSegment: Segment = {
      ...existingSegment,
      ...updates,
      id: segmentId, // Prevent ID change
    } as Segment;

    // Validate segment dates if changed
    if (updates.startDatetime || updates.endDatetime) {
      if (
        updatedSegment.startDatetime < existing.startDate ||
        updatedSegment.endDatetime > existing.endDate
      ) {
        return err(
          createValidationError(
            'CONSTRAINT_VIOLATION',
            'Segment dates must be within itinerary date range',
            'startDatetime'
          )
        );
      }

      if (updatedSegment.startDatetime >= updatedSegment.endDatetime) {
        return err(
          createValidationError(
            'CONSTRAINT_VIOLATION',
            'Segment start datetime must be before end datetime',
            'endDatetime'
          )
        );
      }
    }

    // Update segment in array
    const updatedSegments = [...existing.segments];
    updatedSegments[segmentIndex] = updatedSegment;

    // Create updated itinerary
    const updated: Itinerary = {
      ...existing,
      segments: updatedSegments,
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    // Save updated itinerary
    return this.storage.save(updated);
  }

  /**
   * Delete a segment
   * @param itineraryId - Itinerary ID
   * @param segmentId - Segment ID to delete
   * @returns Result with updated itinerary or storage error
   */
  async delete(
    itineraryId: ItineraryId,
    segmentId: SegmentId
  ): Promise<Result<Itinerary, StorageError>> {
    // Load existing itinerary
    const loadResult = await this.storage.load(itineraryId);
    if (!loadResult.success) {
      return loadResult;
    }

    const existing = loadResult.value;

    // Check if segment exists
    const segmentExists = existing.segments.some((s) => s.id === segmentId);
    if (!segmentExists) {
      return err(
        createStorageError('NOT_FOUND', `Segment ${segmentId} not found`, {
          segmentId,
        })
      );
    }

    // Remove segment and any dependencies on it
    const updatedSegments = existing.segments
      .filter((s) => s.id !== segmentId)
      .map((s) => {
        const filteredDeps = s.dependsOn?.filter((depId) => depId !== segmentId);
        if (filteredDeps && filteredDeps.length > 0) {
          return { ...s, dependsOn: filteredDeps };
        }
        const { dependsOn: _removed, ...rest } = s;
        return rest as Segment;
      });

    // Create updated itinerary
    const updated: Itinerary = {
      ...existing,
      segments: updatedSegments,
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    // Save updated itinerary
    return this.storage.save(updated);
  }

  /**
   * Get a specific segment
   * @param itineraryId - Itinerary ID
   * @param segmentId - Segment ID to retrieve
   * @returns Result with segment or storage error
   */
  async get(
    itineraryId: ItineraryId,
    segmentId: SegmentId
  ): Promise<Result<Segment, StorageError>> {
    // Load itinerary
    const loadResult = await this.storage.load(itineraryId);
    if (!loadResult.success) {
      return loadResult;
    }

    const itinerary = loadResult.value;

    // Find segment
    const segment = itinerary.segments.find((s) => s.id === segmentId);
    if (!segment) {
      return err(
        createStorageError('NOT_FOUND', `Segment ${segmentId} not found`, {
          segmentId,
        })
      );
    }

    return ok(segment);
  }

  /**
   * Reorder segments (update sort order)
   * @param itineraryId - Itinerary ID
   * @param segmentIds - Array of segment IDs in desired order
   * @returns Result with updated itinerary or storage error
   */
  async reorder(
    itineraryId: ItineraryId,
    segmentIds: SegmentId[]
  ): Promise<Result<Itinerary, StorageError>> {
    // Load existing itinerary
    const loadResult = await this.storage.load(itineraryId);
    if (!loadResult.success) {
      return loadResult;
    }

    const existing = loadResult.value;

    // Validate all segment IDs exist
    const existingIds = new Set(existing.segments.map((s) => s.id));
    const missingIds = segmentIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      return err(
        createStorageError('NOT_FOUND', `Segments not found: ${missingIds.join(', ')}`, {
          missingIds,
        })
      );
    }

    // Validate all existing segments are in the new order
    if (segmentIds.length !== existing.segments.length) {
      return err(
        createStorageError('VALIDATION_ERROR', 'Segment IDs must include all existing segments', {
          expected: existing.segments.length,
          received: segmentIds.length,
        })
      );
    }

    // Create a map for quick lookup
    const segmentMap = new Map(existing.segments.map((s) => [s.id, s]));

    // Reorder segments
    const reorderedSegments = segmentIds
      .map((id) => segmentMap.get(id))
      .filter((s): s is Segment => s !== undefined);

    // Create updated itinerary
    const updated: Itinerary = {
      ...existing,
      segments: reorderedSegments,
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    // Save updated itinerary
    return this.storage.save(updated);
  }
}
