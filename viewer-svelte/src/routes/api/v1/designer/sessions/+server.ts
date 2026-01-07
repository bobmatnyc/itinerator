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
 * Create a new chat session for an itinerary or help mode
 * Body: { itineraryId?: string, mode?: 'trip-designer' | 'help' }
 * Response: { sessionId: string }
 * Headers: X-OpenRouter-API-Key (optional, overrides env var)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userEmail = locals.userEmail || 'anonymous';
	console.log(`[TripDesigner] Session creation started | user=${userEmail}`);

	const { itineraryService } = locals.services;

	// Get API key from header or use cached service
	const headerApiKey = request.headers.get('X-OpenRouter-API-Key');
	let tripDesignerService = locals.services.tripDesignerService;

	// Validate API key from header (reject empty/whitespace keys)
	if (headerApiKey !== null && headerApiKey.trim() === '') {
		throw error(400, {
			message: 'Invalid API key: API key cannot be empty. Please add your OpenRouter API key in Profile settings.'
		});
	}

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
	const { itineraryId, mode = 'trip-designer' } = body;

	// For trip-designer mode, itineraryId is required
	if (mode === 'trip-designer' && !itineraryId) {
		throw error(400, {
			message: 'Missing itineraryId: itineraryId is required for trip-designer mode'
		});
	}

	// Verify itinerary exists (only for trip-designer mode)
	if (mode === 'trip-designer' && itineraryId) {
		const itineraryResult = await itineraryService.get(itineraryId as ItineraryId);
		if (!itineraryResult.success) {
			throw error(404, {
				message: `Itinerary not found: No itinerary found with id: ${itineraryId}`
			});
		}
	}

	// Create session with mode
	const sessionResult = await tripDesignerService.createSession(
		itineraryId as ItineraryId | undefined,
		mode
	);

	if (!sessionResult.success) {
		console.log(`[TripDesigner] Session creation FAILED | user=${userEmail} | error=${sessionResult.error.message}`);
		throw error(500, {
			message: 'Failed to create session: ' + sessionResult.error.message
		});
	}

	console.log(`[TripDesigner] Session created | user=${userEmail} | session=${sessionResult.value} | itinerary=${itineraryId || 'none'} | mode=${mode}`);

	return json(
		{
			sessionId: sessionResult.value
		},
		{ status: 201 }
	);
};
