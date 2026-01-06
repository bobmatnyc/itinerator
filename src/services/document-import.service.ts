/**
 * Document import service - orchestrates the full import pipeline
 * @module services/document-import
 */

import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { createStorageError, createValidationError } from '../core/errors.js';
import type { StorageError, ValidationError } from '../core/errors.js';
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';
import type { ImportConfig, ImportResult, ModelTestResult, StructuredMarkdown, TokenUsage } from '../domain/types/import.js';
import { DEFAULT_IMPORT_MODEL } from '../domain/types/import.js';
import type { Itinerary } from '../domain/types/itinerary.js';
import type { ItineraryService } from './itinerary.service.js';
import { CostTrackerService } from './cost-tracker.service.js';
import { LLMService } from './llm.service.js';
import { MarkdownConverterService } from './markdown-converter.service.js';
import { PDFExtractorService } from './pdf-extractor.service.js';
import { SegmentContinuityService } from './segment-continuity.service.js';
import { GapType, type LocationGap } from './segment-continuity.service.js';
import type { Segment, FlightSegment, TransferSegment, HotelSegment, ActivitySegment, MeetingSegment } from '../domain/types/segment.js';
import { SegmentType } from '../domain/types/common.js';
import { generateSegmentId } from '../domain/types/branded.js';
import { TravelAgentService } from './travel-agent.service.js';
import { ModelSelectorService } from './model-selector.service.js';
import { DurationInferenceService } from './duration-inference.service.js';
import { TravelAgentReviewService } from './travel-agent-review.service.js';
import { GeocodingService } from './geocoding.service.js';
import type { Location } from '../domain/types/location.js';

/**
 * Import preview result (before LLM processing)
 */
export interface ImportPreview {
  /** Source file path */
  sourceFile: string;
  /** Raw text extracted from PDF */
  rawText: string;
  /** Structured markdown */
  structuredMarkdown: StructuredMarkdown;
  /** PDF metadata */
  metadata: {
    pages: number;
    title?: string;
    author?: string;
  };
}

/**
 * Geographic continuity validation result
 */
export interface ContinuityValidationResult {
  /** True if geographic continuity is valid (no gaps) */
  valid: boolean;
  /** Detected location gaps */
  gaps: LocationGap[];
  /** Number of segments validated */
  segmentCount: number;
  /** Human-readable summary */
  summary: string;
}

/**
 * Service for importing documents into itineraries
 */
export class DocumentImportService {
  private pdfExtractor: PDFExtractorService;
  private markdownConverter: MarkdownConverterService;
  private llmService: LLMService;
  private costTracker: CostTrackerService;
  private continuityService: SegmentContinuityService;
  private modelSelector: ModelSelectorService;
  private durationInference: DurationInferenceService;
  private reviewService: TravelAgentReviewService;
  private geocodingService: GeocodingService;
  private itineraryService?: ItineraryService;
  private travelAgent?: TravelAgentService;

  /**
   * Creates a new document import service
   * @param config - Import configuration
   * @param itineraryService - Optional itinerary service for saving results
   */
  constructor(
    private config: ImportConfig,
    itineraryService?: ItineraryService
  ) {
    this.pdfExtractor = new PDFExtractorService();
    this.markdownConverter = new MarkdownConverterService();
    this.llmService = new LLMService(config);
    this.costTracker = new CostTrackerService(
      config.costLogPath ?? './data/imports/cost-log.json',
      config.costTrackingEnabled ?? true
    );
    this.continuityService = new SegmentContinuityService();
    this.modelSelector = new ModelSelectorService();
    this.durationInference = new DurationInferenceService();
    this.reviewService = new TravelAgentReviewService();
    this.geocodingService = new GeocodingService();
    this.itineraryService = itineraryService;

    // Initialize TravelAgentService if SerpAPI is configured
    if (config.serpapi?.apiKey) {
      this.travelAgent = new TravelAgentService(config.serpapi);
    }
  }

