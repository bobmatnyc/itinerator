/**
 * Examples of using the itinerary rules system
 * @module domain/rules/examples
 *
 * This file demonstrates common patterns for using the rule engine.
 * These examples are not executed - they're for documentation.
 */

import { createRuleEngine, RuleId } from './index.js';
import type { SegmentRule, RuleContext } from './index.js';
import { SegmentType } from '../types/common.js';
import type { Itinerary } from '../types/itinerary.js';
import type { Segment, ActivitySegment } from '../types/segment.js';

// ============================================================================
// Example 1: Basic Validation with Default Rules
// ============================================================================

export function example1_basicValidation(itinerary: Itinerary, newSegment: Segment) {
  // Create engine with default configuration
  const ruleEngine = createRuleEngine({
    enableWarnings: true,
    enableInfo: false,
  });

  // Validate adding a segment
  const result = ruleEngine.validateAdd(itinerary, newSegment);

  if (!result.valid) {
    // Hard errors that block the operation
    console.error('Validation failed:');
    result.errors.forEach((error) => {
      console.error(`  [${error.ruleId}] ${error.message}`);
      if (error.suggestion) {
        console.error(`    Suggestion: ${error.suggestion}`);
      }
    });
    return false;
  }

  // Check warnings (operation allowed but may have issues)
  if (result.warnings.length > 0) {
    console.warn('Validation warnings:');
    result.warnings.forEach((warning) => {
      console.warn(`  [${warning.ruleId}] ${warning.message}`);
      if (warning.suggestion) {
        console.warn(`    Suggestion: ${warning.suggestion}`);
      }
    });
  }

  return true;
}

// ============================================================================
// Example 2: Disabling Specific Rules
// ============================================================================

export function example2_disableRules(itinerary: Itinerary, newSegment: Segment) {
  // Create engine with certain rules disabled
  const ruleEngine = createRuleEngine({
    disabledRules: [
      RuleId.REASONABLE_DURATION, // Don't check duration
      RuleId.GEOGRAPHIC_CONTINUITY, // Don't check location flow
    ],
    enableWarnings: true,
  });

  const result = ruleEngine.validateAdd(itinerary, newSegment);
  return result.valid;
}

// ============================================================================
// Example 3: Custom Rule - Maximum Activities Per Day
// ============================================================================

export function example3_customRule() {
  const maxActivitiesPerDayRule: SegmentRule = {
    id: 'max-activities-per-day',
    name: 'Maximum Activities Per Day',
    description: 'Warn if more than 5 activities scheduled in a single day',
    severity: 'warning',
    segmentTypes: [SegmentType.ACTIVITY],
    enabled: true,
    validate: (context: RuleContext) => {
      if (context.segment.type !== SegmentType.ACTIVITY) {
        return { passed: true };
      }

      // Count activities on the same day
      const segmentDate = new Date(context.segment.startDatetime).toDateString();
      const activitiesOnSameDay = context.allSegments.filter(
        (seg) =>
          seg.type === SegmentType.ACTIVITY &&
          new Date(seg.startDatetime).toDateString() === segmentDate
      );

      if (activitiesOnSameDay.length > 5) {
        return {
          passed: false,
          message: `You have ${activitiesOnSameDay.length} activities on ${segmentDate}`,
          suggestion: 'Consider spreading activities across multiple days',
          relatedSegmentIds: activitiesOnSameDay.map((s) => s.id),
          confidence: 0.8,
        };
      }

      return { passed: true };
    },
  };

  // Register custom rule
  const ruleEngine = createRuleEngine();
  ruleEngine.registerRule(maxActivitiesPerDayRule);

  return ruleEngine;
}

// ============================================================================
// Example 4: Custom Rule - Meal Coverage
// ============================================================================

export function example4_mealCoverageRule() {
  const mealCoverageRule: SegmentRule = {
    id: 'meal-coverage',
    name: 'Meal Coverage',
    description: 'Suggest dining activities for days without meal coverage',
    severity: 'info',
    enabled: true,
    validate: (context: RuleContext) => {
      // Only check when adding activities
      if (context.segment.type !== SegmentType.ACTIVITY) {
        return { passed: true };
      }

      const activity = context.segment as ActivitySegment;
      const isDining = activity.category?.toLowerCase().includes('dining');

      if (!isDining) {
        // Check if this day has dining activities
        const segmentDate = new Date(activity.startDatetime).toDateString();
        const hasDining = context.allSegments.some(
          (seg) =>
            seg.type === SegmentType.ACTIVITY &&
            'category' in seg &&
            seg.category?.toLowerCase().includes('dining') &&
            new Date(seg.startDatetime).toDateString() === segmentDate
        );

        if (!hasDining) {
          return {
            passed: true, // Info only
            message: `No dining activities scheduled for ${segmentDate}`,
            suggestion: 'Consider adding dining reservations',
            confidence: 0.6,
          };
        }
      }

      return { passed: true };
    },
  };

  const ruleEngine = createRuleEngine({ enableInfo: true });
  ruleEngine.registerRule(mealCoverageRule);

  return ruleEngine;
}

