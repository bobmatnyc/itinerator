/**
 * LLM Extractor - Extract booking data using LLM
 * @module services/import/extractors/llm
 */

import OpenAI from 'openai';
import type { ImportResult, ImportFormat, ExtractedSegment } from '../types.js';
import { SegmentType, SegmentStatus } from '../../../domain/types/common.js';

/**
 * LLM extractor configuration
 */
export interface LLMExtractorConfig {
  /** OpenRouter API key */
  apiKey: string;
  /** Model to use (default: claude-3.5-haiku) */
  model?: string;
}

/**
 * Default model for extraction
 */
const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku';

/**
 * System prompt for booking extraction
 */
const EXTRACTION_PROMPT = `You are an expert at extracting travel booking details from various documents.

Extract ALL booking information and return structured JSON matching the segment schema.

Common document types:
- Flight confirmations (airlines, booking sites)
- Hotel confirmations (hotels, Airbnb, Booking.com)
- Activity bookings (tours, tickets, events)
- Car rentals (rental companies)
- Restaurant reservations
- Event tickets

For each booking found, extract:
- Type: FLIGHT, HOTEL, ACTIVITY, TRANSFER, or CUSTOM
- Start/end dates and times (REQUIRED)
- Location details
- Confirmation numbers
- Provider information
- Prices (if available)

Return JSON in this exact format:
{
  "segments": [
    {
      "type": "FLIGHT|HOTEL|ACTIVITY|TRANSFER|CUSTOM",
      "status": "CONFIRMED|TENTATIVE",
      "startDatetime": "ISO 8601 date-time",
      "endDatetime": "ISO 8601 date-time",
      "confirmationNumber": "string",
      "bookingReference": "string",
      "provider": { "name": "string", "code": "string" },
      "price": { "amount": number, "currency": "USD" },
      "notes": "string",
      "inferred": false,

      // Flight-specific (if type=FLIGHT):
      "airline": { "name": "string", "code": "string" },
      "flightNumber": "string",
      "origin": { "name": "string", "code": "string", "city": "string", "country": "string" },
      "destination": { "name": "string", "code": "string", "city": "string", "country": "string" },
      "cabinClass": "ECONOMY|PREMIUM_ECONOMY|BUSINESS|FIRST",

      // Hotel-specific (if type=HOTEL):
      "property": { "name": "string", "code": "string" },
      "location": { "name": "string", "address": "string", "city": "string", "country": "string" },
      "checkInDate": "ISO 8601 date",
      "checkOutDate": "ISO 8601 date",
      "checkInTime": "HH:MM",
      "checkOutTime": "HH:MM",
      "roomType": "string",
      "roomCount": number,

      // Activity-specific (if type=ACTIVITY):
      "name": "string",
      "description": "string",
      "location": { "name": "string", "address": "string", "city": "string", "country": "string" },
      "category": "string",

      // Transfer-specific (if type=TRANSFER):
      "transferType": "TAXI|UBER|RENTAL_CAR|SHUTTLE|TRAIN|BUS",
      "pickupLocation": { "name": "string", "address": "string", "city": "string", "country": "string" },
      "dropoffLocation": { "name": "string", "address": "string", "city": "string", "country": "string" },
      "vehicleDetails": "string"
    }
  ],
  "confidence": 0.0-1.0,
  "summary": "Brief description of what was found"
}

CRITICAL RULES:
1. ONLY include fields relevant to the segment type
2. startDatetime and endDatetime are REQUIRED
3. Use ISO 8601 format for dates/datetimes
4. Set confidence based on data clarity (0.9+ for clear, 0.5-0.8 for partial)
5. If no bookings found, return empty segments array with confidence 0
6. Extract ALL prices and confirmation numbers
7. For hotels: checkInDate/checkOutDate should match startDatetime/endDatetime dates`;

/**
 * LLM-based extractor for unstructured text
 */
export class LLMExtractor {
  private client: OpenAI;
  private config: LLMExtractorConfig;

  constructor(config: LLMExtractorConfig) {
    this.config = {
      ...config,
      model: config.model || DEFAULT_MODEL,
    };

    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/itinerizer',
        'X-Title': 'Itinerizer Import Service',
      },
    });
  }

  /**
   * Extract booking data from text using LLM
   */
  async extract(text: string, format: ImportFormat): Promise<ImportResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model!,
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          {
            role: 'user',
            content: `Extract booking details from this ${format} document:\n\n${text}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 4096,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        return {
          success: false,
          format,
          segments: [],
          confidence: 0,
          errors: ['LLM returned empty response'],
        };
      }

      const parsed = JSON.parse(result);

      // Validate and convert segments
      const segments = this.validateAndConvertSegments(parsed.segments || []);

      return {
        success: segments.length > 0,
        format,
        segments,
        confidence: parsed.confidence || 0,
        summary: parsed.summary || `Found ${segments.length} booking(s)`,
        rawText: text.substring(0, 1000), // Store sample for debugging
      };
    } catch (error) {
      return {
        success: false,
        format,
        segments: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error during LLM extraction'],
      };
    }
  }

  /**
   * Validate and convert segments from LLM response
   */
  private validateAndConvertSegments(segments: any[]): ExtractedSegment[] {
    return segments
      .map((segment) => {
        try {
          // Validate required fields
          if (!segment.type || !Object.values(SegmentType).includes(segment.type)) {
            console.warn(`Invalid segment type: ${segment.type}`);
            return null;
          }

          if (!segment.startDatetime || !segment.endDatetime) {
            console.warn('Missing required datetime fields');
            return null;
          }

          // Convert dates
          segment.startDatetime = new Date(segment.startDatetime);
          segment.endDatetime = new Date(segment.endDatetime);

          if (segment.type === SegmentType.HOTEL) {
            if (segment.checkInDate) segment.checkInDate = new Date(segment.checkInDate);
            if (segment.checkOutDate) segment.checkOutDate = new Date(segment.checkOutDate);
          }

          // Set default status
          if (!segment.status) {
            segment.status = SegmentStatus.CONFIRMED;
          }

          // Add default confidence if missing
          if (!segment.confidence) {
            segment.confidence = 0.8;
          }

          return segment as ExtractedSegment;
        } catch (error) {
          console.warn('Failed to convert segment:', error);
          return null;
        }
      })
      .filter((s): s is ExtractedSegment => s !== null);
  }
}
