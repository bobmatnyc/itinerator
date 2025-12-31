/**
 * Demo Key API Route
 *
 * Provides demo OpenRouter API key for localhost development.
 * Only returns key if:
 * - Request is from localhost/127.0.0.1
 * - OR user is authenticated (has valid session cookie)
 */

import type { RequestHandler } from './$types';
import { env as privateEnv } from '$env/dynamic/private';

const SESSION_COOKIE_NAME = 'itinerizer_session';
const SESSION_SECRET = 'authenticated';

/**
 * Check if request is from localhost
 */
function isLocalhost(host: string | null): boolean {
	if (!host) return false;
	return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

/**
 * Check if user is authenticated
 */
function isAuthenticated(cookies: any): boolean {
	const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
	return sessionCookie === SESSION_SECRET;
}

/**
 * GET /api/auth/demo-key
 *
 * Returns the server's OpenRouter API key if eligible.
 *
 * Response:
 * - 200: { key: "sk-or-..." } - Demo key provided
 * - 200: { key: null } - Not eligible for demo key
 */
export const GET: RequestHandler = async ({ request, cookies }) => {
	try {
		const host = request.headers.get('host');
		const localhost = isLocalhost(host);
		const authenticated = isAuthenticated(cookies);

		// Check eligibility: localhost OR authenticated
		if (!localhost && !authenticated) {
			return new Response(
				JSON.stringify({ key: null }),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Get server's OpenRouter API key
		const apiKey = privateEnv.OPENROUTER_API_KEY;

		if (!apiKey) {
			// No server key configured
			return new Response(
				JSON.stringify({ key: null }),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Return the demo key
		return new Response(
			JSON.stringify({ key: apiKey }),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		console.error('Demo key error:', error);
		return new Response(
			JSON.stringify({ key: null }),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