  /**
   * Initialize the import service
   */
  async initialize(): Promise<Result<void, StorageError>> {
    return this.costTracker.initialize();
  }

  /**
   * Import a PDF file and create an itinerary
   * @param filePath - Path to the PDF file
   * @param options - Import options
   * @returns Result with import result
   */
  async import(
    filePath: string,
    options: {
      model?: string;
      saveToStorage?: boolean;
    } = {}
  ): Promise<Result<ImportResult, StorageError | ValidationError>> {
    const { model, saveToStorage = false } = options;
    const startTime = Date.now();

    // Step 1: Extract text from PDF
    const extractResult = await this.pdfExtractor.extract(filePath);
    if (!extractResult.success) {
      return extractResult;
    }

    const { text, pages, metadata } = extractResult.value;

    if (!text.trim()) {
      return err(
        createValidationError('INVALID_DATA', 'PDF contains no extractable text', 'content', {
          hint: 'This may be a scanned PDF. Consider using OCR first.',
        })
      );
    }

    // Step 2: Convert to structured markdown
    const structuredMarkdown = this.markdownConverter.convert(text);

    // Step 3: Select model if not specified
    let selectedModel = model;
    if (!selectedModel) {
      const modelResult = await this.modelSelector.selectModelForFile(filePath);
      if (modelResult.success) {
        selectedModel = modelResult.value.name;
        const fs = await import('node:fs/promises');
        const stats = await fs.stat(filePath);
        const fileSizeMB = (stats.size / 1_000_000).toFixed(2);
        console.log(`📊 Auto-selected model: ${selectedModel}`);
        console.log(`   File size: ${fileSizeMB}MB`);
        console.log(`   Max tokens: ${modelResult.value.maxTokens.toLocaleString()}`);
      }
    }

    // Step 4: Parse with LLM
    const llmResult = await this.llmService.parseItinerary(structuredMarkdown.markdown, selectedModel);

    if (!llmResult.success) {
      // Log failed attempt
      if (this.config.costTrackingEnabled) {
        await this.costTracker.logUsage(
          {
            model: model ?? DEFAULT_IMPORT_MODEL,
            inputTokens: 0,
            outputTokens: 0,
            costUSD: 0,
            timestamp: new Date(),
          },
          filePath,
          false
        );
      }
      return llmResult;
    }

    let { itinerary, usage } = llmResult.value;
    const endTime = Date.now();

    // Geocode locations to add coordinates
    itinerary = await this.geocodeItinerary(itinerary);

    // Enhance itinerary metadata with import information
    itinerary = this.enhanceItineraryMetadata(itinerary, filePath, usage, startTime, endTime);

    // Log successful usage
    if (this.config.costTrackingEnabled) {
      await this.costTracker.logUsage(usage, filePath, true);
    }

    // Step 4: Save to storage if requested
    // Save the full parsed itinerary (with segments) directly
    if (saveToStorage && this.itineraryService) {
      const saveResult = await this.itineraryService.saveImported(itinerary);

      if (!saveResult.success) {
        return saveResult;
      }
    }

    return ok({
      id: randomUUID(),
      sourceFile: filePath,
      extractedMarkdown: structuredMarkdown.markdown,
      parsedItinerary: itinerary,
      usage,
      timestamp: new Date(),
    });
  }

  /**
   * Preview import without LLM processing
   * @param filePath - Path to the PDF file
   * @returns Result with preview
   */
  async preview(filePath: string): Promise<Result<ImportPreview, StorageError | ValidationError>> {
    // Extract text from PDF
    const extractResult = await this.pdfExtractor.extract(filePath);
    if (!extractResult.success) {
      return extractResult;
    }

    const { text, pages, metadata } = extractResult.value;

    if (!text.trim()) {
      return err(
        createValidationError('INVALID_DATA', 'PDF contains no extractable text', 'content')
      );
    }

    // Convert to structured markdown
    const structuredMarkdown = this.markdownConverter.convert(text);

    return ok({
      sourceFile: filePath,
      rawText: text,
      structuredMarkdown,
      metadata: {
        pages,
        title: metadata.title,
        author: metadata.author,
      },
    });
  }

