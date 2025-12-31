/**
 * Tool execution handler - maps tool calls to service methods
 * @module services/trip-designer/tool-executor
 */

import type { ItineraryId, SegmentId } from '../../domain/types/branded.js';
import { generateSegmentId } from '../../domain/types/branded.js';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  SessionId,
} from '../../domain/types/trip-designer.js';
import { SegmentType, SegmentStatus } from '../../domain/types/common.js';
import type { Segment } from '../../domain/types/segment.js';
import type { SegmentService } from '../segment.service.js';
import type { ItineraryService } from '../itinerary.service.js';
import type { DependencyService } from '../dependency.service.js';
import type { KnowledgeService } from '../knowledge.service.js';
import type { WeaviateKnowledgeService } from '../weaviate-knowledge.service.js';
import { isWeaviateKnowledgeService } from '../knowledge-factory.js';
import { summarizeItineraryForTool } from './itinerary-summarizer.js';
import { parseLocalDate, parseLocalDateTime } from '../../utils/date-parser.js';
import { GeocodingService } from '../geocoding.service.js';
import {
  addFlightArgsSchema,
  addHotelArgsSchema,
  addActivityArgsSchema,
  addTransferArgsSchema,
  addMeetingArgsSchema,
  addTravelerArgsSchema,
  updateItineraryArgsSchema,
  updatePreferencesArgsSchema,
  getSegmentArgsSchema,
  updateSegmentArgsSchema,
  deleteSegmentArgsSchema,
  moveSegmentArgsSchema,
  reorderSegmentsArgsSchema,
  searchWebArgsSchema,
  searchFlightsArgsSchema,
  searchHotelsArgsSchema,
  searchTransfersArgsSchema,
  storeTravelIntelligenceArgsSchema,
  retrieveTravelIntelligenceArgsSchema,
  switchToTripDesignerArgsSchema,
  getDistanceArgsSchema,
  showRouteArgsSchema,
  geocodeLocationArgsSchema,
} from '../../domain/schemas/index.js';

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
  knowledgeService?: KnowledgeService | WeaviateKnowledgeService;
  geocodingService?: GeocodingService;
}

/**
 * Executes tool calls against existing services
 */
export class ToolExecutor {
  private currentItinerary?: any; // Cache current itinerary for context

  constructor(private readonly deps: ToolExecutorDependencies = {}) {}

  /**
   * Execute a tool call
   */
  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const { toolCall, itineraryId } = context;
    const { name, arguments: argsJson } = toolCall.function;

    const startTime = Date.now();

