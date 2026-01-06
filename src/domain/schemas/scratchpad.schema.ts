/**
 * Scratchpad Zod schemas for validation
 * @module domain/schemas/scratchpad
 */

import { z } from 'zod';
import { dateSchema, itineraryIdSchema, segmentIdSchema, segmentTypeSchema } from './common.schema.js';
import { segmentSchema } from './segment.schema.js';

/**
 * Scratchpad source schema
 */
export const scratchpadSourceSchema = z.enum(['designer', 'agent', 'user', 'search']);

/**
 * Scratchpad priority schema
 */
export const scratchpadPrioritySchema = z.enum(['high', 'medium', 'low']);

/**
 * Geography type schema
 */
export const geographyTypeSchema = z.enum(['neighborhood', 'district', 'area', 'region']);

/**
 * Scratchpad item ID schema (UUID)
 */
export const scratchpadItemIdSchema = z.string().uuid('Must be a valid UUID');

/**
 * Geography recommendation schema
 */
export const geographyRecommendationSchema = z.object({
  /** Unique identifier */
  id: z.string().uuid('Must be a valid UUID'),
  /** Parent itinerary ID */
  itineraryId: itineraryIdSchema,
  /** Name of the area */
  name: z.string().min(1, 'Name is required'),
  /** Type of geography */
  type: geographyTypeSchema,
  /** Parent city */
  city: z.string().min(1, 'City is required'),
  /** Country (optional) */
  country: z.string().optional(),
  /** Overview description */
  description: z.string().min(1, 'Description is required'),
  /** Key attractions, vibes */
  highlights: z.array(z.string()).default([]),
  /** What this area is best for */
  bestFor: z.array(z.string()).default([]),
  /** Source of this recommendation */
  source: scratchpadSourceSchema,
  /** Why this was recommended */
  notes: z.string().optional(),
  /** Priority level */
  priority: scratchpadPrioritySchema,
  /** When it was added */
  addedAt: dateSchema,
  /** Tags for filtering and organization */
  tags: z.array(z.string()).default([]),
});

/**
 * Scratchpad item schema
 */
export const scratchpadItemSchema = z.object({
  /** Unique item identifier */
  id: scratchpadItemIdSchema,
  /** Parent itinerary ID */
  itineraryId: itineraryIdSchema,
  /** The segment data */
  segment: segmentSchema,
  /** Timestamp when item was added */
  addedAt: dateSchema,
  /** Source of the recommendation */
  source: scratchpadSourceSchema,
  /** Optional notes explaining why this was recommended */
  notes: z.string().optional(),
  /** Priority level for this alternative */
  priority: scratchpadPrioritySchema.optional(),
  /** Tags for filtering and organization */
  tags: z.array(z.string()).default([]),
  /** Related segment ID that this could replace (optional) */
  relatedSegmentId: segmentIdSchema.optional(),
});

/**
 * Scratchpad items organized by type schema
 */
export const scratchpadByTypeSchema = z.object({
  FLIGHT: z.array(scratchpadItemSchema).default([]),
  HOTEL: z.array(scratchpadItemSchema).default([]),
  ACTIVITY: z.array(scratchpadItemSchema).default([]),
  TRANSFER: z.array(scratchpadItemSchema).default([]),
  MEETING: z.array(scratchpadItemSchema).default([]),
  CUSTOM: z.array(scratchpadItemSchema).default([]),
});

/**
 * Base scratchpad object schema
 * Type annotation provided to avoid excessive type inference length
 */
const baseScratchpadSchema: z.ZodObject<any> = z.object({
  /** Parent itinerary ID */
  itineraryId: itineraryIdSchema,
  /** All scratchpad items */
  items: z.array(scratchpadItemSchema).default([]),
  /** Geography recommendations */
  geography: z.array(geographyRecommendationSchema).default([]),
  /** Items organized by segment type */
  byType: scratchpadByTypeSchema,
});

/**
 * Scratchpad schema
 * Type annotation provided to avoid excessive type inference length
 */
export const scratchpadSchema: any = baseScratchpadSchema;

/**
 * Swap result schema
 */
export const swapResultSchema = z.object({
  /** The segment that was removed from the itinerary */
  removedSegment: segmentSchema,
  /** The segment that was added to the itinerary */
  addedSegment: segmentSchema,
  /** The scratchpad item that was used */
  scratchpadItem: scratchpadItemSchema,
});

/**
 * Schema for adding an item to the scratchpad
 */
export const addToScratchpadSchema = z.object({
  /** The segment to add */
  segment: segmentSchema,
  /** Source of the recommendation */
  source: scratchpadSourceSchema,
  /** Optional notes */
  notes: z.string().optional(),
  /** Priority level */
  priority: scratchpadPrioritySchema.optional(),
  /** Tags */
  tags: z.array(z.string()).default([]),
  /** Related segment ID this could replace */
  relatedSegmentId: segmentIdSchema.optional(),
});

/**
 * Type exports from schemas
 */
export type ScratchpadItemInput = z.input<typeof scratchpadItemSchema>;
export type ScratchpadItemOutput = z.output<typeof scratchpadItemSchema>;
export type ScratchpadInput = z.input<typeof scratchpadSchema>;
export type ScratchpadOutput = z.output<typeof scratchpadSchema>;
export type AddToScratchpadInput = z.input<typeof addToScratchpadSchema>;
export type SwapResultOutput = z.output<typeof swapResultSchema>;
