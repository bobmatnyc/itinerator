import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Simple health check endpoint
 * Returns 200 OK with timestamp when backend is operational
 */
export const GET: RequestHandler = async () => {
  return json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'itinerator-api',
  });
};
