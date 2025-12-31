/**
 * Itinerary summarizer - generates concise text summaries for context injection
 * @module services/trip-designer/itinerary-summarizer
 */

import type { Itinerary } from '../../domain/types/itinerary.js';
import type { Segment } from '../../domain/types/segment.js';

/**
 * Format date as readable string (e.g., "Jan 15, 2025")
 * Uses UTC to avoid timezone conversion issues
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Format date range (e.g., "Jan 15-22, 2025")
 * Uses UTC to avoid timezone conversion issues
 */
function formatDateRange(start: Date, end: Date): string {
  const startDate = formatDate(start);
  const endDate = formatDate(end);

  // If same month/year, abbreviate (use UTC methods)
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })} ${start.getUTCDate()}-${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  }

  return `${startDate} - ${endDate}`;
}

/**
 * Calculate trip duration in days
 */
function calculateDuration(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Group segments by type and count them
 */
function summarizeSegments(segments: Segment[]): {
  flights: number;
  hotels: number;
  activities: number;
  other: number;
} {
  const summary = { flights: 0, hotels: 0, activities: 0, other: 0 };

  for (const segment of segments) {
    switch (segment.type) {
      case 'FLIGHT':
        summary.flights++;
        break;
      case 'HOTEL':
        summary.hotels++;
        break;
      case 'ACTIVITY':
        summary.activities++;
        break;
      default:
        summary.other++;
    }
  }

  return summary;
}

/**
 * Format segment counts as readable string
 */
function formatSegmentCounts(counts: ReturnType<typeof summarizeSegments>): string {
  const parts: string[] = [];

  if (counts.flights > 0) parts.push(`${counts.flights} flight${counts.flights > 1 ? 's' : ''}`);
  if (counts.hotels > 0) parts.push(`${counts.hotels} hotel${counts.hotels > 1 ? 's' : ''}`);
  if (counts.activities > 0) parts.push(`${counts.activities} activit${counts.activities > 1 ? 'ies' : 'y'}`);
  if (counts.other > 0) parts.push(`${counts.other} other segment${counts.other > 1 ? 's' : ''}`);

  return parts.join(', ');
}

/**
 * Format traveler preferences as readable string
 */
function formatPreferences(itinerary: Itinerary): string[] {
  const prefs: string[] = [];
  const tripPrefs = itinerary.tripPreferences;

  if (!tripPrefs) return prefs;

  // Travel style and pace
  if (tripPrefs.travelStyle && tripPrefs.pace) {
    prefs.push(`Style: ${tripPrefs.travelStyle} budget, ${tripPrefs.pace} pace`);
  } else if (tripPrefs.travelStyle) {
    prefs.push(`Style: ${tripPrefs.travelStyle} budget`);
  } else if (tripPrefs.pace) {
    prefs.push(`Pace: ${tripPrefs.pace}`);
  }

  // Interests
  if (tripPrefs.interests && tripPrefs.interests.length > 0) {
    prefs.push(`Interests: ${tripPrefs.interests.join(', ')}`);
  }

  // Origin
  if (tripPrefs.origin) {
    prefs.push(`Traveling from: ${tripPrefs.origin}`);
  }

  // Dietary restrictions
  if (tripPrefs.dietaryRestrictions) {
    prefs.push(`Diet: ${tripPrefs.dietaryRestrictions}`);
  }

  // Mobility restrictions
  if (tripPrefs.mobilityRestrictions) {
    prefs.push(`Mobility: ${tripPrefs.mobilityRestrictions}`);
  }

  // Accommodation preferences
  if (tripPrefs.accommodationPreference) {
    prefs.push(`Accommodation: ${tripPrefs.accommodationPreference}`);
  }

  // Budget flexibility
  if (tripPrefs.budgetFlexibility !== undefined) {
    const flexibility = ['very strict', 'strict', 'moderate', 'flexible', 'very flexible'][tripPrefs.budgetFlexibility - 1] || 'moderate';
    prefs.push(`Budget flexibility: ${flexibility}`);
  }

  return prefs;
}

/**
 * Summarize segments with brief details
 */
function summarizeSegmentDetails(segments: Segment[], maxCount: number = 8): string[] {
  const details: string[] = [];

  for (let i = 0; i < Math.min(segments.length, maxCount); i++) {
    const seg = segments[i];
    const date = formatDate(new Date(seg.startDatetime));

    switch (seg.type) {
      case 'FLIGHT':
        details.push(`- Flight: ${date}${seg.metadata?.route ? ` (${seg.metadata.route})` : ''}`);
        break;
      case 'HOTEL': {
        const nights = (seg.metadata?.nights as number | undefined) || 1;
        details.push(`- Hotel: ${date} (${nights} night${nights > 1 ? 's' : ''}${seg.metadata?.name ? `, ${seg.metadata.name}` : ''})`);
        break;
      }
      case 'ACTIVITY':
        details.push(`- Activity: ${date}${seg.metadata?.name ? ` - ${seg.metadata.name}` : ''}`);
        break;
      default:
        details.push(`- ${seg.type}: ${date}`);
    }
  }

  if (segments.length > maxCount) {
    details.push(`  ... and ${segments.length - maxCount} more segment${segments.length - maxCount > 1 ? 's' : ''}`);
  }

  return details;
}

/**
 * Infer hotel tier from hotel name
 * Used to help AI recognize luxury properties
 */
function inferHotelTier(hotelName: string): string {
  const luxury = [
    'l\'esplanade', 'four seasons', 'ritz', 'st. regis', 'aman', 'belmond',
    'peninsula', 'mandarin oriental', 'rosewood', 'park hyatt', 'bulgari',
    'eden roc', 'cheval blanc', 'raffles', 'six senses', 'one&only',
    'the berkeley', 'claridge\'s', 'dorchester', 'savoy'
  ];
  const moderate = [
    'marriott', 'hilton', 'hyatt', 'sheraton', 'westin', 'holiday inn',
    'courtyard', 'hampton', 'doubletree', 'intercontinental'
  ];

  const nameLower = hotelName.toLowerCase();
  if (luxury.some(l => nameLower.includes(l))) return 'LUXURY';
  if (moderate.some(m => nameLower.includes(m))) return 'MODERATE';
  return 'STANDARD';
}

/**
 * Infer travel style from flight cabin class
 */
function inferFlightTier(cabinClass: string): string {
  const cabinLower = cabinClass.toLowerCase();
  if (cabinLower.includes('first') || cabinLower.includes('suite')) return 'LUXURY';
  if (cabinLower.includes('business') || cabinLower.includes('premium')) return 'PREMIUM';
  return 'ECONOMY';
}

/**
 * Extract destinations from flight and hotel segments
 * Used as fallback when itinerary.destinations is empty
 */
function extractDestinationsFromSegments(segments: Segment[]): string[] {
  const destinations = new Set<string>();

  for (const segment of segments) {
    // Get destination from flights
    if (segment.type === 'FLIGHT') {
      const flightSeg = segment as import('./../../domain/types/segment.js').FlightSegment;
      if (flightSeg.destination) {
        const name = flightSeg.destination.address?.city || flightSeg.destination.name || flightSeg.destination.code;
        if (name) destinations.add(name);
      }
    }
    // Get location from hotels
    if (segment.type === 'HOTEL') {
      const hotelSeg = segment as import('./../../domain/types/segment.js').HotelSegment;
      if (hotelSeg.location) {
        const name = hotelSeg.location.address?.city || hotelSeg.location.name;
        if (name) destinations.add(name);
      }
    }
  }

  return Array.from(destinations);
}

/**
 * Extract existing bookings from segments to help AI infer preferences
 * Returns prominent booking callouts with inferred travel style
 */
function formatExistingBookings(segments: Segment[]): string[] {
  const bookings: string[] = [];

  for (const seg of segments) {
    if (seg.type === 'HOTEL') {
      const hotelSeg = seg as import('./../../domain/types/segment.js').HotelSegment;
      const hotelName = hotelSeg.property?.name || 'Unknown hotel';
      const location = hotelSeg.location?.address?.city || hotelSeg.location?.name || '';
      const tier = inferHotelTier(hotelName);

      // Calculate nights if dates are available
      let nights = 1;
      if (hotelSeg.checkOutDate && hotelSeg.checkInDate) {
        nights = Math.ceil((hotelSeg.checkOutDate.getTime() - hotelSeg.checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      bookings.push(`- 🏨 HOTEL: ${hotelName}${location ? ` in ${location}` : ''} (${nights} night${nights > 1 ? 's' : ''}) → ${tier} style`);
    }
    if (seg.type === 'FLIGHT') {
      const flightSeg = seg as import('./../../domain/types/segment.js').FlightSegment;
      if (flightSeg.cabinClass) {
        const tier = inferFlightTier(flightSeg.cabinClass);
        const route = `${flightSeg.origin?.code || flightSeg.origin?.name || ''} → ${flightSeg.destination?.code || flightSeg.destination?.name || ''}`;
        bookings.push(`- ✈️ FLIGHT: ${route} (${flightSeg.cabinClass}) → ${tier} style`);
      }
    }
  }

  return bookings;
}

/**
 * Mismatch detection result
 */
export interface TitleDestinationMismatch {
  /** True if a mismatch was detected */
  hasMismatch: boolean;
  /** Location name mentioned in title (if any) */
  titleMentions: string | null;
  /** Actual primary destination from segments */
  actualDestination: string | null;
  /** Suggested corrected title */
  suggestedTitle: string | null;
  /** Explanation of the mismatch */
  explanation: string | null;
}

/**
 * Detect if the itinerary title/description mentions a different location than
 * the actual destination based on flight segments.
 *
 * Common issue: User imports confirmation from departure city email,
 * and title gets set to departure city instead of destination.
 *
 * Example:
 * - Title: "New York Winter Getaway"
 * - Flights: JFK → SXM (St. Maarten), SXM → JFK
 * - Mismatch: Title mentions New York (origin) but destination is St. Maarten
 *
 * @param itinerary - The itinerary to check
 * @returns Mismatch detection result, or null if no check could be performed
 */
export function detectTitleDestinationMismatch(itinerary: Itinerary): TitleDestinationMismatch | null {
  console.log('[Mismatch Detection] Starting mismatch detection for itinerary:', itinerary.id);
  console.log('[Mismatch Detection] Itinerary title:', itinerary.title);

  // Need at least one flight to detect destination
  const flightSegments = itinerary.segments.filter(
    (s) => s.type === 'FLIGHT'
  ) as import('./../../domain/types/segment.js').FlightSegment[];

  console.log('[Mismatch Detection] Flight segments found:', flightSegments.length);

  if (flightSegments.length === 0) {
    console.log('[Mismatch Detection] No flights - cannot detect mismatch');
    return null; // Can't determine without flights
  }

  // Sort flights by date to find first/last
  // Note: startDatetime may be a string (from JSON) or Date object
  const sortedFlights = [...flightSegments].sort((a, b) => {
    const dateA = a.startDatetime instanceof Date ? a.startDatetime : new Date(a.startDatetime);
    const dateB = b.startDatetime instanceof Date ? b.startDatetime : new Date(b.startDatetime);
    return dateA.getTime() - dateB.getTime();
  });

  const firstFlight = sortedFlights[0];
  const lastFlight = sortedFlights[sortedFlights.length - 1];

  // Extract origin and destination info
  const originCityRaw = firstFlight.origin?.address?.city || firstFlight.origin?.city || firstFlight.origin?.name;
  const originCode = firstFlight.origin?.code;
  const destinationCityRaw = firstFlight.destination?.address?.city || firstFlight.destination?.city || firstFlight.destination?.name;
  const destinationCode = firstFlight.destination?.code;

  console.log('[Mismatch Detection] Origin city raw:', originCityRaw);
  console.log('[Mismatch Detection] Origin code:', originCode);
  console.log('[Mismatch Detection] Destination city raw:', destinationCityRaw);
  console.log('[Mismatch Detection] Destination code:', destinationCode);

  if (!originCityRaw || !destinationCityRaw) {
    console.log('[Mismatch Detection] Missing city names - cannot detect mismatch');
    return null; // Can't detect without city names
  }

  // Normalize city names: remove airport codes and state/country suffixes
  // Example: "New York, NY (JFK)" → "New York"
  //          "St. Maarten (SXM)" → "St. Maarten"
  const normalizeCityName = (name: string): string => {
    // Remove airport code in parentheses (e.g., "(JFK)")
    let normalized = name.replace(/\s*\([A-Z]{3}\)\s*/g, '');
    // Remove state/country codes after comma (e.g., ", NY")
    normalized = normalized.replace(/,\s*[A-Z]{2}(?:\s|$)/g, '');
    return normalized.trim();
  };

  const originCity = normalizeCityName(originCityRaw);
  const destinationCity = normalizeCityName(destinationCityRaw);

  console.log('[Mismatch Detection] Origin city normalized:', originCity);
  console.log('[Mismatch Detection] Destination city normalized:', destinationCity);

  // Check if this is a round trip (last flight returns to origin)
  const isRoundTrip =
    lastFlight.destination?.code === originCode ||
    (lastFlight.destination?.address?.city || lastFlight.destination?.city) === originCity;

  // For round trips, the destination is the middle point (first flight's destination)
  const actualDestination = isRoundTrip ? destinationCity : destinationCity;
  const actualDestinationCode = isRoundTrip ? destinationCode : destinationCode;

  // Check if title or description mentions the origin city instead of destination
  const titleLower = itinerary.title.toLowerCase();
  const descLower = (itinerary.description || '').toLowerCase();
  const originCityLower = originCity.toLowerCase();
  const destinationCityLower = actualDestination.toLowerCase();

  console.log('[Mismatch Detection] Title (lowercase):', titleLower);
  console.log('[Mismatch Detection] Description (lowercase):', descLower);
  console.log('[Mismatch Detection] Origin city (lowercase):', originCityLower);
  console.log('[Mismatch Detection] Destination city (lowercase):', destinationCityLower);

  // Check if title/description mentions origin but NOT destination
  const mentionsOrigin =
    titleLower.includes(originCityLower) ||
    (originCode && titleLower.includes(originCode.toLowerCase())) ||
    descLower.includes(originCityLower) ||
    (originCode && descLower.includes(originCode.toLowerCase()));

  const mentionsDestination =
    titleLower.includes(destinationCityLower) ||
    (actualDestinationCode && titleLower.includes(actualDestinationCode.toLowerCase())) ||
    descLower.includes(destinationCityLower) ||
    (actualDestinationCode && descLower.includes(actualDestinationCode.toLowerCase()));

  console.log('[Mismatch Detection] Mentions origin?', mentionsOrigin);
  console.log('[Mismatch Detection] Mentions destination?', mentionsDestination);

  // Mismatch detected if mentions origin but not destination
  if (mentionsOrigin && !mentionsDestination) {
    console.log('[Mismatch Detection] ⚠️ MISMATCH DETECTED - Title mentions origin but not destination');

    // Remove origin city from title to generate suggestion
    // Handle multi-word city names by doing case-insensitive replacement
    let suggestedTitle = itinerary.title;

    // Try to remove origin city name (case-insensitive)
    const originRegex = new RegExp(originCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    suggestedTitle = suggestedTitle.replace(originRegex, '').trim();

    // Try to remove origin code if exists
    if (originCode) {
      const codeRegex = new RegExp(`\\b${originCode}\\b`, 'gi');
      suggestedTitle = suggestedTitle.replace(codeRegex, '').trim();
    }

    // Clean up extra spaces
    suggestedTitle = suggestedTitle.replace(/\s+/g, ' ').trim();

    // If we removed everything, use a generic suffix
    if (!suggestedTitle) {
      suggestedTitle = 'Trip';
    }

    // Prepend destination
    suggestedTitle = `${actualDestination} ${suggestedTitle}`;

    console.log('[Mismatch Detection] Suggested title:', suggestedTitle);

    return {
      hasMismatch: true,
      titleMentions: originCity,
      actualDestination,
      suggestedTitle,
      explanation: `Title mentions "${originCity}" (your departure city) but you're actually traveling to "${actualDestination}". This often happens when importing confirmation emails sent from the departure city.`,
    };
  }

  console.log('[Mismatch Detection] ✓ No mismatch detected');

  // No mismatch detected
  return {
    hasMismatch: false,
    titleMentions: null,
    actualDestination,
    suggestedTitle: null,
    explanation: null,
  };
}

/**
 * Generate a concise summary of the itinerary for context injection
 *
 * This summary is used in the Trip Designer system prompt when editing
 * existing itineraries, providing the agent with key context about the
 * current state of the trip.
 *
 * @param itinerary - The itinerary to summarize
 * @returns Formatted markdown summary
 */
export function summarizeItinerary(itinerary: Itinerary): string {
  const lines: string[] = [];

  // Check for title/destination mismatch FIRST
  const mismatch = detectTitleDestinationMismatch(itinerary);
  console.log('[summarizeItinerary] Title:', itinerary.title);
  console.log('[summarizeItinerary] Mismatch result:', JSON.stringify(mismatch, null, 2));

  if (mismatch?.hasMismatch) {
    lines.push('⚠️ **TITLE/DESTINATION MISMATCH DETECTED**');
    lines.push(`- Current title: "${itinerary.title}"`);
    lines.push(`- Title mentions: "${mismatch.titleMentions}" (departure city)`);
    lines.push(`- Actual destination: "${mismatch.actualDestination}"`);
    lines.push(`- Suggested title: "${mismatch.suggestedTitle}"`);
    lines.push('');
    lines.push(`**Explanation**: ${mismatch.explanation}`);
    lines.push('');
    lines.push('**ACTION REQUIRED**: You should acknowledge this mismatch and offer to update the title to correctly reflect the destination.');
    lines.push('');
  }

  // Header with title and dates
  lines.push(`**Trip**: ${itinerary.title}`);

  // Handle null/undefined dates gracefully
  if (itinerary.startDate && itinerary.endDate) {
    const duration = calculateDuration(itinerary.startDate, itinerary.endDate);
    lines.push(`**Dates**: ${formatDateRange(itinerary.startDate, itinerary.endDate)} (${duration} days)`);
  } else {
    lines.push(`**Dates**: Not specified`);
  }

  // Travelers
  const travelerCount = itinerary.travelers.length;
  if (travelerCount > 0) {
    const travelerNames = itinerary.travelers.map(t => `${t.firstName} ${t.lastName}`).join(', ');
    lines.push(`**Travelers**: ${travelerNames}`);
  } else {
    lines.push(`**Travelers**: Not specified`);
  }

  // Destinations - try array first, then extract from segments
  let destinationNames: string[] = [];
  if (itinerary.destinations && itinerary.destinations.length > 0) {
    destinationNames = itinerary.destinations
      .map(d => d.address?.city || d.name)
      .filter(Boolean);
  } else if (itinerary.segments && itinerary.segments.length > 0) {
    destinationNames = extractDestinationsFromSegments(itinerary.segments);
  }

  if (destinationNames.length > 0) {
    lines.push(`**Destinations**: ${destinationNames.join(', ')}`);
  }

  // Preferences
  const prefs = formatPreferences(itinerary);
  if (prefs.length > 0) {
    lines.push('');
    lines.push('**Preferences**:');
    for (const pref of prefs) {
      lines.push(`- ${pref}`);
    }
  }

  // Budget
  if (itinerary.totalPrice) {
    lines.push('');
    lines.push(`**Budget**: ${itinerary.totalPrice.amount} ${itinerary.totalPrice.currency}`);
  }

  // Segments summary
  if (itinerary.segments.length > 0) {
    const segmentCounts = summarizeSegments(itinerary.segments);
    const countsStr = formatSegmentCounts(segmentCounts);

    lines.push('');
    lines.push(`**Segments**: ${countsStr} (${itinerary.segments.length} total)`);

    // Show first few segments with details
    const segmentDetails = summarizeSegmentDetails(itinerary.segments);
    lines.push(...segmentDetails);

    // PROMINENT: Show existing bookings to help AI infer preferences
    const bookings = formatExistingBookings(itinerary.segments);
    if (bookings.length > 0) {
      lines.push('');
      lines.push('**⚠️ EXISTING BOOKINGS** (use to infer travel preferences):');
      for (const booking of bookings) {
        lines.push(booking);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate a minimal summary for session compression
 * Focuses on just the essential facts without formatting
 */
export function summarizeItineraryMinimal(itinerary: Itinerary): string {
  const parts: string[] = [];

  // Basic info - handle null/undefined dates gracefully
  if (itinerary.startDate && itinerary.endDate) {
    parts.push(`${itinerary.title} (${formatDateRange(itinerary.startDate, itinerary.endDate)})`);
  } else {
    parts.push(`${itinerary.title} (dates not specified)`);
  }

  // Destinations - try array first, then extract from segments
  let destinationNames: string[] = [];
  if (itinerary.destinations && itinerary.destinations.length > 0) {
    destinationNames = itinerary.destinations
      .map(d => d.address?.city || d.name)
      .filter(Boolean);
  } else if (itinerary.segments && itinerary.segments.length > 0) {
    destinationNames = extractDestinationsFromSegments(itinerary.segments);
  }

  if (destinationNames.length > 0) {
    parts.push(`Destinations: ${destinationNames.join(', ')}`);
  }

  // Segments
  if (itinerary.segments.length > 0) {
    const counts = summarizeSegments(itinerary.segments);
    parts.push(formatSegmentCounts(counts));
  }

  return parts.join(' | ');
}

/**
 * Create a compact summary for get_itinerary tool result
 * Returns minimal data to save tokens while still being useful
 */
export function summarizeItineraryForTool(itinerary: Itinerary): unknown {
  // Destinations - try array first, then extract from segments
  let destinationNames: string[] = [];
  if (itinerary.destinations && itinerary.destinations.length > 0) {
    destinationNames = itinerary.destinations
      .map(d => d.address?.city || d.name)
      .filter(Boolean);
  } else if (itinerary.segments && itinerary.segments.length > 0) {
    destinationNames = extractDestinationsFromSegments(itinerary.segments);
  }

  return {
    id: itinerary.id,
    title: itinerary.title,
    summary: summarizeItineraryMinimal(itinerary),
    dates: {
      start: itinerary.startDate,
      end: itinerary.endDate,
    },
    destinations: destinationNames,
    segmentCount: itinerary.segments?.length || 0,
    // Only include segment IDs and types for reference
    segments: itinerary.segments?.map(s => {
      const base = {
        id: s.id,
        type: s.type,
        startDatetime: s.startDatetime,
        name: s.metadata?.name || s.metadata?.route || (s as any).flightNumber || (s as any).property?.name || (s as any).name || (s as any).title || `${s.type} segment`,
      };

      // Add tier inference for hotels and flights to help AI understand travel style
      if (s.type === 'HOTEL') {
        const hotelSeg = s as import('./../../domain/types/segment.js').HotelSegment;
        return {
          ...base,
          inferred_tier: inferHotelTier(hotelSeg.property?.name || ''),
        };
      }
      if (s.type === 'FLIGHT') {
        const flightSeg = s as import('./../../domain/types/segment.js').FlightSegment;
        return {
          ...base,
          inferred_tier: flightSeg.cabinClass ? inferFlightTier(flightSeg.cabinClass) : undefined,
        };
      }

      return base;
    }) || [],
    tripPreferences: itinerary.tripPreferences || {},
    travelers: itinerary.travelers?.map(t => `${t.firstName} ${t.lastName}`) || [],
  };
}
