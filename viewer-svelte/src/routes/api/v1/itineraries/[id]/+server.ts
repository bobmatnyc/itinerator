/**
 * Individual itinerary routes
 * GET /api/v1/itineraries/:id - Get itinerary with segments (permission verified)
 * PATCH /api/v1/itineraries/:id - Update itinerary metadata (permission verified)
 * DELETE /api/v1/itineraries/:id - Delete itinerary (permission verified)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ItineraryId } from '$domain/types/branded.js';

/**
 * GET /api/v1/itineraries/:id
 * Get full itinerary with segments (permission verified)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { itineraryService, permissionService } = locals.services;
	const { userEmail } = locals;
	const id = params.id as ItineraryId;

	if (!id) {
		throw error(400, { message: 'Missing ID parameter' });
	}

	if (!userEmail) {
		throw error(401, { message: 'User email not found in session' });
	}

	// Load itinerary
	const result = await itineraryService.getItinerary(id);
	if (!result.success) {
		throw error(404, { message: 'Itinerary not found' });
	}

	let itinerary = result.value;

	// Initialize permissions if needed (migration)
	if (!itinerary.permissions || itinerary.permissions.owners.length === 0) {
		itinerary = permissionService.initializePermissions(itinerary);
		await locals.services.storage.save(itinerary);
	}

	// Check permission
	if (!permissionService.canView(itinerary, userEmail)) {
		throw error(404, { message: 'Itinerary not found' }); // Don't leak existence
	}

	return json(itinerary);
};

/**
 * PATCH /api/v1/itineraries/:id
 * Update itinerary metadata (title, description, dates, status, tags)
 * Permission verified before update (requires editor or owner)
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { collectionService, itineraryService, permissionService } = locals.services;
	const { userEmail } = locals;
	const id = params.id as ItineraryId;

	if (!userEmail) {
		throw error(401, { message: 'User email not found in session' });
	}

	// Load itinerary
	const loadResult = await itineraryService.getItinerary(id);
	if (!loadResult.success) {
		throw error(404, { message: 'Itinerary not found' });
	}

	let itinerary = loadResult.value;

	// Initialize permissions if needed (migration)
	if (!itinerary.permissions || itinerary.permissions.owners.length === 0) {
		itinerary = permissionService.initializePermissions(itinerary);
		await locals.services.storage.save(itinerary);
	}

	// Check permission - must be editor or owner
	if (!permissionService.canEdit(itinerary, userEmail)) {
		throw error(403, { message: 'Access denied: You do not have permission to edit this itinerary' });
	}

	const body = await request.json();
	const { title, description, startDate, endDate, status, tripType, tags } = body;

	const updates: Parameters<typeof collectionService.updateMetadata>[1] = {};

	if (title !== undefined) updates.title = title;
	if (description !== undefined) updates.description = description;
	if (startDate !== undefined) updates.startDate = new Date(startDate);
	if (endDate !== undefined) updates.endDate = new Date(endDate);
	if (status !== undefined) updates.status = status;
	if (tripType !== undefined) updates.tripType = tripType;
	if (tags !== undefined) updates.tags = tags;

	const result = await collectionService.updateMetadata(id, updates);

	if (!result.success) {
		throw error(500, {
			message: 'Failed to update itinerary: ' + result.error.message
		});
	}

	return json(result.value);
};

/**
 * DELETE /api/v1/itineraries/:id
 * Delete itinerary (permission verified - requires owner)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { collectionService, itineraryService, permissionService, tripDesignerService } = locals.services;
	const { userEmail } = locals;
	const id = params.id as ItineraryId;

	if (!userEmail) {
		throw error(401, { message: 'User email not found in session' });
	}

	// Load itinerary
	const loadResult = await itineraryService.getItinerary(id);
	if (!loadResult.success) {
		throw error(404, { message: 'Itinerary not found' });
	}

	let itinerary = loadResult.value;

	// Initialize permissions if needed (migration)
	if (!itinerary.permissions || itinerary.permissions.owners.length === 0) {
		itinerary = permissionService.initializePermissions(itinerary);
		await locals.services.storage.save(itinerary);
	}

	// Check permission - must be owner
	if (!permissionService.canDelete(itinerary, userEmail)) {
		throw error(403, { message: 'Access denied: Only owners can delete itineraries' });
	}

	const result = await collectionService.deleteItinerary(id);

	if (!result.success) {
		throw error(500, {
			message: 'Failed to delete itinerary: ' + result.error.message
		});
	}

	// Clean up any associated chat sessions to prevent orphaned sessions with stale context
	if (tripDesignerService) {
		tripDesignerService.deleteSessionsByItineraryId(id);
	}

	return new Response(null, { status: 204 });
};