  /**
   * Test multiple models on the same PDF
   * @param filePath - Path to the PDF file
   * @param models - Models to test (default: all known models)
   * @returns Results for each model
   */
  async testModels(
    filePath: string,
    models?: string[]
  ): Promise<Result<ModelTestResult[], StorageError | ValidationError>> {
    // Extract and convert once
    const extractResult = await this.pdfExtractor.extract(filePath);
    if (!extractResult.success) {
      return extractResult;
    }

    const { text } = extractResult.value;

    if (!text.trim()) {
      return err(
        createValidationError('INVALID_DATA', 'PDF contains no extractable text', 'content')
      );
    }

    const structuredMarkdown = this.markdownConverter.convert(text);
    const markdown = structuredMarkdown.markdown;

    // Test each model
    const modelsToTest = models ?? this.llmService.getAvailableModels();
    const results: ModelTestResult[] = [];

    for (const model of modelsToTest) {
      const startTime = Date.now();

      try {
        const result = await this.llmService.parseItinerary(markdown, model);
        const durationMs = Date.now() - startTime;

        if (result.success) {
          // Log usage
          await this.costTracker.logUsage(result.value.usage, filePath, true);

          results.push({
            model,
            success: true,
            itinerary: result.value.itinerary,
            usage: result.value.usage,
            durationMs,
          });
        } else {
          results.push({
            model,
            success: false,
            error: result.error.message,
            usage: {
              model,
              inputTokens: 0,
              outputTokens: 0,
              costUSD: 0,
              timestamp: new Date(),
            },
            durationMs,
          });
        }
      } catch (error) {
        results.push({
          model,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          usage: {
            model,
            inputTokens: 0,
            outputTokens: 0,
            costUSD: 0,
            timestamp: new Date(),
          },
          durationMs: Date.now() - startTime,
        });
      }
    }

    return ok(results);
  }

  /**
   * Get cost tracking summary
   */
  async getCostSummary() {
    return this.costTracker.getSummary();
  }

  /**
   * Check if the service is properly configured
   */
  async checkConfiguration(): Promise<Result<boolean, StorageError>> {
    return this.llmService.testConnection();
  }

  /**
   * Get available models for testing
   */
  getAvailableModels(): string[] {
    return this.llmService.getAvailableModels();
  }

  /**
   * Validate geographic continuity of an itinerary
   * @param itinerary - Itinerary to validate
   * @returns Validation result with detected gaps
   */
  validateGeographicContinuity(itinerary: Itinerary): ContinuityValidationResult {
    // Sort segments chronologically
    const sortedSegments = this.continuityService.sortSegments(itinerary.segments);

    // Detect gaps
    const gaps = this.continuityService.detectLocationGaps(sortedSegments);

    // Build summary
    let summary: string;
    if (gaps.length === 0) {
      summary = 'All segments are geographically continuous. No transportation gaps detected.';
    } else {
      const gapDescriptions = gaps.map((gap, index) => {
        return `${index + 1}. ${gap.description} (suggested: ${gap.suggestedType})`;
      });
      summary = `Found ${gaps.length} geographic gap(s):\n${gapDescriptions.join('\n')}`;
    }

    return {
      valid: gaps.length === 0,
      gaps,
      segmentCount: sortedSegments.length,
      summary,
    };
  }

