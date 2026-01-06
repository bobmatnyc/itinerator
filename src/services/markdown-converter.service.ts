/**
 * Markdown converter service - code-based structure inference
 * @module services/markdown-converter
 */

import type { MarkdownSection, StructuredMarkdown } from '../domain/types/import.js';

/**
 * Detected flight information
 */
interface DetectedFlight {
  airline?: string;
  flightNumber?: string;
  origin?: string;
  destination?: string;
  departureDate?: string;
  departureTime?: string;
  arrivalTime?: string;
  confidence: number;
}

/**
 * Detected hotel information
 */
interface DetectedHotel {
  name?: string;
  location?: string;
  checkIn?: string;
  checkOut?: string;
  roomType?: string;
  confirmationNumber?: string;
  confidence: number;
}

/**
 * Service for converting raw text to structured markdown
 * Uses code-based pattern matching (no LLM) to infer structure
 */
export class MarkdownConverterService {
  // Common date patterns
  private static readonly DATE_PATTERNS = [
    // ISO format: 2025-06-15
    /(\d{4})-(\d{2})-(\d{2})/g,
    // US format: 06/15/2025 or 6/15/2025
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    // European format: 15/06/2025 or 15.06.2025
    /(\d{1,2})[./](\d{1,2})[./](\d{4})/g,
    // Written format: June 15, 2025 or Jun 15, 2025
    /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/gi,
    // Written format: 15 June 2025
    /(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+(\d{4})/gi,
  ];

  // Time patterns
  private static readonly TIME_PATTERNS = [
    // 24-hour format: 14:30 or 14:30:00
    /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g,
    // 12-hour format: 2:30 PM or 2:30PM
    /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)\b/gi,
  ];

  // Flight patterns
  private static readonly FLIGHT_NUMBER_PATTERN = /\b([A-Z]{2,3})[\s-]?(\d{1,4})\b/g;
  private static readonly AIRPORT_CODE_PATTERN = /\b([A-Z]{3})\b/g;

  // Major airlines for detection
  private static readonly AIRLINES: Record<string, string> = {
    AA: 'American Airlines',
    UA: 'United Airlines',
    DL: 'Delta Air Lines',
    BA: 'British Airways',
    AF: 'Air France',
    LH: 'Lufthansa',
    QF: 'Qantas',
    SQ: 'Singapore Airlines',
    EK: 'Emirates',
    QR: 'Qatar Airways',
    JL: 'Japan Airlines',
    NH: 'All Nippon Airways',
    CX: 'Cathay Pacific',
    TK: 'Turkish Airlines',
    EY: 'Etihad Airways',
    VS: 'Virgin Atlantic',
    AC: 'Air Canada',
    NZ: 'Air New Zealand',
    KL: 'KLM',
    IB: 'Iberia',
    AY: 'Finnair',
    LX: 'SWISS',
    OS: 'Austrian',
    SK: 'Scandinavian Airlines',
    TP: 'TAP Air Portugal',
  };

  // Hotel-related keywords
  private static readonly HOTEL_KEYWORDS = [
    'hotel',
    'resort',
    'inn',
    'lodge',
    'suites',
    'marriott',
    'hilton',
    'hyatt',
    'sheraton',
    'westin',
    'intercontinental',
    'four seasons',
    'ritz',
    'waldorf',
    'fairmont',
    'accor',
    'ibis',
    'novotel',
    'sofitel',
    'radisson',
    'holiday inn',
    'crowne plaza',
    'best western',
    'wyndham',
    'airbnb',
    'vrbo',
    'accommodation',
    'stay',
    'check-in',
    'check-out',
    'checkout',
    'checkin',
  ];

  // Activity keywords
  private static readonly ACTIVITY_KEYWORDS = [
    'tour',
    'visit',
    'excursion',
    'activity',
    'experience',
    'museum',
    'temple',
    'shrine',
    'castle',
    'palace',
    'garden',
    'park',
    'beach',
    'hiking',
    'snorkeling',
    'diving',
    'safari',
    'cooking class',
    'wine tasting',
    'concert',
    'show',
    'theater',
    'spa',
    'massage',
    'yoga',
    'cruise',
    'boat',
    'ferry',
  ];

