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
import { env } from '$env/dynamic/private';
import { join } from 'node:path';
import { createItineraryStorage } from '../../src/storage/index.js';
import type { ItineraryStorage } from '../../src/storage/index.js';
import { ItineraryService } from '../../src/services/itinerary.service.js';
import { ItineraryCollectionService } from '../../src/services/itinerary-collection.service.js';
import { SegmentService } from '../../src/services/segment.service.js';
import { DependencyService } from '../../src/services/dependency.service.js';
import { PermissionService } from '../../src/services/permission.service.js';

// Type-only imports for optional services (don't load modules)
import type { DocumentImportService } from '../../src/services/document-import.service.js';
import type { ImportConfig } from '../../src/domain/types/import.js';
import type { TravelAgentService } from '../../src/services/travel-agent.service.js';
import type { TravelAgentConfig } from '../../src/services/travel-agent.service.js';
import type { TravelAgentFacade } from '../../src/services/travel-agent-facade.service.js';
import type { TripDesignerService } from '../../src/services/trip-designer/trip-designer.service.js';
import type { TripDesignerConfig } from '../../src/domain/types/trip-designer.js';
import type { KnowledgeService } from '../../src/services/knowledge.service.js';
import type { WeaviateKnowledgeService } from '../../src/services/weaviate-knowledge.service.js';
import type { KnowledgeConfig } from '../../src/services/knowledge.service.js';
import type { SessionStorage } from '../../src/services/trip-designer/session.js';

/**
 * Services available to all API routes
 */
interface Services {
	storage: ItineraryStorage;
	itineraryService: ItineraryService;
	collectionService: ItineraryCollectionService;
	segmentService: SegmentService;
	dependencyService: DependencyService;
	permissionService: PermissionService;
	importService: DocumentImportService | null;
	travelAgentService: TravelAgentService | null;
	travelAgentFacade: TravelAgentFacade;
	tripDesignerService: TripDesignerService | null;
	knowledgeService: KnowledgeService | WeaviateKnowledgeService | null;
}

let servicesInstance: Services | null = null;

/**
 * Global session storage that survives HMR
 * All TripDesignerService instances share this storage to prevent session loss
 */
let globalSessionStorage: SessionStorage | null = null;

/**
 * Cache for TripDesignerService instances keyed by API key
 * Ensures session persistence across requests with the same API key
 */
const tripDesignerCache = new Map<string, TripDesignerService>();

// Preserve session storage across HMR in development
if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		console.log('[HMR] Clearing TripDesigner service cache (sessions preserved)');
		// Clear the service cache, but keep globalSessionStorage intact
		// This ensures sessions survive HMR reloads
		tripDesignerCache.clear();
	});
}

/**
 * Initialize services with Vercel compatibility
 */
