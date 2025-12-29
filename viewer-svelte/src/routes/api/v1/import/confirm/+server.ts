/**
 * Import Confirmation API Route
 * POST /api/v1/import/confirm
 * Confirm and finalize import to a specific itinerary or create new trip
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ImportService } from '../../../../../services/import/index.js';
import { ItineraryCollectionService } from '../../../../../services/itinerary-collection.service.js';
import { SegmentService } from '../../../../../services/segment.service.js';
import { createItineraryStorage } from '../../../../../storage/index.js';
import { OPENROUTER_API_KEY } from '$env/static/private';
import type { ExtractedSegment } from '../../../../../services/import/types.js';

/**
 * POST /api/v1/import/confirm
 * Finalize import by adding segments to itinerary or creating new trip
 *
 * Request body (add to existing):
 * {
 *   segments: ExtractedSegment[],
 *   itineraryId: string,
 *   userId: string
 * }
 *
 * Request body (create new):
 * {
 *   segments: ExtractedSegment[],
 *   createNew: true,
 *   tripName: string,
 *   userId: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   action: 'added_to_existing' | 'created_new',
 *   selectedItinerary: { id: string, name: string },
 *   deduplication: { added: number, skipped: number, duplicates: string[] }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Check API key
    if (!OPENROUTER_API_KEY) {
      return error(500, 'OPENROUTER_API_KEY not configured');
    }

    // Parse request body
    const body = await request.json();
    const { segments, itineraryId, createNew, tripName, userId } = body as {
      segments: ExtractedSegment[];
      itineraryId?: string;
      createNew?: boolean;
      tripName?: string;
      userId: string;
    };

    if (!segments || !Array.isArray(segments)) {
      return error(400, 'Invalid segments array');
    }

    if (!userId) {
      return error(400, 'userId is required');
    }

    // Initialize services
    const storage = createItineraryStorage();
    const itineraryCollection = new ItineraryCollectionService(storage);
    const segmentService = new SegmentService(storage);

    const importService = new ImportService({
      apiKey: OPENROUTER_API_KEY,
      itineraryCollection,
      segmentService,
    });

    // If creating new trip
    if (createNew) {
      if (!tripName) {
        return error(400, 'tripName is required when creating new trip');
      }

      // Create new itinerary
      const createResult = await itineraryCollection.createItinerary({
        title: tripName,
        createdBy: userId,
      });

      if (!createResult.success) {
        return error(500, 'Failed to create new itinerary');
      }

      const newItinerary = createResult.value;

      // Add segments to new itinerary
      const result = await importService.confirmImport(segments, newItinerary.id);

      return json({
        ...result,
        action: 'created_new',
        selectedItinerary: {
          id: newItinerary.id,
          name: newItinerary.title,
        },
      });
    }

    // Add to existing itinerary
    if (!itineraryId) {
      return error(400, 'itineraryId is required when not creating new trip');
    }

    const result = await importService.confirmImport(segments, itineraryId);

    return json(result);
  } catch (err) {
    console.error('Import confirmation error:', err);
    return error(500, err instanceof Error ? err.message : 'Failed to confirm import');
  }
};