// ============================================================================
// Example 5: Batch Validation
// ============================================================================

export function example5_batchValidation(itinerary: Itinerary) {
  const ruleEngine = createRuleEngine();

  // Validate all segments in the itinerary
  const results = ruleEngine.validateAll(itinerary);

  // Check for issues
  const segmentsWithErrors: string[] = [];
  const segmentsWithWarnings: string[] = [];

  results.forEach((result, segmentId) => {
    if (!result.valid) {
      segmentsWithErrors.push(segmentId);
    }
    if (result.warnings.length > 0) {
      segmentsWithWarnings.push(segmentId);
    }
  });

  console.log(`Validated ${results.size} segments:`);
  console.log(`  Errors: ${segmentsWithErrors.length}`);
  console.log(`  Warnings: ${segmentsWithWarnings.length}`);

  return results;
}

// ============================================================================
// Example 6: Dynamic Rule Configuration
// ============================================================================

export function example6_dynamicConfig(itinerary: Itinerary) {
  const ruleEngine = createRuleEngine({
    enableWarnings: true,
    enableInfo: false,
  });

  // Validate normally
  let result = ruleEngine.validateAdd(itinerary, {} as Segment);

  // Change configuration dynamically
  if (itinerary.tripType === 'BUSINESS') {
    // Business trips: stricter validation
    ruleEngine.updateConfig({
      enableWarnings: true,
      enableInfo: true,
      disabledRules: [], // Enable all rules
    });
  } else {
    // Leisure trips: more relaxed
    ruleEngine.updateConfig({
      enableWarnings: false,
      enableInfo: false,
      disabledRules: [RuleId.REASONABLE_DURATION, RuleId.ACTIVITY_REQUIRES_TRANSFER],
    });
  }

  return ruleEngine;
}

// ============================================================================
// Example 7: Error Handling in Service Layer
// ============================================================================

export function example7_serviceLayerIntegration() {
  // This example shows how validation errors are handled in SegmentService

  /*
  async add(itineraryId: ItineraryId, segment: Segment) {
    const loadResult = await this.storage.load(itineraryId);
    if (!loadResult.success) return loadResult;

    const validationResult = this.ruleEngine.validateAdd(loadResult.value, segment);

    if (!validationResult.valid) {
      const firstError = validationResult.errors[0];
      return err(
        createValidationError(
          'CONSTRAINT_VIOLATION',
          firstError.message,
          firstError.ruleId,
          {
            ruleId: firstError.ruleId,
            ruleName: firstError.ruleName,
            suggestion: firstError.suggestion,
            relatedSegmentIds: firstError.relatedSegmentIds,
            allErrors: validationResult.errors,
            warnings: validationResult.warnings,
          }
        )
      );
    }

    // ... save segment ...

    // Attach warnings to successful result
    if (validationResult.warnings.length > 0) {
      return ok({
        ...savedItinerary,
        metadata: {
          ...savedItinerary.metadata,
          validationWarnings: validationResult.warnings,
        },
      });
    }

    return ok(savedItinerary);
  }
  */
}

// ============================================================================
// Example 8: Get Rules for Specific Segment Type
// ============================================================================

export function example8_getRulesForType() {
  const ruleEngine = createRuleEngine();

  // Get all rules applicable to flights
  const flightRules = ruleEngine.getRulesForType(SegmentType.FLIGHT);

  console.log('Flight validation rules:');
  flightRules.forEach((rule) => {
    console.log(`  [${rule.severity}] ${rule.name}`);
    console.log(`    ${rule.description}`);
  });

  return flightRules;
}

// ============================================================================
// Example 9: Validation Result Summary
// ============================================================================

export function example9_resultSummary(itinerary: Itinerary, segment: Segment) {
  const ruleEngine = createRuleEngine();
  const result = ruleEngine.validateAdd(itinerary, segment);

  // Get human-readable summary
  const summary = ruleEngine.summarize(result);
  console.log(summary);
  // Output: "Validation passed" or "Validation failed: 2 error(s), 1 warning(s)"

  return summary;
}
