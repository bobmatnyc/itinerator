/**
 * Core validation rules implementation
 * @module domain/rules/core-rules
 */

import type { SegmentRule, RuleContext, RuleResult } from './itinerary-rules.js';
import {
  RuleId,
  datesOverlap,
  datetimesOverlap,
  isSameLocation,
  getDurationMinutes,
  hasOvernightGap,
} from './itinerary-rules.js';
import { SegmentType } from '../types/common.js';
import { isFlightSegment, isHotelSegment, isActivitySegment } from '../types/segment.js';

/**
 * RULE: NO_FLIGHT_OVERLAP
 * Flights cannot overlap with each other or with hotels
 */
export const noFlightOverlapRule: SegmentRule = {
  id: RuleId.NO_FLIGHT_OVERLAP,
  name: 'No Flight Overlap',
  description: 'Flights cannot overlap with each other or with hotel stays',
  severity: 'error',
  segmentTypes: [SegmentType.FLIGHT],
  enabled: true,
  validate: (context: RuleContext): RuleResult => {
    if (!isFlightSegment(context.segment)) {
      return { passed: true };
    }

    const flight = context.segment;
    const overlapping = context.allSegments.filter((seg) => {
      // Skip self
      if (seg.id === flight.id) return false;

      // Check flights and hotels
      if (seg.type !== SegmentType.FLIGHT && seg.type !== SegmentType.HOTEL) {
        return false;
      }

      return datetimesOverlap(
        flight.startDatetime,
        flight.endDatetime,
        seg.startDatetime,
        seg.endDatetime
      );
    });

    if (overlapping.length > 0) {
      return {
        passed: false,
        message: `Flight ${flight.flightNumber} overlaps with existing ${overlapping[0].type.toLowerCase()}`,
        suggestion: 'Adjust flight times or remove conflicting segments',
        relatedSegmentIds: overlapping.map((s) => s.id),
      };
    }

    return { passed: true };
  },
};

/**
 * RULE: NO_HOTEL_OVERLAP
 * Hotels cannot overlap with other hotels (but can overlap with activities)
 */
export const noHotelOverlapRule: SegmentRule = {
  id: RuleId.NO_HOTEL_OVERLAP,
  name: 'No Hotel Overlap',
  description: 'Cannot stay at multiple hotels simultaneously',
  severity: 'error',
  segmentTypes: [SegmentType.HOTEL],
  enabled: true,
  validate: (context: RuleContext): RuleResult => {
    if (!isHotelSegment(context.segment)) {
      return { passed: true };
    }

    const hotel = context.segment;
    const overlapping = context.allSegments.filter((seg) => {
      // Skip self
      if (seg.id === hotel.id) return false;

      // Only check other hotels
      if (seg.type !== SegmentType.HOTEL) return false;

      return datesOverlap(hotel.checkInDate, hotel.checkOutDate, seg.checkInDate, seg.checkOutDate);
    });

    if (overlapping.length > 0 && isHotelSegment(overlapping[0])) {
      return {
        passed: false,
        message: `Hotel ${hotel.property.name} overlaps with ${overlapping[0].property.name}`,
        suggestion: 'Adjust check-in/check-out dates or remove one hotel',
        relatedSegmentIds: overlapping.map((s) => s.id),
      };
    }

    return { passed: true };
  },
};

/**
 * RULE: HOTEL_ACTIVITY_OVERLAP_ALLOWED
 * Hotels CAN overlap with activities (informational rule)
 * This is expected behavior - you stay at a hotel while doing activities
 */
export const hotelActivityOverlapAllowedRule: SegmentRule = {
  id: RuleId.HOTEL_ACTIVITY_OVERLAP_ALLOWED,
  name: 'Hotel-Activity Overlap Allowed',
  description: 'Hotels can overlap with activities - this is expected',
  severity: 'info',
  segmentTypes: [SegmentType.HOTEL, SegmentType.ACTIVITY],
  enabled: false, // Disabled by default (informational only)
  validate: (context: RuleContext): RuleResult => {
    // This rule is informational - always passes
    return { passed: true };
  },
};