    try {
      // Load itinerary context if not cached
      if (!this.currentItinerary && this.deps.itineraryService) {
        const itinResult = await this.deps.itineraryService.get(itineraryId);
        if (itinResult.success) {
          this.currentItinerary = itinResult.value;
        }
      }

      // Parse arguments with validation
      // Note: Some tools like get_itinerary have no parameters (empty arguments is valid)
      let args: any = {};

      if (argsJson && argsJson.trim().length > 0) {
        try {
          args = JSON.parse(argsJson);
        } catch (parseError) {
          return {
            toolCallId: toolCall.id,
            success: false,
            error: `Failed to parse tool arguments: ${parseError instanceof Error ? parseError.message : String(parseError)}. Raw arguments: ${argsJson.substring(0, 100)}...`,
            metadata: {
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
      }

      // Route to appropriate handler
      let result: unknown;

      switch (name) {
        case 'get_itinerary':
          result = await this.handleGetItinerary(itineraryId);
          break;

        case 'get_segment':
          result = await this.handleGetSegment(itineraryId, args);
          break;

        case 'update_itinerary':
          result = await this.handleUpdateItinerary(itineraryId, args);
          break;

        case 'update_preferences':
          result = await this.handleUpdatePreferences(itineraryId, args);
          break;

        case 'add_traveler':
          result = await this.handleAddTraveler(itineraryId, args);
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
          result = await this.handleUpdateSegment(itineraryId, args);
          break;

        case 'delete_segment':
          result = await this.handleDeleteSegment(itineraryId, args);
          break;

        case 'move_segment':
          result = await this.handleMoveSegment(itineraryId, args);
          break;

        case 'reorder_segments':
          result = await this.handleReorderSegments(itineraryId, args);
          break;

        case 'search_web':
          result = await this.handleSearchWeb(args);
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

        case 'switch_to_trip_designer':
          result = await this.handleSwitchToTripDesigner(context.sessionId, args);
          break;

        // Geography tools
        case 'get_distance':
          result = await this.handleGetDistance(args);
          break;

        case 'show_route':
          result = await this.handleShowRoute(args);
          break;

        case 'geocode_location':
          result = await this.handleGeocodeLocation(args);
          break;

        default:
          return {
            toolCallId: toolCall.id,
            success: false,
            error: `Unknown tool: ${name}`,
          };
      }

      // Extract segmentId from result if present (for tracking modified segments)
      const metadata: Record<string, unknown> = {
        executionTimeMs: Date.now() - startTime,
      };

      if (result && typeof result === 'object' && 'segmentId' in result) {
        metadata.segmentId = result.segmentId;
        console.log(`[ToolExecutor] Extracted segmentId to metadata for ${name}:`, result.segmentId);
      } else {
        console.log(`[ToolExecutor] No segmentId in result for ${name}`, {
          hasResult: !!result,
          isObject: typeof result === 'object',
          hasSegmentIdKey: result && typeof result === 'object' && 'segmentId' in result,
          resultKeys: result && typeof result === 'object' ? Object.keys(result) : []
        });
      }

      return {
        toolCallId: toolCall.id,
        success: true,
        result,
        metadata,
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
   * Returns a summarized version to save tokens
   */
  private async handleGetItinerary(itineraryId: ItineraryId): Promise<unknown> {
    if (!this.deps.itineraryService) {
      throw new Error('ItineraryService not configured');
    }

    const result = await this.deps.itineraryService.get(itineraryId);
    if (!result.success) {
      throw new Error(`Failed to get itinerary: ${result.error.message}`);
    }

    const itinerary = result.value;

    // Return summarized version to save tokens
    // Instead of full itinerary JSON (can be 20KB+), return compact summary
    return summarizeItineraryForTool(itinerary);
  }

  /**
   * Get segment handler
   */
  private async handleGetSegment(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = getSegmentArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid get_segment arguments: ${validation.error.message}`);
    }

    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    const { segmentId } = validation.data;
    const result = await this.deps.segmentService.get(itineraryId, segmentId as SegmentId);
    if (!result.success) {
      throw new Error(`Failed to get segment: ${result.error.message}`);
    }

    return result.value;
  }

  /**
   * Update itinerary handler
   */
  private async handleUpdateItinerary(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = updateItineraryArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid update_itinerary arguments: ${validation.error.message}`);
    }

    const params = validation.data;
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

    // Update dates with validation
    if (params.startDate) {
      const startDate = parseLocalDate(params.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day for comparison

      const startDateNormalized = new Date(startDate);
      startDateNormalized.setHours(0, 0, 0, 0); // Normalize parsed date too

      // Validate: start date must be at least 1 day in the future (tomorrow or later)
      if (startDateNormalized <= today) {
        // Calculate suggested dates
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const nextYear = new Date(startDate);
        nextYear.setFullYear(nextYear.getFullYear() + 1);

        const tripDuration = params.endDate
          ? Math.ceil((parseLocalDate(params.endDate).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          : 7; // Default 7 days if no end date

        const suggestedEndTomorrow = new Date(tomorrow);
        suggestedEndTomorrow.setDate(suggestedEndTomorrow.getDate() + tripDuration);

        const suggestedEndNextYear = new Date(nextYear);
        suggestedEndNextYear.setDate(suggestedEndNextYear.getDate() + tripDuration);

        throw new Error(
          `Trip start date cannot be in the past. The date you provided (${params.startDate}) has already passed. ` +
          `Please choose dates in the future. Suggestions:\n` +
          `1. Start tomorrow: ${tomorrow.toISOString().split('T')[0]} to ${suggestedEndTomorrow.toISOString().split('T')[0]}\n` +
          `2. Same dates next year: ${nextYear.toISOString().split('T')[0]} to ${suggestedEndNextYear.toISOString().split('T')[0]}\n\n` +
          `Would you like me to update the trip with one of these date ranges?`
        );
      }

      updates.startDate = startDate;
    }
    if (params.endDate) {
      updates.endDate = parseLocalDate(params.endDate);
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

    return {
      success: true,
      updated: Object.keys(updates),
      // Signal that itinerary metadata changed (destinations, dates, title, etc.)
      itineraryChanged: true
    };
  }

  /**
   * Handle update_preferences tool call
   */
  private async handleUpdatePreferences(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = updatePreferencesArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid update_preferences arguments: ${validation.error.message}`);
    }

    const params = validation.data;
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
    if (params.travelerType) {
      tripPreferences.travelerType = params.travelerType;
    }
    if (params.tripPurpose) {
      tripPreferences.tripPurpose = params.tripPurpose;
    }
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
    if (params.budget) {
      tripPreferences.budget = {
        amount: params.budget.amount,
        currency: params.budget.currency,
        period: params.budget.period,
      };
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
      // Signal that itinerary changed (triggers UI refresh)
      itineraryChanged: true,
    };
  }

  /**
   * Handle add_traveler tool call
   */
  private async handleAddTraveler(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = addTravelerArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid add_traveler arguments: ${validation.error.message}`);
    }

    const params = validation.data;
    if (!this.deps.itineraryService) {
      throw new Error('ItineraryService not configured');
    }

    // Get current itinerary
    const itinResult = await this.deps.itineraryService.get(itineraryId);
    if (!itinResult.success) {
      throw new Error(`Failed to get itinerary: ${itinResult.error.message}`);
    }

    const itinerary = itinResult.value;

    // Import generateTravelerId from branded types
    const { generateTravelerId } = await import('../../domain/types/branded.js');
    const { TravelerType } = await import('../../domain/types/common.js');

    // Map type string to TravelerType enum
    const typeMap: Record<string, string> = {
      adult: TravelerType.ADULT,
      child: TravelerType.CHILD,
      infant: TravelerType.INFANT,
      senior: TravelerType.SENIOR,
    };

    // Create new Traveler object
    const newTraveler: any = {
      id: generateTravelerId(),
      type: typeMap[params.type] || TravelerType.ADULT,
      firstName: params.firstName,
      lastName: params.lastName || '',
      middleName: params.middleName,
      email: params.email,
      phone: params.phone,
      loyaltyPrograms: [],
      specialRequests: [],
      metadata: {
        relationship: params.relationship,
        isPrimary: params.isPrimary || false,
        age: params.age,
      },
    };

    // Parse dateOfBirth if provided
    if (params.dateOfBirth) {
      newTraveler.dateOfBirth = parseLocalDate(params.dateOfBirth);
    }

    // Add to itinerary travelers array
    if (!itinerary.travelers) {
      itinerary.travelers = [];
    }

    itinerary.travelers.push(newTraveler);
    itinerary.updatedAt = new Date();

    // Save updated itinerary
    const saveResult = await this.deps.itineraryService.update(itineraryId, {
      travelers: itinerary.travelers,
    });

    if (!saveResult.success) {
      throw new Error(`Failed to add traveler: ${saveResult.error.message}`);
    }

    // Build response message
    const travelerName = params.lastName
      ? `${params.firstName} ${params.lastName}`
      : params.firstName;
    const relationshipText = params.relationship ? ` (${params.relationship})` : '';
    const isPrimaryText = params.isPrimary ? ' - Primary traveler' : '';

    return {
      success: true,
      travelerId: newTraveler.id,
      travelerName,
      message: `Added ${travelerName}${relationshipText}${isPrimaryText} to the trip`,
      // Signal that itinerary changed (triggers UI refresh)
      itineraryChanged: true,
    };
  }

  /**
   * Ensure itinerary exists before adding content
   * Note: Itineraries created via API are already persisted
   */
  private async ensurePersisted(itineraryId: ItineraryId): Promise<void> {
    // Verify itinerary exists (itineraries from API are already persisted)
    if (this.deps.itineraryService) {
      const result = await this.deps.itineraryService.getItinerary(itineraryId);
      if (!result.success) {
        throw new Error(`Itinerary not found: ${result.error.message}`);
      }
    }
  }

  /**
   * Add flight handler
   */
  private async handleAddFlight(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = addFlightArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid flight arguments: ${validation.error.message}`);
    }

    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    // Persist draft if needed (first content being added)
    await this.ensurePersisted(itineraryId);

    const params = validation.data;
    const segment: Omit<Segment, 'id'> = {
      type: SegmentType.FLIGHT,
      status: SegmentStatus.CONFIRMED,
      startDatetime: parseLocalDateTime(params.departureTime),
      endDatetime: parseLocalDateTime(params.arrivalTime),
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

    // CRITICAL: Return the segment ID from the service result, not the input segment
    // The input segment doesn't have an ID yet - it's added by the service
    return { success: true, segmentId: result.value.id };
  }

  /**
   * Add hotel handler
   */
  private async handleAddHotel(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = addHotelArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid hotel arguments: ${validation.error.message}`);
    }

    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    // Persist draft if needed
    await this.ensurePersisted(itineraryId);

    const params = validation.data;
    const checkInDate = parseLocalDate(params.checkInDate);
    const checkOutDate = parseLocalDate(params.checkOutDate);
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

    // CRITICAL: Return the segment ID from the service result, not the input segment
    // The input segment doesn't have an ID yet - it's added by the service
    return { success: true, segmentId: result.value.id };
  }

  /**
   * Add activity handler
   */
  private async handleAddActivity(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = addActivityArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid activity arguments: ${validation.error.message}`);
    }

    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    // Persist draft if needed
    await this.ensurePersisted(itineraryId);

    const params = validation.data;
    const startTime = parseLocalDateTime(params.startTime);
    let endTime: Date;

    if (params.endTime) {
      endTime = parseLocalDateTime(params.endTime);
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

    // CRITICAL: Return the segment ID from the service result, not the input segment
    // The input segment doesn't have an ID yet - it's added by the service
    return { success: true, segmentId: result.value.id };
  }

  /**
   * Add transfer handler
   */
  private async handleAddTransfer(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = addTransferArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid transfer arguments: ${validation.error.message}`);
    }

    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    // Persist draft if needed
    await this.ensurePersisted(itineraryId);

    const params = validation.data;
    const pickupTime = parseLocalDateTime(params.pickupTime);
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

    // CRITICAL: Return the segment ID from the service result, not the input segment
    // The input segment doesn't have an ID yet - it's added by the service
    return { success: true, segmentId: result.value.id };
  }

  /**
   * Add meeting handler
   */
  private async handleAddMeeting(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = addMeetingArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid meeting arguments: ${validation.error.message}`);
    }

    if (!this.deps.segmentService) {
      throw new Error('SegmentService not configured');
    }

    // Persist draft if needed
    await this.ensurePersisted(itineraryId);

    const params = validation.data;

    const segment: Omit<Segment, 'id'> = {
      type: SegmentType.MEETING,
      status: SegmentStatus.CONFIRMED,
      startDatetime: parseLocalDateTime(params.startTime),
      endDatetime: parseLocalDateTime(params.endTime),
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

    // CRITICAL: Return the segment ID from the service result, not the input segment
    // The input segment doesn't have an ID yet - it's added by the service
    return { success: true, segmentId: result.value.id };
  }

  /**
   * Update segment handler
   */
  private async handleUpdateSegment(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = updateSegmentArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid update_segment arguments: ${validation.error.message}`);
    }

