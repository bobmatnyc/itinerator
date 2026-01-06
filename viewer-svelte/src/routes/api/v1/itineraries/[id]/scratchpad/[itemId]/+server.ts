/**
 * Scratchpad item routes
 * DELETE /api/v1/itineraries/:id/scratchpad/:itemId - Remove from scratchpad
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * DELETE /api/v1/itineraries/:id/scratchpad/:itemId
 * Remove an item from the scratchpad
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	// For now, return success - implement actual storage later
	// TODO: Implement scratchpad storage service
	return json({ success: true });
};
