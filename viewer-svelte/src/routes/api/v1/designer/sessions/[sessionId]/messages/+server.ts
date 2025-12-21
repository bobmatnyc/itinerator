/**
 * Trip Designer - Messages route (non-streaming)
 * POST /api/v1/designer/sessions/:sessionId/messages
 * Body: { message: string }
 * Response: AgentResponse
 * Headers: X-OpenRouter-API-Key (optional, overrides env var)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SessionId } from '$domain/types/branded.js';
import { createTripDesignerWithKey } from '$hooks/hooks.server.js';

/**
 * POST /api/v1/designer/sessions/:sessionId/messages
 * Send a message to a chat session (non-streaming)
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	// Get API key from header or use cached service
	const headerApiKey = request.headers.get('X-OpenRouter-API-Key');
	let tripDesignerService = locals.services.tripDesignerService;

	// Create on-demand service if header key provided
	if (headerApiKey) {
		tripDesignerService = await createTripDesignerWithKey(headerApiKey, locals.services);
	}

	if (!tripDesignerService) {
		throw error(503, {
			message: 'Trip Designer disabled: No API key provided. Set your OpenRouter API key in Profile settings.'
		});
	}

	const sessionId = params.sessionId as SessionId;

	const body = await request.json();
	const { message } = body;

	if (!message || typeof message !== 'string') {
		throw error(400, {
			message: 'Invalid message: message must be a non-empty string'
		});
	}

	// Send message and get response
	const chatResult = await tripDesignerService.chat(sessionId, message);

	if (!chatResult.success) {
		const err = chatResult.error;

		// Handle different error types
		if (err.type === 'session_not_found') {
			throw error(404, {
				message: `Session not found: No session found with id: ${sessionId}`
			});
		}

		if (err.type === 'rate_limit_exceeded') {
			throw error(429, {
				message: 'Rate limit exceeded: Too many requests, please try again later'
			});
		}

		if (err.type === 'cost_limit_exceeded') {
			throw error(402, {
				message: `Cost limit exceeded: Session cost limit exceeded: $${err.cost} / $${err.limit}`
			});
		}

		if (err.type === 'llm_api_error') {
			const statusCode = err.retryable ? 503 : 500;
			throw error(statusCode, {
				message: 'LLM API error: ' + err.error
			});
		}

		// Generic error
		throw error(500, {
			message: 'Chat failed: ' + JSON.stringify(err)
		});
	}

	// Return successful response
	return json(chatResult.value);
};