async function initializeServices(): Promise<Services> {
	if (servicesInstance) {
		console.log('Using cached services instance');
		return servicesInstance;
	}

	const isVercel = env.VERCEL === '1';
	const cwd = process.cwd();
	console.log('Initializing services...', {
		isVercel,
		hasBlob: !!env.BLOB_READ_WRITE_TOKEN,
		nodeEnv: env.NODE_ENV,
		cwd
	});

	try {
		// CORE SERVICES - Required for all operations

		// Storage - auto-detects Blob vs JSON based on BLOB_READ_WRITE_TOKEN
		// For local development, use absolute path to project root's data directory
		// SvelteKit dev server runs from viewer-svelte/, so we need to go up one level
		const storagePath = env.BLOB_READ_WRITE_TOKEN
			? undefined // Blob storage doesn't need a path
			: join(process.cwd(), '..', 'data', 'itineraries');

		console.log('Storage path:', storagePath);
		const storage = createItineraryStorage(storagePath);
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
		const permissionService = new PermissionService();
		console.log('✅ Core services initialized');

		// OPTIONAL SERVICES - Only initialize if API keys are configured
		// Uses dynamic imports to avoid loading modules on Vercel

		// Import service - requires OPENROUTER_API_KEY
		let importService: DocumentImportService | null = null;
		const importApiKey = env.OPENROUTER_API_KEY;

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
		const serpApiKey = env.SERPAPI_KEY;

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

		// Knowledge service - auto-detects Weaviate or Vectra
		// Initialize BEFORE TripDesigner so it can be passed as dependency
		let knowledgeService: KnowledgeService | WeaviateKnowledgeService | null = null;

		try {
			// Use factory to auto-detect backend
			const { createKnowledgeService } = await import(
				'../../src/services/knowledge-factory.js'
			);

			knowledgeService = createKnowledgeService();

			if (knowledgeService) {
				const initResult = await knowledgeService.initialize();
				if (initResult.success) {
					console.log('✅ Knowledge service initialized');
				} else {
					console.warn('⚠️  Knowledge service initialization failed:', initResult.error.message);
					knowledgeService = null;
				}
			} else {
				console.log('⚠️  Knowledge service disabled (no backend configured)');
			}
		} catch (error) {
			console.warn('⚠️  Knowledge service setup failed:', error);
		}

		// Trip Designer service - requires OPENROUTER_API_KEY
		let tripDesignerService: TripDesignerService | null = null;
		const tripDesignerApiKey = env.OPENROUTER_API_KEY;

		if (tripDesignerApiKey) {
			const { TripDesignerService: TripDesignerServiceClass } = await import(
				'../../src/services/trip-designer/trip-designer.service.js'
			);

			// Initialize global session storage if needed (survives HMR)
			if (!globalSessionStorage) {
				const { InMemorySessionStorage } = await import(
					'../../src/services/trip-designer/session.js'
				);
				globalSessionStorage = new InMemorySessionStorage();
				console.log('✅ Global session storage initialized');
			}

			const tripDesignerConfig: TripDesignerConfig = {
				apiKey: tripDesignerApiKey,
			};
			tripDesignerService = new TripDesignerServiceClass(
				tripDesignerConfig,
				globalSessionStorage, // Use global session storage (survives HMR)
				{
					itineraryService,
					segmentService,
					dependencyService,
					knowledgeService: knowledgeService || undefined,
					travelAgentFacade,
				}
			);
			console.log('✅ Trip Designer service initialized');
		} else {
			console.log('⚠️  Trip Designer service disabled (no OPENROUTER_API_KEY)');
		}

		servicesInstance = {
			storage,
			itineraryService,
			collectionService,
			segmentService,
			dependencyService,
			permissionService,
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
const SESSION_COOKIE_NAME = 'itinerator_session';
const SESSION_SECRET = 'authenticated';
const USER_EMAIL_COOKIE_NAME = 'itinerator_user_email';

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/auth', '/api/health', '/api/v1/health'];

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

		// Try cookie first, fallback to X-User-Email header for compatibility
		// This handles cases where the cookie expires but localStorage still has the email
		let userEmail = event.cookies.get(USER_EMAIL_COOKIE_NAME);
		console.log('[hooks] Cookie value:', { userEmail, cookieName: USER_EMAIL_COOKIE_NAME });
		if (!userEmail) {
			userEmail = event.request.headers.get('X-User-Email');
			if (userEmail) {
				console.log('[hooks] Using X-User-Email header:', userEmail);
			}
		}
		// Normalize email to match login endpoint normalization
		event.locals.userEmail = userEmail ? userEmail.trim().toLowerCase() : null;
		console.log('[hooks] Final userEmail:', event.locals.userEmail);

		// Check if route requires authentication
		const isPublicRoute = PUBLIC_ROUTES.some(route => event.url.pathname.startsWith(route));
		const isOptionsRequest = event.request.method === 'OPTIONS';

		// Handle CORS preflight requests for API routes
		// Return proper CORS headers to allow cross-origin requests (e.g., ngrok)
		if (isOptionsRequest && event.url.pathname.startsWith('/api/')) {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': event.request.headers.get('Origin') || '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, X-OpenRouter-API-Key',
					'Access-Control-Allow-Credentials': 'true',
					'Access-Control-Max-Age': '86400' // Cache preflight for 24 hours
				}
			});
		}

		// Redirect to login if not authenticated and not on a public route
		// Always allow OPTIONS preflight requests (they never include credentials)
		if (!event.locals.isAuthenticated && !isPublicRoute && !isOptionsRequest) {
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

		// Add CORS headers to API responses for cross-origin requests (e.g., ngrok)
		if (event.url.pathname.startsWith('/api/')) {
			const origin = event.request.headers.get('Origin');
			if (origin) {
				response.headers.set('Access-Control-Allow-Origin', origin);
				response.headers.set('Access-Control-Allow-Credentials', 'true');
			}
		}

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
 *
 * IMPORTANT: Uses global session storage to maintain session persistence across:
 * - HMR reloads in development
 * - API key changes
 * - Service instance recreation
 *
 * All TripDesignerService instances share the same session storage, ensuring
 * sessions survive even if the service instance is recreated.
 */
export async function createTripDesignerWithKey(
	apiKey: string,
	services: Services
): Promise<TripDesignerService> {
	// Check cache first - reuse existing service instance to preserve sessions
	const cached = tripDesignerCache.get(apiKey);
	if (cached) {
		console.log('[createTripDesignerWithKey] Using cached TripDesignerService for API key');
		return cached;
	}

	console.log('[createTripDesignerWithKey] Creating new TripDesignerService for API key');
	const { TripDesignerService: TripDesignerServiceClass } = await import(
		'../../src/services/trip-designer/trip-designer.service.js'
	);

	// Initialize global session storage if needed (survives HMR)
	if (!globalSessionStorage) {
		const { InMemorySessionStorage } = await import(
			'../../src/services/trip-designer/session.js'
		);
		globalSessionStorage = new InMemorySessionStorage();
		console.log('✅ Global session storage initialized (createTripDesignerWithKey)');
	}

	const config: TripDesignerConfig = {
		apiKey,
	};

	const service = new TripDesignerServiceClass(config, globalSessionStorage, {
		itineraryService: services.itineraryService,
		segmentService: services.segmentService,
		dependencyService: services.dependencyService,
		travelAgentFacade: services.travelAgentFacade,
		knowledgeService: services.knowledgeService || undefined,
	});

	// Cache the service instance to preserve SessionManager across requests
	tripDesignerCache.set(apiKey, service);

	return service;
}

// Export type for use in +server.ts files
export type { Services };
