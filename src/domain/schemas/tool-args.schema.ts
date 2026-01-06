/**
 * Tool argument validation schemas for Trip Designer
 * @module domain/schemas/tool-args
 */

import { z } from 'zod';
import { locationSchema, companySchema } from './location.schema.js';
import { moneyInputSchema } from './money.schema.js';
import { cabinClassSchema, boardBasisSchema, transferTypeSchema } from './common.schema.js';

/**
 * Common datetime schema - accepts string or Date, keeps as-is for date parser
 * The date parser functions (parseLocalDate, parseLocalDateTime) handle both types
 */
const toolDatetimeSchema = z.union([z.string(), z.date()]);

/**
 * Common date schema (date-only strings) - keeps as string for date parser
 */
const toolDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format');

// =============================================================================
// Segment Creation Tools
// =============================================================================

/**
 * add_flight arguments schema
 * Only origin, destination, and departureTime are required
 * All other fields are optional to support minimal flight info from search results
 */
export const addFlightArgsSchema = z.object({
  airline: companySchema.optional(),
  flightNumber: z.string().optional(),
  origin: locationSchema,
  destination: locationSchema,
  departureTime: toolDatetimeSchema,
  arrivalTime: toolDatetimeSchema.optional(),
  cabinClass: cabinClassSchema.optional(),
  price: moneyInputSchema.optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * add_hotel arguments schema
 */
export const addHotelArgsSchema = z.object({
  property: companySchema,
  location: locationSchema,
  checkInDate: toolDateSchema,
  checkOutDate: toolDateSchema,
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
  roomType: z.string().optional(),
  roomCount: z.number().int().positive().optional(),
  boardBasis: boardBasisSchema.optional(),
  price: moneyInputSchema.optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * add_activity arguments schema
 */
export const addActivityArgsSchema = z.object({
  name: z.string().min(1, 'Activity name is required'),
  description: z.string().optional(),
  location: locationSchema,
  startTime: toolDatetimeSchema,
  endTime: toolDatetimeSchema.optional(),
  durationHours: z.number().positive().optional(),
  category: z.string().optional(),
  price: moneyInputSchema.optional(),
  provider: companySchema.optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
  bookingUrl: z.string().url().optional(),
  bookingProvider: z.string().optional(),
});

/**
 * add_transfer arguments schema
 */
export const addTransferArgsSchema = z.object({
  transferType: transferTypeSchema,
  pickupLocation: locationSchema,
  dropoffLocation: locationSchema,
  pickupTime: toolDatetimeSchema,
  estimatedDurationMinutes: z.number().int().positive().optional(),
  vehicleDetails: z.string().optional(),
  price: moneyInputSchema.optional(),
  provider: companySchema.optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * add_meeting arguments schema
 */
export const addMeetingArgsSchema = z.object({
  title: z.string().min(1, 'Meeting title is required'),
  location: locationSchema,
  startTime: toolDatetimeSchema,
  endTime: toolDatetimeSchema,
  organizer: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  agenda: z.string().optional(),
  meetingUrl: z.string().url('Must be a valid URL').optional(),
  notes: z.string().optional(),
});

// =============================================================================
// Itinerary Management Tools
// =============================================================================

/**
 * update_itinerary arguments schema
 */
export const updateItineraryArgsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  startDate: toolDateSchema.optional(),
  endDate: toolDateSchema.optional(),
  destinations: z.array(z.string()).optional(),
});

/**
 * update_preferences arguments schema
 */
export const updatePreferencesArgsSchema = z.object({
  travelerType: z.enum(['solo', 'couple', 'family', 'friends', 'business', 'group']).optional(),
  tripPurpose: z.string().optional(),
  travelStyle: z.enum(['luxury', 'moderate', 'budget', 'backpacker']).optional(),
  pace: z.enum(['packed', 'balanced', 'leisurely']).optional(),
  interests: z.array(z.string()).optional(),
  budgetFlexibility: z.number().int().min(1).max(5).optional(),
  budget: z
    .object({
      amount: z.number(),
      currency: z.string().length(3),
      period: z.enum(['per_day', 'per_person', 'total']),
    })
    .optional(),
  dietaryRestrictions: z.string().optional(),
  mobilityRestrictions: z.string().optional(),
  origin: z.string().optional(),
  accommodationPreference: z.enum(['hotel', 'resort', 'airbnb', 'hostel', 'boutique']).optional(),
  activityPreferences: z.array(z.string()).optional(),
  avoidances: z.array(z.string()).optional(),
});

// =============================================================================
// Segment Management Tools
// =============================================================================

/**
 * get_segment arguments schema
 */
export const getSegmentArgsSchema = z.object({
  segmentId: z.string().min(1, 'Segment ID is required'),
});

/**
 * update_segment arguments schema
 */
export const updateSegmentArgsSchema = z.object({
  segmentId: z.string().min(1, 'Segment ID is required'),
  updates: z.record(z.unknown()),
});

/**
 * delete_segment arguments schema
 */
export const deleteSegmentArgsSchema = z.object({
  segmentId: z.string().min(1, 'Segment ID is required'),
});

/**
 * move_segment arguments schema
 */
export const moveSegmentArgsSchema = z.object({
  segmentId: z.string().min(1, 'Segment ID is required'),
  newStartTime: toolDatetimeSchema,
});

/**
 * reorder_segments arguments schema
 */
export const reorderSegmentsArgsSchema = z.object({
  segmentIds: z.array(z.string().min(1)),
});

// =============================================================================
// Search and Intelligence Tools
// =============================================================================

/**
 * search_web arguments schema
 */
export const searchWebArgsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
});

/**
 * search_flights arguments schema
 */
export const searchFlightsArgsSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  departureDate: toolDateSchema,
  returnDate: toolDateSchema.optional(),
  adults: z.number().int().positive().optional(),
  cabinClass: z.enum(['economy', 'premium_economy', 'business', 'first']).optional(),
});