  /**
   * Convert raw text to structured markdown
   * @param text - Raw text from PDF
   * @returns Structured markdown with inferred metadata
   */
  convert(text: string): StructuredMarkdown {
    const lines = text.split('\n');
    const sections: MarkdownSection[] = [];

    // Extract title (usually first non-empty line or prominent text)
    const title = this.extractTitle(lines);

    // Extract date range
    const dateRange = this.extractDateRange(text);

    // Process lines into sections
    let currentSection: MarkdownSection | null = null;
    let sectionStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || '';
      if (!line) continue;

      // Detect section type
      const sectionType = this.detectSectionType(line, lines, i);

      if (sectionType && (!currentSection || sectionType !== currentSection.type)) {
        // Save previous section
        if (currentSection) {
          currentSection.lineNumbers = [sectionStartLine, i - 1];
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          type: sectionType,
          content: line,
          data: this.extractSectionData(sectionType, line),
        };
        sectionStartLine = i;
      } else if (currentSection) {
        currentSection.content += '\n' + line;
      } else {
        // First section
        currentSection = {
          type: 'text',
          content: line,
        };
        sectionStartLine = i;
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.lineNumbers = [sectionStartLine, lines.length - 1];
      sections.push(currentSection);
    }

    // Generate structured markdown
    const markdown = this.generateMarkdown(title, dateRange, sections);

    // Calculate confidence scores
    const confidence = this.calculateConfidence(sections, title, dateRange);

    return {
      title,
      dateRange,
      sections,
      markdown,
      confidence,
    };
  }

  /**
   * Extract title from text
   */
  private extractTitle(lines: string[]): string | undefined {
    // Look for common title patterns
    for (const line of lines.slice(0, 10)) {
      const trimmed = line?.trim() || '';
      if (!trimmed) continue;

      // Skip very short lines (likely headers)
      if (trimmed.length < 5) continue;

      // Check for common title patterns
      if (
        trimmed.toLowerCase().includes('itinerary') ||
        trimmed.toLowerCase().includes('trip') ||
        trimmed.toLowerCase().includes('travel') ||
        trimmed.toLowerCase().includes('vacation') ||
        trimmed.toLowerCase().includes('holiday')
      ) {
        return trimmed;
      }

      // Use first substantial line as title
      if (trimmed.length > 10 && !trimmed.includes('@') && !trimmed.includes('http')) {
        return trimmed;
      }
    }

    return undefined;
  }

  /**
   * Extract date range from text
   */
  private extractDateRange(text: string): { start?: Date; end?: Date } | undefined {
    const dates: Date[] = [];

    // Find all dates in the text
    for (const pattern of MarkdownConverterService.DATE_PATTERNS) {
      const matches = text.matchAll(new RegExp(pattern.source, pattern.flags));
      for (const match of matches) {
        const date = this.parseDate(match[0]);
        if (date && !isNaN(date.getTime())) {
          dates.push(date);
        }
      }
    }

    if (dates.length === 0) return undefined;

    // Sort dates
    dates.sort((a, b) => a.getTime() - b.getTime());

    return {
      start: dates[0],
      end: dates[dates.length - 1],
    };
  }

  /**
   * Parse a date string into a Date object
   */
  private parseDate(dateStr: string): Date | undefined {
    // Try standard parsing first
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Try month name parsing
    const monthNames: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };

    const monthMatch = dateStr.match(
      /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/i
    );
    const dayMatch = dateStr.match(/(\d{1,2})(?:st|nd|rd|th)?/);
    const yearMatch = dateStr.match(/(\d{4})/);

    if (monthMatch && dayMatch && yearMatch) {
      const month = monthNames[monthMatch[1].toLowerCase()];
      if (month !== undefined) {
        return new Date(parseInt(yearMatch[1], 10), month, parseInt(dayMatch[1], 10));
      }
    }

