/**
 * Logout API Route
 *
 * Clears the session cookie to log out the user.
 */

import type { RequestHandler } from './$types';

const SESSION_COOKIE_NAME = 'itinerator_session';
const USER_EMAIL_COOKIE_NAME = 'itinerator_user_email';

/**
 * POST /api/auth/logout
 *
 * Response:
 * - 200: { success: true }
 */
export const POST: RequestHandler = async ({ cookies }) => {
	// Clear session cookie
	cookies.delete(SESSION_COOKIE_NAME, {
		path: '/'
	});

	// Clear user email cookie
	cookies.delete(USER_EMAIL_COOKIE_NAME, {
		path: '/'
	});

	return new Response(
		JSON.stringify({ success: true }),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	);
};
