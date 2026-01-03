/**
 * Location and address Zod schemas
 * @module domain/schemas/location
 */

import { z } from 'zod';

/**
 * Coordinates schema - validates latitude/longitude ranges
 */
export const coordinatesSchema = z.object({
  /** Latitude in decimal degrees (-90 to 90) */
  latitude: z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
  /** Longitude in decimal degrees (-180 to 180) */
  longitude: z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
});

/**
 * Address schema - validates physical address
 */
export const addressSchema = z.object({
  /** Street address */
  street: z.string().optional(),
  /** City name */
  city: z.string().optional(),
  /** State or province */
  state: z.string().optional(),
  /** Postal or ZIP code */
  postalCode: z.string().optional(),
  /** Country (ISO 3166-1 alpha-2 code) */
  country: z
    .string()
    .length(2, 'Country must be 2-letter ISO code')
    .transform((val) => val.toUpperCase()),
});

/**
 * Location schema - validates location with optional address and coordinates
 * At least one of name, code, or city must be provided
 */
export const locationSchema = z.object({
  /** Location name (e.g., airport name) */
  name: z.string().min(1).optional(),
  /** IATA airport or city code (normalized to 3 letters by schema-normalizer) */
  code: z
    .string()
    .min(1, 'Code must not be empty')
    .max(3, 'Code must be 3 letters or less')
    .transform((val) => val.toUpperCase())
    .optional(),
  /** City name */
  city: z.string().min(1).optional(),
  /** Country name */
  country: z.string().optional(),
  /** Physical address */
  address: addressSchema.optional(),
  /** Geographic coordinates */
  coordinates: coordinatesSchema.optional(),
  /** IANA timezone identifier */
  timezone: z.string().optional(),
}).refine(
  (data) => data.name || data.code || data.city,
  { message: 'At least one of name, code, or city must be provided' }
);

/**
 * Company schema - validates company/provider information
 */
export const companySchema = z.object({
  /** Company name */
  name: z.string().min(1, 'Name is required'),
  /** Company code (e.g., airline IATA code) */
  code: z
    .string()
    .transform((val) => val.toUpperCase())
    .optional(),
  /** Company website URL */
  website: z.string().url('Must be a valid URL').optional(),
});
