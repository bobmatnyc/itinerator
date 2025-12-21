/**
 * SvelteKit server hooks - Services initialization for Vercel deployment
 *
 * Initializes core services with Vercel-compatible configuration:
 * - Uses Blob storage when BLOB_READ_WRITE_TOKEN is set
 * - Skips filesystem-dependent services on Vercel
 * - Uses dynamic imports for optional services to avoid loading modules
 *   with dependencies that fail on Vercel serverless
 * - Initializes optional services only when API keys are configured
 *
 * Architecture:
 * - Top-level imports: Only core services (ItineraryService, SegmentService, etc.)
 * - Dynamic imports: All optional services (DocumentImportService, TravelAgentService, etc.)
 * - Type-only imports: Types for optional services (don't trigger module loading)
 *
 * @module hooks.server
 */

import type { Handle } from '@sveltejs/kit';
import { createItineraryStorage } from '../../src/storage/index.js';
import type { ItineraryStorage } from '../../src/storage/index.js';
import { ItineraryService } from '../../src/services/itinerary.service.js';
import { ItineraryCollectionService } from '../../src/services/itinerary-collection.service.js';
import { SegmentService } from '../../src/services/segment.service.js';
import { DependencyService } from '../../src/services/dependency.service.js';

// Type-only imports for optional services (don't load modules)
import type { DocumentImportService } from '../../src/services/document-import.service.js';
import type { ImportConfig } from '../../src/domain/types/import.js';
import type { TravelAgentService } from '../../src/services/travel-agent.service.js';
import type { TravelAgentConfig } from '../../src/services/travel-agent.service.js';
import type { TravelAgentFacade } from '../../src/services/travel-agent-facade.service.js';
import type { TripDesignerService } from '../../src/services/trip-designer/trip-designer.service.js';
import type { TripDesignerConfig } from '../../src/domain/types/trip-designer.js';
import type { KnowledgeService } from '../../src/services/knowledge.service.js';
import type { KnowledgeConfig } from '../../src/services/knowledge.service.js';

/**
 * Services available to all API routes
 */
interface Services {
	storage: ItineraryStorage;
	itineraryService: ItineraryService;
	collectionService: ItineraryCollectionService;
	segmentService: SegmentService;
	dependencyService: DependencyService;
	importService: DocumentImportService | null;
	travelAgentService: TravelAgentService | null;
	travelAgentFacade: TravelAgentFacade;
	tripDesignerService: TripDesignerService | null;
	knowledgeService: KnowledgeService | null;
}

let servicesInstance: Services | null = null;

/**
 * Initialize services with Vercel compatibility
 */
