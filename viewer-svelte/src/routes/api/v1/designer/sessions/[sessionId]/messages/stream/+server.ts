/**
 * Trip Designer - Streaming messages route
 * POST /api/v1/designer/sessions/:sessionId/messages/stream
 * Body: { message: string }
 * Response: SSE stream
 * Headers: X-OpenRouter-API-Key (optional, overrides env var)
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SessionId } from '$domain/types/branded.js';
import { createTripDesignerWithKey } from '$hooks/hooks.server.js';

/**
 * POST /api/v1/designer/sessions/:sessionId/messages/stream
 * Send a message to a chat session with SSE streaming
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const userEmail = locals.userEmail || 'anonymous';
	const sessionId = params.sessionId;
	console.log(`[TripDesigner] Chat request | user=${userEmail} | session=${sessionId}`);

	// Get API key from header or use cached service
	const headerApiKey = request.headers.get('X-OpenRouter-API-Key');
	let tripDesignerService = locals.services.tripDesignerService;

	// Validate API key from header (reject empty/whitespace keys)
	if (headerApiKey !== null && headerApiKey.trim() === '') {
		throw error(400, {
			message: 'Invalid API key: API key cannot be empty. Please add your OpenRouter API key in Profile settings.'
		});
	}

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

	// Log the user's query
	const truncatedMessage = message.length > 200 ? message.substring(0, 200) + '...' : message;
	console.log(`[TripDesigner] User query | user=${userEmail} | session=${sessionId} | message="${truncatedMessage}"`);

	// Create a ReadableStream for SSE
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			// Helper to write SSE events
			const writeEvent = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\n`));
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			};

			try {
				// Send initial connection event
				writeEvent('connected', { status: 'connected' });

				// Stream the chat response
				for await (const event of tripDesignerService.chatStream(sessionId, message)) {
					// Map StreamEvent to SSE format
					switch (event.type) {
						case 'text':
							writeEvent('text', { content: event.content });
							break;

						case 'tool_call':
							writeEvent('tool_call', { name: event.name, arguments: event.arguments });
							break;

						case 'tool_result':
							writeEvent('tool_result', {
								name: event.name,
								result: event.result,
								success: event.success
							});
							break;

						case 'structured_questions':
							writeEvent('structured_questions', { questions: event.questions });
							break;

						case 'done':
							console.log(`[TripDesigner] Response complete | user=${userEmail} | session=${sessionId} | tokens=${event.tokens || 'n/a'} | cost=$${event.cost?.toFixed(4) || 'n/a'} | updated=${event.itineraryUpdated}`);
							writeEvent('done', {
								itineraryUpdated: event.itineraryUpdated,
								segmentsModified: event.segmentsModified || [],
								tokens: event.tokens,
								cost: event.cost
							});
							break;

						case 'error':
							console.log(`[TripDesigner] Stream error | user=${userEmail} | session=${sessionId} | error=${event.message}`);
							writeEvent('error', { message: event.message });
							break;
					}
				}

				// Close the stream
				controller.close();
			} catch (streamError) {
				const errorMsg = streamError instanceof Error ? streamError.message : 'Stream error';
				console.log(`[TripDesigner] Stream exception | user=${userEmail} | session=${sessionId} | error=${errorMsg}`);
				// Send error event
				writeEvent('error', {
					message: errorMsg
				});
				controller.close();
			}
		}
	});

	// Return SSE response
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no' // Disable nginx buffering
		}
	});
};
