/**
 * Format itineraries and segments for display
 * @module cli/output/formatters
 */

import type { Itinerary } from '../../domain/types/itinerary.js';
import type { Segment } from '../../domain/types/segment.js';
import {
  isActivitySegment,
  isCustomSegment,
  isFlightSegment,
  isHotelSegment,
  isMeetingSegment,
  isTransferSegment,
} from '../../domain/types/segment.js';
import type { ItinerarySummary } from '../../storage/storage.interface.js';
import { colors } from './colors.js';

/**
 * Format a date for display
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format datetime for display
 * @param date - Date to format
 * @returns Formatted datetime string
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date range
 * @param start - Start date
 * @param end - End date
 * @returns Formatted date range string
 */
export function formatDateRange(start: Date, end: Date): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

/**
 * Format money amount
 * @param amount - Amount to format
 * @param currency - Currency code (ISO 4217)
 * @returns Formatted money string
 */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

/**
 * Format duration in minutes to human readable
 * @param minutes - Duration in minutes
 * @returns Formatted duration string
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

/**
 * Format an itinerary summary for list view
 * @param summary - Itinerary summary
 * @param index - List index (1-based)
 * @returns Formatted summary string
 */
export function formatItinerarySummary(summary: ItinerarySummary, index: number): string {
  const statusColor = colors.status[summary.status as keyof typeof colors.status] || colors.dim;
  const dateRange = formatDateRange(summary.startDate, summary.endDate);

  const lines = [
    `${colors.dim(`${index}.`)} ${colors.bold(summary.title)}`,
    `   ${colors.id(summary.id.slice(0, 8))} | ${statusColor(summary.status)} | ${colors.date(dateRange)}`,
    `   ${summary.travelerCount} traveler${summary.travelerCount !== 1 ? 's' : ''} | ${summary.segmentCount} segment${summary.segmentCount !== 1 ? 's' : ''}`,
  ];

  return lines.join('\n');
}

/**
 * Format a segment for display
 * @param segment - Segment to format
 * @param index - Segment index (1-based)
 * @returns Formatted segment string
 */
export function formatSegment(segment: Segment, index: number): string {
  const typeColor =
    colors.segmentType[segment.type as keyof typeof colors.segmentType] || colors.dim;
  const header = `${colors.dim(`${index}.`)} ${typeColor(segment.type)}`;

  const startTime = formatDateTime(segment.startDatetime);
  const endTime = formatDateTime(segment.endDatetime);

  let details = '';

  if (isFlightSegment(segment)) {
    details = [
      `${segment.airline.code} ${segment.flightNumber}`,
      `${segment.origin.code} → ${segment.destination.code}`,
      segment.cabinClass || '',
    ]
      .filter(Boolean)
      .join(' | ');
  } else if (isHotelSegment(segment)) {
    details = [
      segment.property.name,
      segment.location.name,
      `${segment.roomCount} room${segment.roomCount !== 1 ? 's' : ''}`,
    ]
      .filter(Boolean)
      .join(' | ');
  } else if (isMeetingSegment(segment)) {
    details = [segment.title, segment.location.name, `${segment.attendees.length} attendees`]
      .filter(Boolean)
      .join(' | ');
  } else if (isActivitySegment(segment)) {
    details = [segment.name, segment.location.name, segment.category].filter(Boolean).join(' | ');
  } else if (isTransferSegment(segment)) {
    details = [
      segment.transferType,
      `${segment.pickupLocation.name} → ${segment.dropoffLocation.name}`,
    ]
      .filter(Boolean)
      .join(' | ');
  } else if (isCustomSegment(segment)) {
    details = [segment.title, segment.description].filter(Boolean).join(' | ');
  }

  const lines = [header];
  if (details) {
    lines.push(`   ${details}`);
  }
  lines.push(`   ${colors.dim(startTime)} → ${colors.dim(endTime)}`);

  if (segment.confirmationNumber) {
    lines.push(`   Confirmation: ${colors.dim(segment.confirmationNumber)}`);
  }

  return lines.join('\n');
}

/**
 * Format an itinerary for display (full details)
 * @param itinerary - Itinerary to format
 * @returns Formatted itinerary string
 */
export function formatItinerary(itinerary: Itinerary): string {
  const lines: string[] = [];

  lines.push(colors.heading(itinerary.title));
  lines.push('');

  // Status and dates
  const statusColor = colors.status[itinerary.status as keyof typeof colors.status] || colors.dim;
  lines.push(`Status: ${statusColor(itinerary.status)}`);
  lines.push(`Dates: ${colors.date(formatDateRange(itinerary.startDate, itinerary.endDate))}`);

  if (itinerary.description) {
    lines.push(`Description: ${colors.dim(itinerary.description)}`);
  }

  if (itinerary.tripType) {
    lines.push(`Trip Type: ${itinerary.tripType}`);
  }

  lines.push('');

  // Travelers
  if (itinerary.travelers.length > 0) {
    lines.push(colors.bold('Travelers:'));
    for (const traveler of itinerary.travelers) {
      const name = `${traveler.firstName} ${traveler.lastName}`;
      const isPrimary = traveler.id === itinerary.primaryTravelerId ? ' (Primary)' : '';
      lines.push(`  • ${name}${isPrimary} - ${colors.dim(traveler.email || 'No email')}`);
    }
    lines.push('');
  }

  // Segments
  if (itinerary.segments.length > 0) {
    lines.push(colors.bold('Segments:'));
    for (let i = 0; i < itinerary.segments.length; i++) {
      const segment = itinerary.segments[i];
      if (segment) {
        const formatted = formatSegment(segment, i + 1);
        lines.push(formatted);
        if (i < itinerary.segments.length - 1) {
          lines.push('');
        }
      }
    }
  } else {
    lines.push(colors.dim('No segments yet'));
  }

  lines.push('');
  lines.push(colors.dim(`ID: ${itinerary.id}`));
  lines.push(
    colors.dim(`Version: ${itinerary.version} | Updated: ${formatDate(itinerary.updatedAt)}`)
  );

  return lines.join('\n');
}
