/**
 * Segment continuity service - detects geographic gaps in itineraries
 * @module services/segment-continuity
 */

import type {
  ActivitySegment,
  CustomSegment,
  FlightSegment,
  HotelSegment,
  MeetingSegment,
  Segment,
  TransferSegment,
} from '../domain/types/segment.js';
import type { Location } from '../domain/types/location.js';

/**
 * Type of geographic gap between segments
 */
export enum GapType {
  /** Same city, different locations (needs ground transfer) */
  LOCAL_TRANSFER = 'LOCAL_TRANSFER',
  /** Different cities in same country (needs domestic flight or long transfer) */
  DOMESTIC_GAP = 'DOMESTIC_GAP',
  /** Different countries (needs international flight) */
  INTERNATIONAL_GAP = 'INTERNATIONAL_GAP',
  /** Overnight gap (no direct transfer needed - travelers likely at hotel) */
  OVERNIGHT_GAP = 'OVERNIGHT_GAP',
  /** Unknown gap type (insufficient location data) */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Geographic gap between two segments
 */
export interface LocationGap {
  /** Index of segment before gap */
  beforeIndex: number;
  /** Index of segment after gap */
  afterIndex: number;
  /** Segment before gap */
  beforeSegment: Segment;
  /** Segment after gap */
  afterSegment: Segment;
  /** End location of before segment */
  endLocation: Location | null;
  /** Start location of after segment */
  startLocation: Location | null;
  /** Type of gap detected */
  gapType: GapType;
  /** Human-readable description of gap */
  description: string;
  /** Suggested segment type to fill gap */
  suggestedType: 'FLIGHT' | 'TRANSFER';
  /** Confidence score (0-100) for gap-filling recommendation */
  confidence: number;
}

/**
 * Service for detecting geographic discontinuities between segments
 */
export class SegmentContinuityService {
  /**
   * Get the starting geographic location for any segment type
   * @param segment - Segment to extract start location from
   * @returns Start location or null if not applicable
   */
  getStartLocation(segment: Segment): Location | null {
    switch (segment.type) {
      case 'FLIGHT':
        return (segment as FlightSegment).origin;

      case 'TRANSFER':
        return (segment as TransferSegment).pickupLocation;

      case 'HOTEL':
        return (segment as HotelSegment).location;

      case 'ACTIVITY':
        return (segment as ActivitySegment).location;

      case 'MEETING':
        return (segment as MeetingSegment).location;

      case 'CUSTOM':
        return (segment as CustomSegment).location ?? null;

      default:
        return null;
    }
  }

  /**
   * Get the ending geographic location for any segment type
   * @param segment - Segment to extract end location from
   * @returns End location or null if not applicable
   */
  getEndLocation(segment: Segment): Location | null {
    switch (segment.type) {
      case 'FLIGHT':
        return (segment as FlightSegment).destination;

      case 'TRANSFER':
        return (segment as TransferSegment).dropoffLocation;

      case 'HOTEL':
        // Hotel stays end at the same location they start
        return (segment as HotelSegment).location;

      case 'ACTIVITY':
        // Activities end at the same location they start
        return (segment as ActivitySegment).location;

      case 'MEETING':
        // Meetings end at the same location they start
        return (segment as MeetingSegment).location;

      case 'CUSTOM':
        return (segment as CustomSegment).location ?? null;

      default:
        return null;
    }
  }

