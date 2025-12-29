/**
 * Trip Matching Service
 * Intelligently matches imported segments with existing itineraries
 * @module services/import/trip-matcher
 */

import type { Itinerary } from '../../domain/types/itinerary.js';
import type { ItinerarySummary } from '../../storage/storage.interface.js';
import type { ExtractedSegment } from './types.js';

/**
 * A potential trip match with scoring
 */
export interface TripMatch {
  /** Itinerary ID */
  itineraryId: string;
  /** Itinerary name/title */
  itineraryName: string;
  /** Primary destination */
  destination: string;
  /** Trip date range */
  dateRange: { start: string; end: string };
  /** Overall match score (0-1) */
  matchScore: number;
  /** Detailed reasons for the match */
  matchReasons: string[];
}

/**
 * Result of trip matching operation
 */
export interface MatchResult {
  /** All potential matches, sorted by score (best first) */
  matches: TripMatch[];
  /** Suggested action based on best match */
  suggestedAction: 'add_to_existing' | 'create_new' | 'ask_user';
  /** Confidence in the suggested action (0-1) */
  confidence: number;
}

/**
 * Date overlap calculation result
 */
interface DateOverlap {
  /** Percentage of overlap (0-1) */
  overlapPercent: number;
  /** Days of overlap */
  overlapDays: number;
  /** Whether dates are adjacent (within 2 days) */
  isAdjacent: boolean;
}

/**
 * Trip Matcher Service
 * Matches imported segments with existing trips using date and location analysis
 */
export class TripMatcher {
  // Scoring weights
  private static readonly DATE_WEIGHT = 0.6;
  private static readonly LOCATION_WEIGHT = 0.4;

  // Thresholds
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 0.7;
  private static readonly LOW_CONFIDENCE_THRESHOLD = 0.3;
  private static readonly ADJACENT_DAYS_THRESHOLD = 2;

  /**
   * Find matching trips for imported segments
   * @param segments - Segments to match
   * @param existingTrips - Existing itineraries to match against
   * @returns Match result with suggested action
   */
  async findMatches(
    segments: ExtractedSegment[],
    existingTrips: ItinerarySummary[]
  ): Promise<MatchResult> {
    // If no existing trips, suggest creating new
    if (existingTrips.length === 0) {
      return {
        matches: [],
        suggestedAction: 'create_new',
        confidence: 1.0,
      };
    }

    // Calculate match scores for all trips
    const matches: TripMatch[] = [];

    for (const trip of existingTrips) {
      const match = this.scoreTrip(segments, trip);
      if (match.matchScore > 0) {
        matches.push(match);
      }
    }

    // Sort by score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Determine suggested action based on best match
    const bestMatch = matches[0];
    let suggestedAction: 'add_to_existing' | 'create_new' | 'ask_user';
    let confidence: number;

    if (!bestMatch || bestMatch.matchScore < TripMatcher.LOW_CONFIDENCE_THRESHOLD) {
      // No good match - suggest creating new trip
      suggestedAction = 'create_new';
      confidence = 1.0 - (bestMatch?.matchScore ?? 0);
    } else if (bestMatch.matchScore >= TripMatcher.HIGH_CONFIDENCE_THRESHOLD) {
      // High confidence match - suggest adding to existing
      suggestedAction = 'add_to_existing';
      confidence = bestMatch.matchScore;
    } else {
      // Medium confidence - ask user to confirm
      suggestedAction = 'ask_user';
      confidence = 0.5;
    }

    return {
      matches,
      suggestedAction,
      confidence,
    };
  }

  /**
   * Score a single trip against imported segments
   */
  private scoreTrip(segments: ExtractedSegment[], trip: ItinerarySummary): TripMatch {
    const reasons: string[] = [];
    let dateScore = 0;
    let locationScore = 0;

    // Extract segment date range
    const segmentDates = this.extractDateRange(segments);
    if (!segmentDates) {
      // No valid dates in segments - can't match
      return {
        itineraryId: trip.id,
        itineraryName: trip.title,
        destination: 'Unknown',
        dateRange: this.formatDateRange(trip.startDate, trip.endDate),
        matchScore: 0,
        matchReasons: ['No valid dates in imported segments'],
      };
    }

    // Calculate date overlap if trip has dates
    if (trip.startDate && trip.endDate) {
      const overlap = this.calculateDateOverlap(
        segmentDates.start,
        segmentDates.end,
        trip.startDate,
        trip.endDate
      );

      if (overlap.overlapPercent > 0) {
        dateScore = overlap.overlapPercent;
        reasons.push(
          `Date overlap: ${Math.round(overlap.overlapPercent * 100)}% (${overlap.overlapDays} days)`
        );
      } else if (overlap.isAdjacent) {
        dateScore = 0.3; // Low score for adjacent dates
        reasons.push('Dates are adjacent (within 2 days)');
      } else {
        reasons.push('No date overlap');
      }
    } else {
      // Trip has no dates - can't match on dates
      reasons.push('Trip has no dates set');
    }

    // Calculate location match
    const locations = this.extractLocations(segments);
    if (locations.length > 0) {
      // For now, use simple string matching
      // In a full implementation, this would use geocoding/fuzzy matching
      const tripDestination = trip.title.toLowerCase();

      for (const location of locations) {
        const loc = location.toLowerCase();
        if (tripDestination.includes(loc)) {
          locationScore = 0.4; // Exact match
          reasons.push(`Destination match: ${location}`);
          break;
        }
      }
    }

    // Calculate overall score
    const matchScore =
      dateScore * TripMatcher.DATE_WEIGHT + locationScore * TripMatcher.LOCATION_WEIGHT;

    return {
      itineraryId: trip.id,
      itineraryName: trip.title,
      destination: trip.title, // Use title as destination for now
      dateRange: this.formatDateRange(trip.startDate, trip.endDate),
      matchScore,
      matchReasons: reasons,
    };
  }

