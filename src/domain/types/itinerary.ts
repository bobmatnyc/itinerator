/**
 * Main Itinerary interface
 * @module domain/types/itinerary
 */

import type { ItineraryId, TravelerId } from './branded.js';
import type { ItineraryStatus, TripType } from './common.js';
import type { Location } from './location.js';
import type { Money } from './money.js';
import type { Segment } from './segment.js';
import type { TravelPreferences, Traveler } from './traveler.js';

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
  /** Trip start date */
  startDate: Date;
  /** Trip end date */
  endDate: Date;
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
  /** Travel preferences */
  preferences?: TravelPreferences;
  /** Tags for organization */
  tags: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
}
