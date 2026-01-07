/**
 * Individual user permission routes
 * PATCH /api/v1/itineraries/:id/share/:email - Change user's role
 * DELETE /api/v1/itineraries/:id/share/:email - Remove user's access
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ItineraryId } from '$domain/types/branded.js';
import type { PermissionRole } from '../../../../../../../src/services/permission.service.js';

/**
 * PATCH /api/v1/itineraries/:id/share/:email
 * Change a user's permission role
 * Requires: owner permission
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { itineraryService, permissionService, storage } = locals.services;
	const { userEmail } = locals;
	const id = params.id as ItineraryId;
	const targetEmail = decodeURIComponent(params.email);

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

	// Check permission - must be owner to manage permissions
	if (!permissionService.canManagePermissions(itinerary, userEmail)) {
		throw error(403, { message: 'Access denied: Only owners can manage permissions' });
	}

	// Parse request body
	const body = await request.json();
	const { role } = body;

	if (!role) {
		throw error(400, { message: 'Missing required field: role' });
	}

	// Validate role
	const validRoles: PermissionRole[] = ['owner', 'editor', 'viewer'];
	if (!validRoles.includes(role)) {
		throw error(400, { message: 'Invalid role. Must be one of: owner, editor, viewer' });
	}

	// Get current role
	const currentRole = permissionService.getRole(itinerary, targetEmail);

	if (currentRole === 'none') {
		throw error(404, { message: 'User does not have any permission. Use POST /share to add them.' });
	}

	try {
		// Change role
		const updatedItinerary = permissionService.changeRole(itinerary, targetEmail, role);

		// Save updated itinerary
		const saveResult = await storage.save(updatedItinerary);
		if (!saveResult.success) {
			throw error(500, { message: 'Failed to save itinerary: ' + saveResult.error.message });
		}

		return json({
			success: true,
			user: targetEmail,
			oldRole: currentRole,
			newRole: role,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(400, { message });
	}
};

/**
 * DELETE /api/v1/itineraries/:id/share/:email
 * Remove a user's access to the itinerary
 * Requires: owner permission
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { itineraryService, permissionService, storage } = locals.services;
	const { userEmail } = locals;
	const id = params.id as ItineraryId;
	const targetEmail = decodeURIComponent(params.email);

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

	// Check permission - must be owner to manage permissions
	if (!permissionService.canManagePermissions(itinerary, userEmail)) {
		throw error(403, { message: 'Access denied: Only owners can manage permissions' });
	}

	// Get current role before removal
	const currentRole = permissionService.getRole(itinerary, targetEmail);

	if (currentRole === 'none') {
		throw error(404, { message: 'User does not have any permission' });
	}

	try {
		// Remove permission
		const updatedItinerary = permissionService.removePermission(itinerary, targetEmail);

		// Save updated itinerary
		const saveResult = await storage.save(updatedItinerary);
		if (!saveResult.success) {
			throw error(500, { message: 'Failed to save itinerary: ' + saveResult.error.message });
		}

		return json({
			success: true,
			removedUser: targetEmail,
			removedRole: currentRole,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw error(400, { message });
	}
};
