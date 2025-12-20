/**
 * Auth Status API Route
 *
 * Returns current authentication status and mode.
 */

import type { RequestHandler } from './$types';
import * as env from '$env/static/public';

/**
 * Determine authentication mode based on environment
 */
function getAuthMode(): 'password' | 'open' {
	// Explicit override via PUBLIC_AUTH_MODE env var
	const authMode = env.PUBLIC_AUTH_MODE;
	if (authMode === 'password' || authMode === 'open') {
		return authMode;
	}

	// Auto-detect: production requires password, development is open
	return import.meta.env.PROD ? 'password' : 'open';
}

/**
 * GET /api/auth/status
 *
 * Response:
 * - 200: { isAuthenticated: boolean, mode: 'password'|'open' }
 */
export const GET: RequestHandler = async ({ locals }) => {
	const authMode = getAuthMode();

	return new Response(
		JSON.stringify({
			isAuthenticated: locals.isAuthenticated,
			mode: authMode
		}),
		{ status: 200, headers: { 'Content-Type': 'application/json' } }
	);
};