  /**
   * Calculate date overlap between two date ranges
   */
  private calculateDateOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): DateOverlap {
    // Convert to milliseconds for calculation
    const start1Ms = start1.getTime();
    const end1Ms = end1.getTime();
    const start2Ms = start2.getTime();
    const end2Ms = end2.getTime();

    // Calculate overlap
    const overlapStart = Math.max(start1Ms, start2Ms);
    const overlapEnd = Math.min(end1Ms, end2Ms);

    if (overlapStart < overlapEnd) {
      // There is overlap
      const overlapMs = overlapEnd - overlapStart;
      const totalMs = end1Ms - start1Ms;
      const overlapDays = Math.ceil(overlapMs / (1000 * 60 * 60 * 24));
      const overlapPercent = overlapMs / totalMs;

      return {
        overlapPercent,
        overlapDays,
        isAdjacent: false,
      };
    }

    // No overlap - check if adjacent
    const dayMs = 1000 * 60 * 60 * 24;
    const gapMs = Math.min(Math.abs(end1Ms - start2Ms), Math.abs(end2Ms - start1Ms));
    const gapDays = gapMs / dayMs;

    return {
      overlapPercent: 0,
      overlapDays: 0,
      isAdjacent: gapDays <= TripMatcher.ADJACENT_DAYS_THRESHOLD,
    };
  }

  /**
   * Extract date range from segments
   */
  private extractDateRange(
    segments: ExtractedSegment[]
  ): { start: Date; end: Date } | null {
    if (segments.length === 0) return null;

    const dates = segments.flatMap((s) => [s.startDatetime, s.endDatetime]);
    const validDates = dates.filter((d): d is Date => d instanceof Date);

    if (validDates.length === 0) return null;

    return {
      start: new Date(Math.min(...validDates.map((d) => d.getTime()))),
      end: new Date(Math.max(...validDates.map((d) => d.getTime()))),
    };
  }

  /**
   * Extract location names from segments
   */
  private extractLocations(segments: ExtractedSegment[]): string[] {
    const locations = new Set<string>();

    for (const segment of segments) {
      // Extract locations based on segment type
      if ('destination' in segment && segment.destination) {
        const dest = segment.destination as any;
        if (dest.city) locations.add(dest.city);
        if (dest.country) locations.add(dest.country);
      }

      if ('origin' in segment && segment.origin) {
        const orig = segment.origin as any;
        if (orig.city) locations.add(orig.city);
        if (orig.country) locations.add(orig.country);
      }

      if ('location' in segment && segment.location) {
        const loc = segment.location as any;
        if (loc.city) locations.add(loc.city);
        if (loc.country) locations.add(loc.country);
      }

      if ('pickupLocation' in segment && segment.pickupLocation) {
        const pickup = segment.pickupLocation as any;
        if (pickup.city) locations.add(pickup.city);
      }

      if ('dropoffLocation' in segment && segment.dropoffLocation) {
        const dropoff = segment.dropoffLocation as any;
        if (dropoff.city) locations.add(dropoff.city);
      }
    }

    return Array.from(locations);
  }

  /**
   * Format date range for display
   */
  private formatDateRange(start?: Date, end?: Date): { start: string; end: string } {
    return {
      start: start ? start.toISOString().split('T')[0] : 'Not set',
      end: end ? end.toISOString().split('T')[0] : 'Not set',
    };
  }

  /**
   * Find a match by itinerary ID
   */
  findMatchById(matches: TripMatch[], itineraryId: string): TripMatch | undefined {
    return matches.find((m) => m.itineraryId === itineraryId);
  }
}
