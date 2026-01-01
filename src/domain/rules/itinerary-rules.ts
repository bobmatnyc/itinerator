/**
 * Business Rules for Itinerary Validation
 * @module domain/rules/itinerary-rules
 *
 * This module defines all itinerary business rules in one centralized location.
 * Rules are composable, testable, and can be enabled/disabled per itinerary.
 */

import type { Itinerary } from '../types/itinerary.js';
import type { Segment } from '../types/segment.js';
import { SegmentType } from '../types/common.js';
import type { SegmentId } from '../types/branded.js';

/**
 * Rule severity levels
 * - error: Blocks the operation (hard constraint)
 * - warning: Allows operation but shows warning (soft constraint)
 * - info: Informational only, does not block
 */
export type RuleSeverity = 'error' | 'warning' | 'info';

/**
 * Context provided to rule validators
 */
export interface RuleContext {
  /** The segment being validated */
  segment: Segment;
  /** Full itinerary for context */
  itinerary: Itinerary;
  /** All segments in the itinerary (including the current one if updating) */
  allSegments: Segment[];
  /** Operation being performed */
  operation: 'add' | 'update' | 'delete';
}

/**
 * Result of rule validation
 */
export interface RuleResult {
  /** Whether the rule passed */
  passed: boolean;
  /** Error/warning message if failed */
  message?: string;
  /** Suggestion for how to fix the issue */
  suggestion?: string;
  /** IDs of related segments (for overlap detection, etc.) */
  relatedSegmentIds?: SegmentId[];
  /** Confidence score (0-1) for soft rules */
  confidence?: number;
}

/**
 * Definition of a single validation rule
 */
export interface SegmentRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Detailed description of what the rule checks */
  description: string;
  /** Severity level */
  severity: RuleSeverity;
  /** Which segment types this rule applies to (undefined = all types) */
  segmentTypes?: SegmentType[];
  /** Whether the rule is enabled by default */
  enabled: boolean;
  /** Validation function */
  validate: (context: RuleContext) => RuleResult;
}

/**
 * Rule IDs as constants for testing and configuration
 */
export const RuleId = {
  // Overlap rules
  NO_FLIGHT_OVERLAP: 'no-flight-overlap',
  NO_HOTEL_OVERLAP: 'no-hotel-overlap',
  HOTEL_ACTIVITY_OVERLAP_ALLOWED: 'hotel-activity-overlap-allowed',

  // Transfer rules
  ACTIVITY_REQUIRES_TRANSFER: 'activity-requires-transfer',
  GEOGRAPHIC_CONTINUITY: 'geographic-continuity',

  // Temporal rules
  SEGMENT_WITHIN_TRIP_DATES: 'segment-within-trip-dates',
  CHRONOLOGICAL_ORDER: 'chronological-order',
  REASONABLE_DURATION: 'reasonable-duration',

  // Data integrity rules
  NO_DUPLICATE_SEGMENTS: 'no-duplicate-segments',
  NO_MISSING_DEPENDENCIES: 'no-missing-dependencies',

  // Logical consistency rules
  HOTEL_NIGHTS_MATCH_DATES: 'hotel-nights-match-dates',
  FLIGHT_DURATION_REASONABLE: 'flight-duration-reasonable',
} as const;

export type RuleId = (typeof RuleId)[keyof typeof RuleId];

/**
 * Configuration for the rule engine
 */
export interface RuleEngineConfig {
  /** Rules to disable globally */
  disabledRules?: RuleId[];
  /** Whether to run warning-level rules */
  enableWarnings?: boolean;
  /** Whether to run info-level rules */
  enableInfo?: boolean;
}

/**
 * Complete validation result for a segment
 */
export interface ValidationResult {
  /** Whether all error-level rules passed */
  valid: boolean;
  /** Failed error-level rules */
  errors: Array<RuleResult & { ruleId: RuleId; ruleName: string }>;
  /** Failed warning-level rules */
  warnings: Array<RuleResult & { ruleId: RuleId; ruleName: string }>;
  /** Info-level rule results */
  info: Array<RuleResult & { ruleId: RuleId; ruleName: string }>;
}

/**
 * Helper to check if two date ranges overlap
 * Uses day-based comparison (ignores time component)
 * @param start1 - Start of first range
 * @param end1 - End of first range
 * @param start2 - Start of second range
 * @param end2 - End of second range
 * @returns True if ranges overlap
 */
export function datesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  // Normalize to date-only (no time component)
  const s1 = new Date(start1).setHours(0, 0, 0, 0);
  const e1 = new Date(end1).setHours(0, 0, 0, 0);
  const s2 = new Date(start2).setHours(0, 0, 0, 0);
  const e2 = new Date(end2).setHours(0, 0, 0, 0);

  // Ranges overlap if: start1 < end2 AND start2 < end1
  return s1 < e2 && s2 < e1;
}

/**
 * Helper to check if two datetime ranges overlap
 * Uses full datetime comparison (includes time)
 * @param start1 - Start of first range
 * @param end1 - End of first range
 * @param start2 - Start of second range
 * @param end2 - End of second range
 * @returns True if ranges overlap
 */
export function datetimesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();

  return s1 < e2 && s2 < e1;
}

/**
 * Helper to check if a segment is at the same location as another
 * @param seg1 - First segment
 * @param seg2 - Second segment
 * @returns True if segments are at the same location
 */
export function isSameLocation(seg1: Segment, seg2: Segment): boolean {
  const loc1 = getSegmentLocation(seg1);
  const loc2 = getSegmentLocation(seg2);

  if (!loc1 || !loc2) return false;

  // Compare by coordinates if available
  if (loc1.coordinates && loc2.coordinates) {
    return (
      loc1.coordinates.latitude === loc2.coordinates.latitude &&
      loc1.coordinates.longitude === loc2.coordinates.longitude
    );
  }

  // Fallback to city comparison
  return loc1.city === loc2.city;
}

/**
 * Extract primary location from a segment
 * @param segment - Segment to extract location from
 * @returns Location or undefined
 */
function getSegmentLocation(segment: Segment) {
  switch (segment.type) {
    case SegmentType.FLIGHT:
      return segment.destination; // Use destination for flights
    case SegmentType.HOTEL:
      return segment.location;
    case SegmentType.ACTIVITY:
      return segment.location;
    case SegmentType.MEETING:
      return segment.location;
    case SegmentType.TRANSFER:
      return segment.dropoffLocation; // Use dropoff for transfers
    case SegmentType.CUSTOM:
      return segment.location;
    default:
      return undefined;
  }
}

/**
 * Calculate duration in minutes between two dates
 * @param start - Start datetime
 * @param end - End datetime
 * @returns Duration in minutes
 */
export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

/**
 * Check if overnight gap exists between segments
 * @param seg1End - End time of first segment
 * @param seg2Start - Start time of second segment
 * @returns True if gap is overnight (>4 hours)
 */
export function hasOvernightGap(seg1End: Date, seg2Start: Date): boolean {
  const gapMinutes = getDurationMinutes(seg1End, seg2Start);
  return gapMinutes > 240; // 4 hours
}