  /**
   * Fill remaining geographic gaps with intelligent or placeholder segments
   * @param itinerary - Itinerary with potential gaps
   * @returns Itinerary with gap-filling segments inserted
   */
  private async fillRemainingGaps(itinerary: Itinerary): Promise<Itinerary> {
    // Step 1: Detect geographic gaps using continuity service (with 80% confidence threshold)
    const sortedSegments = this.continuityService.sortSegments(itinerary.segments);
    const gaps = this.continuityService.detectLocationGaps(sortedSegments);

    if (gaps.length === 0) {
      console.log('✓ No geographic gaps detected (all below 80% confidence threshold)');
      return itinerary;
    }

    console.log(`📍 Detected ${gaps.length} geographic gaps (>=80% confidence):`);
    gaps.forEach((gap, i) => {
      console.log(`   ${i + 1}. ${gap.description} (${gap.confidence}% confidence)`);
    });

    // Step 2: Create gap-filling segments for each gap
    const gapFillingSegments: Segment[] = [];
    for (const gap of gaps) {
      let segment: Segment;

      // Try to use TravelAgentService if available
      if (this.travelAgent) {
        try {
          const result = await this.travelAgent.fillGapIntelligently(gap, sortedSegments);
          if (result.found && result.segment) {
            segment = result.segment;
            console.log(`✓ Found real travel option: ${result.segment.type} via SerpAPI`);
          } else {
            // Fallback to placeholder if search failed
            console.log(`✗ SerpAPI search failed: ${result.error || 'Unknown error'}`);
            segment = this.createPlaceholderSegment(gap);
          }
        } catch (error) {
          // Fallback to placeholder on error
          console.error(`Error using TravelAgentService: ${error}`);
          segment = this.createPlaceholderSegment(gap);
        }
      } else {
        // No TravelAgentService configured, use placeholder
        segment = this.createPlaceholderSegment(gap);
      }

      gapFillingSegments.push(segment);
    }

    // Step 3: Insert gap-filling segments at correct positions
    // We need to insert them in reverse order to maintain correct indices
    let updatedSegments = [...sortedSegments];
    for (let i = gaps.length - 1; i >= 0; i--) {
      const gap = gaps[i];
      const gapFiller = gapFillingSegments[i];
      if (gap && gapFiller) {
        // Insert after the beforeSegment (at afterIndex position)
        updatedSegments.splice(gap.afterIndex, 0, gapFiller);
      }
    }

    // Step 4: Run semantic review to catch obvious errors
    const updatedItinerary = {
      ...itinerary,
      segments: updatedSegments,
    };

    const reviewResult = this.reviewService.reviewItinerary(updatedItinerary);

    if (!reviewResult.valid) {
      console.log('🔍 Semantic review found issues:');
      console.log(reviewResult.summary);

      // Auto-fix HIGH severity issues
      const highSeverityCount = reviewResult.issues.filter(
        (i) => i.severity === 'HIGH'
      ).length;

      if (highSeverityCount > 0) {
        console.log(`🔧 Auto-fixing ${highSeverityCount} HIGH severity issues...`);
        const fixedItinerary = this.reviewService.autoFixIssues(
          updatedItinerary,
          reviewResult
        );
        return fixedItinerary;
      }
    } else {
      console.log('✓ Semantic review passed: No issues detected');
    }

    return updatedItinerary;
  }

