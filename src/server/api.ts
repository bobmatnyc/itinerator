/**
 * Express API server for CLI-only local development
 *
 * NOTE: This Express server is for CLI/local development only.
 * For production deployments, use the SvelteKit server routes in viewer-svelte/src/routes/api/
 *
 * @module server/api
 */

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ItineraryService } from '../services/itinerary.service.js';
import { ItineraryCollectionService } from '../services/itinerary-collection.service.js';
import { SegmentService } from '../services/segment.service.js';
import { DependencyService } from '../services/dependency.service.js';
import { DocumentImportService } from '../services/document-import.service.js';
import { TripDesignerService } from '../services/trip-designer/trip-designer.service.js';
import { TravelAgentService } from '../services/travel-agent.service.js';
import { TravelAgentFacade } from '../services/travel-agent-facade.service.js';
import { KnowledgeService } from '../services/knowledge.service.js';
import { EmbeddingService } from '../services/embedding.service.js';
import { VectraStorage } from '../storage/vectra-storage.js';
import { AVAILABLE_MODELS } from '../services/model-selector.service.js';
import type { ImportConfig } from '../domain/types/import.js';
import type { ItineraryId } from '../domain/types/branded.js';
import type { SessionId } from '../domain/types/trip-designer.js';
import { createCollectionManagerRouter } from './routers/collection-manager.router.js';
import { createItineraryManagerRouter } from './routers/itinerary-manager.router.js';
import { createTravelAgentRouter } from './routers/travel-agent.router.js';
import { createTripDesignerRouter } from './routers/trip-designer.router.js';
import type { ItineraryStorage } from '../storage/storage.interface.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), 'data', 'uploads'));
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${sanitizedName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * Create Express API server
 */
export function createApiServer(config: {
  port?: number;
  storage: ItineraryStorage;
  segmentService: SegmentService;
  dependencyService: DependencyService;
  importConfig?: ImportConfig;
}): express.Application {
  const { storage, segmentService, dependencyService, importConfig } = config;
  const app = express();

  // Initialize services
  const itineraryService = new ItineraryService(storage);
  const collectionService = new ItineraryCollectionService(storage);

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize import service only if we have API key
  const importService = importConfig
    ? new DocumentImportService(importConfig, itineraryService)
    : null;

  // Initialize knowledge service if we have API key
  let knowledgeService: KnowledgeService | undefined;
  if (importConfig?.apiKey) {
    try {
      const vectorStorage = new VectraStorage('./data/vectors');
      const embeddingService = new EmbeddingService({
        apiKey: importConfig.apiKey,
      });
      knowledgeService = new KnowledgeService(vectorStorage, embeddingService, {
        namespace: 'travel-knowledge',
        topK: 5,
        similarityThreshold: 0.7,
      });

      // Initialize asynchronously (don't block server startup)
      knowledgeService.initialize().catch((error) => {
        console.warn('Failed to initialize knowledge service:', error);
      });
    } catch (error) {
      console.warn('Failed to create knowledge service:', error);
    }
  }

  // Initialize Travel Agent service if we have SERPAPI key
  const travelAgentService = importConfig?.serpapi?.apiKey
    ? new TravelAgentService({
        apiKey: importConfig.serpapi.apiKey,
        ...(importConfig.apiKey ? { thinkingModel: 'anthropic/claude-sonnet-4-20250514' } : {}),
      })
    : null;

  // Initialize Travel Agent facade
  const travelAgentFacade = new TravelAgentFacade(itineraryService, travelAgentService);

  // Initialize Trip Designer service if we have API key
  const tripDesignerService = importConfig?.apiKey
    ? new TripDesignerService(
        { apiKey: importConfig.apiKey },
        undefined, // Use default in-memory session storage
        {
          itineraryService,
          segmentService,
          dependencyService,
          ...(knowledgeService ? { knowledgeService } : {}),
          travelAgentFacade, // Pass the Travel Agent facade
        }
      )
    : null;

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // =====================================================================
  // V1 API ROUTERS (NEW ARCHITECTURE)
  // =====================================================================

  // Mount v1 routers
  const collectionManagerRouter = createCollectionManagerRouter(collectionService, itineraryService);
  const itineraryManagerRouter = createItineraryManagerRouter(segmentService, dependencyService);
  const travelAgentRouter = createTravelAgentRouter(
    importService,
    upload,
    travelAgentFacade
  );
  const tripDesignerRouter = createTripDesignerRouter(
    tripDesignerService,
    knowledgeService,
    itineraryService,
    segmentService,
    dependencyService,
    travelAgentFacade
  );

  app.use('/api/v1/itineraries', collectionManagerRouter);
  app.use('/api/v1/itineraries', itineraryManagerRouter);
  app.use('/api/v1/agent', travelAgentRouter);
  app.use('/api/v1/designer', tripDesignerRouter);

  // =====================================================================
  // LEGACY ROUTES (DEPRECATED - for backward compatibility)
  // These will be removed in a future version
  // =====================================================================

  // Add deprecation header middleware for legacy routes
  const addDeprecationHeader = (_req: Request, res: Response, next: () => void) => {
    res.setHeader('Deprecated', 'true');
    res.setHeader('Sunset', '2025-06-01');
    res.setHeader('Link', '</api/v1/docs>; rel="successor-version"');
    next();
  };

  // Get all itineraries
  app.get('/api/itineraries', addDeprecationHeader, async (_req: Request, res: Response) => {
    try {
      const result = await collectionService.listItineraries();

      if (!result.success) {
        return res.status(500).json({
          error: 'Failed to list itineraries',
          message: result.error.message,
        });
      }

      res.json(result.value);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get single itinerary with full details
  app.get('/api/itineraries/:id', addDeprecationHeader, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).json({ error: 'Missing ID parameter' });
      }
      const result = await itineraryService.get(id);

      if (!result.success) {
        return res.status(404).json({
          error: 'Itinerary not found',
          message: result.error.message,
        });
      }

      res.json(result.value);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Create a new blank itinerary
  // Set draft=true to keep in memory only until content is added (for chat)
  app.post('/api/itineraries', addDeprecationHeader, async (req: Request, res: Response) => {
    try {
      const { title, description, startDate, endDate, draft } = req.body;

      if (!title || !startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'title, startDate, and endDate are required',
        });
      }

      const result = await collectionService.createItinerary({
        title,
        description: description || '',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        draft: draft === true, // Only save to disk if not a draft
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'Failed to create itinerary',
          message: result.error.message,
        });
      }

      res.status(201).json({
        ...result.value,
        isDraft: draft === true, // Indicate this is a draft
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update itinerary metadata
  app.patch('/api/itineraries/:id', addDeprecationHeader, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as ItineraryId;
      const { title, description, startDate, endDate, status, tripType, tags } = req.body;

      const updates: Parameters<typeof itineraryService.update>[1] = {};

      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (startDate !== undefined) updates.startDate = new Date(startDate);
      if (endDate !== undefined) updates.endDate = new Date(endDate);
      if (status !== undefined) updates.status = status;
      if (tripType !== undefined) updates.tripType = tripType;
      if (tags !== undefined) updates.tags = tags;

      const result = await itineraryService.update(id, updates);

      if (!result.success) {
        return res.status(404).json({
          error: 'Failed to update itinerary',
          message: result.error.message,
        });
      }

      res.json(result.value);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Delete itinerary
  app.delete('/api/itineraries/:id', addDeprecationHeader, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as ItineraryId;
      const result = await collectionService.deleteItinerary(id);

      if (!result.success) {
        return res.status(404).json({
          error: 'Itinerary not found',
          message: result.error.message,
        });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get available models
  app.get('/api/models', addDeprecationHeader, (_req: Request, res: Response) => {
    res.json(AVAILABLE_MODELS);
  });

  // Import a new PDF
  app.post('/api/import', addDeprecationHeader, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!importService) {
        return res.status(503).json({
          error: 'Import disabled',
          message: 'OPENROUTER_API_KEY not configured - import functionality is disabled',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please upload a PDF file',
        });
      }

      const filePath = req.file.path;
      const model = req.body.model as string | undefined;

      // Import with validation
      const result = await importService.importWithValidation(filePath, {
        model: model || undefined,
        saveToStorage: true,
        validateContinuity: true,
        fillGaps: true,
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'Import failed',
          message: result.error.message,
          details: result.error.details,
        });
      }

      const importResult = result.value;

      res.json({
        success: true,
        itinerary: importResult.parsedItinerary,
        usage: importResult.usage,
        continuityValidation: importResult.continuityValidation,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get cost summary
  app.get('/api/costs', addDeprecationHeader, async (_req: Request, res: Response) => {
    try {
      if (!importService) {
        return res.status(503).json({
          error: 'Cost tracking disabled',
          message: 'OPENROUTER_API_KEY not configured',
        });
      }
      const summary = await importService.getCostSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // =====================================================================
  // TRIP DESIGNER ENDPOINTS
  // =====================================================================

  /**
   * Create a new chat session for an itinerary
   * POST /api/chat/sessions
   * Body: { itineraryId: string }
   * Response: { sessionId: string }
   */
  app.post('/api/chat/sessions', addDeprecationHeader, async (req: Request, res: Response) => {
    try {
      if (!tripDesignerService) {
        return res.status(503).json({
          error: 'Trip Designer disabled',
          message: 'OPENROUTER_API_KEY not configured - chat functionality is disabled',
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
      const itineraryResult = await itineraryService.get(itineraryId as ItineraryId);
      if (!itineraryResult.success) {
        return res.status(404).json({
          error: 'Itinerary not found',
          message: `No itinerary found with id: ${itineraryId}`,
        });
      }

      // Create session
      const sessionResult = await tripDesignerService.createSession(itineraryId as ItineraryId);

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
   * Send a message to a chat session with streaming
   * POST /api/chat/sessions/:sessionId/messages/stream
   * Body: { message: string }
   * Response: SSE stream
   */
  app.post('/api/chat/sessions/:sessionId/messages/stream', addDeprecationHeader, async (req: Request, res: Response) => {
    try {
      if (!tripDesignerService) {
        return res.status(503).json({
          error: 'Trip Designer disabled',
          message: 'OPENROUTER_API_KEY not configured',
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
        for await (const event of tripDesignerService.chatStream(sessionId, message)) {
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
   * Send a message to a chat session
   * POST /api/chat/sessions/:sessionId/messages
   * Body: { message: string }
   * Response: AgentResponse
   */
  app.post('/api/chat/sessions/:sessionId/messages', addDeprecationHeader, async (req: Request, res: Response) => {
    try {
      if (!tripDesignerService) {
        return res.status(503).json({
          error: 'Trip Designer disabled',
          message: 'OPENROUTER_API_KEY not configured',
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
      const chatResult = await tripDesignerService.chat(sessionId, message);

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
   * Get session details
   * GET /api/chat/sessions/:sessionId
   * Response: TripDesignerSession
   */
  app.get('/api/chat/sessions/:sessionId', addDeprecationHeader, async (req: Request, res: Response) => {
    try {
      if (!tripDesignerService) {
        return res.status(503).json({
          error: 'Trip Designer disabled',
          message: 'OPENROUTER_API_KEY not configured',
        });
      }

      const sessionId = req.params.sessionId as SessionId;

      const sessionResult = await tripDesignerService.getSession(sessionId);

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
   * Server-Sent Events stream for real-time itinerary updates
   * GET /api/itineraries/:id/events
   * Response: SSE stream
   */
  app.get('/api/itineraries/:id/events', addDeprecationHeader, async (req: Request, res: Response) => {
    const itineraryId = req.params.id;

    if (!itineraryId) {
      return res.status(400).json({ error: 'Missing itinerary ID' });
    }

    // Verify itinerary exists
    const itineraryResult = await itineraryService.get(itineraryId as ItineraryId);
    if (!itineraryResult.success) {
      return res.status(404).json({
        error: 'Itinerary not found',
        message: `No itinerary found with id: ${itineraryId}`,
      });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection event
    res.write('data: {"type":"connected","itineraryId":"' + itineraryId + '"}\n\n');

    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      res.write(':ping\n\n');
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(pingInterval);
      res.end();
    });

    // TODO: Implement actual change notifications
    // This would require adding an event emitter to the itinerary service
    // to publish changes when segments are added/modified/deleted.
    // For now, this endpoint maintains the connection and sends pings.

    // Example of how to send an update when itinerary changes:
    // itineraryService.on('update', (data) => {
    //   if (data.itineraryId === itineraryId) {
    //     res.write(`data: ${JSON.stringify(data)}\n\n`);
    //   }
    // });
  });

  /**
   * Get Trip Designer statistics
   * GET /api/chat/stats
   * Response: { activeSessions: number }
   */
  app.get('/api/chat/stats', addDeprecationHeader, (_req: Request, res: Response) => {
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
   * Get knowledge graph statistics
   * GET /api/knowledge/stats
   * Response: { totalDocuments: number, byType: object, byCategory: object }
   */
  app.get('/api/knowledge/stats', addDeprecationHeader, async (_req: Request, res: Response) => {
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
   * Search knowledge graph
   * POST /api/knowledge/search
   * Body: { query: string, topK?: number, type?: string, category?: string }
   * Response: { documents: VectorDocument[], scores: number[] }
   */
  app.post('/api/knowledge/search', addDeprecationHeader, async (req: Request, res: Response) => {
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

  return app;
}
