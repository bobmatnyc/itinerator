/**
 * Tool execution handler - maps tool calls to service methods
 * @module services/trip-designer/tool-executor
 */

import type { ItineraryId, SegmentId } from '../../domain/types/branded.js';
import { generateSegmentId } from '../../domain/types/branded.js';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from '../../domain/types/trip-designer.js';
import { SegmentType, SegmentStatus } from '../../domain/types/common.js';
import type { Segment } from '../../domain/types/segment.js';
import type { SegmentService } from '../segment.service.js';
import type { ItineraryService } from '../itinerary.service.js';
import type { DependencyService } from '../dependency.service.js';
import type { KnowledgeService } from '../knowledge.service.js';

/**
 * Travel intelligence entry for knowledge base storage
 */
export interface TravelIntelligence {
  destination: string;
  dates?: string;
  category: 'weather' | 'events' | 'festivals' | 'closures' | 'advisory' | 'crowds' | 'prices' | 'opportunities' | 'warnings' | 'tips';
  level?: 'country' | 'region' | 'city' | 'neighborhood' | 'attraction';
  findings: string;
  impact?: 'positive' | 'negative' | 'neutral' | 'opportunity';
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
  tags?: string[];
  storedAt: Date;
}

/**
 * Tool executor dependencies
 */
export interface ToolExecutorDependencies {
  itineraryService?: ItineraryService;
  segmentService?: SegmentService;
  dependencyService?: DependencyService;
  knowledgeService?: KnowledgeService;
}

/**
 * Executes tool calls against existing services
 */
export class ToolExecutor {
  constructor(private readonly deps: ToolExecutorDependencies = {}) {}

  /**
   * Execute a tool call
   */
  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { toolCall, itineraryId } = context;
    const { name, arguments: argsJson } = toolCall.function;

    const startTime = Date.now();

