/**
 * Time validation utility for segment times
 * @module utils/time-validator
 */

import type { Segment } from '../domain/types/segment.js';
import { SegmentType } from '../domain/types/common.js';
import { isActivitySegment, isFlightSegment, isHotelSegment, isTransferSegment } from '../domain/types/segment.js';

/**
 * Severity levels for time validation issues
 */
export enum TimeIssueSeverity {
  /** Information only - unusual but potentially valid */
  INFO = 'info',
  /** Warning - likely incorrect or unusual */
  WARNING = 'warning',
  /** Error - very likely incorrect */
  ERROR = 'error'
}

/**
 * Result of time validation for a segment
 */
export interface TimeValidationResult {
  /** Whether the time is valid */
  isValid: boolean;
  /** Severity of the issue (if not valid) */
  severity?: TimeIssueSeverity;
  /** Description of the issue */
  issue?: string;
  /** Suggested corrected time (HH:mm format) */
  suggestedTime?: string;
  /** Category of the issue for grouping */
  category?: 'too_early' | 'too_late' | 'unusual' | 'meal_timing' | 'business_hours' | 'semantic_mismatch';
  /** Additional details about the issue */
  details?: string;
}

/**
 * Segment with time validation issue
 */
export interface SegmentTimeIssue {
  /** Segment with issue */
  segment: Segment;
  /** Validation result */
  validation: TimeValidationResult;
}

/**
 * Get hour from date (0-23)
 */
function getHour(date: Date): number {
  return date.getHours();
}

/**
 * Get minutes from date (0-59)
 */
function getMinutes(date: Date): number {
  return date.getMinutes();
}

/**
 * Format hour as time string (e.g., "9:00 AM")
 */
function formatHour(hour: number, minutes = 0): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMinutes = minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ':00';
  return `${displayHour}${displayMinutes} ${period}`;
}

/**
 * Time range for semantic keyword validation
 */
interface TimeRange {
  /** Minimum hour (0-23) */
  minHour: number;
  /** Maximum hour (0-23) - may be less than minHour for overnight ranges */
  maxHour: number;
  /** Suggested time in HH:mm format */
  suggested: string;
  /** Human-readable time range description */
  description: string;
}

/**
 * Time-related keywords and their expected time ranges
 */
const TIME_KEYWORDS: Record<string, TimeRange> = {
  'late night': {
    minHour: 22,
    maxHour: 3,
    suggested: '22:00',
    description: '10 PM - 3 AM'
  },
  'midnight': {
    minHour: 23,
    maxHour: 2,
    suggested: '00:00',
    description: '11 PM - 2 AM'
  },
  'night': {
    minHour: 20,
    maxHour: 3,
    suggested: '21:00',
    description: '8 PM - 3 AM'
  },
  'evening': {
    minHour: 17,
    maxHour: 22,
    suggested: '19:00',
    description: '5 PM - 10 PM'
  },
  'sunset': {
    minHour: 16,
    maxHour: 20,
    suggested: '18:00',
    description: '4 PM - 8 PM'
  },
  'afternoon': {
    minHour: 12,
    maxHour: 18,
    suggested: '14:00',
    description: '12 PM - 6 PM'
  },
  'lunch': {
    minHour: 11,
    maxHour: 15,
    suggested: '12:00',
    description: '11 AM - 3 PM'
  },
  'brunch': {
    minHour: 10,
    maxHour: 14,
    suggested: '11:00',
    description: '10 AM - 2 PM'
  },
  'morning': {
    minHour: 6,
    maxHour: 12,
    suggested: '09:00',
    description: '6 AM - 12 PM'
  },
  'sunrise': {
    minHour: 5,
    maxHour: 8,
    suggested: '06:00',
    description: '5 AM - 8 AM'
  },
  'breakfast': {
    minHour: 6,
    maxHour: 11,
    suggested: '08:00',
    description: '6 AM - 11 AM'
  },
  'early morning': {
    minHour: 5,
    maxHour: 9,
    suggested: '07:00',
    description: '5 AM - 9 AM'
  },
  'dinner': {
    minHour: 17,
    maxHour: 22,
    suggested: '19:00',
    description: '5 PM - 10 PM'
  }
};

/**
 * Check if hour is within time range (handles overnight ranges)
 */
function isInTimeRange(hour: number, minHour: number, maxHour: number): boolean {
  // Handle overnight ranges (e.g., 22:00 - 3:00)
  if (maxHour < minHour) {
    // Hour is either after minHour OR before maxHour
    return hour >= minHour || hour <= maxHour;
  }
  // Normal range
  return hour >= minHour && hour <= maxHour;
}

/**
 * Check activity name for time-related keywords and validate scheduling
 */
