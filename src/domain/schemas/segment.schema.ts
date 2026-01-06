/**
 * Segment Zod schemas with discriminated union
 * @module domain/schemas/segment
 */

import { z } from 'zod';
import {
  boardBasisSchema,
  cabinClassSchema,
  dateSchema,
  segmentIdSchema,
  segmentStatusSchema,
  transferTypeSchema,
  travelerIdSchema,
} from './common.schema.js';
import { companySchema, locationSchema } from './location.schema.js';
import { moneySchema } from './money.schema.js';

// ===========================
// Source tracking schemas
// ===========================

/**
 * Segment source schema
 */
const segmentSourceSchema = z.enum(['import', 'user', 'agent']);

/**
 * Agent mode schema
 * - dream: High-level planning without specific bookings
 * - plan: Detailed planning with specific dates/times
 * - book: Ready for booking with confirmed details
 * - chat: Interactive trip designer chat mode
 */
const agentModeSchema = z.enum(['dream', 'plan', 'book', 'chat']);

/**
 * Segment source details schema
 */
const segmentSourceDetailsSchema = z.object({
  /** LLM model used if agent-generated */
  model: z.string().optional(),
  /** SerpAPI search query if used for plausibility check */
  searchQuery: z.string().optional(),
  /** Confidence score (0-1) for agent-generated segments */
  confidence: z.number().min(0).max(1).optional(),
  /** Agent mode used when generating segment */
  mode: agentModeSchema.optional(),
  /** Timestamp when segment was generated/imported */
  timestamp: dateSchema.optional(),
}).optional();

// ===========================
// Base segment schema
// ===========================

/**
 * Base segment fields - shared by all segment types
 * Note: This is an object, not refined, so it can be extended
 */
const baseSegmentFields = {
  /** Unique segment identifier */
  id: segmentIdSchema,
  /** Segment status */
  status: segmentStatusSchema.default('TENTATIVE'),
  /** Start date and time */
  startDatetime: dateSchema,
  /** End date and time */
  endDatetime: dateSchema,
  /** IDs of travelers for this segment (empty = all travelers on itinerary) */
  travelerIds: z.array(travelerIdSchema).default([]),
  /** Source of segment - where it came from (defaults to 'import') */
  source: segmentSourceSchema.optional().default('import'),
  /** Additional details about the source (optional) */
  sourceDetails: segmentSourceDetailsSchema,
  /** Confirmation or reference number */
  confirmationNumber: z.string().optional(),
  /** Booking reference */
  bookingReference: z.string().optional(),
  /** Service provider */
  provider: companySchema.optional(),
  /** Base price */
  price: moneySchema.optional(),
  /** Taxes */
  taxes: moneySchema.optional(),
  /** Fees */
  fees: moneySchema.optional(),
  /** Total price (price + taxes + fees) */
  totalPrice: moneySchema.optional(),
  /** Notes or special instructions */
  notes: z.string().optional(),
  /** Additional metadata */
  metadata: z.record(z.unknown()).default({}),
  /** Segment IDs this segment depends on */
  dependsOn: z.array(segmentIdSchema).optional(),
  /** True if segment was auto-generated to fill geographic gap, not from source document */
  inferred: z.boolean().optional(),
  /** Explanation of why segment was inferred (e.g., "Geographic gap between JFK and Manhattan Grand") */
  inferredReason: z.string().optional(),
  /** Primary review/booking link URL */
  sourceUrl: z.string().url().optional(),
  /** Provider name for primary link (e.g., 'tripadvisor', 'yelp', 'google') */
  sourceProvider: z.string().optional(),
  /** Alternate review/booking links */
  alternateUrls: z.array(z.object({
    url: z.string().url(),
    provider: z.string()
  })).optional(),
} as const;

// ===========================
// Flight segment
// ===========================

/**
 * Flight segment schema (without refinements for discriminated union)
 */
