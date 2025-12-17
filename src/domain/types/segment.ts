/**
 * Segment discriminated union types
 * @module domain/types/segment
 */

import type { SegmentId, TravelerId } from './branded.js';
import type { BoardBasis, CabinClass, SegmentStatus, TransferType } from './common.js';
import { SegmentType } from './common.js';
import type { Company, Location } from './location.js';
import type { Money } from './money.js';

/**
 * Base segment fields shared by all segment types
 */
interface BaseSegment {
  /** Unique segment identifier */
  id: SegmentId;
  /** Segment status */
  status: SegmentStatus;
  /** Start date and time */
  startDatetime: Date;
  /** End date and time */
  endDatetime: Date;
  /** IDs of travelers for this segment */
  travelerIds: TravelerId[];
  /** Confirmation or reference number */
  confirmationNumber?: string;
  /** Booking reference */
  bookingReference?: string;
  /** Service provider */
  provider?: Company;
  /** Base price */
  price?: Money;
  /** Taxes */
  taxes?: Money;
  /** Fees */
  fees?: Money;
  /** Total price (price + taxes + fees) */
  totalPrice?: Money;
  /** Notes or special instructions */
  notes?: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Segment IDs this segment depends on */
  dependsOn?: SegmentId[];
}

/**
 * Flight segment
 */
export interface FlightSegment extends BaseSegment {
  type: typeof SegmentType.FLIGHT;
  /** Operating airline */
  airline: Company;
  /** Flight number */
  flightNumber: string;
  /** Origin airport */
  origin: Location;
  /** Destination airport */
  destination: Location;
  /** Departure terminal */
  departureTerminal?: string;
  /** Arrival terminal */
  arrivalTerminal?: string;
  /** Aircraft type */
  aircraft?: string;
  /** Cabin class */
  cabinClass?: CabinClass;
  /** Booking class (fare class) */
  bookingClass?: string;
  /** Seat assignments by traveler ID */
  seatAssignments?: Record<string, string>;
  /** Flight duration in minutes */
  durationMinutes?: number;
  /** Baggage allowance */
  baggageAllowance?: string;
}

/**
 * Hotel segment
 */
export interface HotelSegment extends BaseSegment {
  type: typeof SegmentType.HOTEL;
  /** Hotel property */
  property: Company;
  /** Hotel location */
  location: Location;
  /** Check-in date */
  checkInDate: Date;
  /** Check-out date */
  checkOutDate: Date;
  /** Check-in time (e.g., "15:00") */
  checkInTime?: string;
  /** Check-out time (e.g., "11:00") */
  checkOutTime?: string;
  /** Room type */
  roomType?: string;
  /** Number of rooms */
  roomCount: number;
  /** Board basis (meal plan) */
  boardBasis?: BoardBasis;
  /** Cancellation policy */
  cancellationPolicy?: string;
  /** Hotel amenities */
  amenities: string[];
}

/**
 * Meeting segment
 */
export interface MeetingSegment extends BaseSegment {
  type: typeof SegmentType.MEETING;
  /** Meeting title */
  title: string;
  /** Meeting location */
  location: Location;
  /** Meeting organizer */
  organizer?: string;
  /** Meeting attendees */
  attendees: string[];
  /** Meeting agenda */
  agenda?: string;
  /** Virtual meeting URL */
  meetingUrl?: string;
  /** Dial-in information */
  dialIn?: string;
}

/**
 * Activity segment
 */
export interface ActivitySegment extends BaseSegment {
  type: typeof SegmentType.ACTIVITY;
  /** Activity name */
  name: string;
  /** Activity description */
  description?: string;
  /** Activity location */
  location: Location;
  /** Activity category */
  category?: string;
  /** Voucher or ticket number */
  voucherNumber?: string;
}

/**
 * Transfer segment
 */
export interface TransferSegment extends BaseSegment {
  type: typeof SegmentType.TRANSFER;
  /** Type of transfer */
  transferType: TransferType;
  /** Pickup location */
  pickupLocation: Location;
  /** Drop-off location */
  dropoffLocation: Location;
  /** Vehicle details */
  vehicleDetails?: string;
  /** Driver name */
  driverName?: string;
  /** Driver phone number */
  driverPhone?: string;
}

/**
 * Custom segment
 */
export interface CustomSegment extends BaseSegment {
  type: typeof SegmentType.CUSTOM;
  /** Custom segment title */
  title: string;
  /** Description */
  description?: string;
  /** Location (optional) */
  location?: Location;
  /** Custom data */
  customData: Record<string, unknown>;
}

/**
 * Discriminated union of all segment types
 */
export type Segment =
  | FlightSegment
  | HotelSegment
  | MeetingSegment
  | ActivitySegment
  | TransferSegment
  | CustomSegment;

/**
 * Type guard for FlightSegment
 * @param segment - The segment to check
 * @returns True if segment is a FlightSegment
 */
export function isFlightSegment(segment: Segment): segment is FlightSegment {
  return segment.type === SegmentType.FLIGHT;
}

/**
 * Type guard for HotelSegment
 * @param segment - The segment to check
 * @returns True if segment is a HotelSegment
 */
export function isHotelSegment(segment: Segment): segment is HotelSegment {
  return segment.type === SegmentType.HOTEL;
}

/**
 * Type guard for MeetingSegment
 * @param segment - The segment to check
 * @returns True if segment is a MeetingSegment
 */
export function isMeetingSegment(segment: Segment): segment is MeetingSegment {
  return segment.type === SegmentType.MEETING;
}

/**
 * Type guard for ActivitySegment
 * @param segment - The segment to check
 * @returns True if segment is an ActivitySegment
 */
export function isActivitySegment(segment: Segment): segment is ActivitySegment {
  return segment.type === SegmentType.ACTIVITY;
}

/**
 * Type guard for TransferSegment
 * @param segment - The segment to check
 * @returns True if segment is a TransferSegment
 */
export function isTransferSegment(segment: Segment): segment is TransferSegment {
  return segment.type === SegmentType.TRANSFER;
}

/**
 * Type guard for CustomSegment
 * @param segment - The segment to check
 * @returns True if segment is a CustomSegment
 */
export function isCustomSegment(segment: Segment): segment is CustomSegment {
  return segment.type === SegmentType.CUSTOM;
}
