/**
 * Travel Agent Facade Service
 * Wraps all Travel Agent capabilities into a single, simple interface
 * @module services/travel-agent-facade
 */

import type { ItineraryId } from '../domain/types/branded.js';
import type { Itinerary } from '../domain/types/itinerary.js';
import type { Segment } from '../domain/types/segment.js';
import type { Result } from '../core/result.js';
import type { StorageError } from '../core/errors.js';
import { ItineraryService } from './itinerary.service.js';
import { TravelAgentService, type TravelSearchResult } from './travel-agent.service.js';
import { TravelAgentReviewService, type SemanticReviewResult } from './travel-agent-review.service.js';
import { SegmentContinuityService, type LocationGap } from './segment-continuity.service.js';
import { summarizeItinerary } from './trip-designer/itinerary-summarizer.js';
import { err } from '../core/result.js';
import { createStorageError } from '../core/errors.js';

/**
 * Result of analyzing an itinerary
 */
export interface AnalysisResult {
  /** Whether the itinerary is valid */
  valid: boolean;
  /** Semantic issues detected */
  issues: SemanticReviewResult['issues'];
  /** Geographic gaps detected */
  gaps: Array<{
    beforeIndex: number;
    afterIndex: number;
    gapType: string;
    description: string;
    suggestedType: 'FLIGHT' | 'TRANSFER';
    confidence: number;
  }>;
  /** Summary of analysis */
  summary: string;
}

/**
 * Result of summarizing an itinerary
 */
export interface SummaryResult {
  /** Human-readable summary */
  summary: string;
  /** Statistics about the itinerary */
  stats: {
    totalSegments: number;
    durationDays: number;
    destinationCount: number;
    travelerCount: number;
    segmentCounts: Record<string, number>;
  };
}

/**
 * Result of filling gaps
 */
export interface GapFillingResult {
  /** Suggested segments to fill gaps */
  suggestions: Array<{
    gapIndex: number;
    gapType: string;
    description: string;
    confidence: number;
    segment: {
      type: string;
      startDatetime: Date;
      endDatetime: Date;
      notes?: string;
    };
  }>;
  /** Whether suggestions were applied */
  applied: boolean;
  /** Result message */
  message: string;
}

/**
 * Options for gap filling
 */
export interface GapFillingOptions {
  /** If true, automatically apply suggestions to the itinerary */
  autoApply?: boolean;
}

/**
 * Facade service that wraps all Travel Agent capabilities
 * Simplifies router dependencies by providing a single entry point
 */
export class TravelAgentFacade {
  private readonly reviewService: TravelAgentReviewService;
  private readonly continuityService: SegmentContinuityService;

  constructor(
    private readonly itineraryService: ItineraryService,
    private readonly travelAgentService: TravelAgentService | null
  ) {
    this.reviewService = new TravelAgentReviewService();
    this.continuityService = new SegmentContinuityService();
  }

  /**
   * Analyze an itinerary for gaps, issues, and generate summary
   * Uses TravelAgentReviewService + SegmentContinuityService
   * @param itineraryId - Itinerary ID to analyze
   * @returns Analysis result
   */
  async analyze(itineraryId: ItineraryId): Promise<Result<AnalysisResult, StorageError>> {
    // Fetch the itinerary
    const itineraryResult = await this.itineraryService.getItinerary(itineraryId);

    if (!itineraryResult.success) {
      return itineraryResult;
    }

    const itinerary = itineraryResult.value;

    // Run semantic review
    const reviewResult = this.reviewService.reviewItinerary(itinerary);

    // Detect geographic gaps
    const gaps = this.continuityService.detectLocationGaps(itinerary.segments);

    // Generate summary
    const summary = [
      `Analyzed itinerary "${itinerary.title}" with ${itinerary.segments.length} segments.`,
      '',
      '**Semantic Review:**',
      reviewResult.summary,
      '',
      `**Geographic Gaps:** ${gaps.length} gap${gaps.length !== 1 ? 's' : ''} detected`,
    ].join('\n');

    return {
      success: true,
      value: {
        valid: reviewResult.valid && gaps.length === 0,
        issues: reviewResult.issues,
        gaps: gaps.map((gap) => ({
          beforeIndex: gap.beforeIndex,
          afterIndex: gap.afterIndex,
          gapType: gap.gapType,
          description: gap.description,
          suggestedType: gap.suggestedType,
          confidence: gap.confidence,
        })),
        summary,
      },
    };
  }