const flightSegmentBaseSchema = z.object({
  ...baseSegmentFields,
  /** Segment type discriminator */
  type: z.literal('FLIGHT'),
  /** Operating airline (optional - may not be known when creating flight placeholder) */
  airline: companySchema.optional(),
  /** Flight number (e.g., AA123, BA4567, or combined B6887/B6788) - optional until confirmed */
  flightNumber: z.string().regex(/^[A-Z0-9]{2,3}\d{1,4}([\/\-][A-Z0-9]{2,3}\d{1,4})?$/, 'Invalid flight number format').optional(),
  /** Origin airport (optional - may not be known when creating flight placeholder) */
  origin: locationSchema.optional(),
  /** Destination airport (optional - may not be known when creating flight placeholder) */
  destination: locationSchema.optional(),
  /** Departure terminal */
  departureTerminal: z.string().optional(),
  /** Arrival terminal */
  arrivalTerminal: z.string().optional(),
  /** Aircraft type */
  aircraft: z.string().optional(),
  /** Cabin class */
  cabinClass: cabinClassSchema.optional(),
  /** Booking class (fare class) */
  bookingClass: z.string().optional(),
  /** Seat assignments by traveler ID */
  seatAssignments: z.record(z.string()).optional(),
  /** Flight duration in minutes */
  durationMinutes: z.number().int().positive('Duration must be positive').optional(),
  /** Baggage allowance */
  baggageAllowance: z.string().optional(),
});

/**
 * Flight segment schema with validations
 */
export const flightSegmentSchema = flightSegmentBaseSchema.refine(
  (data) => data.endDatetime > data.startDatetime,
  {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  }
);

// ===========================
// Hotel segment
// ===========================

/**
 * Hotel segment schema (without refinements for discriminated union)
 */
const hotelSegmentBaseSchema = z.object({
  ...baseSegmentFields,
  /** Segment type discriminator */
  type: z.literal('HOTEL'),
  /** Hotel property */
  property: companySchema,
  /** Hotel location */
  location: locationSchema,
  /** Check-in date */
  checkInDate: dateSchema,
  /** Check-out date */
  checkOutDate: dateSchema,
  /** Check-in time (HH:mm format) */
  checkInTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format')
    .default('15:00'),
  /** Check-out time (HH:mm format) */
  checkOutTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format')
    .default('11:00'),
  /** Room type */
  roomType: z.string().optional(),
  /** Number of rooms */
  roomCount: z.number().int().positive('Room count must be positive').default(1),
  /** Board basis (meal plan) */
  boardBasis: boardBasisSchema.optional(),
  /** Cancellation policy */
  cancellationPolicy: z.string().optional(),
  /** Hotel amenities */
  amenities: z.array(z.string()).default([]),
});

/**
 * Hotel segment schema with validations
 */
export const hotelSegmentSchema = hotelSegmentBaseSchema
  .refine((data) => data.endDatetime > data.startDatetime, {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  })
  .refine((data) => data.checkOutDate > data.checkInDate, {
    message: 'Check-out date must be after check-in date',
    path: ['checkOutDate'],
  });

// ===========================
// Meeting segment
// ===========================

/**
 * Meeting segment schema (without refinements for discriminated union)
 */
const meetingSegmentBaseSchema = z.object({
  ...baseSegmentFields,
  /** Segment type discriminator */
  type: z.literal('MEETING'),
  /** Meeting title */
  title: z.string().min(1, 'Title is required'),
  /** Meeting location */
  location: locationSchema,
  /** Meeting organizer */
  organizer: z.string().optional(),
  /** Meeting attendees */
  attendees: z.array(z.string()).default([]),
  /** Meeting agenda */
  agenda: z.string().optional(),
  /** Virtual meeting URL */
  meetingUrl: z.string().url('Must be a valid URL').optional(),
  /** Dial-in information */
  dialIn: z.string().optional(),
});

/**
 * Meeting segment schema with validations
 */
export const meetingSegmentSchema = meetingSegmentBaseSchema.refine(
  (data) => data.endDatetime > data.startDatetime,
  {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  }
);

// ===========================
// Activity segment
// ===========================

