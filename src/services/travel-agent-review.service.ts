/**
 * Travel Agent Review Service - semantic validation of itineraries
 * @module services/travel-agent-review
 */

import type { Segment, FlightSegment, TransferSegment } from '../domain/types/segment.js';
import type { Itinerary } from '../domain/types/itinerary.js';
import { SegmentType } from '../domain/types/common.js';
import { generateSegmentId } from '../domain/types/branded.js';

/**
 * Type of semantic issue detected
 */
export enum SemanticIssueType {
  /** Flight arrival missing transfer to next non-airport segment */
  MISSING_AIRPORT_TRANSFER = 'MISSING_AIRPORT_TRANSFER',
  /** Segments have overlapping times */
  OVERLAPPING_TIMES = 'OVERLAPPING_TIMES',
  /** Impossible sequence (e.g., activity before flight arrival) */
  IMPOSSIBLE_SEQUENCE = 'IMPOSSIBLE_SEQUENCE',
}

/**
 * Severity of semantic issue
 */
export type SemanticIssueSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Semantic issue detected in itinerary
 */
export interface SemanticIssue {
  /** Type of issue */
  type: SemanticIssueType;
  /** Severity level */
  severity: SemanticIssueSeverity;
  /** Human-readable description */
  description: string;
  /** Segment indices involved in the issue */
  segmentIndices: number[];
  /** Suggested fix segment (if applicable) */
  suggestedFix?: Segment;
}

/**
 * Result of semantic review
 */
export interface SemanticReviewResult {
  /** Whether the itinerary passed all checks */
  valid: boolean;
  /** Issues detected */
  issues: SemanticIssue[];
  /** Summary of review */
  summary: string;
}

/**
 * Service for semantic review of itineraries using higher-level reasoning
 */
export class TravelAgentReviewService {
  /**
   * Review an itinerary for semantic issues
   * @param itinerary - Itinerary to review
   * @returns Review result with detected issues
   */
  reviewItinerary(itinerary: Itinerary): SemanticReviewResult {
    const issues: SemanticIssue[] = [];

    // Sort segments chronologically
    const sortedSegments = [...itinerary.segments].sort(
      (a, b) => a.startDatetime.getTime() - b.startDatetime.getTime()
    );

    // Rule 1: Flight arrivals must have transfers to next non-airport segment
    issues.push(...this.checkFlightArrivals(sortedSegments));

    // Rule 2: Flight departures must have transfers from previous non-airport segment
    issues.push(...this.checkFlightDepartures(sortedSegments));

    // Rule 3: No segment should start before previous one ends
    issues.push(...this.checkTimeOverlaps(sortedSegments));

    // Build summary
    const summary = this.buildSummary(issues);

    return {
      valid: issues.length === 0,
      issues,
      summary,
    };
  }

  /**
   * Auto-fix HIGH severity issues in an itinerary
   * @param itinerary - Itinerary to fix
   * @param reviewResult - Review result with issues to fix
   * @returns Fixed itinerary
   */
  autoFixIssues(itinerary: Itinerary, reviewResult: SemanticReviewResult): Itinerary {
    // Only fix HIGH severity issues
    const highSeverityIssues = reviewResult.issues.filter(
      (issue) => issue.severity === 'HIGH' && issue.suggestedFix
    );

    if (highSeverityIssues.length === 0) {
      return itinerary;
    }

    // Sort segments chronologically
    let segments = [...itinerary.segments].sort(
      (a, b) => a.startDatetime.getTime() - b.startDatetime.getTime()
    );

    // Apply fixes in reverse order (to maintain correct indices)
    for (let i = highSeverityIssues.length - 1; i >= 0; i--) {
      const issue = highSeverityIssues[i];
      if (!issue?.suggestedFix) continue;

      // Insert the fix at the appropriate position
      // For missing transfers, insert between the two segments
      if (issue.type === SemanticIssueType.MISSING_AIRPORT_TRANSFER) {
        const afterIndex = Math.max(...issue.segmentIndices);
        segments.splice(afterIndex, 0, issue.suggestedFix);
      }
    }

    return {
      ...itinerary,
      segments,
    };
  }