/**
 * search_hotels arguments schema
 */
export const searchHotelsArgsSchema = z.object({
  location: z.string().min(1),
  checkInDate: toolDateSchema,
  checkOutDate: toolDateSchema,
  adults: z.number().int().positive().optional(),
  children: z.number().int().nonnegative().optional(),
});

/**
 * search_transfers arguments schema
 */
export const searchTransfersArgsSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
});

/**
 * store_travel_intelligence arguments schema
 */
export const storeTravelIntelligenceArgsSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  dates: z.string().optional(),
  category: z.enum([
    'weather',
    'events',
    'festivals',
    'closures',
    'advisory',
    'crowds',
    'prices',
    'opportunities',
    'warnings',
    'tips',
  ]),
  level: z.enum(['country', 'region', 'city', 'neighborhood', 'attraction']).optional(),
  findings: z.string().min(1, 'Findings are required'),
  impact: z.enum(['positive', 'negative', 'neutral', 'opportunity']).optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * retrieve_travel_intelligence arguments schema
 */
export const retrieveTravelIntelligenceArgsSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  dates: z.string().optional(),
  categories: z
    .array(
      z.enum([
        'weather',
        'events',
        'festivals',
        'closures',
        'advisory',
        'crowds',
        'prices',
        'opportunities',
        'warnings',
        'tips',
      ])
    )
    .optional(),
  query: z.string().optional(),
});

/**
 * switch_to_trip_designer arguments schema
 */
export const switchToTripDesignerArgsSchema = z.object({
  initialContext: z.string().optional(),
});

// =============================================================================
// Geography Tools
// =============================================================================

/**
 * get_distance arguments schema
 */
export const getDistanceArgsSchema = z.object({
  from: z.string().min(1, 'Origin location is required'),
  to: z.string().min(1, 'Destination location is required'),
});

/**
 * show_route arguments schema
 */
export const showRouteArgsSchema = z.object({
  locations: z.array(z.string().min(1)).min(2, 'At least 2 locations are required'),
  travelMode: z.enum(['drive', 'fly', 'mixed']).optional(),
});

/**
 * geocode_location arguments schema
 */
export const geocodeLocationArgsSchema = z.object({
  location: z.string().min(1, 'Location is required'),
});

// =============================================================================
// Traveler Management Tools
// =============================================================================

/**
 * add_traveler arguments schema
 */
export const addTravelerArgsSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  middleName: z.string().optional(),
  email: z.string().email('Must be a valid email').optional(),
  phone: z.string().optional(),
  type: z.enum(['adult', 'child', 'infant', 'senior']).default('adult'),
  age: z.number().int().positive().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  relationship: z.string().optional(), // e.g., "partner", "spouse", "child", "friend", "parent"
  isPrimary: z.boolean().optional(),
});

// =============================================================================
// Scratchpad Tools
// =============================================================================

/**
 * add_to_scratchpad arguments schema
 * Stores alternative recommendations for later consideration
 */
export const addToScratchpadArgsSchema = z.object({
  segment: z.object({
    type: z.enum(['ACTIVITY', 'HOTEL', 'FLIGHT', 'TRANSFER']),
    name: z.string().min(1, 'Segment name is required'),
    description: z.string().optional(),
    location: z.object({
      name: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
    startTime: z.string().optional(),
    price: z.object({
      amount: z.number(),
      currency: z.string(),
    }).optional(),
  }),
  notes: z.string().min(1, 'Notes are required to explain why this is an alternative'),
  priority: z.enum(['high', 'medium', 'low']),
  tags: z.array(z.string()).optional(),
});
