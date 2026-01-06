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
 * Travel style preferences
 */
export interface TravelStyle {
  /** Budget level */
  budget: 'budget' | 'moderate' | 'luxury' | 'ultra-luxury';
  /** Travel pace */
  pace: 'relaxed' | 'moderate' | 'packed';
  /** Areas of interest */
  interests: string[];
  /** Dining preferences */
  diningPreferences: string[];
  /** Accommodation preferences */
  accommodationPreferences: string[];
}

/**
 * Travel preferences (per-traveler)
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
  /** Home country for currency conversion */
  homeCountry?: string;
  /** Home currency (ISO 4217 code) */
  homeCurrency?: string;
  /** Travel style preferences */
  travelStyle?: TravelStyle;
}

/**
 * Trip-level traveler preferences (stored on Itinerary)
 * These are preferences that apply to the entire trip planning experience
 */
export interface TripTravelerPreferences {
  /** Traveler type - who is traveling */
  travelerType?: 'solo' | 'couple' | 'family' | 'friends' | 'business' | 'group' | string;
  /** Trip purpose - why they're traveling */
  tripPurpose?: string; // e.g., 'vacation', 'business', 'client_meetings', 'conference', 'wedding'
  /** Travel style */
  travelStyle?: 'luxury' | 'moderate' | 'budget' | 'backpacker';
  /** Trip pacing preference */
  pace?: 'packed' | 'balanced' | 'leisurely';
  /** Areas of interest */
  interests?: string[]; // e.g., ['food', 'history', 'nature', 'nightlife']
  /** Budget flexibility (1-5 scale, 1 = very strict, 5 = very flexible) */
  budgetFlexibility?: number;
  /** Budget details */
  budget?: {
    /** Budget amount */
    amount?: number;
    /** Currency code (ISO 4217) */
    currency?: string;
    /** Budget period (per_day, per_person, total) */
    period?: 'per_day' | 'per_person' | 'total';
  };
  /** Dietary restrictions for all travelers */
  dietaryRestrictions?: string;
  /** Mobility restrictions or accessibility needs */
  mobilityRestrictions?: string;
  /** Origin location - where they're traveling from */
  origin?: string;
  /** Accommodation preferences */
  accommodationPreference?: string; // 'hotel', 'resort', 'airbnb', 'hostel', 'boutique'
  /** Activity preferences */
  activityPreferences?: string[]; // e.g., ['museums', 'hiking', 'beaches']
  /** Things to avoid */
  avoidances?: string[];
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