/**
 * RULE: ACTIVITY_REQUIRES_TRANSFER
 * Activities at different locations require a transfer segment between them
 * Exception: Back-to-back at same location OR overnight gap
 */
export const activityRequiresTransferRule: SegmentRule = {
  id: RuleId.ACTIVITY_REQUIRES_TRANSFER,
  name: 'Activity Requires Transfer',
  description: 'Activities at different locations should have transfer segments',
  severity: 'warning',
  segmentTypes: [SegmentType.ACTIVITY],
  enabled: true,
  validate: (context: RuleContext): RuleResult => {
    if (!isActivitySegment(context.segment)) {
      return { passed: true };
    }

    const activity = context.segment;
    const sortedSegments = [...context.allSegments].sort(
      (a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime()
    );

    const currentIndex = sortedSegments.findIndex((s) => s.id === activity.id);
    if (currentIndex === -1 || currentIndex === 0) {
      return { passed: true };
    }

    const previousSegment = sortedSegments[currentIndex - 1];

    // Check if different location
    if (isSameLocation(previousSegment, activity)) {
      return { passed: true }; // Same location, no transfer needed
    }

    // Check if overnight gap
    if (hasOvernightGap(previousSegment.endDatetime, activity.startDatetime)) {
      return { passed: true }; // Overnight gap, transfer not required
    }

    // Check if transfer exists between segments
    const hasTransfer = sortedSegments.some(
      (s) =>
        s.type === SegmentType.TRANSFER &&
        new Date(s.startDatetime).getTime() >= new Date(previousSegment.endDatetime).getTime() &&
        new Date(s.endDatetime).getTime() <= new Date(activity.startDatetime).getTime()
    );

    if (!hasTransfer) {
      return {
        passed: false,
        message: `Activity "${activity.name}" is at a different location from previous segment`,
        suggestion: 'Add a transfer segment between the two locations',
        relatedSegmentIds: [previousSegment.id],
        confidence: 0.8,
      };
    }

    return { passed: true };
  },
};

/**
 * RULE: SEGMENT_WITHIN_TRIP_DATES
 * All segments must fall within itinerary start/end dates
 */
export const segmentWithinTripDatesRule: SegmentRule = {
  id: RuleId.SEGMENT_WITHIN_TRIP_DATES,
  name: 'Segment Within Trip Dates',
  description: 'Segment must fall within itinerary start and end dates',
  severity: 'error',
  enabled: true,
  validate: (context: RuleContext): RuleResult => {
    const { segment, itinerary } = context;

    // Only validate if itinerary has dates set
    if (!itinerary.startDate || !itinerary.endDate) {
      return { passed: true };
    }

    const segmentStart = new Date(segment.startDatetime).getTime();
    const segmentEnd = new Date(segment.endDatetime).getTime();
    const tripStart = new Date(itinerary.startDate).getTime();
    const tripEnd = new Date(itinerary.endDate).getTime();

    if (segmentStart < tripStart || segmentEnd > tripEnd) {
      return {
        passed: false,
        message: 'Segment dates are outside the trip date range',
        suggestion: `Adjust segment dates to fall between ${itinerary.startDate.toLocaleDateString()} and ${itinerary.endDate.toLocaleDateString()}`,
      };
    }

    return { passed: true };
  },
};

/**
 * RULE: CHRONOLOGICAL_ORDER
 * Segment end time must be after start time
 */
export const chronologicalOrderRule: SegmentRule = {
  id: RuleId.CHRONOLOGICAL_ORDER,
  name: 'Chronological Order',
  description: 'Segment end time must be after start time',
  severity: 'error',
  enabled: true,
  validate: (context: RuleContext): RuleResult => {
    const { segment } = context;

    if (new Date(segment.startDatetime).getTime() >= new Date(segment.endDatetime).getTime()) {
      return {
        passed: false,
        message: 'Segment start datetime must be before end datetime',
        suggestion: 'Adjust start or end datetime',
      };
    }

    return { passed: true };
  },
};

/**
 * RULE: REASONABLE_DURATION
 * Warn if segments have unrealistic durations
 */
export const reasonableDurationRule: SegmentRule = {
  id: RuleId.REASONABLE_DURATION,
  name: 'Reasonable Duration',
  description: 'Segments should have realistic durations for their type',
  severity: 'warning',
  enabled: true,
  validate: (context: RuleContext): RuleResult => {
    const { segment } = context;
    const durationMinutes = getDurationMinutes(segment.startDatetime, segment.endDatetime);

    // Define reasonable duration ranges by segment type
    const limits = {
      [SegmentType.FLIGHT]: { min: 30, max: 20 * 60 }, // 30min - 20hrs
      [SegmentType.ACTIVITY]: { min: 30, max: 12 * 60 }, // 30min - 12hrs
      [SegmentType.MEETING]: { min: 15, max: 8 * 60 }, // 15min - 8hrs
      [SegmentType.TRANSFER]: { min: 5, max: 6 * 60 }, // 5min - 6hrs
      [SegmentType.HOTEL]: { min: 12 * 60, max: 30 * 24 * 60 }, // 12hrs - 30 days
      [SegmentType.CUSTOM]: { min: 1, max: 365 * 24 * 60 }, // No real limits
    };

    const limit = limits[segment.type];
    if (!limit) {
      return { passed: true };
    }

    if (durationMinutes < limit.min) {
      return {
        passed: false,
        message: `${segment.type} duration (${Math.round(durationMinutes)}min) is unusually short`,
        suggestion: `Expected at least ${limit.min} minutes for this segment type`,
        confidence: 0.7,
      };
    }

    if (durationMinutes > limit.max) {
      return {
        passed: false,
        message: `${segment.type} duration (${Math.round(durationMinutes / 60)}hrs) is unusually long`,
        suggestion: `Expected at most ${Math.round(limit.max / 60)} hours for this segment type`,
        confidence: 0.7,
      };
    }

    return { passed: true };
  },
};

/**
 * RULE: GEOGRAPHIC_CONTINUITY
 * Segments should flow geographically - gaps should trigger transfer suggestions
 */
export const geographicContinuityRule: SegmentRule = {
  id: RuleId.GEOGRAPHIC_CONTINUITY,
  name: 'Geographic Continuity',
  description: 'Segments should flow geographically with appropriate transfers',
  severity: 'info',
  enabled: true,
  validate: (context: RuleContext): RuleResult => {
    const { segment, allSegments } = context;

    const sortedSegments = [...allSegments].sort(
      (a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime()
    );

    const currentIndex = sortedSegments.findIndex((s) => s.id === segment.id);
    if (currentIndex === -1 || currentIndex === sortedSegments.length - 1) {
      return { passed: true };
    }

    const nextSegment = sortedSegments[currentIndex + 1];

    // Check if location changes
    if (isSameLocation(segment, nextSegment)) {
      return { passed: true };
    }

    // Check if there's a transfer segment
    const hasTransfer = sortedSegments.some(
      (s) =>
        s.type === SegmentType.TRANSFER &&
        new Date(s.startDatetime).getTime() >= new Date(segment.endDatetime).getTime() &&
        new Date(s.endDatetime).getTime() <= new Date(nextSegment.startDatetime).getTime()
    );

    if (!hasTransfer) {
      return {
        passed: true, // Info only - doesn't fail
        message: 'Location change detected without transfer segment',
        suggestion: 'Consider adding a transfer segment for better tracking',
        relatedSegmentIds: [nextSegment.id],
        confidence: 0.6,
      };
    }

    return { passed: true };
  },
};

/**
 * All core rules exported as an array
 */
export const CORE_RULES: SegmentRule[] = [
  noFlightOverlapRule,
  noHotelOverlapRule,
  hotelActivityOverlapAllowedRule,
  activityRequiresTransferRule,
  segmentWithinTripDatesRule,
  chronologicalOrderRule,
  reasonableDurationRule,
  geographicContinuityRule,
];
