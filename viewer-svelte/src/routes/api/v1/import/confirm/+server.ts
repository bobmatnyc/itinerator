/**
 * Import Confirmation API Route
 * POST /api/v1/import/confirm
 * Confirm and finalize import to a specific itinerary or create new trip
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ImportService } from '../../../../../../../src/services/import/index.js';
import { ItineraryCollectionService } from '../../../../../../../src/services/itinerary-collection.service.js';
import { SegmentService } from '../../../../../../../src/services/segment.service.js';
import { createItineraryStorage } from '../../../../../../../src/storage/index.js';
import { OPENROUTER_API_KEY } from '$env/static/private';
import type { ExtractedSegment } from '../../../../../../../src/services/import/types.js';

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
    const { segments, itineraryId, createNew, name, tripName, userId } = body as {
      segments: ExtractedSegment[];
      itineraryId?: string;
      createNew?: boolean;
      name?: string; // Support both 'name' and 'tripName'
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
      const newTripName = name || tripName; // Support both 'name' and 'tripName'
      console.log('[Import Confirm] Creating new trip:', { newTripName, userId, segmentCount: segments?.length });

      if (!newTripName) {
        return error(400, 'name or tripName is required when creating new trip');
      }

      // Create new itinerary
      const createResult = await itineraryCollection.createItinerary({
        title: newTripName,
        createdBy: userId,
      });

      console.log('[Import Confirm] Create result:', createResult);

      if (!createResult.success) {
        console.error('[Import Confirm] Failed to create:', createResult);
        return error(500, 'Failed to create new itinerary');
      }

      const newItinerary = createResult.value;
      console.log('[Import Confirm] Created itinerary:', newItinerary.id);

      // Add segments to new itinerary
      const result = await importService.confirmImport(segments, newItinerary.id);
      console.log('[Import Confirm] Segments added:', result);

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

    // Get itinerary name for response
    const itineraryResult = await itineraryCollection.getItinerary(itineraryId);
    const itineraryName = itineraryResult.success ? itineraryResult.value.title : 'Unknown';

    return json({
      ...result,
      action: 'added_to_existing',
      itineraryId,
      itineraryName,
    });
  } catch (err) {
    console.error('Import confirmation error:', err);
    return error(500, err instanceof Error ? err.message : 'Failed to confirm import');
  }
};