/**
 * Activity segment schema (without refinements for discriminated union)
 */
const activitySegmentBaseSchema = z.object({
  ...baseSegmentFields,
  /** Segment type discriminator */
  type: z.literal('ACTIVITY'),
  /** Activity name */
  name: z.string().min(1, 'Name is required'),
  /** Activity description */
  description: z.string().optional(),
  /** Activity location */
  location: locationSchema,
  /** Activity category */
  category: z.string().optional(),
  /** Voucher or ticket number */
  voucherNumber: z.string().optional(),
  /** Booking URL (link to GetYourGuide, Viator, etc.) */
  bookingUrl: z.string().url().optional(),
  /** Booking provider name (e.g., 'getyourguide', 'viator', 'klook') */
  bookingProvider: z.string().optional(),
});

/**
 * Activity segment schema with validations
 */
export const activitySegmentSchema = activitySegmentBaseSchema.refine(
  (data) => data.endDatetime > data.startDatetime,
  {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  }
);

// ===========================
// Transfer segment
// ===========================

/**
 * Transfer segment schema (without refinements for discriminated union)
 */
const transferSegmentBaseSchema = z.object({
  ...baseSegmentFields,
  /** Segment type discriminator */
  type: z.literal('TRANSFER'),
  /** Type of transfer */
  transferType: transferTypeSchema,
  /** Pickup location */
  pickupLocation: locationSchema,
  /** Drop-off location */
  dropoffLocation: locationSchema,
  /** Vehicle details */
  vehicleDetails: z.string().optional(),
  /** Driver name */
  driverName: z.string().optional(),
  /** Driver phone number */
  driverPhone: z.string().optional(),
});

/**
 * Transfer segment schema with validations
 */
export const transferSegmentSchema = transferSegmentBaseSchema.refine(
  (data) => data.endDatetime > data.startDatetime,
  {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  }
);

// ===========================
// Custom segment
// ===========================

/**
 * Custom segment schema (without refinements for discriminated union)
 */
const customSegmentBaseSchema = z.object({
  ...baseSegmentFields,
  /** Segment type discriminator */
  type: z.literal('CUSTOM'),
  /** Custom segment title */
  title: z.string().min(1, 'Title is required'),
  /** Description */
  description: z.string().optional(),
  /** Location (optional) */
  location: locationSchema.optional(),
  /** Custom data */
  customData: z.record(z.unknown()).default({}),
});

/**
 * Custom segment schema with validations
 */
export const customSegmentSchema = customSegmentBaseSchema.refine(
  (data) => data.endDatetime > data.startDatetime,
  {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  }
);

// ===========================
// Discriminated union
// ===========================

/**
 * Segment discriminated union schema (base, without refinements)
 * This is used for parsing and type discrimination
 */
const segmentBaseSchema = z.discriminatedUnion('type', [
  flightSegmentBaseSchema,
  hotelSegmentBaseSchema,
  meetingSegmentBaseSchema,
  activitySegmentBaseSchema,
  transferSegmentBaseSchema,
  customSegmentBaseSchema,
]);

/**
 * Segment schema with validations
 * This is the main segment schema that validates all segment types
 */
export const segmentSchema = segmentBaseSchema.refine(
  (data) => data.endDatetime > data.startDatetime,
  {
    message: 'End datetime must be after start datetime',
    path: ['endDatetime'],
  }
);

/**
 * Type exports from schemas
 */
export type SegmentInput = z.input<typeof segmentSchema>;
export type SegmentOutput = z.output<typeof segmentSchema>;
export type FlightSegmentInput = z.input<typeof flightSegmentSchema>;
export type HotelSegmentInput = z.input<typeof hotelSegmentSchema>;
export type MeetingSegmentInput = z.input<typeof meetingSegmentSchema>;
export type ActivitySegmentInput = z.input<typeof activitySegmentSchema>;
export type TransferSegmentInput = z.input<typeof transferSegmentSchema>;
export type CustomSegmentInput = z.input<typeof customSegmentSchema>;
