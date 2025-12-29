/**
 * Import Service Types
 * @module services/import/types
 */

import type { Segment } from '../../domain/types/segment.js';

/**
 * Import source - where the data came from
 */
export type ImportSource = 'upload' | 'email' | 'text' | 'url';

/**
 * Import format - what format the data is in
 */
export type ImportFormat = 'pdf' | 'email' | 'ics' | 'text' | 'json' | 'html' | 'unknown';

/**
 * Import request data
 */
export interface ImportRequest {
  /** Where the import came from */
  source: ImportSource;
  /** Content as string or Buffer */
  content: string | Buffer;
  /** MIME type (optional, helps with detection) */
  mimeType?: string;
  /** Filename (optional, helps with detection) */
  filename?: string;
  /** Additional metadata */
  metadata?: {
    /** From email address (for email imports) */
    fromEmail?: string;
    /** Email subject (for email imports) */
    subject?: string;
    /** When email was received (for email imports) */
    receivedAt?: string;
  };
}

/**
 * Import result from any parser
 */
export interface ImportResult {
  /** Whether the import succeeded */
  success: boolean;
  /** Detected format */
  format: ImportFormat;
  /** Extracted segments */
  segments: ExtractedSegment[];
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Raw extracted text (optional, for debugging) */
  rawText?: string;
  /** Errors or warnings */
  errors?: string[];
  /** Summary of what was found */
  summary?: string;
}

/**
 * Extracted segment with confidence score
 * Omits id, metadata, travelerIds which are added when saving to itinerary
 * Makes source optional since it's set during import
 */
export interface ExtractedSegment extends Omit<Segment, 'id' | 'metadata' | 'travelerIds' | 'source'> {
  /** Confidence score for this segment (0-1) */
  confidence: number;
  /** Source is optional for extracted segments (set during import) */
  source?: 'import' | 'user' | 'agent';
}

/**
 * Parser interface - all parsers must implement this
 */
export interface IParser {
  /** Formats this parser can handle */
  supportedFormats: ImportFormat[];
  /** Parse the content and extract segments */
  parse(request: ImportRequest): Promise<ImportResult>;
}

/**
 * Format detector interface
 */
export interface IFormatDetector {
  /** Detect format from request */
  detect(request: ImportRequest): ImportFormat;
}

/**
 * Extractor interface - for extracting structured data from raw text
 */
export interface IExtractor {
  /** Extract booking data from text */
  extract(text: string, format: ImportFormat): Promise<ImportResult>;
}
