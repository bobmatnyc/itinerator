/**
 * Utility for generating review and booking links for segments
 * @module utils/segment-links
 */

import type { Segment } from '../domain/types/segment.js';

/**
 * Link provider information
 */
export interface SegmentLink {
  url: string;
  provider: string;
}

/**
 * Generate review/booking links for a segment based on its type
 * @param segment - The segment to generate links for
 * @returns Array of links with provider names
 */
export function generateSegmentLinks(segment: Segment): SegmentLink[] {
  const links: SegmentLink[] = [];

  // URL encode helper
  const encode = (s: string) => encodeURIComponent(s);

  switch (segment.type) {
    case 'HOTEL': {
      const hotelName = segment.property?.name || '';
      const hotelLocation = segment.location?.city || segment.location?.name || '';
      const hotelQuery = `${hotelName} ${hotelLocation}`.trim();

      if (hotelQuery) {
        links.push(
          {
            url: `https://www.tripadvisor.com/Search?q=${encode(hotelQuery)}`,
            provider: 'TripAdvisor'
          },
          {
            url: `https://www.booking.com/searchresults.html?ss=${encode(hotelQuery)}`,
            provider: 'Booking.com'
          },
          {
            url: `https://www.google.com/maps/search/${encode(hotelQuery)}`,
            provider: 'Google Maps'
          }
        );
      }
      break;
    }

    case 'ACTIVITY': {
      const activityName = segment.name || '';
      const activityLocation = segment.location?.city || segment.location?.name || '';
      const activityQuery = `${activityName} ${activityLocation}`.trim();

      if (activityQuery) {
        links.push(
          {
            url: `https://www.getyourguide.com/s/?q=${encode(activityQuery)}`,
            provider: 'GetYourGuide'
          },
          {
            url: `https://www.viator.com/searchResults/all?text=${encode(activityQuery)}`,
            provider: 'Viator'
          },
          {
            url: `https://www.tripadvisor.com/Search?q=${encode(activityQuery)}`,
            provider: 'TripAdvisor'
          }
        );
      }
      break;
    }

    case 'TRANSFER': {
      // For transfers, provide Google Maps directions
      const pickup = segment.pickupLocation?.name || '';
      const dropoff = segment.dropoffLocation?.name || '';

      if (pickup && dropoff) {
        links.push(
          {
            url: `https://www.google.com/maps/dir/${encode(pickup)}/${encode(dropoff)}`,
            provider: 'Google Maps'
          }
        );
      }
      break;
    }

    case 'FLIGHT': {
      // Generic flight search
      links.push(
        {
          url: 'https://www.google.com/travel/flights',
          provider: 'Google Flights'
        }
      );

      // If we have airline information, we could add airline-specific links in the future
      if (segment.airline?.name) {
        // TODO: Add airline-specific booking links
      }
      break;
    }

    case 'MEETING': {
      // For meetings with physical locations
      if (segment.location) {
        const locationName = segment.location.name || segment.location.city || '';
        if (locationName) {
          links.push(
            {
              url: `https://www.google.com/maps/search/${encode(locationName)}`,
              provider: 'Google Maps'
            }
          );
        }
      }
      break;
    }

    case 'CUSTOM': {
      // For custom segments with locations
      if (segment.location) {
        const locationName = segment.location.name || segment.location.city || '';
        if (locationName) {
          links.push(
            {
              url: `https://www.google.com/maps/search/${encode(locationName)}`,
              provider: 'Google Maps'
            }
          );
        }
      }
      break;
    }
  }

  return links;
}

/**
 * Get all links for a segment, including stored links and generated links
 * @param segment - The segment to get links for
 * @returns Combined array of all available links
 */
export function getAllSegmentLinks(segment: Segment): SegmentLink[] {
  const links: SegmentLink[] = [];

  // Add stored primary link if available
  if (segment.sourceUrl && segment.sourceProvider) {
    links.push({
      url: segment.sourceUrl,
      provider: segment.sourceProvider
    });
  }

  // Add stored alternate links if available
  if (segment.alternateUrls) {
    links.push(...segment.alternateUrls);
  }

  // If no stored links, generate them
  if (links.length === 0) {
    links.push(...generateSegmentLinks(segment));
  }

  return links;
}
