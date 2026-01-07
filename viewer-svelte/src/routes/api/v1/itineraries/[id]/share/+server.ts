/**
 * Share management routes
 * POST /api/v1/itineraries/:id/share - Add user with permission role
 * GET /api/v1/itineraries/:id/share - List all users with permissions
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ItineraryId } from '$domain/types/branded.js';
import type { PermissionRole } from '../../../../../../src/services/permission.service.js';

/**
 * POST /api/v1/itineraries/:id/share
 * Add a user to the itinerary with a specific permission role
 * Requires: owner permission
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { itineraryService, permissionService, storage } = locals.services;
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
	itinerary = permissionService.initializePermissions(itinerary);

	// Check permission - must be owner to share
	if (!permissionService.canManagePermissions(itinerary, userEmail)) {
		throw error(403, { message: 'Access denied: Only owners can share itineraries' });
	}

	// Parse request body
	const body = await request.json();
	const { email, role } = body;

	if (!email || !role) {
		throw error(400, { message: 'Missing required fields: email and role' });
	}

	// Validate email format
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		throw error(400, { message: 'Invalid email format' });
	}

	// Validate role
	const validRoles: PermissionRole[] = ['owner', 'editor', 'viewer'];
	if (!validRoles.includes(role)) {
		throw error(400, { message: 'Invalid role. Must be one of: owner, editor, viewer' });
	}

	try {
		// Add permission
		const updatedItinerary = permissionService.addPermission(itinerary, email, role);

		// Save updated itinerary
		const saveResult = await storage.save(updatedItinerary);
		if (!saveResult.success) {
			throw error(500, { message: 'Failed to save itinerary: ' + saveResult.error.message });
		}

		return json({
			success: true,
			itinerary: {
				id: updatedItinerary.id,
				permissions: updatedItinerary.permissions,
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(400, { message });
	}
};

/**
 * GET /api/v1/itineraries/:id/share
 * List all users with permissions (requires viewer permission)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { itineraryService, permissionService } = locals.services;
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
	itinerary = permissionService.initializePermissions(itinerary);

	// Check permission - must have at least viewer access
	if (!permissionService.canView(itinerary, userEmail)) {
		throw error(404, { message: 'Itinerary not found' }); // Don't leak existence
	}

	const permissions = itinerary.permissions || { owners: [], editors: [], viewers: [] };

	// Build collaborators list with roles
	const collaborators = [
		...permissions.owners.map((email) => ({ email, role: 'owner' as const })),
		...permissions.editors.map((email) => ({ email, role: 'editor' as const })),
		...permissions.viewers.map((email) => ({ email, role: 'viewer' as const })),
	];

	return json({ collaborators });
};
