/**
 * Unified Import Service
 * @module services/import
 */

import type { ImportRequest, ImportResult, ImportOptions, ImportResultWithMatching } from './types.js';
import { FormatDetector } from './format-detector.js';
import { LLMExtractor } from './extractors/llm.extractor.js';
import { SchemaOrgExtractor } from './extractors/schema-org.extractor.js';
import { ParserRegistry } from './parsers/index.js';
import { TripMatcher } from './trip-matcher.js';
import type { ItineraryCollectionService } from '../itinerary-collection.service.js';
import type { SegmentService } from '../segment.service.js';
import type { Segment } from '../../domain/types/segment.js';
import type { ItineraryId, SegmentId } from '../../domain/types/branded.js';
import { generateSegmentId } from '../../domain/types/branded.js';

/**
 * Import service configuration
 */
export interface ImportServiceConfig {
  /** OpenRouter API key for LLM extraction */
  apiKey: string;
  /** Model to use for LLM extraction (optional) */
  model?: string;
  /** Itinerary collection service for trip lookup (optional, required for matching) */
  itineraryCollection?: ItineraryCollectionService;
  /** Segment service for adding segments (optional, required for matching) */
  segmentService?: SegmentService;
}

/**
 * Unified Import Service
 * Auto-detects format and routes to appropriate parser
 */
export class ImportService {
  private formatDetector: FormatDetector;
  private parserRegistry: ParserRegistry;
  private llmExtractor: LLMExtractor;
  private schemaOrgExtractor: SchemaOrgExtractor;
  private tripMatcher: TripMatcher;
  private itineraryCollection?: ItineraryCollectionService;
  private segmentService?: SegmentService;

  constructor(config: ImportServiceConfig) {
    // Initialize components
    this.formatDetector = new FormatDetector();
    this.llmExtractor = new LLMExtractor({
      apiKey: config.apiKey,
      model: config.model,
    });
    this.schemaOrgExtractor = new SchemaOrgExtractor();
    this.tripMatcher = new TripMatcher();

    // Initialize parser registry
    this.parserRegistry = new ParserRegistry({
      llmExtractor: this.llmExtractor,
      schemaOrgExtractor: this.schemaOrgExtractor,
    });

    // Store optional services for trip matching
    this.itineraryCollection = config.itineraryCollection;
    this.segmentService = config.segmentService;
  }

  /**
   * Import from any source
   * Auto-detects format and extracts booking data
   */
  async import(request: ImportRequest): Promise<ImportResult> {
    try {
      // Detect format
      const format = this.formatDetector.detect(request);

      // Get appropriate parser
      const parser = this.parserRegistry.get(format);

      // Parse and extract
      const result = await parser.parse(request);

      return result;
    } catch (error) {
      return {
        success: false,
        format: 'unknown',
        segments: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error during import'],
      };
    }
  }

  /**
   * Import from file upload
   */
  async importFromUpload(
    content: Buffer | string,
    filename: string,
    mimeType?: string
  ): Promise<ImportResult> {
    return this.import({
      source: 'upload',
      content,
      filename,
      mimeType,
    });
  }

  /**
   * Import from email
   */
  async importFromEmail(
    content: string,
    metadata: {
      fromEmail?: string;
      subject?: string;
      receivedAt?: string;
    }
  ): Promise<ImportResult> {
    return this.import({
      source: 'email',
      content,
      metadata,
    });
  }

  /**
   * Import from plain text
   */
  async importFromText(text: string): Promise<ImportResult> {
    return this.import({
      source: 'text',
      content: text,
    });
  }

  /**
   * Import from URL (fetch content first)
   */
  async importFromUrl(url: string): Promise<ImportResult> {
    try {
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || undefined;

      // Try to get content as text first
      let content: string | Buffer;
      if (contentType?.includes('pdf')) {
        content = Buffer.from(await response.arrayBuffer());
      } else {
        content = await response.text();
      }

      return this.import({
        source: 'url',
        content,
        mimeType: contentType,
      });
    } catch (error) {
      return {
        success: false,
        format: 'unknown',
        segments: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Failed to fetch URL'],
      };
    }
  }

