/**
 * Itinerary Zod schemas
 * @module domain/schemas/itinerary
 */

import { z } from 'zod';
import {
  dateSchema,
  itineraryIdSchema,
  itineraryStatusSchema,
  travelerIdSchema,
  tripTypeSchema,
} from './common.schema.js';
import { locationSchema } from './location.schema.js';
import { currencyCodeSchema, moneySchema } from './money.schema.js';
import { segmentSchema } from './segment.schema.js';
import { travelPreferencesSchema, travelerSchema } from './traveler.schema.js';

/**
 * Full itinerary schema - validates complete itinerary
 */
export const itinerarySchema = z
  .object({
    /** Unique itinerary identifier */
    id: itineraryIdSchema,
    /** Version number for optimistic locking */
    version: z.number().int().positive('Version must be positive').default(1),
    /** Creation timestamp */
    createdAt: dateSchema,
    /** Last update timestamp */
    updatedAt: dateSchema,
    /** Itinerary title */
    title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
    /** Trip description */
    description: z.string().optional(),
    /** Itinerary status */
    status: itineraryStatusSchema.default('DRAFT'),
    /** Trip start date - optional, collected by trip designer */
    startDate: dateSchema.nullable().optional(),
    /** Trip end date - optional, collected by trip designer */
    endDate: dateSchema.nullable().optional(),
    /** Origin location */
    origin: locationSchema.optional(),
    /** Destination locations */
    destinations: z.array(locationSchema).default([]),
    /** Travelers on this itinerary */
    travelers: z.array(travelerSchema).default([]),
    /** Primary traveler ID */
    primaryTravelerId: travelerIdSchema.optional(),
    /** User who created the itinerary */
    createdBy: z.string().optional(),
    /** All segments in the itinerary */
    segments: z.array(segmentSchema).default([]),
    /** Total price for the entire trip */
    totalPrice: moneySchema.optional(),
    /** Default currency (ISO 4217) */
    currency: currencyCodeSchema.optional(),
    /** Type of trip */
    tripType: tripTypeSchema.optional(),
    /** Cost center for business trips */
    costCenter: z.string().optional(),
    /** Project code for business trips */
    projectCode: z.string().optional(),
    /** Travel preferences */
    preferences: travelPreferencesSchema.optional(),
    /** Tags for organization */
    tags: z.array(z.string()).default([]),
    /** Additional metadata */
    metadata: z.record(z.unknown()).default({}),
  })
  .refine((data) => {
    // Only validate date order if both dates are provided
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  }, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  })
  .refine(
    (data) =>
      !data.primaryTravelerId || data.travelers.some((t) => t.id === data.primaryTravelerId),
    {
      message: 'Primary traveler must be in travelers list',
      path: ['primaryTravelerId'],
    }
  );

/**
 * Itinerary creation schema - for creating new itineraries
 * Fewer required fields than full schema
 * Note: Dates are optional - trip designer will collect them during discovery
 */
export const itineraryCreateSchema = z
  .object({
    /** Itinerary title */
    title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
    /** Trip description */
    description: z.string().optional(),
    /** Trip start date - optional, collected by trip designer */
    startDate: dateSchema.nullable().optional(),
    /** Trip end date - optional, collected by trip designer */
    endDate: dateSchema.nullable().optional(),
    /** Type of trip */
    tripType: tripTypeSchema.optional(),
    /** Origin location */
    origin: locationSchema.optional(),
    /** Destination locations */
    destinations: z.array(locationSchema).default([]),
    /** Tags for organization */
    tags: z.array(z.string()).default([]),
  })
  .refine((data) => {
    // Only validate date order if both dates are provided
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  }, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

/**
 * Itinerary update schema - for partial updates
 * All fields optional except those that shouldn't change
 */
export const itineraryUpdateSchema = z.object({
  /** Itinerary title */
  title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
  /** Trip description */
  description: z.string().optional(),
  /** Itinerary status */
  status: itineraryStatusSchema.optional(),
  /** Trip start date */
  startDate: dateSchema.nullable().optional(),
  /** Trip end date */
  endDate: dateSchema.nullable().optional(),
  /** Origin location */
  origin: locationSchema.optional(),
  /** Destination locations */
  destinations: z.array(locationSchema).optional(),
  /** Primary traveler ID */
  primaryTravelerId: travelerIdSchema.optional(),
  /** Total price for the entire trip */
  totalPrice: moneySchema.optional(),
  /** Default currency (ISO 4217) */
  currency: currencyCodeSchema.optional(),
  /** Type of trip */
  tripType: tripTypeSchema.optional(),
  /** Cost center for business trips */
  costCenter: z.string().optional(),
  /** Project code for business trips */
  projectCode: z.string().optional(),
  /** Travel preferences */
  preferences: travelPreferencesSchema.optional(),
  /** Tags for organization */
  tags: z.array(z.string()).optional(),
  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Type exports from schemas
 */
export type ItineraryInput = z.input<typeof itinerarySchema>;
export type ItineraryOutput = z.output<typeof itinerarySchema>;
export type ItineraryCreateInput = z.input<typeof itineraryCreateSchema>;
export type ItineraryUpdateInput = z.input<typeof itineraryUpdateSchema>;
