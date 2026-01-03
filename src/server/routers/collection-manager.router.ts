/**
 * Itinerary Collection Manager Router
 * Manages the collection of itineraries (CRUD on itinerary entities)
 * @module server/routers/collection-manager
 */

import { Router, type Request, type Response } from 'express';
import type { ItineraryCollectionService } from '../../services/itinerary-collection.service.js';
import type { ItineraryService } from '../../services/itinerary.service.js';
import type { ItineraryId } from '../../domain/types/branded.js';

export function createCollectionManagerRouter(
  collectionService: ItineraryCollectionService,
  itineraryService?: ItineraryService
): Router {
  const router = Router();

  /**
   * GET /api/v1/itineraries
   * List all itineraries (summaries) for the current user
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      // Get user email from X-User-Email header
      const userEmail = req.headers['x-user-email'] as string | undefined;

      // Use user-scoped list if email provided, otherwise list all
      const result = userEmail
        ? await collectionService.listItinerariesByUser(userEmail)
        : await collectionService.listItineraries();

      if (!result.success) {
        return res.status(500).json({
          error: 'Failed to list itineraries',
          message: result.error.message,
        });
      }

      console.log(`[EXPRESS] Listed ${result.value.length} itineraries for user: ${userEmail || 'all'}`);
      res.json(result.value);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/v1/itineraries
   * Create blank itinerary
   * Body: { title, description?, startDate, endDate, draft? }
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { title, description, startDate, endDate, draft } = req.body;

      if (!title || !startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'title, startDate, and endDate are required',
        });
      }

      // Get user email from X-User-Email header for ownership tracking
      const userEmail = req.headers['x-user-email'] as string | undefined;

      const result = await collectionService.createItinerary({
        title,
        description: description || '',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        draft: draft === true, // Only save to disk if not a draft
        createdBy: userEmail, // Set ownership to current user
      });

      if (!result.success) {
        return res.status(500).json({
          error: 'Failed to create itinerary',
          message: result.error.message,
        });
      }

      res.status(201).json({
        ...result.value,
        isDraft: draft === true,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/v1/itineraries/:id
   * Get full itinerary with segments (ownership verified)
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as ItineraryId;
      if (!id) {
        return res.status(400).json({ error: 'Missing ID parameter' });
      }

      // Get user email from X-User-Email header
      const userEmail = req.headers['x-user-email'] as string | undefined;

      // Use itineraryService for full itinerary (with segments)
      // Fall back to collectionService summary if itineraryService not available
      if (itineraryService) {
        const result = await itineraryService.getItinerary(id);
        if (!result.success) {
          return res.status(404).json({
            error: 'Itinerary not found',
            message: result.error.message,
          });
        }

        // Verify ownership
        const itinerary = result.value;
        if (userEmail && itinerary.createdBy) {
          const createdBy = itinerary.createdBy.toLowerCase().trim();
          const reqUser = userEmail.toLowerCase().trim();
          if (createdBy !== reqUser) {
            return res.status(403).json({
              message: 'Access denied: You do not have permission to view this itinerary',
            });
          }
        }

        return res.json(result.value);
      }

      // Fallback to summary (no segments)
      const result = await collectionService.getItinerarySummary(id);
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

  /**
   * PATCH /api/v1/itineraries/:id
   * Update itinerary metadata (title, description, dates, status, tags) - ownership verified
   */
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as ItineraryId;
      const { title, description, startDate, endDate, status, tripType, tags } = req.body;

      // Get user email from X-User-Email header
      const userEmail = req.headers['x-user-email'] as string | undefined;

      // Verify ownership before updating
      if (collectionService) {
        const summaryResult = await collectionService.getItinerarySummary(id);
        if (summaryResult.success && userEmail && summaryResult.value.createdBy) {
          const createdBy = summaryResult.value.createdBy.toLowerCase().trim();
          const reqUser = userEmail.toLowerCase().trim();
          if (createdBy !== reqUser) {
            return res.status(403).json({
              message: 'Access denied: You do not have permission to update this itinerary',
            });
          }
        }
      }

      const updates: Parameters<typeof collectionService.updateMetadata>[1] = {};

      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (startDate !== undefined) updates.startDate = new Date(startDate);
      if (endDate !== undefined) updates.endDate = new Date(endDate);
      if (status !== undefined) updates.status = status;
      if (tripType !== undefined) updates.tripType = tripType;
      if (tags !== undefined) updates.tags = tags;

      const result = await collectionService.updateMetadata(id, updates);

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

  /**
   * DELETE /api/v1/itineraries/:id
   * Delete itinerary (ownership verified)
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as ItineraryId;

      // Get user email from X-User-Email header
      const userEmail = req.headers['x-user-email'] as string | undefined;

      // Verify ownership before deleting
      if (collectionService) {
        const summaryResult = await collectionService.getItinerarySummary(id);
        if (summaryResult.success && userEmail && summaryResult.value.createdBy) {
          const createdBy = summaryResult.value.createdBy.toLowerCase().trim();
          const reqUser = userEmail.toLowerCase().trim();
          if (createdBy !== reqUser) {
            return res.status(403).json({
              message: 'Access denied: You do not have permission to delete this itinerary',
            });
          }
        }
      }

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

  return router;
}