    const { segmentId, updates } = validation.data;
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
  private async handleDeleteSegment(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = deleteSegmentArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid delete_segment arguments: ${validation.error.message}`);
    }

    const { segmentId } = validation.data;
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
  private async handleMoveSegment(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = moveSegmentArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid move_segment arguments: ${validation.error.message}`);
    }

    const { segmentId, newStartTime } = validation.data;
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
  private async handleReorderSegments(itineraryId: ItineraryId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = reorderSegmentsArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid reorder_segments arguments: ${validation.error.message}`);
    }

    const { segmentIds } = validation.data;
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
   * Search web handler with KB-first flow
   * 1. Search Weaviate knowledge base first
   * 2. If insufficient results, indicate web search needed
   * 3. OpenRouter :online will handle actual web search
   */
  private async handleSearchWeb(args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = searchWebArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid search_web arguments: ${validation.error.message}`);
    }

    const { query } = validation.data;
    const knowledgeService = this.deps.knowledgeService;

    // If no knowledge service, fall back to web search
    if (!knowledgeService) {
      return {
        source: 'web_search',
        note: 'Knowledge base not configured. Using OpenRouter :online for web search.',
        query,
      };
    }

    // KB-first search for Weaviate
    if (isWeaviateKnowledgeService(knowledgeService)) {
      try {
        const searchResult = await knowledgeService.searchWithFallback(query, {
          itinerary: this.currentItinerary,
          destinationName: this.currentItinerary?.destinations?.[0]?.name,
          travelDate: this.currentItinerary
            ? new Date(this.currentItinerary.startDate)
            : undefined,
        });

        if (searchResult.success) {
          const { source, results, kbFallback } = searchResult.value;

          // If we have good KB results, return them
          if (results.length > 0 && results[0].relevanceScore > 0.7) {
            return {
              source: 'knowledge_base',
              results: results.map((r) => ({
                category: r.category,
                content: r.rawContent,
                relevance: r.relevanceScore,
                temporalType: r.temporalType,
                destination: r.destinationName,
              })),
              count: results.length,
            };
          }

          // If fallback needed, indicate web search
          if (kbFallback) {
            return {
              source: 'web_search_needed',
              note: 'Insufficient knowledge base results. Web search recommended via OpenRouter :online.',
              query,
              kbResultsCount: results.length,
            };
          }
        }
      } catch (error) {
        console.warn('KB search failed, falling back to web:', error);
      }
    }

    // Default: indicate web search needed
    return {
      source: 'web_search',
      note: 'Using OpenRouter :online for web search',
      query,
    };
  }

  /**
   * Search flights handler (placeholder for SERP API)
   */
  private async handleSearchFlights(args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = searchFlightsArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid search_flights arguments: ${validation.error.message}`);
    }

    // TODO: Implement SERP API Google Flights search
    return {
      note: 'Flight search not yet implemented',
      params: validation.data,
    };
  }

  /**
   * Search hotels handler (placeholder for SERP API)
   */
  private async handleSearchHotels(args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = searchHotelsArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid search_hotels arguments: ${validation.error.message}`);
    }

    // TODO: Implement SERP API Google Hotels search
    return {
      note: 'Hotel search not yet implemented',
      params: validation.data,
    };
  }

  /**
   * Search transfers handler (placeholder for Rome2Rio)
   */
  private async handleSearchTransfers(args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = searchTransfersArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid search_transfers arguments: ${validation.error.message}`);
    }

    // TODO: Implement Rome2Rio or SERP API transfer search
    return {
      note: 'Transfer search not yet implemented',
      params: validation.data,
    };
  }

  /**
   * Store travel intelligence in the knowledge base
   * Stores seasonal info, events, advisories, etc. for future retrieval
   */
  private async handleStoreTravelIntelligence(args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = storeTravelIntelligenceArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid store_travel_intelligence arguments: ${validation.error.message}`);
    }

    const params = validation.data;
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

    const knowledgeService = this.deps.knowledgeService;

    // Store in knowledge service if available
    if (knowledgeService) {
      try {
        // Use Weaviate for structured storage
        if (isWeaviateKnowledgeService(knowledgeService)) {
          // Parse temporal type from dates
          let temporalType: 'evergreen' | 'seasonal' | 'event' | 'dated' = 'evergreen';
          let relevantFrom: Date | undefined;
          let relevantUntil: Date | undefined;

          if (intelligence.dates) {
            // Try to parse date range
            const dateMatch = intelligence.dates.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (dateMatch) {
              relevantFrom = new Date(intelligence.dates);
              temporalType = 'dated';
            } else if (intelligence.dates.toLowerCase().includes('annual')) {
              temporalType = 'event';
            } else if (
              intelligence.dates.toLowerCase().match(/spring|summer|fall|winter|season/)
            ) {
              temporalType = 'seasonal';
            }
          }

          // Map category to KnowledgeCategory
          const categoryMap: Record<string, string> = {
            weather: 'weather',
            events: 'event',
            festivals: 'event',
            closures: 'advisory',
            advisory: 'advisory',
            crowds: 'tip',
            prices: 'tip',
            opportunities: 'recommendation',
            warnings: 'advisory',
            tips: 'tip',
          };

          const knowledgeCategory = categoryMap[intelligence.category] || 'tip';

          await knowledgeService.storeKnowledge(
            {
              content: intelligence.findings,
              category: knowledgeCategory as any,
              subcategory: intelligence.category,
              source: 'trip_designer',
              temporalType,
            },
            {
              itinerary: this.currentItinerary,
              destinationName: intelligence.destination,
              travelDate: relevantFrom,
            }
          );

          return {
            success: true,
            stored: intelligence,
            backend: 'weaviate',
            message: `Stored ${intelligence.category} intelligence for ${intelligence.destination} in Weaviate KB${intelligence.dates ? ` (${intelligence.dates})` : ''}`,
          };
        } else {
          // Fallback to Vectra (store as message)
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

          await knowledgeService.storeMessages([
            {
              content: documentContent,
              role: 'system',
              sessionId: `travel-intelligence-${intelligence.destination.toLowerCase().replace(/\s+/g, '-')}` as any,
            },
          ]);

          return {
            success: true,
            stored: intelligence,
            backend: 'vectra',
            message: `Stored ${intelligence.category} intelligence for ${intelligence.destination} in Vectra KB${intelligence.dates ? ` (${intelligence.dates})` : ''}`,
          };
        }
      } catch (error) {
        console.warn('Failed to store travel intelligence in knowledge base:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          message: 'Failed to store intelligence in knowledge base',
        };
      }
    }

    return {
      success: false,
      message: 'Knowledge base not configured',
    };
  }

  /**
   * Retrieve travel intelligence from the knowledge base
   * Queries stored seasonal info, events, advisories for a destination
   */
  private async handleRetrieveTravelIntelligence(args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = retrieveTravelIntelligenceArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid retrieve_travel_intelligence arguments: ${validation.error.message}`);
    }

    const { destination, dates, categories, query } = validation.data;

    const knowledgeService = this.deps.knowledgeService;

    if (!knowledgeService) {
      return {
        success: false,
        message: 'Knowledge base not configured',
      };
    }

    // Build search query
    const searchParts: string[] = [];
    if (query) {
      searchParts.push(query);
    } else {
      searchParts.push(destination);
      if (categories && categories.length > 0) {
        searchParts.push(categories.join(' '));
      }
    }

    const searchQuery = searchParts.join(' ');

    try {
      // Use Weaviate for structured search
      if (isWeaviateKnowledgeService(knowledgeService)) {
        const searchResult = await knowledgeService.searchWithFallback(searchQuery, {
          itinerary: this.currentItinerary,
          destinationName: destination,
          travelDate: dates ? new Date(dates) : undefined,
          filters: {
            categories: categories || [],
          },
        });

        if (searchResult.success && searchResult.value.results.length > 0) {
          return {
            success: true,
            destination,
            dates,
            intelligence: searchResult.value.results.map((r) => ({
              content: r.rawContent,
              category: r.category,
              subcategory: r.subcategory,
              relevance: r.relevanceScore,
              temporalType: r.temporalType,
              source: r.source,
            })),
            count: searchResult.value.results.length,
            source: searchResult.value.source,
            message: `Found ${searchResult.value.results.length} relevant intelligence entries for ${destination}`,
          };
        }
      } else {
        // Fallback to Vectra
        const result = await knowledgeService.retrieveContext(searchQuery, {
          type: 'chat',
        });

        if (result.success && result.value.documents.length > 0) {
          return {
            success: true,
            destination,
            dates,
            intelligence: result.value.documents.map((doc) => ({
              content: doc.content,
              relevance: 0, // Vectra doesn't provide scores
            })),
            context: result.value.context,
            message: `Found ${result.value.documents.length} relevant intelligence entries for ${destination}`,
          };
        }
      }
    } catch (error) {
      console.warn('Failed to retrieve travel intelligence from knowledge base:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'Failed to retrieve intelligence from knowledge base',
      };
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

  /**
   * Handle switch to Trip Designer agent
   * This is a signal to the Trip Designer service to switch modes
   */
  private async handleSwitchToTripDesigner(sessionId: SessionId, args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = switchToTripDesignerArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid switch_to_trip_designer arguments: ${validation.error.message}`);
    }

    const params = validation.data;
    return {
      success: true,
      action: 'switch_agent',
      newMode: 'trip_designer',
      initialContext: params.initialContext,
      message: 'Switching to Trip Designer mode. Ready to help plan your trip!',
    };
  }

  // =============================================================================
  // Geography Tool Handlers
  // =============================================================================

  /**
   * Get geocoding service, creating one if not provided
   */
  private getGeocodingService(): GeocodingService {
    if (this.deps.geocodingService) {
      return this.deps.geocodingService;
    }
    // Create a default instance if not provided
    return new GeocodingService();
  }

  /**
   * Handle get_distance tool
   * Calculate distance between two locations
   */
  private async handleGetDistance(args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = getDistanceArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid get_distance arguments: ${validation.error.message}`);
    }

    const { from, to } = validation.data;
    const geocodingService = this.getGeocodingService();

    const distance = await geocodingService.getDistanceBetween(from, to);

    if (!distance) {
      return {
        success: false,
        error: `Could not calculate distance between "${from}" and "${to}". Location(s) could not be geocoded.`,
      };
    }

    const recommendedMode = geocodingService.getRecommendedTravelMode(distance.kilometers);

    return {
      success: true,
      from,
      to,
      distance: {
        kilometers: distance.kilometers,
        miles: distance.miles,
      },
      estimatedTime: {
        driving: `${Math.floor(distance.estimatedDrivingMinutes / 60)}h ${distance.estimatedDrivingMinutes % 60}m`,
        flying: `${Math.floor(distance.estimatedFlightMinutes / 60)}h ${distance.estimatedFlightMinutes % 60}m`,
        drivingMinutes: distance.estimatedDrivingMinutes,
        flyingMinutes: distance.estimatedFlightMinutes,
      },
      recommendedMode,
      summary: `${from} to ${to}: ${distance.kilometers} km (${distance.miles} mi). ${recommendedMode === 'fly' ? 'Flying recommended' : recommendedMode === 'drive' ? 'Driving recommended' : 'Walking distance'}.`,
    };
  }

  /**
   * Handle show_route tool
   * Calculate and display a route between multiple locations
   */
  private async handleShowRoute(args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = showRouteArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid show_route arguments: ${validation.error.message}`);
    }

    const { locations, travelMode } = validation.data;

    const geocodingService = this.getGeocodingService();

    const route = await geocodingService.calculateRoute(locations);

    if (!route) {
      return {
        success: false,
        error: `Could not calculate route. One or more locations could not be geocoded.`,
      };
    }

    // Build route summary
    const routeSummary = route.segments.map((seg, i) => {
      const mode = travelMode === 'fly' || (travelMode === 'mixed' && seg.distanceKm > 300)
        ? 'fly'
        : 'drive';
      const timeMinutes = mode === 'fly'
        ? Math.round((seg.distanceKm / 800) * 60) + 60
        : seg.estimatedMinutes;
      const hours = Math.floor(timeMinutes / 60);
      const mins = timeMinutes % 60;

      return {
        leg: i + 1,
        from: seg.from,
        to: seg.to,
        distance: `${seg.distanceKm} km`,
        time: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
        mode,
      };
    });

    // Create map visualization data
    const mapVisualization = {
      type: 'route' as const,
      waypoints: route.waypoints.map(wp => ({
        name: wp.name,
        coordinates: { lat: wp.latitude, lng: wp.longitude },
      })),
      polyline: route.waypoints.map(wp => [wp.latitude, wp.longitude]),
    };

    return {
      success: true,
      route: {
        locations: locations,
        waypoints: route.waypoints,
        totalDistance: {
          kilometers: route.totalDistanceKm,
          miles: route.totalDistanceMiles,
        },
        segments: routeSummary,
      },
      // This signals to the frontend to show a map
      visualization: mapVisualization,
      summary: `Route: ${locations.join(' → ')} (${route.totalDistanceKm} km total)`,
    };
  }

  /**
   * Handle geocode_location tool
   * Get coordinates for a location
   */
  private async handleGeocodeLocation(args: unknown): Promise<unknown> {
    // Validate arguments
    const validation = geocodeLocationArgsSchema.safeParse(args);
    if (!validation.success) {
      throw new Error(`Invalid geocode_location arguments: ${validation.error.message}`);
    }

    const { location } = validation.data;
    const geocodingService = this.getGeocodingService();

    const result = await geocodingService.geocode(location);

    if (!result) {
      return {
        success: false,
        error: `Could not geocode "${location}". Location not found.`,
      };
    }

    return {
      success: true,
      location,
      coordinates: {
        latitude: result.latitude,
        longitude: result.longitude,
      },
      displayName: result.displayName,
      confidence: result.confidence,
    };
  }
}
