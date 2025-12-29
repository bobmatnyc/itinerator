/**
 * Format Detector - Auto-detect import format
 * @module services/import/format-detector
 */

import type { ImportRequest, ImportFormat, IFormatDetector } from './types.js';

/**
 * Format detector implementation
 */
export class FormatDetector implements IFormatDetector {
  /**
   * Detect format from request
   */
  detect(request: ImportRequest): ImportFormat {
    // Try MIME type first
    if (request.mimeType) {
      const format = this.detectFromMimeType(request.mimeType);
      if (format !== 'unknown') {
        return format;
      }
    }

    // Try filename extension
    if (request.filename) {
      const format = this.detectFromFilename(request.filename);
      if (format !== 'unknown') {
        return format;
      }
    }

    // Try content inspection
    return this.detectFromContent(request.content);
  }

  /**
   * Detect format from MIME type
   */
  private detectFromMimeType(mimeType: string): ImportFormat {
    const normalized = mimeType.toLowerCase();

    if (normalized === 'application/pdf') {
      return 'pdf';
    }
    if (normalized === 'text/calendar' || normalized === 'application/ics') {
      return 'ics';
    }
    if (normalized === 'message/rfc822' || normalized.includes('email')) {
      return 'email';
    }
    if (normalized === 'application/json') {
      return 'json';
    }
    if (normalized === 'text/html' || normalized === 'application/xhtml+xml') {
      return 'html';
    }
    if (normalized.startsWith('text/')) {
      return 'text';
    }

    return 'unknown';
  }

  /**
   * Detect format from filename
   */
  private detectFromFilename(filename: string): ImportFormat {
    const extension = filename.toLowerCase().split('.').pop();

    switch (extension) {
      case 'pdf':
        return 'pdf';
      case 'ics':
      case 'ical':
      case 'ifb':
      case 'icalendar':
        return 'ics';
      case 'eml':
      case 'msg':
        return 'email';
      case 'json':
        return 'json';
      case 'html':
      case 'htm':
        return 'html';
      case 'txt':
      case 'text':
        return 'text';
      default:
        return 'unknown';
    }
  }

  /**
   * Detect format from content inspection
   */
  private detectFromContent(content: string | Buffer): ImportFormat {
    // Convert Buffer to string for inspection
    const text = Buffer.isBuffer(content)
      ? content.toString('utf8', 0, Math.min(content.length, 1024))
      : content.substring(0, 1024);

    // Check for PDF magic bytes
    if (text.startsWith('%PDF')) {
      return 'pdf';
    }

    // Check for ICS content
    if (text.includes('BEGIN:VCALENDAR') || text.includes('BEGIN:VEVENT')) {
      return 'ics';
    }

    // Check for JSON structure
    const trimmed = text.trim();
    if ((trimmed.startsWith('{') && trimmed.includes('}')) ||
        (trimmed.startsWith('[') && trimmed.includes(']'))) {
      try {
        JSON.parse(text.substring(0, 5000)); // Parse larger sample for JSON
        return 'json';
      } catch {
        // Not valid JSON
      }
    }

    // Check for HTML
    if (text.includes('<!DOCTYPE html') ||
        text.includes('<html') ||
        text.includes('<HTML')) {
      return 'html';
    }

    // Check for email headers
    if (text.includes('From:') &&
        text.includes('To:') &&
        text.includes('Subject:')) {
      return 'email';
    }

    // Default to text
    return 'text';
  }
}
