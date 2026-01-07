/**
 * Main Itinerary interface
 * @module domain/types/itinerary
 */

import type { ItineraryId, TravelerId } from './branded.js';
import type { ItineraryStatus, TripType } from './common.js';
import type { Location } from './location.js';
import type { Money } from './money.js';
import type { Segment } from './segment.js';
import type { TravelPreferences, Traveler, TripTravelerPreferences } from './traveler.js';
import type { Scratchpad } from './scratchpad.js';

/**
 * Itinerary permissions for collaborative trip planning
 */
export interface ItineraryPermissions {
  /** Users with full control (can delete, manage permissions) */
  owners: string[];
  /** Users who can modify itinerary content */
  editors: string[];
  /** Users with read-only access */
  viewers: string[];
}

/**
 * Complete itinerary representing a trip
 */
export interface Itinerary {
  /** Unique itinerary identifier */
  id: ItineraryId;
  /** Version number for optimistic locking */
  version: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Itinerary title */
  title: string;
  /** Trip description */
  description?: string;
  /** Itinerary status */
  status: ItineraryStatus;
  /** Trip start date - optional, collected by trip designer */
  startDate?: Date;
  /** Trip end date - optional, collected by trip designer */
  endDate?: Date;
  /** Origin location */
  origin?: Location;
  /** Destination locations */
  destinations: Location[];
  /** Travelers on this itinerary */
  travelers: Traveler[];
  /** Primary traveler ID */
  primaryTravelerId?: TravelerId;
  /** User who created the itinerary */
  createdBy?: string;
  /** Permissions for collaborative access */
  permissions?: ItineraryPermissions;
  /** All segments in the itinerary */
  segments: Segment[];
  /** Total price for the entire trip */
  totalPrice?: Money;
  /** Default currency (ISO 4217) */
  currency?: string;
  /** Type of trip */
  tripType?: TripType;
  /** Cost center for business trips */
  costCenter?: string;
  /** Project code for business trips */
  projectCode?: string;
  /** Travel preferences (per-traveler preferences - deprecated, kept for backward compatibility) */
  preferences?: TravelPreferences;
  /** Trip-level traveler preferences (for trip planning) */
  tripPreferences?: TripTravelerPreferences;
  /** Scratchpad for alternative segment recommendations */
  scratchpad?: Scratchpad;
  /** Tags for organization */
  tags: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
}
