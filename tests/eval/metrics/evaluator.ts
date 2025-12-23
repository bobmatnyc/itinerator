/**
 * LLM Response Evaluator
 * Provides metrics and scoring for Trip Designer responses
 */

export interface EvaluationCriteria {
  expectedDestination?: string;
  expectedDuration?: number;
  expectedTravelerCount?: number;
  personaAlignment?: any;
  budgetRange?: { min: number; max: number };
  requiredSegmentTypes?: string[];
}

export interface EvaluationMetrics {
  accuracy: number;          // 0-1: Factual correctness
  quality: number;           // 0-1: Logical flow and completeness
  personaAlignment: number;  // 0-1: Matches traveler preferences
  safety: number;            // 0-1: No conflicts or impossible scenarios
}

export interface EvaluationResult {
  passed: boolean;
  score: number;             // Overall score 0-1
  metrics: EvaluationMetrics;
  issues: string[];
  recommendations: string[];
  details: Record<string, any>;
}

/**
 * Evaluate a Trip Designer response
 */
export function evaluateResponse(
  response: any,
  criteria: EvaluationCriteria
): EvaluationResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const details: Record<string, any> = {};

  // Accuracy evaluation
  const accuracyScore = evaluateAccuracy(response, criteria, issues, details);

  // Quality evaluation
  const qualityScore = evaluateQuality(response, criteria, issues, details);

  // Persona alignment evaluation
  const personaScore = evaluatePersonaAlignment(response, criteria, issues, details);

  // Safety evaluation
  const safetyScore = evaluateSafety(response, issues, details);

  // Calculate overall score
  const score = (accuracyScore + qualityScore + personaScore + safetyScore) / 4;

  // Determine pass/fail
  const passed = score >= 0.7 && issues.filter(i => i.includes('CRITICAL')).length === 0;

  return {
    passed,
    score,
    metrics: {
      accuracy: accuracyScore,
      quality: qualityScore,
      personaAlignment: personaScore,
      safety: safetyScore,
    },
    issues,
    recommendations,
    details,
  };
}

/**
 * Evaluate accuracy (destination, dates, traveler count)
 */
function evaluateAccuracy(
  response: any,
  criteria: EvaluationCriteria,
  issues: string[],
  details: Record<string, any>
): number {
  let score = 1.0;

  // Check destination
  if (criteria.expectedDestination) {
    const hasDestination = response.destinations?.some((d: any) =>
      d.name?.toLowerCase().includes(criteria.expectedDestination!.toLowerCase())
    );
    if (!hasDestination) {
      issues.push(`CRITICAL: Destination mismatch. Expected: ${criteria.expectedDestination}`);
      score -= 0.5;
    }
    details.destinationMatch = hasDestination;
  }

  // Check duration
  if (criteria.expectedDuration && response.startDate && response.endDate) {
    const start = new Date(response.startDate);
    const end = new Date(response.endDate);
    const actualDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const durationMatch = Math.abs(actualDuration - criteria.expectedDuration) <= 1; // Allow 1 day variance
    if (!durationMatch) {
      issues.push(`Duration mismatch. Expected: ${criteria.expectedDuration} days, Got: ${actualDuration} days`);
      score -= 0.3;
    }
    details.durationMatch = durationMatch;
    details.actualDuration = actualDuration;
  }

  // Check traveler count
  if (criteria.expectedTravelerCount) {
    const travelerCount = response.travelers?.length || 0;
    if (travelerCount !== criteria.expectedTravelerCount) {
      issues.push(`Traveler count mismatch. Expected: ${criteria.expectedTravelerCount}, Got: ${travelerCount}`);
      score -= 0.2;
    }
    details.travelerCountMatch = travelerCount === criteria.expectedTravelerCount;
  }

  return Math.max(0, score);
}

/**
 * Evaluate quality (logical flow, completeness)
 */
