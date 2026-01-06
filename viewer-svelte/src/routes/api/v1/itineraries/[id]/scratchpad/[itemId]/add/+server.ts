/**
 * Add scratchpad item to specific day
 * POST /api/v1/itineraries/:id/scratchpad/:itemId/add - Add to specific day
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ItineraryId } from '$domain/types/branded.js';

/**
 * POST /api/v1/itineraries/:id/scratchpad/:itemId/add
 * Add a scratchpad item to a specific day in the itinerary
 * Body: { dayNumber: number }
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { segmentService } = locals.services;
	const itineraryId = params.id as ItineraryId;
	const itemId = params.itemId;

	const body = await request.json();
	const { dayNumber } = body;

	if (dayNumber === undefined || dayNumber === null) {
		throw error(400, {
			message: 'dayNumber is required'
		});
	}

	// TODO: Implement actual add logic
	// 1. Get scratchpad item from storage
	// 2. Add segment to specified day in itinerary
	// 3. Remove item from scratchpad
	// For now, return success
	return json({ success: true });
};