  /**
   * Create a placeholder segment to fill a geographic gap
   * @param gap - Geographic gap to fill
   * @returns Placeholder segment (FLIGHT or TRANSFER)
   */
  private createPlaceholderSegment(gap: LocationGap): Segment {
    const { beforeSegment, afterSegment, endLocation, startLocation, gapType, description } = gap;

    // Calculate reasonable timestamps based on adjacent segments
    // Use inferred end time for before segment if it doesn't have an endDatetime
    const beforeEnd = this.durationInference.getEffectiveEndTime(beforeSegment);
    const afterStart = afterSegment.startDatetime;

    // Validate that we have enough time between segments
    const timeDiff = afterStart.getTime() - beforeEnd.getTime();

    // Calculate placeholder start time
    // For transfers: Start after source activity ends
    // For flights: Allow more buffer time
    let placeholderStart: Date;

    if (gap.suggestedType === 'FLIGHT') {
      // Flights need more buffer (assume 1-2 hours to get to airport after activity)
      const bufferTime = 2 * 60 * 60 * 1000; // 2 hours
      placeholderStart = new Date(beforeEnd.getTime() + bufferTime);
    } else {
      // Local transfers can start shortly after activity ends
      const bufferTime = 15 * 60 * 1000; // 15 minutes
      placeholderStart = new Date(beforeEnd.getTime() + bufferTime);
    }

    // Ensure placeholder doesn't start after destination activity
    if (placeholderStart >= afterStart) {
      // Not enough time for transfer - adjust start time
      // Place it earlier, warning that this might overlap with source activity
      const minTransferTime = gap.suggestedType === 'FLIGHT' ? 60 * 60 * 1000 : 30 * 60 * 1000;
      placeholderStart = new Date(afterStart.getTime() - minTransferTime);

      // Log warning about potential overlap
      console.warn(
        `⚠ Tight schedule: Transfer from ${endLocation?.name} to ${startLocation?.name} ` +
        `may overlap with activities. Consider adjusting segment times.`
      );
    }

    // Calculate placeholder end time
    // Must end before destination activity starts
    const maxEndTime = new Date(afterStart.getTime() - 1); // 1ms before destination

    // Determine segment type based on gap type
    if (gap.suggestedType === 'FLIGHT') {
      return this.createPlaceholderFlight(
        placeholderStart,
        maxEndTime,
        endLocation,
        startLocation,
        gapType,
        description
      );
    } else {
      return this.createPlaceholderTransfer(
        placeholderStart,
        maxEndTime,
        endLocation,
        startLocation,
        description
      );
    }
  }