function evaluateQuality(
  response: any,
  criteria: EvaluationCriteria,
  issues: string[],
  details: Record<string, any>
): number {
  let score = 1.0;

  const segments = response.segments || [];

  // Check for required segment types
  if (criteria.requiredSegmentTypes) {
    const presentTypes = new Set(segments.map((s: any) => s.type));
    const missingTypes = criteria.requiredSegmentTypes.filter(t => !presentTypes.has(t));
    if (missingTypes.length > 0) {
      const typesStr = missingTypes.join(', ');
      issues.push(`Missing segment types: ${typesStr}`);
      score -= 0.2 * missingTypes.length;
    }
    details.segmentTypes = Array.from(presentTypes);
  }

  // Check chronological order
  let previousEnd: Date | null = null;
  let chronologyIssues = 0;
  for (const segment of segments) {
    const start = new Date(segment.startDatetime);
    if (previousEnd && start < previousEnd) {
      chronologyIssues++;
    }
    previousEnd = new Date(segment.endDatetime);
  }
  if (chronologyIssues > 0) {
    issues.push(`Chronology issues: ${chronologyIssues} segments out of order`);
    score -= 0.1 * Math.min(chronologyIssues, 3);
  }
  details.chronologyIssues = chronologyIssues;

  // Check completeness (has flights, accommodation, activities)
  const hasFlights = segments.some((s: any) => s.type === 'FLIGHT');
  const hasHotels = segments.some((s: any) => s.type === 'HOTEL');
  const hasActivities = segments.some((s: any) => s.type === 'ACTIVITY');

  if (!hasFlights) issues.push('No flights included');
  if (!hasHotels) issues.push('No accommodation included');
  if (!hasActivities) issues.push('No activities included');

  details.hasFlights = hasFlights;
  details.hasHotels = hasHotels;
  details.hasActivities = hasActivities;

  return Math.max(0, score);
}

/**
 * Evaluate persona alignment
 */
function evaluatePersonaAlignment(
  response: any,
  criteria: EvaluationCriteria,
  issues: string[],
  details: Record<string, any>
): number {
  let score = 1.0;

  if (!criteria.personaAlignment) {
    return 1.0; // Skip if no persona specified
  }

  const persona = criteria.personaAlignment;
  const prefs = persona.preferences || {};

  // Check travel style alignment
  if (prefs.travelStyle && response.tripPreferences?.travelStyle) {
    if (prefs.travelStyle !== response.tripPreferences.travelStyle) {
      issues.push(`Travel style mismatch. Expected: ${prefs.travelStyle}, Got: ${response.tripPreferences.travelStyle}`);
      score -= 0.2;
    }
  }

  // Check budget alignment
  if (criteria.budgetRange) {
    const totalPrice = response.totalPrice?.amount || 0;
    if (totalPrice < criteria.budgetRange.min || totalPrice > criteria.budgetRange.max) {
      issues.push(`Budget out of range. Expected: ${criteria.budgetRange.min}-${criteria.budgetRange.max}, Got: ${totalPrice}`);
      score -= 0.3;
    }
    details.budgetMatch = totalPrice >= criteria.budgetRange.min && totalPrice <= criteria.budgetRange.max;
  }

  details.personaAlignment = score;
  return Math.max(0, score);
}

/**
 * Evaluate safety (no conflicts, valid data)
 */
function evaluateSafety(
  response: any,
  issues: string[],
  details: Record<string, any>
): number {
  let score = 1.0;

  const segments = response.segments || [];

  // Check for overlapping segments
  let overlaps = 0;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const seg1Start = new Date(segments[i].startDatetime);
      const seg1End = new Date(segments[i].endDatetime);
      const seg2Start = new Date(segments[j].startDatetime);
      const seg2End = new Date(segments[j].endDatetime);

      if (seg1Start < seg2End && seg2Start < seg1End) {
        overlaps++;
        issues.push(`CRITICAL: Overlapping segments: ${segments[i].id} and ${segments[j].id}`);
      }
    }
  }
  score -= 0.3 * Math.min(overlaps, 3);
  details.overlappingSegments = overlaps;

  // Check for valid dates
  let invalidDates = 0;
  for (const segment of segments) {
    const start = new Date(segment.startDatetime);
    const end = new Date(segment.endDatetime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      invalidDates++;
      issues.push(`CRITICAL: Invalid date in segment ${segment.id}`);
    }
    if (end <= start) {
      invalidDates++;
      issues.push(`CRITICAL: End date before start date in segment ${segment.id}`);
    }
  }
  score -= 0.3 * Math.min(invalidDates, 3);
  details.invalidDates = invalidDates;

  return Math.max(0, score);
}
