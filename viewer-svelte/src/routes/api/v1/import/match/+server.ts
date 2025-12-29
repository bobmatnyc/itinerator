/**
 * Trip Matching API Route
 * POST /api/v1/import/match
 * Find matching trips for imported segments
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TripMatcher } from '../../../../../services/import/trip-matcher.js';
import { ItineraryCollectionService } from '../../../../../services/itinerary-collection.service.js';
import { createItineraryStorage } from '../../../../../storage/index.js';
import type { ExtractedSegment } from '../../../../../services/import/types.js';

/**
 * POST /api/v1/import/match
 * Find matching trips for segments
 *
 * Request body:
 * {
 *   segments: ExtractedSegment[],
 *   userId: string
 * }
 *
 * Response:
 * {
 *   matches: TripMatch[],
 *   suggestedAction: 'add_to_existing' | 'create_new' | 'ask_user',
 *   confidence: number
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json();
    const { segments, userId } = body as {
      segments: ExtractedSegment[];
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
    const tripMatcher = new TripMatcher();

    // Get user's existing trips
    const tripsResult = await itineraryCollection.listItinerariesByUser(userId);
    if (!tripsResult.success) {
      return error(500, 'Failed to load user trips');
    }

    // Find matches
    const matches = await tripMatcher.findMatches(segments, tripsResult.value);

    return json(matches);
  } catch (err) {
    console.error('Trip matching error:', err);
    return error(500, err instanceof Error ? err.message : 'Failed to match trips');
  }
};