  /**
   * Create a placeholder flight segment
   */
  private createPlaceholderFlight(
    startDatetime: Date,
    endDatetime: Date,
    origin: any,
    destination: any,
    gapType: GapType,
    description: string
  ): FlightSegment {
    // Default duration: 1 hour for domestic, 2 hours for international
    const defaultDuration = gapType === GapType.INTERNATIONAL_GAP ? 2 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000;
    const actualEnd =
      endDatetime.getTime() - startDatetime.getTime() > 0
        ? endDatetime
        : new Date(startDatetime.getTime() + defaultDuration);

    return {
      id: generateSegmentId(),
      type: SegmentType.FLIGHT,
      status: 'TENTATIVE',
      startDatetime,
      endDatetime: actualEnd,
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'dream',
        confidence: 0.5,
        timestamp: new Date(),
      },
      airline: {
        name: 'Unknown',
        code: 'XX',
      },
      flightNumber: 'XX0000',
      origin: {
        name: origin?.name ?? 'Unknown Origin',
        code: origin?.code ?? 'XXX',
        address: origin?.address,
      },
      destination: {
        name: destination?.name ?? 'Unknown Destination',
        code: destination?.code ?? 'XXX',
        address: destination?.address,
      },
      notes: 'Placeholder flight - please verify and update with actual flight details',
      metadata: {},
      inferred: true,
      inferredReason: description,
    };
  }

  /**
   * Create a placeholder transfer segment
   */
  private createPlaceholderTransfer(
    startDatetime: Date,
    endDatetime: Date,
    pickup: any,
    dropoff: any,
    description: string
  ): TransferSegment {
    // Default duration: 30 minutes for local transfer
    const defaultDuration = 30 * 60 * 1000;
    const actualEnd =
      endDatetime.getTime() - startDatetime.getTime() > 0
        ? endDatetime
        : new Date(startDatetime.getTime() + defaultDuration);

    return {
      id: generateSegmentId(),
      type: SegmentType.TRANSFER,
      status: 'TENTATIVE',
      startDatetime,
      endDatetime: actualEnd,
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'dream',
        confidence: 0.5,
        timestamp: new Date(),
      },
      transferType: 'PRIVATE',
      pickupLocation: {
        name: pickup?.name ?? 'Unknown Pickup',
        address: pickup?.address,
      },
      dropoffLocation: {
        name: dropoff?.name ?? 'Unknown Dropoff',
        address: dropoff?.address,
      },
      notes: 'Placeholder transfer - please verify and update with actual transfer details',
      metadata: {},
      inferred: true,
      inferredReason: description,
    };
  }

  /**
   * Import with automatic continuity validation
   * @param filePath - Path to the PDF file
   * @param options - Import options
   * @returns Result with import result and continuity validation
   */
  async importWithValidation(
    filePath: string,
    options: {
      model?: string;
      saveToStorage?: boolean;
      validateContinuity?: boolean;
      fillGaps?: boolean;
    } = {}
  ): Promise<
    Result<
      ImportResult & { continuityValidation?: ContinuityValidationResult },
      StorageError | ValidationError
    >
  > {
    const { validateContinuity = true, fillGaps = true, model, saveToStorage = false } = options;
    const startTime = Date.now();

    // Step 1: Extract text from PDF
    const extractResult = await this.pdfExtractor.extract(filePath);
    if (!extractResult.success) {
      return extractResult;
    }

    const { text, pages, metadata } = extractResult.value;

    if (!text.trim()) {
      return err(
        createValidationError('INVALID_DATA', 'PDF contains no extractable text', 'content', {
          hint: 'This may be a scanned PDF. Consider using OCR first.',
        })
      );
    }

    // Step 2: Convert to structured markdown
    const structuredMarkdown = this.markdownConverter.convert(text);

    // Step 3: Select model if not specified
    let selectedModel = model;
    if (!selectedModel) {
      const modelResult = await this.modelSelector.selectModelForFile(filePath);
      if (modelResult.success) {
        selectedModel = modelResult.value.name;
        const fs = await import('node:fs/promises');
        const stats = await fs.stat(filePath);
        const fileSizeMB = (stats.size / 1_000_000).toFixed(2);
        console.log(`📊 Auto-selected model: ${selectedModel}`);
        console.log(`   File size: ${fileSizeMB}MB`);
        console.log(`   Max tokens: ${modelResult.value.maxTokens.toLocaleString()}`);
      }
    }

    // Step 4: Parse with LLM (which now searches for missing transportation)
    const llmResult = await this.llmService.parseItinerary(structuredMarkdown.markdown, selectedModel);

    if (!llmResult.success) {
      // Log failed attempt
      if (this.config.costTrackingEnabled) {
        await this.costTracker.logUsage(
          {
            model: model ?? DEFAULT_IMPORT_MODEL,
            inputTokens: 0,
            outputTokens: 0,
            costUSD: 0,
            timestamp: new Date(),
          },
          filePath,
          false
        );
      }
      return llmResult;
    }

    let { itinerary, usage } = llmResult.value;
    const endTime = Date.now();

    // Step 4a: Geocode locations to add coordinates
    itinerary = await this.geocodeItinerary(itinerary);

    // Step 4b: Fill remaining geographic gaps with intelligent/placeholder segments if requested
    if (fillGaps) {
      itinerary = await this.fillRemainingGaps(itinerary);
    }

    // Enhance itinerary metadata with import information
    itinerary = this.enhanceItineraryMetadata(itinerary, filePath, usage, startTime, endTime);

    // Log successful usage
    if (this.config.costTrackingEnabled) {
      await this.costTracker.logUsage(usage, filePath, true);
    }

    // Step 5: Save to storage if requested
    if (saveToStorage && this.itineraryService) {
      const saveResult = await this.itineraryService.saveImported(itinerary);

      if (!saveResult.success) {
        return saveResult;
      }
    }

    const importResult: ImportResult = {
      id: randomUUID(),
      sourceFile: filePath,
      extractedMarkdown: structuredMarkdown.markdown,
      parsedItinerary: itinerary,
      usage,
      timestamp: new Date(),
    };

    // Step 6: Add continuity validation if requested
    if (validateContinuity) {
      const validation = this.validateGeographicContinuity(itinerary);

      return ok({
        ...importResult,
        continuityValidation: validation,
      });
    }

    return ok(importResult);
  }

  /**
   * Geocode all locations in an itinerary
   * @param itinerary - Itinerary to geocode
   * @returns Itinerary with coordinates added to locations
   */
  private async geocodeItinerary(itinerary: Itinerary): Promise<Itinerary> {
    console.log('🌍 Geocoding locations...');

    // Step 1: Collect all unique locations from segments
    const locationQueries = new Map<string, Location>();

    for (const segment of itinerary.segments) {
      // Collect locations based on segment type
      if (segment.type === SegmentType.FLIGHT) {
        if (segment.origin) {
          const query = this.geocodingService.buildLocationQuery(segment.origin);
          if (query) locationQueries.set(query, segment.origin);
        }
        if (segment.destination) {
          const query = this.geocodingService.buildLocationQuery(segment.destination);
          if (query) locationQueries.set(query, segment.destination);
        }
      } else if (segment.type === SegmentType.HOTEL) {
        if (segment.location) {
          const query = this.geocodingService.buildLocationQuery(segment.location);
          if (query) locationQueries.set(query, segment.location);
        }
      } else if (segment.type === SegmentType.MEETING) {
        if (segment.location) {
          const query = this.geocodingService.buildLocationQuery(segment.location);
          if (query) locationQueries.set(query, segment.location);
        }
      } else if (segment.type === SegmentType.ACTIVITY) {
        if (segment.location) {
          const query = this.geocodingService.buildLocationQuery(segment.location);
          if (query) locationQueries.set(query, segment.location);
        }
      } else if (segment.type === SegmentType.TRANSFER) {
        if (segment.pickupLocation) {
          const query = this.geocodingService.buildLocationQuery(segment.pickupLocation);
          if (query) locationQueries.set(query, segment.pickupLocation);
        }
        if (segment.dropoffLocation) {
          const query = this.geocodingService.buildLocationQuery(segment.dropoffLocation);
          if (query) locationQueries.set(query, segment.dropoffLocation);
        }
      }
    }

    if (locationQueries.size === 0) {
      console.log('✓ No locations to geocode');
      return itinerary;
    }

    console.log(`   Found ${locationQueries.size} unique locations to geocode`);

    // Step 2: Geocode all locations in batch
    const queries = Array.from(locationQueries.keys());
    const geocodingResults = await this.geocodingService.geocodeBatch(queries);

    // Step 3: Create a map of location references to geocoded coordinates
    const coordinatesByQuery = new Map<string, { latitude: number; longitude: number }>();
    let successCount = 0;
    let failedCount = 0;

    for (const [query, result] of geocodingResults) {
      if (result) {
        coordinatesByQuery.set(query, {
          latitude: result.latitude,
          longitude: result.longitude,
        });
        successCount++;
        console.log(`   ✓ ${query} → ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`);
      } else {
        failedCount++;
        console.log(`   ✗ ${query} → not found`);
      }
    }

    console.log(`✓ Geocoded ${successCount} locations, ${failedCount} failed`);

    // Step 4: Update segments with coordinates
    const updatedSegments = itinerary.segments.map((segment) => {
      const updatedSegment = { ...segment };

      if (segment.type === SegmentType.FLIGHT) {
        const flightSegment = segment as FlightSegment;
        const updatedFlight = updatedSegment as FlightSegment;
        if (flightSegment.origin) {
          const query = this.geocodingService.buildLocationQuery(flightSegment.origin);
          const coords = coordinatesByQuery.get(query);
          if (coords && !flightSegment.origin.coordinates) {
            updatedFlight.origin = { ...flightSegment.origin, coordinates: coords };
          }
        }
        if (flightSegment.destination) {
          const query = this.geocodingService.buildLocationQuery(flightSegment.destination);
          const coords = coordinatesByQuery.get(query);
          if (coords && !flightSegment.destination.coordinates) {
            updatedFlight.destination = { ...flightSegment.destination, coordinates: coords };
          }
        }
      } else if (segment.type === SegmentType.HOTEL) {
        const hotelSegment = segment as HotelSegment;
        const updatedHotel = updatedSegment as HotelSegment;
        if (hotelSegment.location) {
          const query = this.geocodingService.buildLocationQuery(hotelSegment.location);
          const coords = coordinatesByQuery.get(query);
          if (coords && !hotelSegment.location.coordinates) {
            updatedHotel.location = { ...hotelSegment.location, coordinates: coords };
          }
        }
      } else if (segment.type === SegmentType.MEETING) {
        const meetingSegment = segment as MeetingSegment;
        const updatedMeeting = updatedSegment as MeetingSegment;
        if (meetingSegment.location) {
          const query = this.geocodingService.buildLocationQuery(meetingSegment.location);
          const coords = coordinatesByQuery.get(query);
          if (coords && !meetingSegment.location.coordinates) {
            updatedMeeting.location = { ...meetingSegment.location, coordinates: coords };
          }
        }
      } else if (segment.type === SegmentType.ACTIVITY) {
        const activitySegment = segment as ActivitySegment;
        const updatedActivity = updatedSegment as ActivitySegment;
        if (activitySegment.location) {
          const query = this.geocodingService.buildLocationQuery(activitySegment.location);
          const coords = coordinatesByQuery.get(query);
          if (coords && !activitySegment.location.coordinates) {
            updatedActivity.location = { ...activitySegment.location, coordinates: coords };
          }
        }
      } else if (segment.type === SegmentType.TRANSFER) {
        const transferSegment = segment as TransferSegment;
        const updatedTransfer = updatedSegment as TransferSegment;
        if (transferSegment.pickupLocation) {
          const query = this.geocodingService.buildLocationQuery(transferSegment.pickupLocation);
          const coords = coordinatesByQuery.get(query);
          if (coords && !transferSegment.pickupLocation.coordinates) {
            updatedTransfer.pickupLocation = { ...transferSegment.pickupLocation, coordinates: coords };
          }
        }
        if (transferSegment.dropoffLocation) {
          const query = this.geocodingService.buildLocationQuery(transferSegment.dropoffLocation);
          const coords = coordinatesByQuery.get(query);
          if (coords && !transferSegment.dropoffLocation.coordinates) {
            updatedTransfer.dropoffLocation = { ...transferSegment.dropoffLocation, coordinates: coords };
          }
        }
      }

      return updatedSegment;
    });

    return {
      ...itinerary,
      segments: updatedSegments,
    };
  }

  /**
   * Enhance itinerary metadata with import information
   * @param itinerary - Itinerary to enhance
   * @param filePath - Source file path
   * @param usage - Token usage information
   * @param startTime - Import start time in milliseconds
   * @param endTime - Import end time in milliseconds
   * @returns Enhanced itinerary with metadata
   */
  private enhanceItineraryMetadata(
    itinerary: Itinerary,
    filePath: string,
    usage: TokenUsage,
    startTime: number,
    endTime: number
  ): Itinerary {
    const importedAt = new Date().toISOString();
    const processingTimeMs = endTime - startTime;

    // Add import metadata to itinerary
    const enhancedMetadata = {
      ...itinerary.metadata,
      importSource: {
        filename: basename(filePath),
        importedAt,
        model: usage.model,
        processingTimeMs,
      },
      llmUsage: {
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
        totalCost: usage.costUSD,
      },
    };

    // Enhance each segment's sourceDetails with model and timestamp
    const enhancedSegments = itinerary.segments.map((segment) => {
      // Only enhance segments from import source (not agent-generated)
      if (segment.source === 'import') {
        return {
          ...segment,
          sourceDetails: {
            ...segment.sourceDetails,
            model: usage.model,
            timestamp: new Date(importedAt),
          },
        };
      }
      return segment;
    });

    return {
      ...itinerary,
      metadata: enhancedMetadata,
      segments: enhancedSegments,
    };
  }
}