  /**
   * Generate human-readable summary of an itinerary
   * Uses itinerary-summarizer
   * @param itineraryId - Itinerary ID to summarize
   * @returns Summary result
   */
  async summarize(itineraryId: ItineraryId): Promise<Result<SummaryResult, StorageError>> {
    // Fetch the itinerary
    const itineraryResult = await this.itineraryService.getItinerary(itineraryId);

    if (!itineraryResult.success) {
      return itineraryResult;
    }

    const itinerary = itineraryResult.value;

    // Generate summary using the summarizer service
    const summary = summarizeItinerary(itinerary);

    // Calculate duration - handle null/undefined dates gracefully
    let durationDays = 0;
    if (itinerary.startDate && itinerary.endDate) {
      const durationMs = itinerary.endDate.getTime() - itinerary.startDate.getTime();
      durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    }

    // Count segment types
    const segmentCounts = itinerary.segments.reduce(
      (counts, segment) => {
        counts[segment.type] = (counts[segment.type] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );

    return {
      success: true,
      value: {
        summary,
        stats: {
          totalSegments: itinerary.segments.length,
          durationDays,
          destinationCount: itinerary.destinations.length,
          travelerCount: itinerary.travelers.length,
          segmentCounts,
        },
      },
    };
  }

  /**
   * Fill geographic gaps in an itinerary intelligently
   * Uses TravelAgentService
   * @param itineraryId - Itinerary ID
   * @param options - Gap filling options
   * @returns Gap filling result
   */
  async fillGaps(
    itineraryId: ItineraryId,
    options?: GapFillingOptions
  ): Promise<Result<GapFillingResult, StorageError>> {
    if (!this.travelAgentService) {
      return err(
        createStorageError(
          'VALIDATION_ERROR',
          'Travel agent service not configured - SERPAPI_API_KEY required'
        )
      );
    }

    const autoApply = options?.autoApply ?? false;

    // Fetch the itinerary
    const itineraryResult = await this.itineraryService.getItinerary(itineraryId);

    if (!itineraryResult.success) {
      return itineraryResult;
    }

    const itinerary = itineraryResult.value;

    // Detect geographic gaps
    const gaps = this.continuityService.detectLocationGaps(itinerary.segments);

    if (gaps.length === 0) {
      return {
        success: true,
        value: {
          suggestions: [],
          applied: false,
          message: 'No geographic gaps detected',
        },
      };
    }

    // Fill gaps intelligently
    const suggestions = [];
    for (const gap of gaps) {
      const result = await this.travelAgentService.fillGapIntelligently(gap, itinerary.segments);

      if (result.found && result.segment) {
        suggestions.push({
          gapIndex: gap.beforeIndex,
          gapType: gap.gapType,
          description: gap.description,
          confidence: gap.confidence,
          segment: {
            type: result.segment.type,
            startDatetime: result.segment.startDatetime,
            endDatetime: result.segment.endDatetime,
            notes: result.segment.notes,
          },
        });
      }
    }

    // Auto-apply if requested
    let applied = false;
    if (autoApply && suggestions.length > 0) {
      // Sort segments chronologically and insert new segments
      const updatedSegments = [...itinerary.segments];

      // Insert suggestions in reverse order to maintain correct indices
      for (let i = suggestions.length - 1; i >= 0; i--) {
        const suggestion = suggestions[i];
        if (suggestion) {
          // Re-fetch gap to get full segment
          const gap = gaps[i];
          if (gap) {
            const result = await this.travelAgentService.fillGapIntelligently(gap, itinerary.segments);
            if (result.found && result.segment) {
              updatedSegments.splice(suggestion.gapIndex + 1, 0, result.segment);
            }
          }
        }
      }

      // Update the itinerary
      const updateResult = await this.itineraryService.updateItinerary(itineraryId, {
        segments: updatedSegments,
      });

      applied = updateResult.success;
    }

    return {
      success: true,
      value: {
        suggestions,
        applied,
        message: applied
          ? `Applied ${suggestions.length} gap-filling suggestion${suggestions.length !== 1 ? 's' : ''}`
          : `Generated ${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''} (not applied)`,
      },
    };
  }

  /**
   * Search for flights using SerpAPI
   * @param gap - Geographic gap to fill
   * @param segments - Existing segments for preference inference
   * @returns Search result with flight segment
   */
  async searchFlights(gap: LocationGap, segments: Segment[]): Promise<TravelSearchResult> {
    if (!this.travelAgentService) {
      return {
        found: false,
        error: 'Travel agent service not configured - SERPAPI_API_KEY required',
      };
    }

    const preferences = this.travelAgentService.inferPreferences(segments);
    return this.travelAgentService.searchFlight(gap, preferences);
  }

  /**
   * Search for hotels using SerpAPI
   * @param location - Location to search
   * @param checkInDate - Check-in date
   * @param checkOutDate - Check-out date
   * @param segments - Existing segments for preference inference
   * @returns Search result with hotel segment
   */
  async searchHotels(
    location: { name: string; code?: string; address?: { city?: string; country?: string } },
    checkInDate: Date,
    checkOutDate: Date,
    segments: Segment[]
  ): Promise<TravelSearchResult> {
    if (!this.travelAgentService) {
      return {
        found: false,
        error: 'Travel agent service not configured - SERPAPI_API_KEY required',
      };
    }

    const preferences = this.travelAgentService.inferPreferences(segments);
    return this.travelAgentService.searchHotel(location, checkInDate, checkOutDate, preferences);
  }

  /**
   * Search for ground transportation using SerpAPI
   * @param gap - Geographic gap to fill
   * @param segments - Existing segments for preference inference
   * @returns Search result with transfer segment
   */
  async searchTransfers(gap: LocationGap, segments: Segment[]): Promise<TravelSearchResult> {
    if (!this.travelAgentService) {
      return {
        found: false,
        error: 'Travel agent service not configured - SERPAPI_API_KEY required',
      };
    }

    const preferences = this.travelAgentService.inferPreferences(segments);
    return this.travelAgentService.searchTransfer(gap, preferences);
  }
}
