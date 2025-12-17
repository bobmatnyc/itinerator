/**
 * Traveler and travel preferences types
 * @module domain/types/traveler
 */

import type { TravelerId } from './branded.js';
import type { TravelerType } from './common.js';

/**
 * Loyalty program membership
 */
export interface LoyaltyProgram {
  /** Airline or company code */
  carrier: string;
  /** Membership number */
  number: string;
  /** Membership tier or level */
  tier?: string;
}

/**
 * Travel preferences
 */
export interface TravelPreferences {
  /** Preferred seat position on flights */
  seatPreference?: 'AISLE' | 'WINDOW' | 'MIDDLE';
  /** Meal preference or dietary restrictions */
  mealPreference?: string;
  /** Preferred hotel chains */
  hotelChainPreference?: string[];
  /** Accessibility requirements */
  accessibility?: string[];
}

/**
 * Traveler information
 */
export interface Traveler {
  /** Unique traveler identifier */
  id: TravelerId;
  /** Traveler type (adult, child, etc.) */
  type: TravelerType;
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** Middle name */
  middleName?: string;
  /** Email address */
  email?: string;
  /** Phone number */
  phone?: string;
  /** Date of birth */
  dateOfBirth?: Date;
  /** Passport number */
  passportNumber?: string;
  /** Passport expiration date */
  passportExpiry?: Date;
  /** Passport issuing country (ISO 3166-1 alpha-2) */
  passportCountry?: string;
  /** Loyalty program memberships */
  loyaltyPrograms: LoyaltyProgram[];
  /** Special requests or requirements */
  specialRequests: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
}
