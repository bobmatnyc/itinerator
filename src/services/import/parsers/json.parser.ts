/**
 * JSON Parser - Parse pre-structured segment JSON
 * @module services/import/parsers/json
 */

import type { IParser, ImportRequest, ImportResult, ImportFormat, ExtractedSegment } from '../types.js';
import { segmentSchema } from '../../../domain/schemas/segment.schema.js';
import { SegmentType, SegmentStatus } from '../../../domain/types/common.js';

/**
 * JSON parser for already-structured segment data
 */
export class JSONParser implements IParser {
  supportedFormats: ImportFormat[] = ['json'];

  /**
   * Parse JSON and validate against segment schema
   */
  async parse(request: ImportRequest): Promise<ImportResult> {
    try {
      // Parse JSON content
      const content = Buffer.isBuffer(request.content)
        ? request.content.toString('utf8')
        : request.content;

      const parsed = JSON.parse(content);

      // Handle both single segment and array of segments
      const rawSegments = Array.isArray(parsed) ? parsed : [parsed];

      const segments: ExtractedSegment[] = [];
      const errors: string[] = [];

      // Validate and convert each segment
      for (let i = 0; i < rawSegments.length; i++) {
        try {
          const segment = this.validateSegment(rawSegments[i]);
          if (segment) {
            segments.push(segment);
          }
        } catch (error) {
          errors.push(
            `Segment ${i}: ${error instanceof Error ? error.message : 'Validation failed'}`
          );
        }
      }

      return {
        success: segments.length > 0,
        format: 'json',
        segments,
        confidence: 1.0, // Perfect confidence for valid JSON
        summary: `Validated ${segments.length} segment(s) from JSON`,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        format: 'json',
        segments: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Failed to parse JSON'],
      };
    }
  }

  /**
   * Validate segment against schema
   */
  private validateSegment(data: any): ExtractedSegment | null {
    try {
      // Add default values
      if (!data.status) {
        data.status = SegmentStatus.CONFIRMED;
      }

      // Convert date strings to Date objects
      if (data.startDatetime) {
        data.startDatetime = new Date(data.startDatetime);
      }
      if (data.endDatetime) {
        data.endDatetime = new Date(data.endDatetime);
      }

      // Convert hotel dates
      if (data.type === SegmentType.HOTEL) {
        if (data.checkInDate) data.checkInDate = new Date(data.checkInDate);
        if (data.checkOutDate) data.checkOutDate = new Date(data.checkOutDate);
      }

      // Validate against Zod schema (without id, metadata, travelerIds)
      const validated = segmentSchema.parse(data);

      // Add default confidence
      // Type assertion is safe here because we've validated against segment schema
      return {
        ...validated,
        confidence: 1.0,
      } as any as ExtractedSegment;
    } catch (error) {
      console.warn('Segment validation failed:', error);
      return null;
    }
  }
}
