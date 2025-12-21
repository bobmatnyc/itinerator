/**
 * Trip Designer - Sessions routes
 * POST /api/v1/designer/sessions - Create new chat session
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ItineraryId } from '$domain/types/branded.js';
import { createTripDesignerWithKey } from '$hooks/hooks.server.js';

/**
 * POST /api/v1/designer/sessions
 * Create a new chat session for an itinerary
 * Body: { itineraryId: string }
 * Response: { sessionId: string }
 * Headers: X-OpenRouter-API-Key (optional, overrides env var)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { itineraryService } = locals.services;

	// Get API key from header or use cached service
	const headerApiKey = request.headers.get('X-OpenRouter-API-Key');
	let tripDesignerService = locals.services.tripDesignerService;

	// Create on-demand service if header key provided
	if (headerApiKey) {
		tripDesignerService = await createTripDesignerWithKey(headerApiKey, locals.services);
	}

	if (!tripDesignerService) {
		throw error(503, {
			message: 'Trip Designer disabled: No API key provided. Set your OpenRouter API key in Profile settings.'
		});
	}

	const body = await request.json();
	const { itineraryId } = body;

	if (!itineraryId) {
		throw error(400, {
			message: 'Missing itineraryId: itineraryId is required in request body'
		});
	}

	// Verify itinerary exists
	const itineraryResult = await itineraryService.get(itineraryId as ItineraryId);
	if (!itineraryResult.success) {
		throw error(404, {
			message: `Itinerary not found: No itinerary found with id: ${itineraryId}`
		});
	}

	// Create session
	const sessionResult = await tripDesignerService.createSession(itineraryId as ItineraryId);

	if (!sessionResult.success) {
		throw error(500, {
			message: 'Failed to create session: ' + sessionResult.error.message
		});
	}

	return json(
		{
			sessionId: sessionResult.value
		},
		{ status: 201 }
	);
};
