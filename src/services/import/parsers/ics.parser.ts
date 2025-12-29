/**
 * ICS Parser - Parse iCalendar files
 * @module services/import/parsers/ics
 */

import * as ical from 'node-ical';
import type { IParser, ImportRequest, ImportResult, ImportFormat, ExtractedSegment } from '../types.js';
import { SegmentType, SegmentStatus } from '../../../domain/types/common.js';

/**
 * ICS/iCalendar parser
 */
export class ICSParser implements IParser {
  supportedFormats: ImportFormat[] = ['ics'];

  /**
   * Parse ICS file and convert to segments
   */
  async parse(request: ImportRequest): Promise<ImportResult> {
    try {
      // Convert content to string if needed
      const icsContent = Buffer.isBuffer(request.content)
        ? request.content.toString('utf8')
        : request.content;

      // Parse ICS
      const events = await ical.async.parseICS(icsContent);

      const segments: ExtractedSegment[] = [];
      const errors: string[] = [];

      // Convert each event to a segment
      for (const [uid, event] of Object.entries(events)) {
        // Type guard for VEvent
        if (!event || typeof event !== 'object' || !('type' in event) || event.type !== 'VEVENT') {
          continue; // Skip non-event entries (like VTIMEZONE)
        }

        try {
          const segment = this.convertEventToSegment(event);
          if (segment) {
            segments.push(segment);
          }
        } catch (error) {
          errors.push(`Failed to convert event ${uid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: segments.length > 0,
        format: 'ics',
        segments,
        confidence: 0.9, // High confidence for structured calendar data
        summary: `Found ${segments.length} event(s) from calendar`,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        format: 'ics',
        segments: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Failed to parse ICS file'],
      };
    }
  }

  /**
   * Convert iCal event to segment
   */
  private convertEventToSegment(event: any): ExtractedSegment | null {
    if (!event.start || !event.end) {
      console.warn('Event missing start or end time');
      return null;
    }

    // Determine segment type from event summary/description
    const type = this.guessSegmentType(event.summary, event.description);

    // Base segment data
    const baseSegment = {
      type,
      status: this.mapEventStatus(event.status),
      startDatetime: new Date(event.start),
      endDatetime: new Date(event.end),
      notes: event.description,
      confidence: 0.9,
      inferred: false,
    };

    // Type-specific conversion
    switch (type) {
      case SegmentType.FLIGHT:
        return this.convertToFlightSegment(event, baseSegment);
      case SegmentType.HOTEL:
        return this.convertToHotelSegment(event, baseSegment);
      default:
        return this.convertToActivitySegment(event, baseSegment);
    }
  }

  /**
   * Guess segment type from event summary and description
   */
  private guessSegmentType(summary: string = '', description: string = ''): SegmentType {
    const combined = `${summary} ${description}`.toLowerCase();

    // Flight keywords
    if (combined.match(/flight|airline|depart|arrive|airport|boarding/)) {
      return SegmentType.FLIGHT;
    }

    // Hotel keywords
    if (combined.match(/hotel|check.?in|check.?out|accommodation|stay|reservation/)) {
      return SegmentType.HOTEL;
    }

    // Transfer keywords
    if (combined.match(/transfer|taxi|uber|rental|car|shuttle|train/)) {
      return SegmentType.TRANSFER;
    }

    // Default to activity
    return SegmentType.ACTIVITY;
  }

  /**
   * Map iCal event status to our status
   */
  private mapEventStatus(status?: string): SegmentStatus {
    if (!status) return SegmentStatus.CONFIRMED;

    const normalized = status.toUpperCase();
    switch (normalized) {
      case 'CONFIRMED':
        return SegmentStatus.CONFIRMED;
      case 'TENTATIVE':
        return SegmentStatus.TENTATIVE;
      case 'CANCELLED':
        return SegmentStatus.CANCELLED;
      default:
        return SegmentStatus.CONFIRMED;
    }
  }

  /**
   * Convert to flight segment (best effort)
   */
  private convertToFlightSegment(event: any, base: any): ExtractedSegment {
    // Try to extract flight number from summary
    const flightMatch = event.summary?.match(/([A-Z]{2}\d{3,4})/);

    return {
      ...base,
      type: SegmentType.FLIGHT,
      airline: { name: '', code: '' },
      flightNumber: flightMatch ? flightMatch[1] : '',
      origin: { name: event.location || '', code: '', city: '', country: '' },
      destination: { name: '', code: '', city: '', country: '' },
    } as ExtractedSegment;
  }

  /**
   * Convert to hotel segment (best effort)
   */
  private convertToHotelSegment(event: any, base: any): ExtractedSegment {
    return {
      ...base,
      type: SegmentType.HOTEL,
      property: { name: event.summary || event.location || '', code: '' },
      location: { name: event.location || '', address: '', city: '', country: '' },
      checkInDate: new Date(event.start),
      checkOutDate: new Date(event.end),
      checkInTime: '15:00',
      checkOutTime: '11:00',
      roomCount: 1,
    } as ExtractedSegment;
  }

  /**
   * Convert to activity segment
   */
  private convertToActivitySegment(event: any, base: any): ExtractedSegment {
    return {
      ...base,
      type: SegmentType.ACTIVITY,
      name: event.summary || 'Untitled Event',
      description: event.description,
      location: {
        name: event.location || '',
        address: event.location || '',
        city: '',
        country: '',
      },
    } as ExtractedSegment;
  }
}