async function initializeServices(): Promise<Services> {
	if (servicesInstance) {
		console.log('Using cached services instance');
		return servicesInstance;
	}

	const isVercel = process.env.VERCEL === '1';
	console.log('Initializing services...', {
		isVercel,
		hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN,
		nodeEnv: process.env.NODE_ENV
	});

	try {
		// CORE SERVICES - Required for all operations

		// Storage - auto-detects Blob vs JSON based on BLOB_READ_WRITE_TOKEN
		const storage = createItineraryStorage();
		const initResult = await storage.initialize();

		if (!initResult.success) {
			throw new Error('Storage initialization failed');
		}
		console.log('✅ Storage initialized');

		// Core services
		const itineraryService = new ItineraryService(storage);
		const collectionService = new ItineraryCollectionService(storage);
		const segmentService = new SegmentService(storage);
		const dependencyService = new DependencyService(storage);
		console.log('✅ Core services initialized');

		// OPTIONAL SERVICES - Only initialize if API keys are configured
		// Uses dynamic imports to avoid loading modules on Vercel

		// Import service - requires OPENROUTER_API_KEY
		let importService: DocumentImportService | null = null;
		const importApiKey = process.env.OPENROUTER_API_KEY;

		if (importApiKey) {
			const { DocumentImportService: ImportServiceClass } = await import(
				'../../src/services/document-import.service.js'
			);
			const importConfig: ImportConfig = {
				apiKey: importApiKey,
				costTrackingEnabled: false, // Disable for Vercel (no filesystem)
			};
			importService = new ImportServiceClass(importConfig, itineraryService);
			console.log('✅ Import service initialized');
		} else {
			console.log('⚠️  Import service disabled (no OPENROUTER_API_KEY)');
		}

		// Travel Agent service - requires SERPAPI_KEY
		let travelAgentService: TravelAgentService | null = null;
		const serpApiKey = process.env.SERPAPI_KEY;

		if (serpApiKey) {
			const { TravelAgentService: TravelAgentServiceClass } = await import(
				'../../src/services/travel-agent.service.js'
			);
			const travelAgentConfig: TravelAgentConfig = {
				apiKey: serpApiKey,
			};
			travelAgentService = new TravelAgentServiceClass(travelAgentConfig);
			console.log('✅ Travel Agent service initialized');
		} else {
			console.log('⚠️  Travel Agent service disabled (no SERPAPI_KEY)');
		}

		// Travel Agent Facade - always available (wraps review/continuity services)
		// Dynamic import to avoid loading module on Vercel
		const { TravelAgentFacade: TravelAgentFacadeClass } = await import(
			'../../src/services/travel-agent-facade.service.js'
		);
		const travelAgentFacade = new TravelAgentFacadeClass(itineraryService, travelAgentService);
		console.log('✅ Travel Agent Facade initialized');

		// Trip Designer service - requires OPENROUTER_API_KEY
		let tripDesignerService: TripDesignerService | null = null;
		const tripDesignerApiKey = process.env.OPENROUTER_API_KEY;

		if (tripDesignerApiKey) {
			const { TripDesignerService: TripDesignerServiceClass } = await import(
				'../../src/services/trip-designer/trip-designer.service.js'
			);
			const tripDesignerConfig: TripDesignerConfig = {
				apiKey: tripDesignerApiKey,
			};
			tripDesignerService = new TripDesignerServiceClass(
				tripDesignerConfig,
				undefined, // Use default in-memory session storage
				{
					itineraryService,
					segmentService,
					dependencyService,
					travelAgentFacade,
				}
			);
			console.log('✅ Trip Designer service initialized');
		} else {
			console.log('⚠️  Trip Designer service disabled (no OPENROUTER_API_KEY)');
		}

		// Knowledge service - requires OPENROUTER_API_KEY and filesystem (skip on Vercel)
		let knowledgeService: KnowledgeService | null = null;

		if (!isVercel && process.env.OPENROUTER_API_KEY) {
			try {
				// Dynamic imports for filesystem-dependent services only when not on Vercel
				const { VectraStorage } = await import('../../src/storage/vectra-storage.js');
				const { EmbeddingService } = await import('../../src/services/embedding.service.js');
				const { KnowledgeService: KnowledgeServiceClass } = await import(
					'../../src/services/knowledge.service.js'
				);

				const vectorStorage = new VectraStorage('./data/vectra');
				const embeddingService = new EmbeddingService({
					apiKey: process.env.OPENROUTER_API_KEY,
				});

				knowledgeService = new KnowledgeServiceClass(vectorStorage, embeddingService);
				await knowledgeService.initialize();
				console.log('✅ Knowledge service initialized');
			} catch (error) {
				console.warn('⚠️  Knowledge service initialization failed:', error);
			}
		} else {
			console.log('⚠️  Knowledge service disabled (Vercel or no API key)');
		}

		servicesInstance = {
			storage,
			itineraryService,
			collectionService,
			segmentService,
			dependencyService,
			importService,
			travelAgentService,
			travelAgentFacade,
			tripDesignerService,
			knowledgeService,
		};

		console.log('✅ All services initialized successfully');
		return servicesInstance;
	} catch (error) {
		console.error('❌ Service initialization failed:', {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined
		});
		throw error;
	}
}

/**
 * Session authentication constants
 */
const SESSION_COOKIE_NAME = 'itinerizer_session';
const SESSION_SECRET = 'authenticated';

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/auth'];

/**
 * SvelteKit handle hook - Authentication + Services
 */
export const handle: Handle = async ({ event, resolve }) => {
	console.log(`Request: ${event.request.method} ${event.url.pathname}`);

	try {
		// Initialize services on first request
		const services = await initializeServices();

		// Make services available to all API routes via locals
		event.locals.services = services;

		// Check for session cookie
		const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);
		event.locals.isAuthenticated = sessionCookie === SESSION_SECRET;

		// Check if route requires authentication
		const isPublicRoute = PUBLIC_ROUTES.some(route => event.url.pathname.startsWith(route));

		// Redirect to login if not authenticated and not on a public route
		if (!event.locals.isAuthenticated && !isPublicRoute) {
			// Allow API routes to fail with 401 instead of redirecting
			if (event.url.pathname.startsWith('/api/')) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Redirect to login page
			return new Response(null, {
				status: 302,
				headers: {
					location: '/login'
				}
			});
		}

		// Redirect to home if authenticated and trying to access login page
		if (event.locals.isAuthenticated && event.url.pathname === '/login') {
			return new Response(null, {
				status: 302,
				headers: {
					location: '/'
				}
			});
		}

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

/**
 * Create a TripDesignerService on-demand with a custom API key
 * Used when client provides API key in request headers
 */
export async function createTripDesignerWithKey(
	apiKey: string,
	services: Services
): Promise<TripDesignerService> {
	const { TripDesignerService: TripDesignerServiceClass } = await import(
		'../../src/services/trip-designer/trip-designer.service.js'
	);

	const config: TripDesignerConfig = {
		apiKey,
	};

	return new TripDesignerServiceClass(config, undefined, {
		itineraryService: services.itineraryService,
		segmentService: services.segmentService,
		dependencyService: services.dependencyService,
		travelAgentFacade: services.travelAgentFacade,
	});
}

// Export type for use in +server.ts files
export type { Services };