    try {
      // Parse arguments
      const args = JSON.parse(argsJson);

      // Route to appropriate handler
      let result: unknown;

      switch (name) {
        case 'get_itinerary':
          result = await this.handleGetItinerary(itineraryId);
          break;

        case 'get_segment':
          result = await this.handleGetSegment(itineraryId, args.segmentId);
          break;

        case 'update_itinerary':
          result = await this.handleUpdateItinerary(itineraryId, args);
          break;

        case 'update_preferences':
          result = await this.handleUpdatePreferences(itineraryId, args);
          break;

        case 'add_flight':
          result = await this.handleAddFlight(itineraryId, args);
          break;

        case 'add_hotel':
          result = await this.handleAddHotel(itineraryId, args);
          break;

        case 'add_activity':
          result = await this.handleAddActivity(itineraryId, args);
          break;

        case 'add_transfer':
          result = await this.handleAddTransfer(itineraryId, args);
          break;

        case 'add_meeting':
          result = await this.handleAddMeeting(itineraryId, args);
          break;

        case 'update_segment':
          result = await this.handleUpdateSegment(itineraryId, args.segmentId, args.updates);
          break;

        case 'delete_segment':
          result = await this.handleDeleteSegment(itineraryId, args.segmentId);
          break;

        case 'move_segment':
          result = await this.handleMoveSegment(itineraryId, args.segmentId, args.newStartTime);
          break;

        case 'reorder_segments':
          result = await this.handleReorderSegments(itineraryId, args.segmentIds);
          break;

        case 'search_web':
          result = await this.handleSearchWeb(args.query);
          break;

        case 'search_flights':
          result = await this.handleSearchFlights(args);
          break;

        case 'search_hotels':
          result = await this.handleSearchHotels(args);
          break;

        case 'search_transfers':
          result = await this.handleSearchTransfers(args);
          break;

        case 'store_travel_intelligence':
          result = await this.handleStoreTravelIntelligence(args);
          break;

        case 'retrieve_travel_intelligence':
          result = await this.handleRetrieveTravelIntelligence(args);
          break;

        default:
          return {
            toolCallId: toolCall.id,
            success: false,
            error: `Unknown tool: ${name}`,
          };
      }

      return {
        toolCallId: toolCall.id,
        success: true,
        result,
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Get itinerary handler
   */
  private async handleGetItinerary(itineraryId: ItineraryId): Promise<unknown> {
    if (!this.deps.itineraryService) {
      throw new Error('ItineraryService not configured');
    }

    const result = await this.deps.itineraryService.get(itineraryId);
    if (!result.success) {
      throw new Error(`Failed to get itinerary: ${result.error.message}`);
    }

    return result.value;
  }

  /**
   * Get segment handler
   */
  private async handleGetSegment(itineraryId: ItineraryId, segmentId: SegmentId): Promise<unknown> {
    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    const result = await this.deps.segmentService.get(itineraryId, segmentId);
    if (!result.success) {
      throw new Error(`Failed to get segment: ${result.error.message}`);
    }

    return result.value;
  }

  /**
   * Update itinerary handler
   */
  private async handleUpdateItinerary(itineraryId: ItineraryId, params: any): Promise<unknown> {
    if (!this.deps.itineraryService) {
      throw new Error('ItineraryService not configured');
    }

    const updates: any = {};

    // Update title
    if (params.title) {
      updates.title = params.title;
    }

    // Update description
    if (params.description) {
      updates.description = params.description;
    }

    // Update dates
    if (params.startDate) {
      updates.startDate = new Date(params.startDate);
    }
    if (params.endDate) {
      updates.endDate = new Date(params.endDate);
    }

    // Update destinations
    if (params.destinations && Array.isArray(params.destinations)) {
      // Get current itinerary to merge destinations
      const itinResult = await this.deps.itineraryService.get(itineraryId);
      if (itinResult.success) {
        const currentDestinations = itinResult.value.destinations || [];

        // Create destination objects from string array
        const newDestinations = params.destinations.map((dest: string) => ({
          name: dest,
          city: dest,
          type: 'CITY' as const,
        }));

        // Merge, avoiding duplicates by name
        const allDestinations = [...currentDestinations];
        for (const newDest of newDestinations) {
          if (!allDestinations.some(d => d.name === newDest.name || d.city === newDest.city)) {
            allDestinations.push(newDest);
          }
        }

        // Store merged destinations in the itinerary
        const itinerary = itinResult.value;
        itinerary.destinations = allDestinations;

        // Save the itinerary with new destinations
        const saveResult = await this.deps.itineraryService.update(itineraryId, {
          ...updates,
        });

        // Manually update destinations through storage since update() doesn't handle it
        if (saveResult.success) {
          const updated = saveResult.value;
          updated.destinations = allDestinations;
          updated.updatedAt = new Date();
        }
      }
    }

    const result = await this.deps.itineraryService.update(itineraryId, updates);
    if (!result.success) {
      throw new Error(`Failed to update itinerary: ${result.error.message}`);
    }

    return { success: true, updated: Object.keys(updates) };
  }

  /**
   * Handle update_preferences tool call
   */
  private async handleUpdatePreferences(itineraryId: ItineraryId, params: any): Promise<unknown> {
    if (!this.deps.itineraryService) {
      throw new Error('ItineraryService not configured');
    }

    // Get current itinerary
    const itinResult = await this.deps.itineraryService.get(itineraryId);
    if (!itinResult.success) {
      throw new Error(`Failed to get itinerary: ${itinResult.error.message}`);
    }

    const itinerary = itinResult.value;

    // Build preferences object from params
    const tripPreferences: any = itinerary.tripPreferences || {};

    // Update each preference field if provided
    if (params.travelStyle) {
      tripPreferences.travelStyle = params.travelStyle;
    }
    if (params.pace) {
      tripPreferences.pace = params.pace;
    }
    if (params.interests && Array.isArray(params.interests)) {
      tripPreferences.interests = params.interests;
    }
    if (params.budgetFlexibility !== undefined) {
      tripPreferences.budgetFlexibility = params.budgetFlexibility;
    }
    if (params.dietaryRestrictions) {
      tripPreferences.dietaryRestrictions = params.dietaryRestrictions;
    }
    if (params.mobilityRestrictions) {
      tripPreferences.mobilityRestrictions = params.mobilityRestrictions;
    }
    if (params.origin) {
      tripPreferences.origin = params.origin;
    }
    if (params.accommodationPreference) {
      tripPreferences.accommodationPreference = params.accommodationPreference;
    }
    if (params.activityPreferences && Array.isArray(params.activityPreferences)) {
      tripPreferences.activityPreferences = params.activityPreferences;
    }
    if (params.avoidances && Array.isArray(params.avoidances)) {
      tripPreferences.avoidances = params.avoidances;
    }

    // Update itinerary with new preferences
    itinerary.tripPreferences = tripPreferences;
    itinerary.updatedAt = new Date();

    // Save updated itinerary
    const saveResult = await this.deps.itineraryService.update(itineraryId, {
      tripPreferences,
    });

    if (!saveResult.success) {
      throw new Error(`Failed to update preferences: ${saveResult.error.message}`);
    }

    return {
      success: true,
      message: 'Travel preferences updated successfully',
      preferences: tripPreferences,
    };
  }

  /**
   * Ensure draft itinerary is persisted before adding content
   */
  private async ensurePersisted(itineraryId: ItineraryId): Promise<void> {
    if (this.deps.itineraryService?.isDraft(itineraryId)) {
      const result = await this.deps.itineraryService.persistDraft(itineraryId);
      if (!result.success) {
        throw new Error(`Failed to persist draft: ${result.error.message}`);
      }
    }
  }

  /**
   * Add flight handler
   */
  private async handleAddFlight(itineraryId: ItineraryId, params: any): Promise<unknown> {
    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    // Persist draft if needed (first content being added)
    await this.ensurePersisted(itineraryId);

    const segment: Omit<Segment, 'id'> = {
      type: SegmentType.FLIGHT,
      status: SegmentStatus.CONFIRMED,
      startDatetime: new Date(params.departureTime),
      endDatetime: new Date(params.arrivalTime),
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'chat',
        timestamp: new Date(),
      },
      airline: params.airline,
      flightNumber: params.flightNumber,
      origin: { ...params.origin, type: 'AIRPORT' },
      destination: { ...params.destination, type: 'AIRPORT' },
      cabinClass: params.cabinClass,
      price: params.price,
      confirmationNumber: params.confirmationNumber,
      notes: params.notes,
      metadata: {},
    } as any;

    const result = await this.deps.segmentService.add(itineraryId, segment);
    if (!result.success) {
      throw new Error(`Failed to add flight: ${result.error.message}`);
    }

    return { success: true, segmentId: segment.id };
  }

  /**
   * Add hotel handler
   */
  private async handleAddHotel(itineraryId: ItineraryId, params: any): Promise<unknown> {
    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    // Persist draft if needed
    await this.ensurePersisted(itineraryId);

    const checkInDate = new Date(params.checkInDate);
    const checkOutDate = new Date(params.checkOutDate);
    const checkInTime = params.checkInTime || '15:00';
    const checkOutTime = params.checkOutTime || '11:00';

    // Combine date and time
    const [checkInHour, checkInMin] = checkInTime.split(':');
    const [checkOutHour, checkOutMin] = checkOutTime.split(':');

    checkInDate.setHours(parseInt(checkInHour || '15'), parseInt(checkInMin || '0'));
    checkOutDate.setHours(parseInt(checkOutHour || '11'), parseInt(checkOutMin || '0'));

    const segment: Omit<Segment, 'id'> = {
      type: SegmentType.HOTEL,
      status: SegmentStatus.CONFIRMED,
      startDatetime: checkInDate,
      endDatetime: checkOutDate,
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'chat',
        timestamp: new Date(),
      },
      property: params.property,
      location: { ...params.location, type: 'HOTEL' },
      checkInDate,
      checkOutDate,
      checkInTime,
      checkOutTime,
      roomType: params.roomType,
      roomCount: params.roomCount || 1,
      boardBasis: params.boardBasis,
      amenities: [],
      price: params.price,
      confirmationNumber: params.confirmationNumber,
      notes: params.notes,
      metadata: {},
    } as any;

    const result = await this.deps.segmentService.add(itineraryId, segment);
    if (!result.success) {
      throw new Error(`Failed to add hotel: ${result.error.message}`);
    }

    return { success: true, segmentId: segment.id };
  }

