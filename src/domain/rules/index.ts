/**
 * Business rules module - centralized itinerary validation
 * @module domain/rules
 *
 * Export all rule types, validators, and the rule engine.
 */

// Core types and interfaces
export type {
  RuleSeverity,
  RuleContext,
  RuleResult,
  SegmentRule,
  RuleEngineConfig,
  ValidationResult,
} from './itinerary-rules.js';

// Export RuleId separately (both const object and type)
export { RuleId } from './itinerary-rules.js';
export type { RuleId as RuleIdType } from './itinerary-rules.js';

export { datesOverlap, datetimesOverlap, isSameLocation, getDurationMinutes, hasOvernightGap } from './itinerary-rules.js';

// Core rules
export {
  noFlightOverlapRule,
  noHotelOverlapRule,
  hotelActivityOverlapAllowedRule,
  activityRequiresTransferRule,
  segmentWithinTripDatesRule,
  chronologicalOrderRule,
  reasonableDurationRule,
  geographicContinuityRule,
  CORE_RULES,
} from './core-rules.js';

// Rule engine
export { ItineraryRuleEngine, createRuleEngine } from './rule-engine.js';
