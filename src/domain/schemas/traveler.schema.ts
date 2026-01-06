/**
 * Traveler Zod schemas
 * @module domain/schemas/traveler
 */

import { z } from 'zod';
import {
  dateSchema,
  seatPreferenceSchema,
  travelerIdSchema,
  travelerTypeSchema,
} from './common.schema.js';

/**
 * Loyalty program schema
 */
export const loyaltyProgramSchema = z.object({
  /** Airline or company code */
  carrier: z.string().min(1, 'Carrier is required'),
  /** Membership number */
  number: z.string().min(1, 'Number is required'),
  /** Membership tier or level */
  tier: z.string().optional(),
});

/**
 * Travel style schema
 */
export const travelStyleSchema = z.object({
  /** Budget level */
  budget: z.enum(['budget', 'moderate', 'luxury', 'ultra-luxury']).default('moderate'),
  /** Travel pace */
  pace: z.enum(['relaxed', 'moderate', 'packed']).default('moderate'),
  /** Areas of interest */
  interests: z.array(z.string()).default([]),
  /** Dining preferences */
  diningPreferences: z.array(z.string()).default([]),
  /** Accommodation preferences */
  accommodationPreferences: z.array(z.string()).default([]),
});

/**
 * Travel preferences schema
 */
export const travelPreferencesSchema = z.object({
  /** Preferred seat position on flights */
  seatPreference: seatPreferenceSchema.optional(),
  /** Meal preference or dietary restrictions */
  mealPreference: z.string().optional(),
  /** Preferred hotel chains */
  hotelChainPreference: z.array(z.string()).optional(),
  /** Accessibility requirements */
  accessibility: z.array(z.string()).optional(),
  /** Home country for currency conversion */
  homeCountry: z.string().default('USA'),
  /** Home currency (ISO 4217 code) */
  homeCurrency: z
    .string()
    .length(3, 'Currency must be 3-letter ISO 4217 code')
    .transform((val) => val.toUpperCase())
    .default('USD'),
  /** Travel style preferences */
  travelStyle: travelStyleSchema.optional(),
});

/**
 * Traveler schema - validates traveler information
 */
export const travelerSchema = z.object({
  /** Unique traveler identifier */
  id: travelerIdSchema,
  /** Traveler type (adult, child, etc.) */
  type: travelerTypeSchema,
  /** First name */
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  /** Last name */
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  /** Middle name */
  middleName: z.string().optional(),
  /** Email address */
  email: z.string().email('Invalid email address').optional(),
  /** Phone number */
  phone: z.string().optional(),
  /** Date of birth */
  dateOfBirth: dateSchema.optional(),
  /** Passport number */
  passportNumber: z.string().optional(),
  /** Passport expiration date */
  passportExpiry: dateSchema.optional(),
  /** Passport issuing country (ISO 3166-1 alpha-2) */
  passportCountry: z
    .string()
    .length(2, 'Country must be 2-letter ISO code')
    .transform((val) => val.toUpperCase())
    .optional(),
  /** Loyalty program memberships */
  loyaltyPrograms: z.array(loyaltyProgramSchema).default([]),
  /** Special requests or requirements */
  specialRequests: z.array(z.string()).default([]),
  /** Additional metadata */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Traveler input schema - for creating new travelers
 * ID is optional and will be generated if not provided
 */
export const travelerInputSchema = travelerSchema.omit({ id: true }).extend({
  /** Optional ID (will be generated if not provided) */
  id: travelerIdSchema.optional(),
});

/**
 * Type exports from schemas
 */
export type TravelerInput = z.input<typeof travelerSchema>;
export type TravelerOutput = z.output<typeof travelerSchema>;
export type TravelerCreateInput = z.input<typeof travelerInputSchema>;
