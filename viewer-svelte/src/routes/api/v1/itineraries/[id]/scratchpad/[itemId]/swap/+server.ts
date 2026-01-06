/**
 * Swap scratchpad item with existing segment
 * POST /api/v1/itineraries/:id/scratchpad/:itemId/swap - Swap with existing segment
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ItineraryId, SegmentId } from '$domain/types/branded.js';

/**
 * POST /api/v1/itineraries/:id/scratchpad/:itemId/swap
 * Swap a scratchpad item with an existing segment in the itinerary
 * Body: { existingSegmentId: string }
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { segmentService } = locals.services;
	const itineraryId = params.id as ItineraryId;
	const itemId = params.itemId;

	const body = await request.json();
	const { existingSegmentId } = body;

	if (!existingSegmentId) {
		throw error(400, {
			message: 'existingSegmentId is required'
		});
	}

	// TODO: Implement actual swap logic
	// 1. Get scratchpad item from storage
	// 2. Replace existing segment with scratchpad segment
	// 3. Remove item from scratchpad
	// For now, return success
	return json({ success: true });
};
