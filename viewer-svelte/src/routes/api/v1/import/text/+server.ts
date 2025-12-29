/**
 * Text Import API Route
 * POST /api/v1/import/text
 *
 * Import travel bookings from plain text (emails, notes, confirmations)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ImportService } from '../../../../../src/services/import/index.js';
import { generateSegmentId } from '../../../../../src/domain/types/branded.js';

/**
 * Text import request body
 */
interface TextImportRequest {
	title?: string;
	text: string;
	apiKey: string;
	itineraryId?: string;
}

/**
 * POST /api/v1/import/text
 * Extract bookings from plain text and optionally add to itinerary
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse request body
		const body: TextImportRequest = await request.json();
		const { title, text, apiKey, itineraryId } = body;

		// Validate inputs
		if (!text || !text.trim()) {
			throw error(400, {
				message: 'Text is required'
			});
		}

		if (!apiKey || !apiKey.trim()) {
			throw error(400, {
				message: 'API key is required'
			});
		}

		console.log(`[POST /import/text] Parsing text import (${text.length} chars)`);

		// Create import service
		const importService = new ImportService({
			apiKey: apiKey.trim(),
		});

		// Extract bookings from text
		const result = await importService.importFromText(text.trim());

		if (!result.success) {
			console.error('[POST /import/text] Extraction failed:', result.errors);
			throw error(400, {
				message: `Failed to extract bookings: ${result.errors?.join(', ')}`
			});
		}

		console.log('[POST /import/text] Extracted:', {
			segmentCount: result.segments.length,
			confidence: result.confidence,
		});

		// If itineraryId provided, add segments to that itinerary
		if (itineraryId && result.segments.length > 0) {
			const { segmentService } = locals.services;
			const addedSegments = [];

			for (const segment of result.segments) {
				const segmentWithId = {
					...segment,
					id: generateSegmentId(),
					metadata: {
						importedFrom: 'text',
						importedAt: new Date().toISOString(),
					},
					travelerIds: [],
				};

				const addResult = await segmentService.add(itineraryId, segmentWithId);
				if (addResult.success) {
					addedSegments.push(segmentWithId.id);
				}
			}

			return json({
				success: true,
				segments: result.segments,
				confidence: result.confidence,
				summary: result.summary,
				addedToItinerary: itineraryId,
				addedSegmentIds: addedSegments,
			});
		}

		// Just return extracted segments
		return json({
			success: true,
			segments: result.segments,
			confidence: result.confidence,
			summary: result.summary,
			format: result.format,
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		// Handle other errors
		console.error('[POST /import/text] Text import error:', err);
		throw error(500, {
			message: err instanceof Error ? err.message : 'Unknown error occurred'
		});
	}
};
