/**
 * MINIMAL SvelteKit server hooks - For Vercel deployment debugging
 *
 * This version has NO imports from parent project to isolate serverless function crashes.
 * All services are mocked inline to satisfy TypeScript requirements.
 *
 * Once /api/health works on Vercel, progressively add imports back to find the culprit.
 *
 * @module hooks.server
 */

import type { Handle } from '@sveltejs/kit';

/**
 * Minimal services interface - mocked implementations
 */
interface Services {
	storage: unknown;
	itineraryService: unknown;
	collectionService: unknown;
	segmentService: unknown;
	dependencyService: unknown;
	importService: unknown;
	travelAgentService: unknown;
	travelAgentFacade: unknown;
	tripDesignerService: unknown;
	knowledgeService: unknown;
}

let servicesInstance: Services | null = null;

/**
 * Initialize minimal mock services
 */
async function initializeServices(): Promise<Services> {
	if (servicesInstance) {
		console.log('Using cached services instance');
		return servicesInstance;
	}

	console.log('Initializing minimal mock services...');
	console.log('Environment:', {
		isVercel: process.env.VERCEL === '1',
		hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN,
		nodeEnv: process.env.NODE_ENV
	});

	// Create minimal mock services
	servicesInstance = {
		storage: null,
		itineraryService: null,
		collectionService: null,
		segmentService: null,
		dependencyService: null,
		importService: null,
		travelAgentService: null,
		travelAgentFacade: null,
		tripDesignerService: null,
		knowledgeService: null
	};

	console.log('Minimal mock services initialized');
	return servicesInstance;
}

/**
 * SvelteKit handle hook
 */
export const handle: Handle = async ({ event, resolve }) => {
	console.log(`Request: ${event.request.method} ${event.url.pathname}`);

	try {
		// Initialize services on first request
		const services = await initializeServices();

		// Make services available to all API routes via locals
		event.locals.services = services;

		const response = await resolve(event);
		console.log(`Response: ${event.request.method} ${event.url.pathname} - ${response.status}`);

		return response;
	} catch (error) {
		console.error('Hook error:', {
			path: event.url.pathname,
			method: event.request.method,
			error: {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			}
		});

		// For API routes, return JSON error
		if (event.url.pathname.startsWith('/api/')) {
			return new Response(
				JSON.stringify({
					error: 'Service initialization failed',
					message: error instanceof Error ? error.message : String(error),
					path: event.url.pathname,
					timestamp: new Date().toISOString()
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// For page routes, return minimal HTML error
		return new Response(
			`<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body>
	<h1>Service Error</h1>
	<p>${error instanceof Error ? error.message : String(error)}</p>
</body>
</html>`,
			{
				status: 500,
				headers: { 'Content-Type': 'text/html' }
			}
		);
	}
};

// Export type for use in +server.ts files
export type { Services };
