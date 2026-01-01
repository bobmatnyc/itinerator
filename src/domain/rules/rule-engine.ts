/**
 * Rule Engine for orchestrating itinerary validation
 * @module domain/rules/rule-engine
 */

import type {
  SegmentRule,
  RuleContext,
  ValidationResult,
  RuleEngineConfig,
  RuleId,
} from './itinerary-rules.js';
import { CORE_RULES } from './core-rules.js';
import type { Segment } from '../types/segment.js';
import type { Itinerary } from '../types/itinerary.js';
import type { SegmentType } from '../types/common.js';

/**
 * Rule engine for validating itinerary segments
 */
export class ItineraryRuleEngine {
  private rules: Map<string, SegmentRule> = new Map();
  private config: Required<RuleEngineConfig>;

  constructor(config: RuleEngineConfig = {}) {
    this.config = {
      disabledRules: config.disabledRules ?? [],
      enableWarnings: config.enableWarnings ?? true,
      enableInfo: config.enableInfo ?? false,
    };

    this.registerCoreRules();
  }

  /**
   * Register all core rules
   */
  private registerCoreRules(): void {
    for (const rule of CORE_RULES) {
      this.registerRule(rule);
    }
  }

  /**
   * Register a custom rule
   * @param rule - Rule to register
   */
  registerRule(rule: SegmentRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Unregister a rule by ID
   * @param ruleId - ID of rule to unregister
   */
  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get a rule by ID
   * @param ruleId - Rule ID to retrieve
   * @returns Rule or undefined if not found
   */
  getRule(ruleId: string): SegmentRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all registered rules
   * @returns Array of all rules
   */
  getAllRules(): SegmentRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules applicable to a specific segment type
   * @param type - Segment type
   * @returns Array of applicable rules
   */
  getRulesForType(type: SegmentType): SegmentRule[] {
    return Array.from(this.rules.values()).filter(
      (rule) => !rule.segmentTypes || rule.segmentTypes.includes(type)
    );
  }

  /**
   * Check if a rule applies to a given context
   * @param rule - Rule to check
   * @param context - Validation context
   * @returns True if rule should be evaluated
   */
  private ruleApplies(rule: SegmentRule, context: RuleContext): boolean {
    // Check if rule is enabled
    if (!rule.enabled) return false;

    // Check if rule is disabled in config
    if (this.config.disabledRules.includes(rule.id as RuleId)) return false;

    // Check severity filters
    if (rule.severity === 'warning' && !this.config.enableWarnings) return false;
    if (rule.severity === 'info' && !this.config.enableInfo) return false;

    // Check if rule applies to this segment type
    if (rule.segmentTypes && !rule.segmentTypes.includes(context.segment.type)) {
      return false;
    }

    return true;
  }

  /**
   * Validate a segment against all applicable rules
   * @param context - Validation context
   * @returns Validation result with errors, warnings, and info
   */
  validate(context: RuleContext): ValidationResult {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    const info: ValidationResult['info'] = [];

    for (const rule of this.rules.values()) {
      if (!this.ruleApplies(rule, context)) {
        continue;
      }

      const result = rule.validate(context);

      if (!result.passed) {
        const enrichedResult = {
          ...result,
          ruleId: rule.id as RuleId,
          ruleName: rule.name,
        };

        switch (rule.severity) {
          case 'error':
            errors.push(enrichedResult);
            break;
          case 'warning':
            warnings.push(enrichedResult);
            break;
          case 'info':
            info.push(enrichedResult);
            break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
    };
  }

  /**
   * Validate a segment for adding to an itinerary
   * @param itinerary - Target itinerary
   * @param segment - Segment to add
   * @returns Validation result
   */
  validateAdd(itinerary: Itinerary, segment: Segment): ValidationResult {
    const context: RuleContext = {
      segment,
      itinerary,
      allSegments: [...itinerary.segments, segment],
      operation: 'add',
    };

    return this.validate(context);
  }

  /**
   * Validate a segment for updating in an itinerary
   * @param itinerary - Target itinerary
   * @param updatedSegment - Updated segment
   * @returns Validation result
   */
  validateUpdate(itinerary: Itinerary, updatedSegment: Segment): ValidationResult {
    const context: RuleContext = {
      segment: updatedSegment,
      itinerary,
      allSegments: itinerary.segments.map((s) => (s.id === updatedSegment.id ? updatedSegment : s)),
      operation: 'update',
    };

    return this.validate(context);
  }

  /**
   * Validate a segment for deletion from an itinerary
   * @param itinerary - Target itinerary
   * @param segment - Segment to delete
   * @returns Validation result
   */
  validateDelete(itinerary: Itinerary, segment: Segment): ValidationResult {
    const context: RuleContext = {
      segment,
      itinerary,
      allSegments: itinerary.segments.filter((s) => s.id !== segment.id),
      operation: 'delete',
    };

    return this.validate(context);
  }

  /**
   * Batch validate all segments in an itinerary
   * Useful for validating existing itineraries or after bulk updates
   * @param itinerary - Itinerary to validate
   * @returns Map of segment ID to validation result
   */
  validateAll(itinerary: Itinerary): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();

    for (const segment of itinerary.segments) {
      const context: RuleContext = {
        segment,
        itinerary,
        allSegments: itinerary.segments,
        operation: 'update',
      };

      results.set(segment.id, this.validate(context));
    }

    return results;
  }

  /**
   * Get a summary of validation results
   * @param result - Validation result to summarize
   * @returns Human-readable summary
   */
  summarize(result: ValidationResult): string {
    const parts: string[] = [];

    if (result.errors.length > 0) {
      parts.push(`${result.errors.length} error(s)`);
    }

    if (result.warnings.length > 0) {
      parts.push(`${result.warnings.length} warning(s)`);
    }

    if (result.info.length > 0) {
      parts.push(`${result.info.length} info message(s)`);
    }

    if (parts.length === 0) {
      return 'Validation passed';
    }

    return `Validation ${result.valid ? 'passed with warnings' : 'failed'}: ${parts.join(', ')}`;
  }

  /**
   * Update engine configuration
   * @param config - New configuration (merged with existing)
   */
  updateConfig(config: Partial<RuleEngineConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current engine configuration
   * @returns Current configuration
   */
  getConfig(): Readonly<Required<RuleEngineConfig>> {
    return { ...this.config };
  }
}

/**
 * Create a default rule engine instance with core rules
 * @param config - Optional configuration
 * @returns New rule engine instance
 */
export function createRuleEngine(config?: RuleEngineConfig): ItineraryRuleEngine {
  return new ItineraryRuleEngine(config);
}