  /**
   * Check if a segment is a transfer-type segment that connects two locations
   * @param segment - Segment to check
   * @returns True if segment is a transfer, flight, or other connecting segment
   */
  private isTransferSegment(segment: Segment): boolean {
    // FLIGHT and TRANSFER segments explicitly connect two locations
    if (segment.type === 'FLIGHT' || segment.type === 'TRANSFER') {
      return true;
    }

    // Check if segment has both origin/destination or pickup/dropoff
    const startLocation = this.getStartLocation(segment);
    const endLocation = this.getEndLocation(segment);

    // If start and end locations are different, it's a connecting segment
    if (startLocation && endLocation && !this.isSameLocation(startLocation, endLocation)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a segment involves an airport (for travel day detection)
   * @param segment - Segment to check
   * @returns True if segment involves airport pickup or dropoff
   */
  private isAirportSegment(segment: Segment): boolean {
    if (segment.type === 'FLIGHT') {
      return true;
    }

    if (segment.type === 'TRANSFER') {
      const transfer = segment as TransferSegment;
      const pickupIsAirport = Boolean(transfer.pickupLocation?.code) ||
        (transfer.pickupLocation?.name?.toLowerCase().includes('airport') ?? false);
      const dropoffIsAirport = Boolean(transfer.dropoffLocation?.code) ||
        (transfer.dropoffLocation?.name?.toLowerCase().includes('airport') ?? false);
      return pickupIsAirport || dropoffIsAirport;
    }

    return false;
  }

  /**
   * Calculate confidence score for gap-filling recommendation
   * @param gap - Gap information
   * @param prevSegment - Segment before gap
   * @param nextSegment - Segment after gap
   * @returns Confidence score (0-100)
   */
  private calculateGapConfidence(
    gapType: GapType,
    prevSegment: Segment,
    nextSegment: Segment
  ): number {
    const prevIsAirport = this.isAirportSegment(prevSegment);
    const nextIsAirport = this.isAirportSegment(nextSegment);
    const prevIsHotel = prevSegment.type === 'HOTEL';
    const nextIsHotel = nextSegment.type === 'HOTEL';

    // HIGH confidence (90%+): Airport-to-airport international/domestic gaps
    // These are clear flights needed (e.g., JFK → MXP)
    if (prevIsAirport && nextIsAirport) {
      if (gapType === GapType.INTERNATIONAL_GAP || gapType === GapType.DOMESTIC_GAP) {
        return 95; // Airport → Airport across cities/countries (definite flight)
      }
    }

    // HIGH confidence (90%+): Airport transfers are obvious and necessary
    if (prevIsAirport && (nextIsHotel || nextSegment.type === 'ACTIVITY')) {
      return 95; // Flight arrival -> Hotel/Activity (obvious transfer needed)
    }
    if (nextIsAirport && (prevIsHotel || prevSegment.type === 'ACTIVITY')) {
      return 95; // Hotel/Activity -> Flight departure (obvious transfer needed)
    }

    // HIGH confidence (90%+): Hotel-to-hotel transitions across cities/countries
    // These are clear travel days requiring flights or long-distance transfers
    if (prevIsHotel && nextIsHotel) {
      if (gapType === GapType.INTERNATIONAL_GAP || gapType === GapType.DOMESTIC_GAP) {
        return 90; // Hotel checkout -> Hotel checkin in different city (clear travel day)
      }
    }

    // MEDIUM-HIGH confidence (85%): Hotel transitions with activities
    if (prevIsHotel && !nextIsHotel && !nextIsAirport) {
      return 85; // Hotel checkout -> Activity (likely needs transfer)
    }
    if (nextIsHotel && !prevIsHotel && !prevIsAirport) {
      return 85; // Activity -> Hotel checkin (likely needs transfer)
    }

    // MEDIUM confidence (80%): Same-city activity-to-activity
    if (gapType === GapType.LOCAL_TRANSFER) {
      return 80; // Same city, different locations (reasonable transfer)
    }

    // LOW confidence (60%): Cross-city gaps between activities
    if (gapType === GapType.DOMESTIC_GAP || gapType === GapType.INTERNATIONAL_GAP) {
      return 60; // May need flight but could be handled differently
    }

    // VERY LOW confidence: Unknown or overnight gaps
    return 50;
  }

  /**
   * Check if the time gap between two segments represents an overnight gap
   * Overnight gaps should not create direct transfers (e.g., no taxi from dinner to next-day lunch)
   * @param segment1EndTime - End time of first segment
   * @param segment2StartTime - Start time of second segment
   * @returns True if gap is overnight (evening activity to next-day morning/afternoon activity)
   */
  private isOvernightGap(segment1EndTime: Date, segment2StartTime: Date): boolean {
    // Calculate time difference in hours
    const hoursDiff = (segment2StartTime.getTime() - segment1EndTime.getTime()) / (1000 * 60 * 60);

    // Same day but unusually long gap (>8 hours)
    // This catches edge cases like all-day gaps on same day
    if (hoursDiff > 8) {
      return true;
    }

    // Check calendar day boundary
    const date1 = segment1EndTime.toDateString();
    const date2 = segment2StartTime.toDateString();

    if (date1 !== date2) {
      // Different days - check if it's a reasonable overnight scenario
      // This specifically targets evening->morning patterns
      const endHour = segment1EndTime.getHours();
      const startHour = segment2StartTime.getHours();

      // Evening activity (after 6PM) ending, morning/midday activity (before 3PM) starting
      // Examples:
      // - Dinner at 9PM -> Lunch at 12PM next day (YES - overnight)
      // - Hotel checkout at 11AM -> Hotel checkin at 3PM next day (NO - travel day)
      if (endHour >= 18 && startHour <= 15) {
        return true;
      }

      // Very late evening (after 9PM) to any time next day before afternoon
      // This is clearly overnight
      if (endHour >= 21 && startHour <= 14) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect geographic gaps between consecutive segments
   * @param segments - Array of segments in chronological order
   * @returns Array of detected gaps
   */
  detectLocationGaps(segments: Segment[]): LocationGap[] {
    const gaps: LocationGap[] = [];

    for (let i = 0; i < segments.length - 1; i++) {
      const currentSegment = segments[i];
      const nextSegment = segments[i + 1];

      if (!currentSegment || !nextSegment) {
        continue;
      }

      // Check for overnight gaps BEFORE location checking
      // Overnight gaps should not create direct transfers between activities
      // BUT hotel-to-hotel transitions and travel days should still create gaps
      const isHotelTransition =
        currentSegment.type === 'HOTEL' || nextSegment.type === 'HOTEL';

      const isAirportTransition =
        this.isAirportSegment(currentSegment) || this.isAirportSegment(nextSegment);

      // Skip overnight gaps for non-travel segments
      // (e.g., dinner to next-day lunch = no direct transfer needed)
      if (!isHotelTransition && !isAirportTransition && this.isOvernightGap(currentSegment.endDatetime, nextSegment.startDatetime)) {
        // Skip overnight gaps between activities - travelers are likely at hotel
        continue;
      }

      const endLocation = this.getEndLocation(currentSegment);
      const startLocation = this.getStartLocation(nextSegment);

      // If either location is missing, we can't determine continuity
      if (!endLocation || !startLocation) {
        continue;
      }

      // Check if locations are different (case-insensitive comparison)
      const locationsDiffer = !this.isSameLocation(endLocation, startLocation);

      if (locationsDiffer) {
        // Skip if the current segment is already a transfer that drops off at the next segment's start
        // This prevents creating consecutive transfers
        if (this.isTransferSegment(currentSegment)) {
          const currentSegmentEnd = this.getEndLocation(currentSegment);

          // If current transfer drops off at (or near) next segment's start, no gap
          if (currentSegmentEnd && this.isSameLocation(currentSegmentEnd, startLocation)) {
            continue; // Transfer already connects to next segment
          }
        }

        // Also skip if the next segment is a transfer that picks up from current segment's end
        if (this.isTransferSegment(nextSegment)) {
          const nextSegmentStart = this.getStartLocation(nextSegment);

          // If next transfer picks up from current segment's end, no gap
          if (nextSegmentStart && this.isSameLocation(endLocation, nextSegmentStart)) {
            continue; // Transfer already handles this transition
          }
        }

        const gapType = this.classifyGap(endLocation, startLocation);
        const confidence = this.calculateGapConfidence(gapType, currentSegment, nextSegment);

        // Only create gap if confidence >= 80%
        if (confidence >= 80) {
          const gap: LocationGap = {
            beforeIndex: i,
            afterIndex: i + 1,
            beforeSegment: currentSegment,
            afterSegment: nextSegment,
            endLocation,
            startLocation,
            gapType,
            description: this.describeGap(endLocation, startLocation, gapType),
            suggestedType: this.suggestSegmentType(gapType),
            confidence,
          };
          gaps.push(gap);
        }
      }
    }

    return gaps;
  }

  /**
   * Classify the type of gap between two locations
   * @param endLoc - End location of previous segment
   * @param startLoc - Start location of next segment
   * @returns Gap classification
   */
  classifyGap(endLoc: Location, startLoc: Location): GapType {
    // Check for country information
    const endCountry = endLoc.address?.country || this.inferCountryFromCode(endLoc.code);
    const startCountry = startLoc.address?.country || this.inferCountryFromCode(startLoc.code);

    // Check cities regardless of country info
    const endCity = this.normalizeCity(
      endLoc.city || endLoc.address?.city || endLoc.name
    );
    const startCity = this.normalizeCity(
      startLoc.city || startLoc.address?.city || startLoc.name
    );

    // If both have the same city, it's a local transfer (even without country info)
    if (endCity && startCity && endCity === startCity) {
      return GapType.LOCAL_TRANSFER;
    }

    // If we can't determine countries but have different cities, return UNKNOWN
    if (!endCountry || !startCountry) {
      // If we have city info and they're different, it could be domestic or international
      // Return UNKNOWN to be safe
      return GapType.UNKNOWN;
    }

    // Different countries = international gap
    if (endCountry.toUpperCase() !== startCountry.toUpperCase()) {
      return GapType.INTERNATIONAL_GAP;
    }

    // Same country, different cities = domestic gap
    if (endCity !== startCity) {
      return GapType.DOMESTIC_GAP;
    }

    // Same city = local transfer
    return GapType.LOCAL_TRANSFER;
  }

  /**
   * Check if two locations represent the same place
   * @param loc1 - First location
   * @param loc2 - Second location
   * @returns True if locations are considered the same
   */
  private isSameLocation(loc1: Location, loc2: Location): boolean {
    // Check airport codes first (most reliable for airports)
    if (loc1.code && loc2.code) {
      // If both have codes and they differ, definitely different locations
      if (loc1.code.toUpperCase() !== loc2.code.toUpperCase()) {
        return false;
      }
      // Same code = same location
      return true;
    }

    // If one has a code and the other doesn't, continue to name-based matching
    // (don't immediately reject - one might just have incomplete data)

    // Check coordinate proximity if both locations have coordinates
    if (this.areCoordinatesClose(loc1, loc2)) {
      return true;
    }

    // Check if location A's address matches location B's name (hotel name vs address)
    if (this.isAddressMatch(loc1, loc2)) {
      return true;
    }

    // Check location names (normalized)
    const name1 = this.normalizeLocationName(loc1.name);
    const name2 = this.normalizeLocationName(loc2.name);

    if (name1 === name2) {
      return true;
    }

    // Check if one name contains the other (e.g., "Four Seasons" in "Four Seasons Resort Oahu")
    if (name1.length > 5 && name2.length > 5) {
      if (name1.includes(name2) || name2.includes(name1)) {
        return true;
      }
    }

    // Check for fuzzy word similarity (e.g., "King George Hotel" ~ "George Hotel")
    if (this.haveSimilarWords(name1, name2)) {
      return true;
    }

    // Default to different locations - safer than false positives
    return false;
  }

  /**
   * Check if two locations have coordinates that are very close (within ~100 meters)
   * @param loc1 - First location
   * @param loc2 - Second location
   * @returns True if coordinates are within proximity threshold
   */
  private areCoordinatesClose(loc1: Location, loc2: Location): boolean {
    const coords1 = loc1.coordinates;
    const coords2 = loc2.coordinates;

    if (!coords1 || !coords2) {
      return false;
    }

    const lat1 = coords1.latitude;
    const lon1 = coords1.longitude;
    const lat2 = coords2.latitude;
    const lon2 = coords2.longitude;

    // Haversine formula for distance between two coordinates
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters

    // Consider same location if within 100 meters
    return distance <= 100;
  }

  /**
   * Check if one location's address field matches the other location's name
   * This handles cases like "King George Hotel" vs "3 Vasileos Georgiou A' St"
   * @param loc1 - First location
   * @param loc2 - Second location
   * @returns True if address field of one matches name of other
   */
  private isAddressMatch(loc1: Location, loc2: Location): boolean {
    // Check if loc1's street address matches loc2's name
    if (loc1.address?.street) {
      const address1 = this.normalizeLocationName(loc1.address.street);
      const name2 = this.normalizeLocationName(loc2.name);
      if (address1 === name2) {
        return true;
      }
    }

    // Check if loc2's street address matches loc1's name
    if (loc2.address?.street) {
      const address2 = this.normalizeLocationName(loc2.address.street);
      const name1 = this.normalizeLocationName(loc1.name);
      if (address2 === name1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if two normalized names have significant word overlap using fuzzy matching
   * @param name1 - First normalized name
   * @param name2 - Second normalized name
   * @returns True if >70% of significant words overlap
   */
  private haveSimilarWords(name1: string, name2: string): boolean {
    const stopWords = new Set([
      'the', 'at', 'in', 'on', 'of', 'and', 'a', 'an', 'to', 'for',
      'resort', 'hotel', 'inn', 'suites', 'lodge', 'airport', 'international',
      'st', 'ave', 'blvd', 'rd', 'street', 'avenue', 'boulevard', 'road',
      'drive', 'lane', 'way', 'place', 'collection', 'luxury',
    ]);

    // Extract significant words (length > 2, not stop words)
    const words1 = name1
      .split(/[\s,]+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
    const words2 = name2
      .split(/[\s,]+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    if (words1.length === 0 || words2.length === 0) {
      return false;
    }

    // Count matching words (using fuzzy matching)
    let matchCount = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (this.areWordsSimilar(word1, word2)) {
          matchCount++;
          break; // Only count each word1 once
        }
      }
    }

    // Calculate overlap percentage (based on smaller set)
    const minWordCount = Math.min(words1.length, words2.length);
    const overlapPercentage = matchCount / minWordCount;

    // Require >70% overlap
    return overlapPercentage > 0.7;
  }

  /**
   * Check if two words are similar using Levenshtein distance
   * @param word1 - First word
   * @param word2 - Second word
   * @returns True if words are similar (exact match or edit distance <= 2)
   */
  private areWordsSimilar(word1: string, word2: string): boolean {
    // Exact match
    if (word1 === word2) {
      return true;
    }

    // One contains the other (e.g., "george" in "georgiou")
    if (word1.includes(word2) || word2.includes(word1)) {
      return true;
    }

    // Use Levenshtein distance for fuzzy matching
    const distance = this.levenshteinDistance(word1, word2);

    // Allow edit distance of up to 2 for words > 5 chars
    // (handles typos and minor variations)
    if (word1.length > 5 || word2.length > 5) {
      return distance <= 2;
    }

    // For shorter words, require exact match or edit distance of 1
    return distance <= 1;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Edit distance between strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create a 2D array for dynamic programming
    const matrix: number[][] = Array.from({ length: len1 + 1 }, () =>
      Array(len2 + 1).fill(0)
    );

    // Initialize first column and row
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // Deletion
          matrix[i][j - 1] + 1, // Insertion
          matrix[i - 1][j - 1] + cost // Substitution
        );
      }
    }

    return matrix[len1][len2];
  }


  /**
   * Normalize location name for comparison
   * @param name - Location name
   * @returns Normalized name
   */
  private normalizeLocationName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  /**
   * Normalize city name for comparison
   * @param city - City name
   * @returns Normalized city name
   */
  private normalizeCity(city: string): string {
    // Remove common suffixes and normalize
    return city
      .toLowerCase()
      .trim()
      .replace(/\s+(airport|international|city|municipal)$/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  /**
   * Infer country from airport or location code
   * @param code - IATA airport code or location code
   * @returns Inferred country code or null
   */
  private inferCountryFromCode(code?: string): string | null {
    if (!code || code.length !== 3) {
      return null;
    }

    // This is a simplified mapping - in production, use a comprehensive IATA code database
    const codeToCountry: Record<string, string> = {
      // USA airports
      JFK: 'US',
      LAX: 'US',
      ORD: 'US',
      ATL: 'US',
      DFW: 'US',
      SFO: 'US',
      EWR: 'US',
      PHL: 'US',
      BOS: 'US',
      // Italy airports
      MXP: 'IT', // Milan Malpensa
      LIN: 'IT', // Milan Linate
      FCO: 'IT', // Rome Fiumicino
      CIA: 'IT', // Rome Ciampino
      VCE: 'IT', // Venice
      // UK airports
      LHR: 'GB',
      LGW: 'GB',
      // France airports
      CDG: 'FR',
      ORY: 'FR',
      // Add more as needed
    };

    return codeToCountry[code.toUpperCase()] ?? null;
  }

  /**
   * Describe a gap in human-readable format
   * @param endLoc - End location
   * @param startLoc - Start location
   * @param gapType - Gap classification
   * @returns Human-readable description
   */
  private describeGap(endLoc: Location, startLoc: Location, gapType: GapType): string {
    const endName = this.getDisplayName(endLoc);
    const startName = this.getDisplayName(startLoc);

    switch (gapType) {
      case GapType.LOCAL_TRANSFER:
        return `Local transfer needed from ${endName} to ${startName}`;
      case GapType.DOMESTIC_GAP:
        return `Domestic transportation needed from ${endName} to ${startName}`;
      case GapType.INTERNATIONAL_GAP:
        return `International flight needed from ${endName} to ${startName}`;
      case GapType.OVERNIGHT_GAP:
        return `Overnight gap between ${endName} and ${startName} (no direct transfer needed)`;
      case GapType.UNKNOWN:
        return `Transportation gap between ${endName} and ${startName}`;
      default:
        return `Gap detected between ${endName} and ${startName}`;
    }
  }

  /**
   * Get display name for a location
   * @param loc - Location
   * @returns Display name (with code if available)
   */
  private getDisplayName(loc: Location): string {
    if (loc.code) {
      return `${loc.name} (${loc.code})`;
    }
    if (loc.address?.city) {
      return `${loc.name}, ${loc.address.city}`;
    }
    return loc.name;
  }

  /**
   * Suggest segment type to fill a gap
   * @param gapType - Type of gap
   * @returns Suggested segment type
   */
  private suggestSegmentType(gapType: GapType): 'FLIGHT' | 'TRANSFER' {
    switch (gapType) {
      case GapType.LOCAL_TRANSFER:
        return 'TRANSFER';
      case GapType.DOMESTIC_GAP:
      case GapType.INTERNATIONAL_GAP:
        return 'FLIGHT';
      default:
        return 'TRANSFER'; // Conservative default
    }
  }

  /**
   * Sort segments chronologically
   * @param segments - Array of segments
   * @returns Sorted array
   */
  sortSegments(segments: Segment[]): Segment[] {
    return [...segments].sort((a, b) => {
      return a.startDatetime.getTime() - b.startDatetime.getTime();
    });
  }
}
