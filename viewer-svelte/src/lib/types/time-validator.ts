/**
 * Time validation types for viewer
 * Re-exports from local utils
 */

export {
  TimeIssueSeverity,
  type TimeValidationResult,
  type SegmentTimeIssue,
  validateSegmentTime,
  validateItineraryTimes,
  getTimeValidationSummary,
  applyTimeFix
} from '$lib/utils/time-validator';