function validateSemanticTime(segment: Segment): TimeValidationResult | null {
  // Only check segments with a name property
  // (FLIGHT and HOTEL segments may not have a name field)
  const name = 'name' in segment ? segment.name : undefined;
  if (!name) {
    return null;
  }

  const nameLower = name.toLowerCase();
  const hour = getHour(segment.startDatetime);
  const minutes = getMinutes(segment.startDatetime);

  // Check each keyword (prioritize longer/more specific keywords first)
  const sortedKeywords = Object.entries(TIME_KEYWORDS).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [keyword, timeRange] of sortedKeywords) {
    if (nameLower.includes(keyword)) {
      if (!isInTimeRange(hour, timeRange.minHour, timeRange.maxHour)) {
        return {
          isValid: false,
          severity: TimeIssueSeverity.WARNING,
          issue: `"${keyword}" activity scheduled outside expected time`,
          details: `"${keyword}" activities are typically ${timeRange.description}, but this is scheduled at ${formatHour(hour, minutes)}`,
          suggestedTime: timeRange.suggested,
          category: 'semantic_mismatch'
        };
      }
      // Found matching keyword and time is valid - skip type-specific validation
      // Return valid result to prevent false positives from type-specific rules
      return { isValid: true };
    }
  }

  // No time keywords found - continue to type-specific validation
  return null;
}

/**
 * Format time as HH:mm for suggested correction
 */
