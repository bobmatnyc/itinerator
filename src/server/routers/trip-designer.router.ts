/**
 * Trip Designer Router
 * Conversational trip planning interface (chat-based)
 * @module server/routers/trip-designer
 */

import { Router, type Request, type Response } from 'express';
import type { TripDesignerService } from '../../services/trip-designer/trip-designer.service.js';
import type { KnowledgeService } from '../../services/knowledge.service.js';
import type { ItineraryService } from '../../services/itinerary.service.js';
import type { ItineraryId, SessionId } from '../../domain/types/branded.js';
import type { SegmentService } from '../../services/segment.service.js';
import type { DependencyService } from '../../services/dependency.service.js';
import type { TravelAgentFacade } from '../../services/travel-agent-facade.service.js';
import type { TripDesignerConfig } from '../../domain/types/trip-designer.js';

interface RouterDependencies {
  tripDesignerService: TripDesignerService | null;
  knowledgeService: KnowledgeService | undefined;
  itineraryService: ItineraryService;
  segmentService: SegmentService;
  dependencyService: DependencyService;
  travelAgentFacade: TravelAgentFacade;
}

export function createTripDesignerRouter(
  tripDesignerService: TripDesignerService | null,
  knowledgeService: KnowledgeService | undefined,
  itineraryService: ItineraryService,
  segmentService?: SegmentService,
  dependencyService?: DependencyService,
  travelAgentFacade?: TravelAgentFacade
): Router {
  const router = Router();

  // Store dependencies for creating on-demand services
  const deps: RouterDependencies = {
    tripDesignerService,
    knowledgeService,
    itineraryService,
    segmentService: segmentService!,
    dependencyService: dependencyService!,
    travelAgentFacade: travelAgentFacade!,
  };

  // Cache TripDesignerService instances by API key to maintain session state
  const serviceCache = new Map<string, TripDesignerService>();

  /**
   * Helper: Create TripDesignerService on-demand with custom API key
   */
  async function createTripDesignerWithKey(apiKey: string): Promise<TripDesignerService> {
    const { TripDesignerService: TripDesignerServiceClass } = await import(
      '../../services/trip-designer/trip-designer.service.js'
    );

    const config: TripDesignerConfig = {
      apiKey,
    };

    return new TripDesignerServiceClass(config, undefined, {
      itineraryService: deps.itineraryService,
      segmentService: deps.segmentService,
      dependencyService: deps.dependencyService,
      travelAgentFacade: deps.travelAgentFacade,
    });
  }

  /**
   * Helper: Get TripDesignerService from header or default
   * Caches services by API key to maintain session state across requests
   */
  async function getTripDesignerService(req: Request): Promise<TripDesignerService | null> {
    const headerApiKey = req.headers['x-openrouter-api-key'];

    // Create or retrieve cached service if header key provided
    if (headerApiKey && typeof headerApiKey === 'string') {
      // Check cache first
      if (serviceCache.has(headerApiKey)) {
        return serviceCache.get(headerApiKey)!;
      }

      // Create new service and cache it
      const service = await createTripDesignerWithKey(headerApiKey);
      serviceCache.set(headerApiKey, service);
      return service;
    }

    // Use default service
    return deps.tripDesignerService;
  }

  /**
   * POST /api/v1/designer/sessions
   * Create a new chat session for an itinerary
   * Body: { itineraryId: string }
   * Response: { sessionId: string }
   * Headers: X-OpenRouter-API-Key (optional, overrides env var)
   */
  router.post('/sessions', async (req: Request, res: Response) => {
    try {
      // Get TripDesignerService from header or default
      const service = await getTripDesignerService(req);

      if (!service) {
        return res.status(503).json({
          error: 'Trip Designer disabled',
          message: 'No API key provided. Set your OpenRouter API key in Profile settings.',
          hint: 'Add your key to .itinerator/config.yaml or set OPENROUTER_API_KEY environment variable',
        });
      }

      const { itineraryId } = req.body;

      if (!itineraryId) {
        return res.status(400).json({
          error: 'Missing itineraryId',
          message: 'itineraryId is required in request body',
        });
      }

      // Verify itinerary exists
      const itineraryResult = await deps.itineraryService.get(itineraryId as ItineraryId);
      if (!itineraryResult.success) {
        return res.status(404).json({
          error: 'Itinerary not found',
          message: `No itinerary found with id: ${itineraryId}`,
        });
      }

      // Create session
      const sessionResult = await service.createSession(itineraryId as ItineraryId);

      if (!sessionResult.success) {
        return res.status(500).json({
          error: 'Failed to create session',
          message: sessionResult.error.message,
        });
      }

      res.status(201).json({
        sessionId: sessionResult.value,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/v1/designer/sessions/:sessionId
   * Get session details
   * Response: TripDesignerSession
   * Headers: X-OpenRouter-API-Key (optional, overrides env var)
   */
  router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      // Get TripDesignerService from header or default
      const service = await getTripDesignerService(req);

      if (!service) {
        return res.status(503).json({
          error: 'Trip Designer disabled',
          message: 'No API key provided. Set your OpenRouter API key in Profile settings.',
        });
      }

      const sessionId = req.params.sessionId as SessionId;

      const sessionResult = await service.getSession(sessionId);

      if (!sessionResult.success) {
        return res.status(404).json({
          error: 'Session not found',
          message: `No session found with id: ${sessionId}`,
        });
      }

      res.json(sessionResult.value);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /api/v1/designer/sessions/:sessionId
   * End a chat session
   * Headers: X-OpenRouter-API-Key (optional, overrides env var)
   */
  router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      // Get TripDesignerService from header or default
      const service = await getTripDesignerService(req);

      if (!service) {
        return res.status(503).json({
          error: 'Trip Designer disabled',
          message: 'No API key provided. Set your OpenRouter API key in Profile settings.',
        });
      }

      const sessionId = req.params.sessionId as SessionId;

      // Get session to verify it exists
      const sessionResult = await service.getSession(sessionId);

      if (!sessionResult.success) {
        return res.status(404).json({
          error: 'Session not found',
          message: `No session found with id: ${sessionId}`,
        });
      }

      // TODO: Add endSession method to TripDesignerService
      // For now, just return success
      res.status(204).send();
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/v1/designer/sessions/:sessionId/messages/stream
   * Send a message to a chat session with SSE streaming
   * Body: { message: string }
   * Response: SSE stream
   * Headers: X-OpenRouter-API-Key (optional, overrides env var)
   */
  router.post('/sessions/:sessionId/messages/stream', async (req: Request, res: Response) => {
    try {
      // Get TripDesignerService from header or default
      const service = await getTripDesignerService(req);

      if (!service) {
        return res.status(503).json({
          error: 'Trip Designer disabled',
          message: 'No API key provided. Set your OpenRouter API key in Profile settings.',
        });
      }

      const sessionId = req.params.sessionId as SessionId;
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          error: 'Invalid message',
          message: 'message must be a non-empty string',
        });
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial connection event
      res.write('event: connected\n');
      res.write('data: {"status":"connected"}\n\n');

      try {
        // Stream the chat response
        for await (const event of service.chatStream(sessionId, message)) {
          // Map StreamEvent to SSE format
          switch (event.type) {
            case 'text':
              res.write('event: text\n');
              res.write(`data: ${JSON.stringify({ content: event.content })}\n\n`);
              break;

            case 'tool_call':
              res.write('event: tool_call\n');
              res.write(`data: ${JSON.stringify({ name: event.name, arguments: event.arguments })}\n\n`);
              break;

            case 'tool_result':
              res.write('event: tool_result\n');
              res.write(
                `data: ${JSON.stringify({ name: event.name, result: event.result, success: event.success })}\n\n`
              );
              break;

            case 'structured_questions':
              res.write('event: structured_questions\n');
              res.write(`data: ${JSON.stringify({ questions: event.questions })}\n\n`);
              break;

            case 'done':
              res.write('event: done\n');
              res.write(
                `data: ${JSON.stringify({
                  itineraryUpdated: event.itineraryUpdated,
                  segmentsModified: event.segmentsModified || [],
                  tokens: event.tokens,
                  cost: event.cost,
                })}\n\n`
              );
              break;

            case 'error':
              res.write('event: error\n');
              res.write(`data: ${JSON.stringify({ message: event.message })}\n\n`);
              break;
          }
        }

        // Close the stream
        res.end();
      } catch (streamError) {
        // Send error event
        res.write('event: error\n');
        res.write(
          `data: ${JSON.stringify({
            message: streamError instanceof Error ? streamError.message : 'Stream error',
          })}\n\n`
        );
        res.end();
      }
    } catch (error) {
      // If headers not sent yet, send JSON error
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error),
        });
      } else {
        // Headers already sent, close the stream
        res.end();
      }
    }
  });

  /**
   * POST /api/v1/designer/sessions/:sessionId/messages
   * Send a message to a chat session (non-streaming)
   * Body: { message: string }
   * Response: AgentResponse
   * Headers: X-OpenRouter-API-Key (optional, overrides env var)
   */
  router.post('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
    try {
      // Get TripDesignerService from header or default
      const service = await getTripDesignerService(req);

      if (!service) {
        return res.status(503).json({
          error: 'Trip Designer disabled',
          message: 'No API key provided. Set your OpenRouter API key in Profile settings.',
        });
      }

      const sessionId = req.params.sessionId as SessionId;
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          error: 'Invalid message',
          message: 'message must be a non-empty string',
        });
      }

      // Send message and get response
      const chatResult = await service.chat(sessionId, message);

      if (!chatResult.success) {
        const error = chatResult.error;

        // Handle different error types
        if (error.type === 'session_not_found') {
          return res.status(404).json({
            error: 'Session not found',
            message: `No session found with id: ${sessionId}`,
          });
        }

        if (error.type === 'rate_limit_exceeded') {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests, please try again later',
            retryAfter: error.retryAfter,
          });
        }

        if (error.type === 'cost_limit_exceeded') {
          return res.status(402).json({
            error: 'Cost limit exceeded',
            message: `Session cost limit exceeded: $${error.cost} / $${error.limit}`,
          });
        }

        if (error.type === 'llm_api_error') {
          return res.status(error.retryable ? 503 : 500).json({
            error: 'LLM API error',
            message: error.error,
            retryable: error.retryable,
          });
        }

        // Generic error
        return res.status(500).json({
          error: 'Chat failed',
          message: JSON.stringify(error),
        });
      }

      // Return successful response
      res.json(chatResult.value);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/v1/designer/stats
   * Get Trip Designer statistics
   * Response: { activeSessions: number }
   */
  router.get('/stats', (_req: Request, res: Response) => {
    if (!tripDesignerService) {
      return res.status(503).json({
        error: 'Trip Designer disabled',
        message: 'OPENROUTER_API_KEY not configured',
      });
    }

    const stats = tripDesignerService.getStats();
    res.json(stats);
  });

  /**
   * GET /api/v1/designer/knowledge/stats
   * Get knowledge graph statistics
   * Response: { totalDocuments: number, byType: object, byCategory: object }
   */
  router.get('/knowledge/stats', async (_req: Request, res: Response) => {
    if (!knowledgeService) {
      return res.status(503).json({
        error: 'Knowledge service disabled',
        message: 'OPENROUTER_API_KEY not configured - knowledge graph is disabled',
      });
    }

    try {
      const statsResult = await knowledgeService.getStats();

      if (!statsResult.success) {
        return res.status(500).json({
          error: 'Failed to get knowledge stats',
          message: statsResult.error.message,
        });
      }

      res.json(statsResult.value);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/v1/designer/knowledge/search
   * Search knowledge graph
   * Body: { query: string, topK?: number, type?: string, category?: string }
   * Response: { documents: VectorDocument[], scores: number[] }
   */
  router.post('/knowledge/search', async (req: Request, res: Response) => {
    if (!knowledgeService) {
      return res.status(503).json({
        error: 'Knowledge service disabled',
        message: 'OPENROUTER_API_KEY not configured - knowledge graph is disabled',
      });
    }

    try {
      const { query, topK, type, category } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: 'Invalid query',
          message: 'query must be a non-empty string',
        });
      }

      const searchResult = await knowledgeService.search(query, {
        topK,
        type,
        category,
      });

      if (!searchResult.success) {
        return res.status(500).json({
          error: 'Search failed',
          message: searchResult.error.message,
        });
      }

      res.json(searchResult.value);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