    return undefined;
  }

  /**
   * Detect section type from line content
   */
  private detectSectionType(
    line: string,
    _lines: string[],
    _index: number
  ): MarkdownSection['type'] | null {
    const lowerLine = line.toLowerCase();

    // Check for flight indicators
    if (this.isFlightLine(line)) {
      return 'flight';
    }

    // Check for hotel indicators
    if (MarkdownConverterService.HOTEL_KEYWORDS.some((kw) => lowerLine.includes(kw))) {
      return 'hotel';
    }

    // Check for activity indicators
    if (MarkdownConverterService.ACTIVITY_KEYWORDS.some((kw) => lowerLine.includes(kw))) {
      return 'activity';
    }

    // Check for transfer indicators
    if (
      lowerLine.includes('transfer') ||
      lowerLine.includes('pickup') ||
      lowerLine.includes('pick-up') ||
      lowerLine.includes('dropoff') ||
      lowerLine.includes('drop-off') ||
      lowerLine.includes('taxi') ||
      lowerLine.includes('car service') ||
      lowerLine.includes('shuttle')
    ) {
      return 'transfer';
    }

    // Check for date-heavy lines
    if (this.hasMultipleDates(line)) {
      return 'dates';
    }

    // Check for header patterns
    if (this.isHeader(line)) {
      return 'header';
    }

    return null;
  }

  /**
   * Check if a line contains flight information
   */
  private isFlightLine(line: string): boolean {
    const lowerLine = line.toLowerCase();

    // Check for flight-related keywords
    if (
      lowerLine.includes('flight') ||
      lowerLine.includes('airline') ||
      lowerLine.includes('departure') ||
      lowerLine.includes('arrival') ||
      lowerLine.includes('boarding')
    ) {
      return true;
    }

    // Check for flight number pattern
    const flightMatch = line.match(MarkdownConverterService.FLIGHT_NUMBER_PATTERN);
    if (flightMatch) {
      const code = flightMatch[1];
      if (code && MarkdownConverterService.AIRLINES[code]) {
        return true;
      }
    }

    // Check for airport codes with arrows or dashes
    if (/[A-Z]{3}\s*[-→>]\s*[A-Z]{3}/.test(line)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a line has multiple dates
   */
  private hasMultipleDates(line: string): boolean {
    let dateCount = 0;
    for (const pattern of MarkdownConverterService.DATE_PATTERNS) {
      const matches = line.match(new RegExp(pattern.source, pattern.flags));
      if (matches) {
        dateCount += matches.length;
      }
    }
    return dateCount >= 2;
  }

  /**
   * Check if a line is a header
   */
  private isHeader(line: string): boolean {
    // All caps, short
    if (line === line.toUpperCase() && line.length < 50 && line.length > 2) {
      return true;
    }

    // Day headers
    if (/^(day\s*\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(line)) {
      return true;
    }

    return false;
  }

  /**
   * Extract section-specific data
   */
  private extractSectionData(type: MarkdownSection['type'], content: string): Record<string, unknown> {
    switch (type) {
      case 'flight':
        return this.extractFlightData(content) as Record<string, unknown>;
      case 'hotel':
        return this.extractHotelData(content) as Record<string, unknown>;
      default:
        return {};
    }
  }

  /**
   * Extract flight data from content
   */
  private extractFlightData(content: string): DetectedFlight {
    const data: DetectedFlight = { confidence: 0 };

    // Extract flight number
    const flightMatch = content.match(MarkdownConverterService.FLIGHT_NUMBER_PATTERN);
    if (flightMatch) {
      const code = flightMatch[1];
      data.flightNumber = flightMatch[0].replace(/\s+/g, '');
      data.airline = code ? MarkdownConverterService.AIRLINES[code] : undefined;
      data.confidence += 0.3;
    }

    // Extract airport codes
    const airportMatches = content.match(MarkdownConverterService.AIRPORT_CODE_PATTERN);
    if (airportMatches && airportMatches.length >= 2) {
      // Filter out common non-airport codes
      const filtered = airportMatches.filter(
        (code) => !['THE', 'AND', 'FOR', 'NOT', 'ARE', 'BUT', 'YOU', 'ALL'].includes(code)
      );
      if (filtered.length >= 2) {
        data.origin = filtered[0];
        data.destination = filtered[1];
        data.confidence += 0.3;
      }
    }

    // Extract times
    const timeMatches = content.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/g);
    if (timeMatches && timeMatches.length >= 2) {
      data.departureTime = timeMatches[0];
      data.arrivalTime = timeMatches[1];
      data.confidence += 0.2;
    }

    return data;
  }

  /**
   * Extract hotel data from content
   */
  private extractHotelData(content: string): DetectedHotel {
    const data: DetectedHotel = { confidence: 0 };

    // Look for hotel name patterns
    const lines = content.split('\n');
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      for (const keyword of MarkdownConverterService.HOTEL_KEYWORDS) {
        if (lowerLine.includes(keyword)) {
          // Extract name from line
          const nameMatch = line.match(
            /(?:hotel|resort|inn|lodge)\s*[:.]?\s*(.+)/i
          );
          if (nameMatch && nameMatch[1]) {
            data.name = nameMatch[1].trim();
            data.confidence += 0.3;
          }
          break;
        }
      }
    }

    // Look for check-in/check-out
    const checkInMatch = content.match(/check[-\s]?in[:\s]+([^\n]+)/i);
    if (checkInMatch) {
      data.checkIn = checkInMatch[1].trim();
      data.confidence += 0.2;
    }

    const checkOutMatch = content.match(/check[-\s]?out[:\s]+([^\n]+)/i);
    if (checkOutMatch) {
      data.checkOut = checkOutMatch[1].trim();
      data.confidence += 0.2;
    }

    // Look for confirmation number
    const confirmMatch = content.match(/(?:confirmation|booking|reference)\s*(?:#|no\.?|number)?[:\s]+([A-Z0-9]+)/i);
    if (confirmMatch) {
      data.confirmationNumber = confirmMatch[1];
      data.confidence += 0.2;
    }

    return data;
  }

  /**
   * Generate final markdown from sections
   * Phase 1: Buckets content BY DAY first, then by type within each day
   */
  private generateMarkdown(
    title: string | undefined,
    dateRange: { start?: Date; end?: Date } | undefined,
    sections: MarkdownSection[]
  ): string {
    let md = '';

    // Title
    if (title) {
      md += `# ${title}\n\n`;
    }

    // Date range
    if (dateRange?.start || dateRange?.end) {
      md += '## Trip Dates\n\n';
      if (dateRange.start) {
        md += `**Start:** ${dateRange.start.toDateString()}\n`;
      }
      if (dateRange.end) {
        md += `**End:** ${dateRange.end.toDateString()}\n`;
      }
      md += '\n';
    }

    // Group sections by day
    const dayGroups = this.groupSectionsByDay(sections, dateRange);

    // Generate markdown for each day
    for (const [dayLabel, daySections] of dayGroups) {
      md += `## ${dayLabel}\n\n`;

      // Group by type within each day
      const flights = daySections.filter((s) => s.type === 'flight');
      const hotels = daySections.filter((s) => s.type === 'hotel');
      const transfers = daySections.filter((s) => s.type === 'transfer');
      const activities = daySections.filter((s) => s.type === 'activity');
      const other = daySections.filter((s) => !['flight', 'hotel', 'transfer', 'activity'].includes(s.type));

      // Output in logical order: flights, transfers, hotels, activities
      if (flights.length > 0) {
        md += '### ✈️ Flights\n\n';
        for (const section of flights) {
          md += this.formatFlightSection(section);
        }
      }

      if (transfers.length > 0) {
        md += '### 🚗 Transfers\n\n';
        for (const section of transfers) {
          md += `- ${section.content.split('\n')[0]}\n`;
          // Include additional lines as sub-bullets
          const lines = section.content.split('\n').slice(1);
          for (const line of lines) {
            if (line.trim()) {
              md += `  - ${line.trim()}\n`;
            }
          }
        }
        md += '\n';
      }

      if (hotels.length > 0) {
        md += '### 🏨 Accommodations\n\n';
        for (const section of hotels) {
          md += this.formatHotelSection(section);
        }
      }

      if (activities.length > 0) {
        md += '### 🎯 Activities\n\n';
        for (const section of activities) {
          md += `- ${section.content.split('\n')[0]}\n`;
          // Include additional lines as sub-bullets
          const lines = section.content.split('\n').slice(1);
          for (const line of lines) {
            if (line.trim()) {
              md += `  - ${line.trim()}\n`;
            }
          }
        }
        md += '\n';
      }

      if (other.length > 0) {
        md += '### 📝 Notes\n\n';
        for (const section of other) {
          md += section.content + '\n\n';
        }
      }
    }

    return md.trim();
  }

  /**
   * Group sections by day based on detected dates or day headers
   */
  private groupSectionsByDay(
    sections: MarkdownSection[],
    dateRange: { start?: Date; end?: Date } | undefined
  ): Map<string, MarkdownSection[]> {
    const dayGroups = new Map<string, MarkdownSection[]>();
    let currentDay = 'Day 1';
    let dayNumber = 1;

    for (const section of sections) {
      // Check if this section starts a new day
      const newDayLabel = this.detectDayFromSection(section, dayNumber, dateRange);
      if (newDayLabel) {
        currentDay = newDayLabel;
        dayNumber++;
      }

      // Add section to current day
      if (!dayGroups.has(currentDay)) {
        dayGroups.set(currentDay, []);
      }
      dayGroups.get(currentDay)!.push(section);
    }

    // If no day grouping was detected, put everything in a single "Itinerary" group
    if (dayGroups.size === 0 || (dayGroups.size === 1 && dayGroups.has('Day 1'))) {
      // Check if there are typed sections to display
      const typedSections = sections.filter((s) =>
        ['flight', 'hotel', 'activity', 'transfer'].includes(s.type)
      );
      if (typedSections.length > 0) {
        dayGroups.clear();
        dayGroups.set('Itinerary', sections);
      }
    }

    return dayGroups;
  }

  /**
   * Detect if a section indicates a new day
   */
  private detectDayFromSection(
    section: MarkdownSection,
    currentDayNumber: number,
    dateRange: { start?: Date; end?: Date } | undefined
  ): string | null {
    const content = section.content;

    // Check for "Day X" pattern
    const dayMatch = content.match(/^day\s*(\d+)/i);
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1], 10);
      return `Day ${dayNum}`;
    }

    // Check for date in header sections
    if (section.type === 'header' || section.type === 'dates') {
      // Look for a date in this section
      for (const pattern of MarkdownConverterService.DATE_PATTERNS) {
        const match = content.match(new RegExp(pattern.source, pattern.flags));
        if (match) {
          const date = this.parseDate(match[0]);
          if (date) {
            // Calculate day number from start date
            if (dateRange?.start) {
              const daysDiff = Math.floor(
                (date.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
              );
              if (daysDiff >= 0) {
                return `Day ${daysDiff + 1}: ${date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}`;
              }
            }
            return `Day ${currentDayNumber}: ${date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}`;
          }
        }
      }
    }

    // Check for weekday headers
    const weekdayMatch = content.match(
      /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
    );
    if (weekdayMatch) {
      return `Day ${currentDayNumber}: ${weekdayMatch[1]}`;
    }

    return null;
  }

  /**
   * Format a flight section
   */
  private formatFlightSection(section: MarkdownSection): string {
    const flight = section.data as DetectedFlight | undefined;
    let md = '';

    if (flight?.flightNumber) {
      md += `### ${flight.airline || 'Flight'} ${flight.flightNumber}\n\n`;
    } else {
      md += '### Flight\n\n';
    }

    if (flight?.origin && flight?.destination) {
      md += `**Route:** ${flight.origin} → ${flight.destination}\n`;
    }

    if (flight?.departureTime) {
      md += `**Departure:** ${flight.departureTime}\n`;
    }

    if (flight?.arrivalTime) {
      md += `**Arrival:** ${flight.arrivalTime}\n`;
    }

    md += `\n${section.content}\n`;

    return md;
  }

  /**
   * Format a hotel section
   */
  private formatHotelSection(section: MarkdownSection): string {
    const hotel = section.data as DetectedHotel | undefined;
    let md = '';

    if (hotel?.name) {
      md += `### ${hotel.name}\n\n`;
    } else {
      md += '### Accommodation\n\n';
    }

    if (hotel?.checkIn) {
      md += `**Check-in:** ${hotel.checkIn}\n`;
    }

    if (hotel?.checkOut) {
      md += `**Check-out:** ${hotel.checkOut}\n`;
    }

    if (hotel?.confirmationNumber) {
      md += `**Confirmation:** ${hotel.confirmationNumber}\n`;
    }

    md += `\n${section.content}\n`;

    return md;
  }

  /**
   * Calculate confidence scores
   */
  private calculateConfidence(
    sections: MarkdownSection[],
    title: string | undefined,
    dateRange: { start?: Date; end?: Date } | undefined
  ): {
    title: number;
    dates: number;
    flights: number;
    hotels: number;
    activities: number;
  } {
    return {
      title: title ? 0.8 : 0,
      dates: dateRange?.start && dateRange?.end ? 0.9 : dateRange?.start || dateRange?.end ? 0.5 : 0,
      flights: Math.min(
        1,
        sections.filter((s) => s.type === 'flight').reduce((sum, s) => sum + ((s.data as DetectedFlight)?.confidence || 0), 0)
      ),
      hotels: Math.min(
        1,
        sections.filter((s) => s.type === 'hotel').reduce((sum, s) => sum + ((s.data as DetectedHotel)?.confidence || 0), 0)
      ),
      activities: Math.min(1, sections.filter((s) => s.type === 'activity').length * 0.3),
    };
  }
}