function formatTime(hour: number, minutes = 0): string {
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Validate activity segment time
 */
function validateActivityTime(segment: Segment & { type: 'ACTIVITY' }): TimeValidationResult {
  const hour = getHour(segment.startDatetime);
  const category = segment.category?.toLowerCase();

  // Dining validation
  if (category?.includes('dining') || category?.includes('restaurant') || category?.includes('food')) {
    // Breakfast: 6 AM - 10 AM
    if (hour >= 6 && hour < 11) {
      // Valid breakfast time
      if (hour < 7) {
        return {
          isValid: false,
          severity: TimeIssueSeverity.WARNING,
          issue: 'Very early for breakfast (most restaurants open 7-8 AM)',
          suggestedTime: formatTime(8, 0),
          category: 'meal_timing'
        };
      }
      return { isValid: true };
    }

    // Lunch: 11 AM - 3 PM
    if (hour >= 11 && hour < 15) {
      return { isValid: true };
    }

    // Dinner: 5 PM - 11 PM
    if (hour >= 17 && hour < 23) {
      return { isValid: true };
    }

    // Late dinner: 11 PM - 1 AM
    if (hour >= 23 || hour < 2) {
      return {
        isValid: false,
        severity: TimeIssueSeverity.WARNING,
        issue: 'Late dining time (most restaurants close by midnight)',
        suggestedTime: formatTime(19, 0),
        category: 'meal_timing'
      };
    }

    // Very early morning (2 AM - 6 AM)
    if (hour >= 2 && hour < 6) {
      return {
        isValid: false,
        severity: TimeIssueSeverity.ERROR,
        issue: 'Too early for dining (most restaurants closed)',
        suggestedTime: formatTime(8, 0),
        category: 'too_early'
      };
    }

    // Odd hours for meals
    return {
      isValid: false,
      severity: TimeIssueSeverity.INFO,
      issue: 'Unusual time for dining',
      suggestedTime: formatTime(12, 0),
      category: 'unusual'
    };
  }

  // General activities (attractions, museums, tours, etc.)
  // Most attractions: 8 AM - 10 PM
  if (hour >= 8 && hour < 22) {
    return { isValid: true };
  }

  // Early morning (6 AM - 8 AM)
  if (hour >= 6 && hour < 8) {
    return {
      isValid: false,
      severity: TimeIssueSeverity.WARNING,
      issue: 'Early for most attractions (usually open 9 AM - 10 AM)',
      suggestedTime: formatTime(9, 0),
      category: 'business_hours'
    };
  }

  // Very early morning (4 AM - 6 AM)
  if (hour >= 4 && hour < 6) {
    return {
      isValid: false,
      severity: TimeIssueSeverity.ERROR,
      issue: 'Too early for most attractions (gardens, museums typically open 9 AM)',
      suggestedTime: formatTime(9, 0),
      category: 'too_early'
    };
  }

  // Overnight (midnight - 4 AM)
  if (hour >= 0 && hour < 4) {
    return {
      isValid: false,
      severity: TimeIssueSeverity.ERROR,
      issue: 'Overnight hours - most attractions closed',
      suggestedTime: formatTime(10, 0),
      category: 'too_early'
    };
  }

  // Late evening (10 PM - midnight)
  if (hour >= 22 && hour < 24) {
    return {
      isValid: false,
      severity: TimeIssueSeverity.WARNING,
      issue: 'Late for most attractions (typically close by 6-8 PM)',
      suggestedTime: formatTime(14, 0),
      category: 'too_late'
    };
  }

  return { isValid: true };
}

/**
 * Validate flight segment time
 */
function validateFlightTime(segment: Segment & { type: 'FLIGHT' }): TimeValidationResult {
  const hour = getHour(segment.startDatetime);

  // Flights operate 24/7, but very early flights are worth noting
  if (hour >= 1 && hour < 5) {
    return {
      isValid: false,
      severity: TimeIssueSeverity.INFO,
      issue: 'Red-eye or very early morning flight (verify departure time)',
      category: 'unusual'
    };
  }

  // All flight times are technically valid
  return { isValid: true };
}

/**
 * Validate hotel segment time
 */
function validateHotelTime(segment: Segment & { type: 'HOTEL' }): TimeValidationResult {
  const hour = getHour(segment.startDatetime);

  // Check-in is usually 3 PM (15:00)
  // Check-in before noon is unusual
  if (hour < 12) {
    return {
      isValid: false,
      severity: TimeIssueSeverity.WARNING,
      issue: 'Early check-in (standard is 3 PM, early check-in may require extra fee)',
      suggestedTime: formatTime(15, 0),
      category: 'business_hours'
    };
  }

  // Check-in after 11 PM is unusual
  if (hour >= 23) {
    return {
      isValid: false,
      severity: TimeIssueSeverity.WARNING,
      issue: 'Very late check-in (verify 24-hour reception)',
      category: 'unusual'
    };
  }

  return { isValid: true };
}

/**
 * Validate transfer segment time
 */
function validateTransferTime(segment: Segment & { type: 'TRANSFER' }): TimeValidationResult {
  const hour = getHour(segment.startDatetime);

  // Transfers can happen anytime, but very late/early is worth noting
  if (hour >= 1 && hour < 5) {
    return {
      isValid: false,
      severity: TimeIssueSeverity.INFO,
      issue: 'Overnight transfer (verify service availability)',
      category: 'unusual'
    };
  }

  return { isValid: true };
}

/**
 * Validate segment time based on segment type and details
 * @param segment - Segment to validate
 * @returns Validation result with issue details and suggestions
 */
export function validateSegmentTime(segment: Segment): TimeValidationResult {
  // First check for semantic time mismatches (applies to all segment types)
  const semanticValidation = validateSemanticTime(segment);
  if (semanticValidation) {
    return semanticValidation;
  }

  // Type-specific validation
  if (isActivitySegment(segment)) {
    return validateActivityTime(segment);
  }

  if (isFlightSegment(segment)) {
    return validateFlightTime(segment);
  }

  if (isHotelSegment(segment)) {
    return validateHotelTime(segment);
  }

  if (isTransferSegment(segment)) {
    return validateTransferTime(segment);
  }

  // No specific validation for MEETING and CUSTOM types
  return { isValid: true };
}

/**
 * Validate all segments in an itinerary
 * @param segments - Array of segments to validate
 * @returns Array of segments with time issues
 */
export function validateItineraryTimes(segments: Segment[]): SegmentTimeIssue[] {
  const issues: SegmentTimeIssue[] = [];

  for (const segment of segments) {
    const validation = validateSegmentTime(segment);
    if (!validation.isValid) {
      issues.push({ segment, validation });
    }
  }

  return issues;
}

/**
 * Get summary of time validation issues
 * @param issues - Array of segment time issues
 * @returns Summary statistics
 */
export function getTimeValidationSummary(issues: SegmentTimeIssue[]): {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<TimeIssueSeverity, number>;
} {
  const summary = {
    total: issues.length,
    byCategory: {} as Record<string, number>,
    bySeverity: {
      [TimeIssueSeverity.INFO]: 0,
      [TimeIssueSeverity.WARNING]: 0,
      [TimeIssueSeverity.ERROR]: 0
    }
  };

  for (const issue of issues) {
    const { validation } = issue;

    // Count by category
    if (validation.category) {
      summary.byCategory[validation.category] = (summary.byCategory[validation.category] || 0) + 1;
    }

    // Count by severity
    if (validation.severity) {
      summary.bySeverity[validation.severity]++;
    }
  }

  return summary;
}

/**
 * Apply suggested time fix to segment
 * @param segment - Segment to fix
 * @param suggestedTime - Suggested time in HH:mm format
 * @returns Updated segment with corrected time
 */
export function applyTimeFix(segment: Segment, suggestedTime: string): Segment {
  const [hours, minutes] = suggestedTime.split(':').map(Number);
  const newStartDatetime = new Date(segment.startDatetime);
  newStartDatetime.setHours(hours, minutes, 0, 0);

  // Maintain duration
  const duration = segment.endDatetime.getTime() - segment.startDatetime.getTime();
  const newEndDatetime = new Date(newStartDatetime.getTime() + duration);

  return {
    ...segment,
    startDatetime: newStartDatetime,
    endDatetime: newEndDatetime
  };
}
