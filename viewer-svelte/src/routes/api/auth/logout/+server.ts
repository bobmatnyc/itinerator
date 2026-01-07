/**
 * Logout API Route
 *
 * Clears the session cookie to log out the user.
 * Uses matching cookie options (secure, sameSite) for proper deletion.
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
export const POST: RequestHandler = async ({ cookies, url }) => {
	// Detect HTTPS (production OR ngrok/proxy) for consistent cookie options
	const isSecure = url.protocol === 'https:';

	// Cookie options must match the options used when setting the cookie
	const cookieOptions = {
		path: '/',
		secure: isSecure,
		sameSite: isSecure ? 'none' : 'lax' as const,
	};

	// Clear session cookie
	cookies.delete(SESSION_COOKIE_NAME, cookieOptions);

	// Clear user email cookie
	cookies.delete(USER_EMAIL_COOKIE_NAME, cookieOptions);

	return new Response(
		JSON.stringify({ success: true }),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	);
};