  /**
   * Add activity handler
   */
  private async handleAddActivity(itineraryId: ItineraryId, params: any): Promise<unknown> {
    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    // Persist draft if needed
    await this.ensurePersisted(itineraryId);

    const startTime = new Date(params.startTime);
    let endTime: Date;

    if (params.endTime) {
      endTime = new Date(params.endTime);
    } else if (params.durationHours) {
      endTime = new Date(startTime.getTime() + params.durationHours * 60 * 60 * 1000);
    } else {
      // Default 2 hours
      endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
    }

    const segment: Omit<Segment, 'id'> = {
      type: SegmentType.ACTIVITY,
      status: SegmentStatus.CONFIRMED,
      startDatetime: startTime,
      endDatetime: endTime,
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'chat',
        timestamp: new Date(),
      },
      name: params.name,
      description: params.description,
      location: { ...params.location, type: 'ATTRACTION' },
      category: params.category,
      provider: params.provider,
      price: params.price,
      confirmationNumber: params.confirmationNumber,
      voucherNumber: params.confirmationNumber,
      notes: params.notes,
      metadata: {},
    } as any;

    const result = await this.deps.segmentService.add(itineraryId, segment);
    if (!result.success) {
      throw new Error(`Failed to add activity: ${result.error.message}`);
    }

