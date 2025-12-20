/**
 * Login API Route
 *
 * Handles authentication based on environment:
 * - Production (Vercel): Validates password against AUTH_PASSWORD env var
 * - Development (local/ngrok): Auto-authenticates without password check
 *
 * Environment detection uses:
 * 1. PUBLIC_AUTH_MODE env var (password|open) - explicit override
 * 2. import.meta.env.PROD - SvelteKit production mode detection
 */

import type { RequestHandler } from './$types';
import { AUTH_PASSWORD } from '$env/static/private';
import * as env from '$env/static/public';

const SESSION_COOKIE_NAME = 'itinerizer_session';
const SESSION_SECRET = 'authenticated';

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
 * POST /api/auth/login
 *
 * Request body:
 * - password?: string (required in password mode, ignored in open mode)
 *
 * Response:
 * - 200: { success: true, mode: 'password'|'open' }
 * - 401: { error: 'Invalid password' }
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const authMode = getAuthMode();

	try {
		const body = await request.json();
		const { password } = body;

		if (authMode === 'password') {
			// Password mode: validate against AUTH_PASSWORD
			if (!AUTH_PASSWORD) {
				console.error('AUTH_PASSWORD not configured but in password mode');
				return new Response(
					JSON.stringify({ error: 'Authentication not configured' }),
					{ status: 500, headers: { 'Content-Type': 'application/json' } }
				);
			}

			if (password !== AUTH_PASSWORD) {
				return new Response(
					JSON.stringify({ error: 'Invalid password' }),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}
		}
		// In open mode, no password validation needed

		// Set session cookie
		cookies.set(SESSION_COOKIE_NAME, SESSION_SECRET, {
			path: '/',
			httpOnly: true,
			secure: import.meta.env.PROD,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		return new Response(
			JSON.stringify({ success: true, mode: authMode }),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		console.error('Login error:', error);
		return new Response(
			JSON.stringify({ error: 'Login failed' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