  /**
   * Check for missing transfers after flight arrivals
   * @param segments - Sorted segments
   * @returns Detected issues
   */
  private checkFlightArrivals(segments: Segment[]): SemanticIssue[] {
    const issues: SemanticIssue[] = [];

    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i];
      const next = segments[i + 1];

      if (!current || !next) continue;

      // Check if current is a flight
      if (current.type !== SegmentType.FLIGHT) continue;

      const flight = current as FlightSegment;

      // Check if next segment is an airport-related transfer
      const nextIsAirportTransfer = this.isAirportTransfer(next);

      // If next segment is NOT an airport transfer and NOT a flight,
      // we likely need a transfer from airport to next location
      if (!nextIsAirportTransfer && next.type !== SegmentType.FLIGHT) {
        // Get the destination of the flight
        const airportLocation = flight.destination;

        // Get the start location of the next segment
        const nextLocation = this.getStartLocation(next);

        // If locations are different, we need a transfer
        if (airportLocation && nextLocation && !this.isSameCity(airportLocation, nextLocation)) {
          const suggestedTransfer = this.createAirportTransfer(
            flight.endDatetime,
            next.startDatetime,
            airportLocation,
            nextLocation
          );

          issues.push({
            type: SemanticIssueType.MISSING_AIRPORT_TRANSFER,
            severity: 'HIGH',
            description: `Flight arrival at ${airportLocation.name} (${airportLocation.code}) is not followed by a transfer to ${nextLocation.name}`,
            segmentIndices: [i, i + 1],
            suggestedFix: suggestedTransfer,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for missing transfers before flight departures
   * @param segments - Sorted segments
   * @returns Detected issues
   */
  private checkFlightDepartures(segments: Segment[]): SemanticIssue[] {
    const issues: SemanticIssue[] = [];

    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      const current = segments[i];

      if (!prev || !current) continue;

      // Check if current is a flight
      if (current.type !== SegmentType.FLIGHT) continue;

      const flight = current as FlightSegment;

      // Check if previous segment is an airport-related transfer
      const prevIsAirportTransfer = this.isAirportTransfer(prev);

      // If previous segment is NOT an airport transfer and NOT a flight,
      // we likely need a transfer to airport from previous location
      if (!prevIsAirportTransfer && prev.type !== SegmentType.FLIGHT) {
        // Get the end location of the previous segment
        const prevLocation = this.getEndLocation(prev);

        // Get the origin of the flight
        const airportLocation = flight.origin;

        // If locations are different, we need a transfer
        if (prevLocation && airportLocation && !this.isSameCity(prevLocation, airportLocation)) {
          const suggestedTransfer = this.createAirportTransfer(
            prev.endDatetime,
            flight.startDatetime,
            prevLocation,
            airportLocation
          );

          issues.push({
            type: SemanticIssueType.MISSING_AIRPORT_TRANSFER,
            severity: 'HIGH',
            description: `Flight departure from ${airportLocation.name} (${airportLocation.code}) is not preceded by a transfer from ${prevLocation.name}`,
            segmentIndices: [i - 1, i],
            suggestedFix: suggestedTransfer,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for time overlaps between segments
   * @param segments - Sorted segments
   * @returns Detected issues
   */
  private checkTimeOverlaps(segments: Segment[]): SemanticIssue[] {
    const issues: SemanticIssue[] = [];

    for (let i = 0; i < segments.length - 1; i++) {
      const current = segments[i];
      const next = segments[i + 1];

      if (!current || !next) continue;

      // Check if next segment starts before current ends
      if (next.startDatetime < current.endDatetime) {
        issues.push({
          type: SemanticIssueType.OVERLAPPING_TIMES,
          severity: 'MEDIUM',
          description: `Segment ${i + 1} starts before segment ${i} ends (overlap: ${this.formatTimeDiff(current.endDatetime, next.startDatetime)})`,
          segmentIndices: [i, i + 1],
        });
      }
    }

    return issues;
  }

  /**
   * Check if a segment is an airport transfer
   * @param segment - Segment to check
   * @returns True if segment is a transfer involving an airport
   */
  private isAirportTransfer(segment: Segment): boolean {
    if (segment.type !== SegmentType.TRANSFER) return false;

    const transfer = segment as TransferSegment;
    // Check if location has IATA code (airport code) or name contains "Airport"
    const pickupIsAirport =
      Boolean(transfer.pickupLocation?.code) ||
      (transfer.pickupLocation?.name?.toLowerCase().includes('airport') ?? false);
    const dropoffIsAirport =
      Boolean(transfer.dropoffLocation?.code) ||
      (transfer.dropoffLocation?.name?.toLowerCase().includes('airport') ?? false);

    return pickupIsAirport || dropoffIsAirport;
  }

  /**
   * Get the start location of a segment
   * @param segment - Segment
   * @returns Start location or null
   */
  private getStartLocation(segment: Segment): any | null {
    switch (segment.type) {
      case SegmentType.FLIGHT:
        return (segment as FlightSegment).origin;
      case SegmentType.TRANSFER:
        return (segment as TransferSegment).pickupLocation;
      case SegmentType.HOTEL:
        return (segment as any).location;
      case SegmentType.ACTIVITY:
        return (segment as any).location;
      case SegmentType.MEETING:
        return (segment as any).location;
      default:
        return null;
    }
  }

  /**
   * Get the end location of a segment
   * @param segment - Segment
   * @returns End location or null
   */
  private getEndLocation(segment: Segment): any | null {
    switch (segment.type) {
      case SegmentType.FLIGHT:
        return (segment as FlightSegment).destination;
      case SegmentType.TRANSFER:
        return (segment as TransferSegment).dropoffLocation;
      case SegmentType.HOTEL:
        return (segment as any).location;
      case SegmentType.ACTIVITY:
        return (segment as any).location;
      case SegmentType.MEETING:
        return (segment as any).location;
      default:
        return null;
    }
  }

  /**
   * Check if two locations are in the same city
   * @param loc1 - First location
   * @param loc2 - Second location
   * @returns True if same city/location (conservative check)
   */
  private isSameCity(loc1: any, loc2: any): boolean {
    // If one is an airport and the other is not, they're different locations
    // even if they're in the same city (airport transfers are needed)
    const loc1IsAirport = Boolean(loc1.code) || (loc1.name?.toLowerCase().includes('airport') ?? false);
    const loc2IsAirport = Boolean(loc2.code) || (loc2.name?.toLowerCase().includes('airport') ?? false);

    if (loc1IsAirport !== loc2IsAirport) {
      // One is airport, one is not - definitely need transfer
      return false;
    }

    // If both have codes and they match, same location
    if (loc1.code && loc2.code) {
      return loc1.code.toUpperCase() === loc2.code.toUpperCase();
    }

    // Check city names (only if both are non-airports)
    const city1 = (loc1.city || loc1.address?.city || '').toLowerCase().trim();
    const city2 = (loc2.city || loc2.address?.city || '').toLowerCase().trim();

    if (city1 && city2 && !loc1IsAirport && !loc2IsAirport) {
      return city1 === city2;
    }

    // Conservative default: assume different cities
    return false;
  }

  /**
   * Create a suggested airport transfer segment
   * @param startTime - Transfer start time
   * @param endTime - Transfer end time
   * @param pickup - Pickup location
   * @param dropoff - Dropoff location
   * @returns Transfer segment
   */
  private createAirportTransfer(
    startTime: Date,
    endTime: Date,
    pickup: any,
    dropoff: any
  ): TransferSegment {
    // Calculate reasonable transfer start time
    // For airport arrival: start shortly after flight lands
    // For airport departure: end well before flight departs
    const isAirportPickup = Boolean(pickup.code) || (pickup.name?.toLowerCase().includes('airport') ?? false);
    const isAirportDropoff = Boolean(dropoff.code) || (dropoff.name?.toLowerCase().includes('airport') ?? false);

    let transferStart: Date;
    let transferEnd: Date;

    if (isAirportPickup) {
      // Airport -> Hotel/Activity: Start 30min after landing (customs/baggage)
      transferStart = new Date(startTime.getTime() + 30 * 60 * 1000);
      // End 30min before next activity
      transferEnd = new Date(endTime.getTime() - 30 * 60 * 1000);
    } else if (isAirportDropoff) {
      // Hotel/Activity -> Airport: Start 3 hours before flight
      transferStart = new Date(endTime.getTime() - 3 * 60 * 60 * 1000);
      // End 2 hours before flight (allow checkin time)
      transferEnd = new Date(endTime.getTime() - 2 * 60 * 60 * 1000);
    } else {
      // Default: reasonable buffer
      transferStart = new Date(startTime.getTime() + 15 * 60 * 1000);
      transferEnd = new Date(endTime.getTime() - 15 * 60 * 1000);
    }

    // Ensure transfer end is after start
    if (transferEnd <= transferStart) {
      transferEnd = new Date(transferStart.getTime() + 30 * 60 * 1000);
    }

    return {
      id: generateSegmentId(),
      type: SegmentType.TRANSFER,
      status: 'TENTATIVE',
      startDatetime: transferStart,
      endDatetime: transferEnd,
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'dream',
        confidence: 0.95, // High confidence for airport transfers
        timestamp: new Date(),
      },
      transferType: 'PRIVATE',
      pickupLocation: {
        name: pickup.name,
        code: pickup.code,
        city: pickup.city,
        country: pickup.country,
        address: pickup.address,
      },
      dropoffLocation: {
        name: dropoff.name,
        code: dropoff.code,
        city: dropoff.city,
        country: dropoff.country,
        address: dropoff.address,
      },
      notes: 'Auto-generated transfer for airport connection',
      metadata: {},
      inferred: true,
      inferredReason: `Semantic review detected missing transfer between ${pickup.name} and ${dropoff.name}`,
    };
  }

  /**
   * Format time difference for display
   * @param time1 - First time
   * @param time2 - Second time
   * @returns Formatted duration
   */
  private formatTimeDiff(time1: Date, time2: Date): string {
    const diffMs = Math.abs(time2.getTime() - time1.getTime());
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Build summary from detected issues
   * @param issues - Detected issues
   * @returns Human-readable summary
   */
  private buildSummary(issues: SemanticIssue[]): string {
    if (issues.length === 0) {
      return 'No semantic issues detected. Itinerary structure is valid.';
    }

    const highSeverity = issues.filter((i) => i.severity === 'HIGH').length;
    const mediumSeverity = issues.filter((i) => i.severity === 'MEDIUM').length;
    const lowSeverity = issues.filter((i) => i.severity === 'LOW').length;

    const parts: string[] = [`Found ${issues.length} semantic issue(s):`];

    if (highSeverity > 0) {
      parts.push(`  - ${highSeverity} HIGH severity (requires immediate attention)`);
    }
    if (mediumSeverity > 0) {
      parts.push(`  - ${mediumSeverity} MEDIUM severity (should be reviewed)`);
    }
    if (lowSeverity > 0) {
      parts.push(`  - ${lowSeverity} LOW severity (minor issues)`);
    }

    // Add specific issue descriptions
    parts.push('');
    parts.push('Issues:');
    issues.forEach((issue, index) => {
      parts.push(`  ${index + 1}. [${issue.severity}] ${issue.description}`);
    });

    return parts.join('\n');
  }
}
