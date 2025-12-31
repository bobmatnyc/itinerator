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

    // Check for duplicate segments before adding
    const duplicateCheck = this.findDuplicateSegment(existing.segments, segmentWithId);
    if (duplicateCheck) {
      return err(
        createValidationError(
          'CONSTRAINT_VIOLATION',
          duplicateCheck.message,
          'duplicate'
        )
      );
    }

    // Validate segment dates are within itinerary date range (if itinerary has dates)
    if (existing.startDate && existing.endDate) {
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

    // Validate segment dates if changed (and itinerary has dates)
    if (updates.startDatetime || updates.endDatetime) {
      if (existing.startDate && existing.endDate) {
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

  /**
   * Find duplicate segment in existing segments
   * @param existingSegments - Array of existing segments
   * @param newSegment - New segment to check
   * @returns Duplicate info with message if found, null otherwise
   */
  private findDuplicateSegment(
    existingSegments: Segment[],
    newSegment: Segment
  ): { message: string } | null {
    for (const existing of existingSegments) {
      if (this.isDuplicateSegment(existing, newSegment)) {
        return {
          message: this.buildDuplicateMessage(existing, newSegment),
        };
      }
    }
    return null;
  }

  /**
   * Check if two segments are duplicates
   * @param existing - Existing segment
   * @param newSeg - New segment to check
   * @returns True if segments are duplicates
   */
  private isDuplicateSegment(existing: Segment, newSeg: Segment): boolean {
    // Must be same type
    if (existing.type !== newSeg.type) {
      return false;
    }

    switch (newSeg.type) {
      case 'ACTIVITY': {
        if (existing.type !== 'ACTIVITY') return false;
        // For activities/dining: same name and same date
        const sameName =
          this.normalizeString(existing.name) === this.normalizeString(newSeg.name);
        const sameDate = this.isSameDate(existing.startDatetime, newSeg.startDatetime);
        return sameName && sameDate;
      }

      case 'HOTEL': {
        if (existing.type !== 'HOTEL') return false;
        // For hotels: same property name and overlapping dates
        const sameName =
          this.normalizeString(existing.property?.name) ===
          this.normalizeString(newSeg.property?.name);
        const overlapping = this.datesOverlap(
          existing.checkInDate,
          existing.checkOutDate,
          newSeg.checkInDate,
          newSeg.checkOutDate
        );
        return sameName && overlapping;
      }

      case 'FLIGHT': {
        if (existing.type !== 'FLIGHT') return false;
        // For flights: same flight number and same departure date
        const sameNumber = existing.flightNumber === newSeg.flightNumber;
        const sameDate = this.isSameDate(existing.startDatetime, newSeg.startDatetime);
        return sameNumber && sameDate;
      }

      case 'MEETING': {
        if (existing.type !== 'MEETING') return false;
        // For meetings: same title and same start time
        const sameTitle =
          this.normalizeString(existing.title) === this.normalizeString(newSeg.title);
        const sameTime = this.isSameDateTime(existing.startDatetime, newSeg.startDatetime);
        return sameTitle && sameTime;
      }

      case 'TRANSFER': {
        if (existing.type !== 'TRANSFER') return false;
        // For transfers: same type, same pickup/dropoff locations, and same date
        const sameType = existing.transferType === newSeg.transferType;
        const samePickup =
          this.normalizeString(existing.pickupLocation?.name) ===
          this.normalizeString(newSeg.pickupLocation?.name);
        const sameDropoff =
          this.normalizeString(existing.dropoffLocation?.name) ===
          this.normalizeString(newSeg.dropoffLocation?.name);
        const sameDate = this.isSameDate(existing.startDatetime, newSeg.startDatetime);
        return sameType && samePickup && sameDropoff && sameDate;
      }

      case 'CUSTOM': {
        if (existing.type !== 'CUSTOM') return false;
        // For custom segments: same title and same start time
        const sameTitle =
          this.normalizeString(existing.title) === this.normalizeString(newSeg.title);
        const sameTime = this.isSameDateTime(existing.startDatetime, newSeg.startDatetime);
        return sameTitle && sameTime;
      }

      default:
        return false;
    }
  }

  /**
   * Build a user-friendly duplicate message
   * @param existing - Existing segment
   * @param newSeg - New segment attempting to be added
   * @returns User-friendly error message
   */
  private buildDuplicateMessage(existing: Segment, newSeg: Segment): string {
    const dateStr = this.formatDate(newSeg.startDatetime);

    switch (newSeg.type) {
      case 'ACTIVITY': {
        return `Duplicate detected: "${newSeg.name}" is already on your itinerary for ${dateStr}. Would you like to update it instead?`;
      }

      case 'HOTEL': {
        return `Duplicate detected: "${newSeg.property?.name}" is already booked with overlapping dates. Would you like to update it instead?`;
      }

      case 'FLIGHT': {
        return `Duplicate detected: Flight ${newSeg.flightNumber} is already on your itinerary for ${dateStr}. Would you like to update it instead?`;
      }

      case 'MEETING': {
        return `Duplicate detected: Meeting "${newSeg.title}" is already scheduled for ${dateStr}. Would you like to update it instead?`;
      }

      case 'TRANSFER': {
        return `Duplicate detected: A ${newSeg.transferType.toLowerCase()} transfer is already scheduled for ${dateStr}. Would you like to update it instead?`;
      }

      case 'CUSTOM': {
        return `Duplicate detected: "${newSeg.title}" is already on your itinerary for ${dateStr}. Would you like to update it instead?`;
      }

      default:
        return 'Duplicate segment detected. A similar item already exists in the itinerary.';
    }
  }

  /**
   * Normalize string for comparison (lowercase, trim, remove special chars)
   * @param s - String to normalize
   * @returns Normalized string
   */
  private normalizeString(s?: string): string {
    if (!s) return '';
    return s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Check if two dates are on the same day
   * @param d1 - First date
   * @param d2 - Second date
   * @returns True if dates are on the same day
   */
  private isSameDate(d1?: string | Date, d2?: string | Date): boolean {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1).toDateString();
    const date2 = new Date(d2).toDateString();
    return date1 === date2;
  }

  /**
   * Check if two datetimes are the same (within a minute)
   * @param d1 - First datetime
   * @param d2 - Second datetime
   * @returns True if datetimes are the same
   */
  private isSameDateTime(d1?: string | Date, d2?: string | Date): boolean {
    if (!d1 || !d2) return false;
    const time1 = new Date(d1).getTime();
    const time2 = new Date(d2).getTime();
    // Within 1 minute (60000 ms)
    return Math.abs(time1 - time2) < 60000;
  }

  /**
   * Check if date ranges overlap
   * For hotel stays, we need to be careful about same-day boundaries
   * Checkout on day N and checkin on day N should NOT be considered overlapping
   * @param start1 - Start date of first range
   * @param end1 - End date of first range
   * @param start2 - Start date of second range
   * @param end2 - End date of second range
   * @returns True if ranges overlap
   */
  private datesOverlap(
    start1?: string | Date,
    end1?: string | Date,
    start2?: string | Date,
    end2?: string | Date
  ): boolean {
    if (!start1 || !end1 || !start2 || !end2) return false;

    // Normalize to date-only (no time component) for proper day-based comparison
    const s1 = new Date(start1).setHours(0, 0, 0, 0);
    const e1 = new Date(end1).setHours(0, 0, 0, 0);
    const s2 = new Date(start2).setHours(0, 0, 0, 0);
    const e2 = new Date(end2).setHours(0, 0, 0, 0);

    // Ranges overlap if: start1 < end2 AND start2 < end1
    // This correctly handles same-day boundaries:
    // - Checkout Jan 12, Checkin Jan 13: 12 < 13 AND 13 < 12 = FALSE (no overlap) ✓
    // - Checkout Jan 13, Checkin Jan 12: 12 < 13 AND 12 < 13 = TRUE (overlap) ✓
    return s1 < e2 && s2 < e1;
  }

  /**
   * Format date for user-friendly display
   * @param d - Date to format
   * @returns Formatted date string
   */
  private formatDate(d: string | Date): string {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
