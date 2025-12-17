/**
 * Common enums and shared types
 * @module domain/types/common
 */

/**
 * Status of an itinerary
 */
export const ItineraryStatus = {
  DRAFT: 'DRAFT',
  PLANNED: 'PLANNED',
  CONFIRMED: 'CONFIRMED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type ItineraryStatus = (typeof ItineraryStatus)[keyof typeof ItineraryStatus];

/**
 * Type of trip
 */
export const TripType = {
  LEISURE: 'LEISURE',
  BUSINESS: 'BUSINESS',
  MIXED: 'MIXED',
} as const;

export type TripType = (typeof TripType)[keyof typeof TripType];

/**
 * Segment type discriminator
 */
export const SegmentType = {
  FLIGHT: 'FLIGHT',
  HOTEL: 'HOTEL',
  MEETING: 'MEETING',
  ACTIVITY: 'ACTIVITY',
  TRANSFER: 'TRANSFER',
  CUSTOM: 'CUSTOM',
} as const;

export type SegmentType = (typeof SegmentType)[keyof typeof SegmentType];

/**
 * Status of a segment
 */
export const SegmentStatus = {
  TENTATIVE: 'TENTATIVE',
  CONFIRMED: 'CONFIRMED',
  WAITLISTED: 'WAITLISTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;

export type SegmentStatus = (typeof SegmentStatus)[keyof typeof SegmentStatus];

/**
 * Type of traveler
 */
export const TravelerType = {
  ADULT: 'ADULT',
  CHILD: 'CHILD',
  INFANT: 'INFANT',
  SENIOR: 'SENIOR',
} as const;

export type TravelerType = (typeof TravelerType)[keyof typeof TravelerType];

/**
 * Flight cabin class
 */
export const CabinClass = {
  ECONOMY: 'ECONOMY',
  PREMIUM_ECONOMY: 'PREMIUM_ECONOMY',
  BUSINESS: 'BUSINESS',
  FIRST: 'FIRST',
} as const;

export type CabinClass = (typeof CabinClass)[keyof typeof CabinClass];

/**
 * Transfer vehicle type
 */
export const TransferType = {
  TAXI: 'TAXI',
  SHUTTLE: 'SHUTTLE',
  PRIVATE: 'PRIVATE',
  PUBLIC: 'PUBLIC',
  RIDE_SHARE: 'RIDE_SHARE',
} as const;

export type TransferType = (typeof TransferType)[keyof typeof TransferType];

/**
 * Hotel board basis
 */
export const BoardBasis = {
  ROOM_ONLY: 'ROOM_ONLY',
  BED_BREAKFAST: 'BED_BREAKFAST',
  HALF_BOARD: 'HALF_BOARD',
  FULL_BOARD: 'FULL_BOARD',
  ALL_INCLUSIVE: 'ALL_INCLUSIVE',
} as const;

export type BoardBasis = (typeof BoardBasis)[keyof typeof BoardBasis];