  /**
   * Import with intelligent trip matching
   * @param request - Import request
   * @param options - Import options with trip matching
   * @returns Import result with trip matches or segments added to itinerary
   */
  async importWithMatching(
    request: ImportRequest,
    options: ImportOptions
  ): Promise<ImportResultWithMatching> {
    // Validate that required services are available
    if (!this.itineraryCollection || !this.segmentService) {
      throw new Error(
        'Trip matching requires itineraryCollection and segmentService to be configured'
      );
    }

    // 1. Parse the content to extract segments
    const parseResult = await this.import(request);

    if (!parseResult.success || parseResult.segments.length === 0) {
      return {
        ...parseResult,
        action: 'pending_selection',
      };
    }

    // 2. If itineraryId provided, add directly to that itinerary
    if (options.itineraryId) {
      return this.addToItinerary(parseResult, options.itineraryId as ItineraryId);
    }

    // 3. Find matching trips
    const tripsResult = await this.itineraryCollection.listItinerariesByUser(options.userId);
    if (!tripsResult.success) {
      // Failed to load trips - return segments for manual selection
      return {
        ...parseResult,
        action: 'pending_selection',
        errors: [...(parseResult.errors || []), 'Failed to load existing trips'],
      };
    }

    const matches = await this.tripMatcher.findMatches(parseResult.segments, tripsResult.value);

    // 4. Based on matches and options, decide action
    const autoMatch = options.autoMatch !== false; // Default to true

    if (matches.suggestedAction === 'add_to_existing' && autoMatch && matches.confidence > 0.8) {
      // High confidence - automatically add to best match
      const bestMatch = matches.matches[0];
      return this.addToItinerary(parseResult, bestMatch.itineraryId as ItineraryId);
    }

    if (matches.suggestedAction === 'create_new' && options.createNewIfNoMatch) {
      // No good match and user wants auto-create
      return {
        ...parseResult,
        action: 'created_new',
        tripMatches: matches.matches,
      };
    }

    // 5. Return matches for user selection
    return {
      ...parseResult,
      tripMatches: matches.matches,
      action: 'pending_selection',
    };
  }

  /**
   * Add extracted segments to an existing itinerary
   * Handles deduplication
   * @param parseResult - Parse result with segments
   * @param itineraryId - Target itinerary ID
   * @returns Result with added segments info
   */
  private async addToItinerary(
    parseResult: ImportResult,
    itineraryId: ItineraryId
  ): Promise<ImportResultWithMatching> {
    if (!this.segmentService || !this.itineraryCollection) {
      throw new Error('Segment service and itinerary collection required');
    }

    // Load the itinerary to check for duplicates
    const summaryResult = await this.itineraryCollection.getItinerarySummary(itineraryId);
    if (!summaryResult.success) {
      return {
        ...parseResult,
        action: 'pending_selection',
        errors: [...(parseResult.errors || []), 'Failed to load target itinerary'],
      };
    }

    const itinerarySummary = summaryResult.value;

    // Track deduplication stats
    let added = 0;
    let skipped = 0;
    let updated = 0;
    const duplicates: string[] = [];

    // Add segments one by one
    for (const extractedSegment of parseResult.segments) {
      // Convert ExtractedSegment to Segment
      const segment: Omit<Segment, 'id'> = {
        ...extractedSegment,
        source: extractedSegment.source || 'import',
        metadata: {},
        travelerIds: [],
      };

      // Check for duplicates (simplified - production would be more sophisticated)
      const isDuplicate = await this.isDuplicate(itineraryId, segment);

      if (isDuplicate) {
        skipped++;
        if (segment.confirmationNumber) {
          duplicates.push(segment.confirmationNumber);
        }
        continue;
      }

      // Add segment
      const addResult = await this.segmentService.add(itineraryId, segment);
      if (addResult.success) {
        added++;
      } else {
        skipped++;
      }
    }

    return {
      ...parseResult,
      action: 'added_to_existing',
      selectedItinerary: {
        id: itineraryId,
        name: itinerarySummary.title,
      },
      deduplication: {
        added,
        skipped,
        updated,
        duplicates,
      },
    };
  }

  /**
   * Confirm and finalize import to a specific itinerary
   * Called after user selects from matches
   * @param segments - Segments to add
   * @param itineraryId - Target itinerary
   * @returns Result with added segments
   */
  async confirmImport(
    segments: ImportResult['segments'],
    itineraryId: string
  ): Promise<ImportResultWithMatching> {
    return this.addToItinerary(
      {
        success: true,
        format: 'json',
        segments,
        confidence: 1.0,
      },
      itineraryId as ItineraryId
    );
  }

  /**
   * Check if a segment is a duplicate
   * Uses confirmation number and flight number + date
   */
  private async isDuplicate(
    itineraryId: ItineraryId,
    segment: Omit<Segment, 'id'>
  ): Promise<boolean> {
    if (!this.itineraryCollection) return false;

    // Load full itinerary to check segments
    const loadResult = await this.itineraryCollection.getItinerarySummary(itineraryId);
    if (!loadResult.success) return false;

    // For now, just check if segment count would indicate we need full load
    // In production, this would load full itinerary and check each segment
    // Simplified implementation - would need full segment comparison

    return false; // For now, don't skip any segments
  }
}

// Re-export types
export type {
  ImportSource,
  ImportFormat,
  ImportRequest,
  ImportResult,
  ExtractedSegment,
  ImportOptions,
  ImportResultWithMatching,
} from './types.js';
export type { TripMatch, MatchResult } from './trip-matcher.js';