    return { success: true, segmentId: segment.id };
  }

  /**
   * Add transfer handler
   */
  private async handleAddTransfer(itineraryId: ItineraryId, params: any): Promise<unknown> {
    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    // Persist draft if needed
    await this.ensurePersisted(itineraryId);

    const pickupTime = new Date(params.pickupTime);
    const durationMs = (params.estimatedDurationMinutes || 30) * 60 * 1000;
    const dropoffTime = new Date(pickupTime.getTime() + durationMs);

    const segment: Omit<Segment, 'id'> = {
      type: SegmentType.TRANSFER,
      status: SegmentStatus.CONFIRMED,
      startDatetime: pickupTime,
      endDatetime: dropoffTime,
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'chat',
        timestamp: new Date(),
      },
      transferType: params.transferType,
      pickupLocation: { ...params.pickupLocation, type: 'OTHER' },
      dropoffLocation: { ...params.dropoffLocation, type: 'OTHER' },
      vehicleDetails: params.vehicleDetails,
      provider: params.provider,
      price: params.price,
      confirmationNumber: params.confirmationNumber,
      notes: params.notes,
      metadata: {},
    } as any;

    const result = await this.deps.segmentService.add(itineraryId, segment);
    if (!result.success) {
      throw new Error(`Failed to add transfer: ${result.error.message}`);
    }

    return { success: true, segmentId: segment.id };
  }

  /**
   * Add meeting handler
   */
  private async handleAddMeeting(itineraryId: ItineraryId, params: any): Promise<unknown> {
    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    // Persist draft if needed
    await this.ensurePersisted(itineraryId);

    const segment: Omit<Segment, 'id'> = {
      type: SegmentType.MEETING,
      status: SegmentStatus.CONFIRMED,
      startDatetime: new Date(params.startTime),
      endDatetime: new Date(params.endTime),
      travelerIds: [],
      source: 'agent',
      sourceDetails: {
        mode: 'chat',
        timestamp: new Date(),
      },
      title: params.title,
      location: { ...params.location, type: 'OTHER' },
      organizer: params.organizer,
      attendees: params.attendees || [],
      agenda: params.agenda,
      meetingUrl: params.meetingUrl,
      notes: params.notes,
      metadata: {},
    } as any;

    const result = await this.deps.segmentService.add(itineraryId, segment);
    if (!result.success) {
      throw new Error(`Failed to add meeting: ${result.error.message}`);
    }

    return { success: true, segmentId: segment.id };
  }

  /**
   * Update segment handler
   */
  private async handleUpdateSegment(
    itineraryId: ItineraryId,
    segmentId: SegmentId,
    updates: any
  ): Promise<unknown> {
    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    const result = await this.deps.segmentService.update(itineraryId, segmentId, updates);
    if (!result.success) {
      throw new Error(`Failed to update segment: ${result.error.message}`);
    }

    return { success: true, segmentId };
  }

  /**
   * Delete segment handler
   */
  private async handleDeleteSegment(itineraryId: ItineraryId, segmentId: SegmentId): Promise<unknown> {
    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    const result = await this.deps.segmentService.delete(itineraryId, segmentId);
    if (!result.success) {
      throw new Error(`Failed to delete segment: ${result.error.message}`);
    }

    return { success: true, segmentId };
  }

  /**
   * Move segment handler (with dependency cascade)
   */
  private async handleMoveSegment(
    itineraryId: ItineraryId,
    segmentId: SegmentId,
    newStartTime: string
  ): Promise<unknown> {
    if (!this.deps.segmentService || !this.deps.dependencyService || !this.deps.itineraryService) {
      throw new Error('Required services not configured');
    }

    // Get current itinerary
    const itinResult = await this.deps.itineraryService.get(itineraryId);
    if (!itinResult.success) {
      throw new Error(`Failed to get itinerary: ${itinResult.error.message}`);
    }

    const itinerary = itinResult.value;
    const segment = itinerary.segments.find((s) => s.id === segmentId);
    if (!segment) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    // Calculate time delta
    const newStart = new Date(newStartTime);
    const oldStart = segment.startDatetime;
    const timeDeltaMs = newStart.getTime() - oldStart.getTime();

    // Adjust dependent segments
    const adjustResult = this.deps.dependencyService.adjustDependentSegments(
      itinerary.segments,
      segmentId,
      timeDeltaMs
    );

    if (!adjustResult.success) {
      throw new Error(`Failed to adjust dependent segments: ${adjustResult.error.message}`);
    }

    // Update all adjusted segments
    for (const adjustedSegment of adjustResult.value) {
      const updateResult = await this.deps.segmentService.update(
        itineraryId,
        adjustedSegment.id,
        {
          startDatetime: adjustedSegment.startDatetime,
          endDatetime: adjustedSegment.endDatetime,
        }
      );

      if (!updateResult.success) {
        throw new Error(`Failed to update segment ${adjustedSegment.id}: ${updateResult.error.message}`);
      }
    }

    return { success: true, segmentId, dependentsAdjusted: adjustResult.value.length - 1 };
  }

  /**
   * Reorder segments handler
   */
  private async handleReorderSegments(
    itineraryId: ItineraryId,
    segmentIds: SegmentId[]
  ): Promise<unknown> {
    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    const result = await this.deps.segmentService.reorder(itineraryId, segmentIds);
    if (!result.success) {
      throw new Error(`Failed to reorder segments: ${result.error.message}`);
    }

    return { success: true, segmentCount: segmentIds.length };
  }

  /**
   * Search web handler (placeholder for OpenRouter :online)
   */
  private async handleSearchWeb(query: string): Promise<unknown> {
    // OpenRouter's :online mode handles this automatically
    // Return placeholder for now
    return {
      note: 'Web search is handled automatically by OpenRouter :online mode',
      query,
    };
  }

  /**
   * Search flights handler (placeholder for SERP API)
   */
  private async handleSearchFlights(params: any): Promise<unknown> {
    // TODO: Implement SERP API Google Flights search
    return {
      note: 'Flight search not yet implemented',
      params,
    };
  }

  /**
   * Search hotels handler (placeholder for SERP API)
   */
  private async handleSearchHotels(params: any): Promise<unknown> {
    // TODO: Implement SERP API Google Hotels search
    return {
      note: 'Hotel search not yet implemented',
      params,
    };
  }

  /**
   * Search transfers handler (placeholder for Rome2Rio)
   */
  private async handleSearchTransfers(params: any): Promise<unknown> {
    // TODO: Implement Rome2Rio or SERP API transfer search
    return {
      note: 'Transfer search not yet implemented',
      params,
    };
  }

  /**
   * Store travel intelligence in the knowledge base
   * Stores seasonal info, events, advisories, etc. for future retrieval
   */
  private async handleStoreTravelIntelligence(params: any): Promise<unknown> {
    const intelligence: TravelIntelligence = {
      destination: params.destination,
      dates: params.dates,
      category: params.category,
      level: params.level || 'country',
      findings: params.findings,
      impact: params.impact || 'neutral',
      confidence: params.confidence || 'medium',
      source: params.source || 'web search',
      tags: params.tags || [],
      storedAt: new Date(),
    };

    // Create a searchable document from the intelligence
    const documentContent = `
Travel Intelligence: ${intelligence.destination}
Category: ${intelligence.category}
Time Period: ${intelligence.dates || 'Year-round'}
Level: ${intelligence.level}
Impact: ${intelligence.impact}

Findings:
${intelligence.findings}

Tags: ${intelligence.tags?.join(', ') || 'none'}
Source: ${intelligence.source}
Confidence: ${intelligence.confidence}
Stored: ${intelligence.storedAt.toISOString()}
    `.trim();

    // Store in knowledge service if available
    if (this.deps.knowledgeService) {
      try {
        // Store as a document in the knowledge base
        await this.deps.knowledgeService.storeMessages([
          {
            content: documentContent,
            role: 'system',
            sessionId: `travel-intelligence-${intelligence.destination.toLowerCase().replace(/\s+/g, '-')}` as any,
          },
        ]);
      } catch (error) {
        console.warn('Failed to store travel intelligence in knowledge base:', error);
        // Continue anyway - the response will still be useful
      }
    }

    return {
      success: true,
      stored: intelligence,
      message: `Stored ${intelligence.category} intelligence for ${intelligence.destination}${intelligence.dates ? ` (${intelligence.dates})` : ''}`,
    };
  }

  /**
   * Retrieve travel intelligence from the knowledge base
   * Queries stored seasonal info, events, advisories for a destination
   */
  private async handleRetrieveTravelIntelligence(params: any): Promise<unknown> {
    const { destination, dates, categories, query } = params;

    // Build search query
    const searchParts: string[] = [
      `Travel Intelligence: ${destination}`,
    ];

    if (dates) {
      searchParts.push(`Time Period: ${dates}`);
    }

    if (categories && categories.length > 0) {
      searchParts.push(`Categories: ${categories.join(', ')}`);
    }

    if (query) {
      searchParts.push(query);
    }

    const searchQuery = searchParts.join(' ');

    // Query knowledge service if available
    if (this.deps.knowledgeService) {
      try {
        const result = await this.deps.knowledgeService.retrieveContext(searchQuery, {
          type: 'chat',
        });

        if (result.success && result.value.documents.length > 0) {
          return {
            success: true,
            destination,
            dates,
            intelligence: result.value.documents.map(doc => ({
              content: doc.content,
              relevance: doc.score,
            })),
            context: result.value.context,
            message: `Found ${result.value.documents.length} relevant intelligence entries for ${destination}`,
          };
        }
      } catch (error) {
        console.warn('Failed to retrieve travel intelligence from knowledge base:', error);
      }
    }

    return {
      success: true,
      destination,
      dates,
      intelligence: [],
      context: null,
      message: `No stored intelligence found for ${destination}. Consider running web searches to gather information.`,
    };
  }
}
