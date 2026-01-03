/**
 * Trip Designer Agent tool definitions
 * Maps OpenRouter function calls to existing services
 * @module services/trip-designer/tools
 */

import type { ToolDefinition } from '../../domain/types/trip-designer.js';

/**
 * Tool: get_itinerary
 * Get the current state of the itinerary
 */
export const GET_ITINERARY_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_itinerary',
    description: 'Get the complete current state of the itinerary including all segments, travelers, and metadata',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

/**
 * Tool: get_segment
 * Get details of a specific segment
 */
export const GET_SEGMENT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_segment',
    description: 'Get detailed information about a specific segment',
    parameters: {
      type: 'object',
      properties: {
        segmentId: {
          type: 'string',
          description: 'The ID of the segment to retrieve',
        },
      },
      required: ['segmentId'],
    },
  },
};

/**
 * Tool: add_flight
 * Add a flight segment to the itinerary
 */
export const ADD_FLIGHT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_flight',
    description: 'Add a RECOMMENDED flight to the itinerary. This does NOT book the flight - it adds a flight recommendation that the user can review and book later. MUST be called after search_flights to add your recommended option to the itinerary. Provide as much detail as available from search results, but only origin, destination, and departure date are required.',
    parameters: {
      type: 'object',
      properties: {
        airline: {
          type: 'object',
          description: 'Airline operating the flight (optional if not known)',
          properties: {
            name: { type: 'string', description: 'Full airline name (e.g., "United Airlines")' },
            code: { type: 'string', description: 'IATA airline code (e.g., "UA")' },
          },
        },
        flightNumber: {
          type: 'string',
          description: 'Flight number including airline code (e.g., "UA123") - optional if not known',
        },
        origin: {
          type: 'object',
          description: 'Origin airport or city (at minimum provide airport code or city name)',
          properties: {
            name: { type: 'string', description: 'Airport name (optional)' },
            code: { type: 'string', description: 'IATA airport code (e.g., "SFO") - provide if known' },
            city: { type: 'string', description: 'City name - provide if airport code not known' },
            country: { type: 'string', description: 'Country name (optional)' },
          },
        },
        destination: {
          type: 'object',
          description: 'Destination airport or city (at minimum provide airport code or city name)',
          properties: {
            name: { type: 'string', description: 'Airport name (optional)' },
            code: { type: 'string', description: 'IATA airport code (e.g., "JFK") - provide if known' },
            city: { type: 'string', description: 'City name - provide if airport code not known' },
            country: { type: 'string', description: 'Country name (optional)' },
          },
        },
        departureTime: {
          type: 'string',
          format: 'date-time',
          description: 'Departure date (and time if known) in ISO 8601 format. If only date is known, use format YYYY-MM-DD',
        },
        arrivalTime: {
          type: 'string',
          format: 'date-time',
          description: 'Arrival date and time in ISO 8601 format (optional if not known)',
        },
        cabinClass: {
          type: 'string',
          description: 'Cabin class (optional)',
          enum: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'],
        },
        price: {
          type: 'object',
          description: 'Flight price (optional)',
          properties: {
            amount: { type: 'number', description: 'Price amount' },
            currency: { type: 'string', description: 'Currency code (e.g., "USD")' },
          },
        },
        confirmationNumber: {
          type: 'string',
          description: 'Booking confirmation number (optional)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the flight (optional - can include search result details)',
        },
      },
      required: ['origin', 'destination', 'departureTime'],
    },
  },
};

/**
 * Tool: add_hotel
 * Add a hotel/accommodation segment
 */
export const ADD_HOTEL_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_hotel',
    description: 'Add a RECOMMENDED hotel or accommodation to the itinerary. This does NOT book the hotel - it adds a hotel recommendation that the user can review and book later. REQUIRED CALL when user mentions ANY accommodation (hotel, resort, Airbnb, "staying at", etc.) OR after calling search_hotels. You MUST call this tool immediately when user mentions where they are staying - verbal acknowledgment alone will NOT save the data. Example: User says "We\'re staying at Hotel L\'Esplanade" → You MUST call this tool with property details BEFORE responding.',
    parameters: {
      type: 'object',
      properties: {
        property: {
          type: 'object',
          description: 'Hotel property information',
          properties: {
            name: { type: 'string', description: 'Hotel name' },
            code: { type: 'string', description: 'Hotel code or ID (optional)' },
          },
          required: ['name'],
        },
        location: {
          type: 'object',
          description: 'Hotel location',
          properties: {
            name: { type: 'string', description: 'Address or area name' },
            city: { type: 'string', description: 'City name' },
            country: { type: 'string', description: 'Country name' },
          },
          required: ['name'],
        },
        checkInDate: {
          type: 'string',
          format: 'date',
          description: 'Check-in date (YYYY-MM-DD)',
        },
        checkOutDate: {
          type: 'string',
          format: 'date',
          description: 'Check-out date (YYYY-MM-DD)',
        },
        checkInTime: {
          type: 'string',
          description: 'Check-in time (HH:MM, default "15:00")',
        },
        checkOutTime: {
          type: 'string',
          description: 'Check-out time (HH:MM, default "11:00")',
        },
        roomType: {
          type: 'string',
          description: 'Room type or category',
        },
        roomCount: {
          type: 'number',
          description: 'Number of rooms',
          minimum: 1,
        },
        boardBasis: {
          type: 'string',
          description: 'Meal plan',
          enum: ['ROOM_ONLY', 'BED_BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'ALL_INCLUSIVE'],
        },
        price: {
          type: 'object',
          description: 'Total price for the stay',
          properties: {
            amount: { type: 'number' },
            currency: { type: 'string' },
          },
        },
        confirmationNumber: {
          type: 'string',
          description: 'Booking confirmation number',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the accommodation',
        },
      },
      required: ['property', 'location', 'checkInDate', 'checkOutDate'],
    },
  },
};

/**
 * Tool: add_activity
 * Add an activity or tour segment
 */
export const ADD_ACTIVITY_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_activity',
    description: 'Add a RECOMMENDED activity, tour, dining experience, or attraction to the itinerary. This does NOT book the activity - it adds a recommendation that the user can review and book later. REQUIRED CALL when user mentions ANY dining/activity (restaurant, tour, museum, show, etc.) OR when you recommend one. You MUST call this tool immediately when mentioning restaurants or activities - verbal discussion alone will NOT save the data. Example: User says "Dinner at Le Tastevin" OR you recommend "Ocean 82 has great seafood" → You MUST call this tool with activity details BEFORE/DURING your response.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Activity name or title',
        },
        description: {
          type: 'string',
          description: 'Description of what the activity involves',
        },
        location: {
          type: 'object',
          description: 'Activity location',
          properties: {
            name: { type: 'string', description: 'Venue or location name' },
            city: { type: 'string', description: 'City name' },
            country: { type: 'string', description: 'Country name' },
          },
          required: ['name'],
        },
        startTime: {
          type: 'string',
          format: 'date-time',
          description: 'Activity start date and time in ISO 8601 format',
        },
        endTime: {
          type: 'string',
          format: 'date-time',
          description: 'Activity end date and time in ISO 8601 format (if known)',
        },
        durationHours: {
          type: 'number',
          description: 'Estimated duration in hours (if endTime not specified)',
        },
        category: {
          type: 'string',
          description: 'Activity category (e.g., "tour", "museum", "dining", "outdoor")',
        },
        price: {
          type: 'object',
          description: 'Activity price per person',
          properties: {
            amount: { type: 'number' },
            currency: { type: 'string' },
          },
        },
        provider: {
          type: 'object',
          description: 'Tour operator or provider',
          properties: {
            name: { type: 'string' },
          },
        },
        confirmationNumber: {
          type: 'string',
          description: 'Booking confirmation or voucher number',
        },
        notes: {
          type: 'string',
          description: 'Additional notes, requirements, or what\'s included',
        },
      },
      required: ['name', 'location', 'startTime'],
    },
  },
};

/**
 * Tool: add_transfer
 * Add a ground transfer segment
 */
export const ADD_TRANSFER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_transfer',
    description: 'Add a ground transfer (taxi, shuttle, car service) between locations',
    parameters: {
      type: 'object',
      properties: {
        transferType: {
          type: 'string',
          description: 'Type of transfer',
          enum: ['TAXI', 'SHUTTLE', 'PRIVATE', 'PUBLIC', 'RIDE_SHARE', 'RENTAL_CAR', 'RAIL', 'FERRY', 'WALKING', 'OTHER'],
        },
        pickupLocation: {
          type: 'object',
          description: 'Pickup location',
          properties: {
            name: { type: 'string', description: 'Location name or address' },
            city: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['name'],
        },
        dropoffLocation: {
          type: 'object',
          description: 'Drop-off location',
          properties: {
            name: { type: 'string', description: 'Location name or address' },
            city: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['name'],
        },
        pickupTime: {
          type: 'string',
          format: 'date-time',
          description: 'Pickup date and time in ISO 8601 format',
        },
        estimatedDurationMinutes: {
          type: 'number',
          description: 'Estimated travel time in minutes',
        },
        vehicleDetails: {
          type: 'string',
          description: 'Vehicle type or description',
        },
        price: {
          type: 'object',
          description: 'Transfer price',
          properties: {
            amount: { type: 'number' },
            currency: { type: 'string' },
          },
        },
        provider: {
          type: 'object',
          description: 'Transfer provider or company',
          properties: {
            name: { type: 'string' },
          },
        },
        confirmationNumber: {
          type: 'string',
          description: 'Booking confirmation number',
        },
        notes: {
          type: 'string',
          description: 'Additional notes or meeting point instructions',
        },
      },
      required: ['transferType', 'pickupLocation', 'dropoffLocation', 'pickupTime'],
    },
  },
};

/**
 * Tool: add_meeting
 * Add a meeting or appointment segment
 */
export const ADD_MEETING_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_meeting',
    description: 'Add a meeting or appointment to the itinerary',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Meeting title or subject',
        },
        location: {
          type: 'object',
          description: 'Meeting location',
          properties: {
            name: { type: 'string', description: 'Venue name or address' },
            city: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['name'],
        },
        startTime: {
          type: 'string',
          format: 'date-time',
          description: 'Meeting start date and time in ISO 8601 format',
        },
        endTime: {
          type: 'string',
          format: 'date-time',
          description: 'Meeting end date and time in ISO 8601 format',
        },
        organizer: {
          type: 'string',
          description: 'Meeting organizer name',
        },
        attendees: {
          type: 'array',
          description: 'List of attendee names',
          items: { type: 'string' },
        },
        agenda: {
          type: 'string',
          description: 'Meeting agenda or description',
        },
        meetingUrl: {
          type: 'string',
          description: 'Virtual meeting URL (if applicable)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes or requirements',
        },
      },
      required: ['title', 'location', 'startTime', 'endTime'],
    },
  },
};

/**
 * Tool: update_segment
 * Update an existing segment
 */
export const UPDATE_SEGMENT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_segment',
    description: 'Update fields of an existing segment. Only provided fields will be updated.',
    parameters: {
      type: 'object',
      properties: {
        segmentId: {
          type: 'string',
          description: 'ID of the segment to update',
        },
        updates: {
          type: 'object',
          description: 'Fields to update. Structure depends on segment type. Common fields: notes, price, confirmationNumber, status',
        },
      },
      required: ['segmentId', 'updates'],
    },
  },
};

/**
 * Tool: update_itinerary
 * Update itinerary metadata (title, dates, description, destinations)
 */
export const UPDATE_ITINERARY_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_itinerary',
    description: 'Update the itinerary metadata such as title, description, start/end dates, and destinations. Use this when the user provides trip details like "10 day trip to Portugal, January 3-12".',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Trip title (e.g., "Portugal Adventure", "Japan Trip")',
        },
        description: {
          type: 'string',
          description: 'Trip description or notes',
        },
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Trip start date (YYYY-MM-DD)',
        },
        endDate: {
          type: 'string',
          format: 'date',
          description: 'Trip end date (YYYY-MM-DD)',
        },
        destinations: {
          type: 'array',
          description: 'List of destination names/cities',
          items: { type: 'string' },
        },
      },
      required: [],
    },
  },
};

/**
 * Tool: update_preferences
 * Update traveler preferences for the trip
 */
export const UPDATE_PREFERENCES_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_preferences',
    description: 'Update traveler preferences for the trip such as traveler type, trip purpose, travel style, pace, interests, budget, dietary restrictions, and mobility needs. MUST be called after EVERY user response to structured questions to save their answers.',
    parameters: {
      type: 'object',
      properties: {
        travelerType: {
          type: 'string',
          description: 'Who is traveling - traveler type',
          enum: ['solo', 'couple', 'family', 'friends', 'business', 'group'],
        },
        tripPurpose: {
          type: 'string',
          description: 'Why they are traveling - trip purpose (e.g., "vacation", "business", "client_meetings", "conference", "wedding", "honeymoon")',
        },
        travelStyle: {
          type: 'string',
          description: 'Travel style preference',
          enum: ['luxury', 'moderate', 'budget', 'backpacker'],
        },
        pace: {
          type: 'string',
          description: 'Trip pacing preference',
          enum: ['packed', 'balanced', 'leisurely'],
        },
        interests: {
          type: 'array',
          description: 'Areas of interest (e.g., food, history, nature, nightlife, art, culture, adventure)',
          items: { type: 'string' },
        },
        budgetFlexibility: {
          type: 'number',
          description: 'Budget flexibility on a scale of 1-5 (1 = very strict, 5 = very flexible)',
          minimum: 1,
          maximum: 5,
        },
        budget: {
          type: 'object',
          description: 'Budget details',
          properties: {
            amount: {
              type: 'number',
              description: 'Budget amount',
            },
            currency: {
              type: 'string',
              description: 'Currency code (ISO 4217, e.g., "USD", "EUR")',
            },
            period: {
              type: 'string',
              description: 'Budget period',
              enum: ['per_day', 'per_person', 'total'],
            },
          },
        },
        dietaryRestrictions: {
          type: 'string',
          description: 'Dietary restrictions or preferences (e.g., "vegetarian", "vegan", "gluten-free", "halal", "kosher", "none")',
        },
        mobilityRestrictions: {
          type: 'string',
          description: 'Mobility restrictions or accessibility needs (e.g., "wheelchair accessible", "limited walking", "no stairs", "none")',
        },
        origin: {
          type: 'string',
          description: 'Origin location - where they are traveling from (e.g., "New York", "London")',
        },
        accommodationPreference: {
          type: 'string',
          description: 'Preferred accommodation type',
          enum: ['hotel', 'resort', 'airbnb', 'hostel', 'boutique'],
        },
        activityPreferences: {
          type: 'array',
          description: 'Preferred activity types (e.g., museums, hiking, beaches, shopping, local experiences)',
          items: { type: 'string' },
        },
        avoidances: {
          type: 'array',
          description: 'Things to avoid (e.g., crowds, long walks, flying, early mornings)',
          items: { type: 'string' },
        },
      },
      required: [],
    },
  },
};

/**
 * Tool: delete_segment
 * Delete a segment from the itinerary
 */
export const DELETE_SEGMENT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_segment',
    description: 'Delete a segment from the itinerary. Will also clean up any dependencies on this segment.',
    parameters: {
      type: 'object',
      properties: {
        segmentId: {
          type: 'string',
          description: 'ID of the segment to delete',
        },
      },
      required: ['segmentId'],
    },
  },
};

/**
 * Tool: move_segment
 * Move a segment in time (cascades to dependent segments)
 */
export const MOVE_SEGMENT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'move_segment',
    description: 'Move a segment to a new time. Any dependent segments will be automatically adjusted to maintain continuity.',
    parameters: {
      type: 'object',
      properties: {
        segmentId: {
          type: 'string',
          description: 'ID of the segment to move',
        },
        newStartTime: {
          type: 'string',
          format: 'date-time',
          description: 'New start date and time in ISO 8601 format',
        },
      },
      required: ['segmentId', 'newStartTime'],
    },
  },
};

/**
 * Tool: reorder_segments
 * Change the display order of segments
 */
export const REORDER_SEGMENTS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'reorder_segments',
    description: 'Change the display order of segments in the itinerary',
    parameters: {
      type: 'object',
      properties: {
        segmentIds: {
          type: 'array',
          description: 'Array of segment IDs in the desired order',
          items: { type: 'string' },
        },
      },
      required: ['segmentIds'],
    },
  },
};

/**
 * Tool: search_web
 * Search the web for travel information
 */
export const SEARCH_WEB_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_web',
    description: 'Search the web for current travel information, events, weather, opening hours, or general facts. Uses OpenRouter\'s built-in web search.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
      },
      required: ['query'],
    },
  },
};

/**
 * Tool: search_flights
 * Search for flight prices and availability
 */
export const SEARCH_FLIGHTS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_flights',
    description: 'Search for flight prices and availability using Google Flights via SERP API. After calling this, you MUST call add_flight to add the recommended option to the itinerary.',
    parameters: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          description: 'Origin airport code (e.g., "SFO")',
        },
        destination: {
          type: 'string',
          description: 'Destination airport code (e.g., "JFK")',
        },
        departureDate: {
          type: 'string',
          format: 'date',
          description: 'Departure date (YYYY-MM-DD)',
        },
        returnDate: {
          type: 'string',
          format: 'date',
          description: 'Return date for round trip (optional)',
        },
        adults: {
          type: 'number',
          description: 'Number of adult passengers (default: 1)',
          minimum: 1,
        },
        cabinClass: {
          type: 'string',
          description: 'Cabin class preference',
          enum: ['economy', 'premium_economy', 'business', 'first'],
        },
      },
      required: ['origin', 'destination', 'departureDate'],
    },
  },
};

/**
 * Tool: search_hotels
 * Search for hotel prices and availability
 */
export const SEARCH_HOTELS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_hotels',
    description: 'Search for hotel prices and availability using Google Hotels via SERP API. After calling this, you MUST call add_hotel to add the recommended option to the itinerary.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Hotel name or location (city, area, or address)',
        },
        checkInDate: {
          type: 'string',
          format: 'date',
          description: 'Check-in date (YYYY-MM-DD)',
        },
        checkOutDate: {
          type: 'string',
          format: 'date',
          description: 'Check-out date (YYYY-MM-DD)',
        },
        adults: {
          type: 'number',
          description: 'Number of adults (default: 2)',
          minimum: 1,
        },
        children: {
          type: 'number',
          description: 'Number of children (default: 0)',
          minimum: 0,
        },
      },
      required: ['location', 'checkInDate', 'checkOutDate'],
    },
  },
};

/**
 * Tool: search_transfers
 * Search for transfer options between locations
 */
export const SEARCH_TRANSFERS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_transfers',
    description: 'Search for ground transfer options and estimated travel times between two locations',
    parameters: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          description: 'Origin location (address, airport code, or place name)',
        },
        destination: {
          type: 'string',
          description: 'Destination location (address, airport code, or place name)',
        },
      },
      required: ['origin', 'destination'],
    },
  },
};

/**
 * Tool: store_travel_intelligence
 * Store seasonal/event information in the vector knowledge base
 */
export const STORE_TRAVEL_INTELLIGENCE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'store_travel_intelligence',
    description: 'Store travel intelligence (seasonal info, events, advisories, closures) in the knowledge base for future reference. Call this after every web search about a destination to build up knowledge.',
    parameters: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          description: 'Destination name (city or country, e.g., "Portugal", "Lisbon", "Tokyo")',
        },
        dates: {
          type: 'string',
          description: 'Relevant time period (e.g., "January 2025", "Summer 2025", "Year-round")',
        },
        category: {
          type: 'string',
          description: 'Category of intelligence',
          enum: ['weather', 'events', 'festivals', 'closures', 'advisory', 'crowds', 'prices', 'opportunities', 'warnings', 'tips'],
        },
        level: {
          type: 'string',
          description: 'Geographic level of the information',
          enum: ['country', 'region', 'city', 'neighborhood', 'attraction'],
        },
        findings: {
          type: 'string',
          description: 'Summary of the key findings from research (2-5 sentences)',
        },
        impact: {
          type: 'string',
          description: 'How this affects travel planning',
          enum: ['positive', 'negative', 'neutral', 'opportunity'],
        },
        confidence: {
          type: 'string',
          description: 'Confidence level of the information',
          enum: ['high', 'medium', 'low'],
        },
        source: {
          type: 'string',
          description: 'Where this information came from (e.g., "web search", "official tourism site")',
        },
        tags: {
          type: 'array',
          description: 'Relevant tags for retrieval (e.g., ["cherry-blossom", "crowds", "spring"])',
          items: { type: 'string' },
        },
      },
      required: ['destination', 'category', 'findings'],
    },
  },
};

/**
 * Tool: retrieve_travel_intelligence
 * Retrieve stored seasonal/event information from the knowledge base
 */
export const RETRIEVE_TRAVEL_INTELLIGENCE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'retrieve_travel_intelligence',
    description: 'Retrieve stored travel intelligence from the knowledge base. Use before making recommendations to check for known seasonal factors, events, or advisories.',
    parameters: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          description: 'Destination to query (city or country)',
        },
        dates: {
          type: 'string',
          description: 'Time period to query (e.g., "January 2025")',
        },
        categories: {
          type: 'array',
          description: 'Categories to retrieve (leave empty for all)',
          items: {
            type: 'string',
            enum: ['weather', 'events', 'festivals', 'closures', 'advisory', 'crowds', 'prices', 'opportunities', 'warnings', 'tips'],
          },
        },
        query: {
          type: 'string',
          description: 'Natural language query to search the knowledge base (e.g., "festivals in January", "weather warnings")',
        },
      },
      required: ['destination'],
    },
  },
};

/**
 * Tool: switch_to_trip_designer
 * Switch from Help agent to Trip Designer agent when user wants to plan a trip
 */
export const SWITCH_TO_TRIP_DESIGNER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'switch_to_trip_designer',
    description: 'Switch from Help mode to Trip Designer mode when the user indicates they want to start planning a trip. Call this when you detect trip planning intent like "I want to plan a trip", "Help me plan a vacation", "I\'m going to [destination]", etc.',
    parameters: {
      type: 'object',
      properties: {
        initialContext: {
          type: 'string',
          description: 'Any trip planning context the user has already shared (destination, dates, travelers, etc.) to pass to the Trip Designer',
        },
      },
      required: [],
    },
  },
};

/**
 * Tool: get_distance
 * Calculate distance between two locations
 */
export const GET_DISTANCE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_distance',
    description: 'Calculate the distance between two locations. Returns kilometers, miles, and estimated travel times for driving and flying. Use this when discussing travel between cities or planning route logistics.',
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Origin location name (city, airport, or address)',
        },
        to: {
          type: 'string',
          description: 'Destination location name (city, airport, or address)',
        },
      },
      required: ['from', 'to'],
    },
  },
};

/**
 * Tool: show_route
 * Calculate and display a route between multiple locations
 */
export const SHOW_ROUTE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'show_route',
    description: 'Calculate a route between multiple locations and display it on a map. Use this when the user wants to visualize their travel path between cities. Returns a route with waypoints, total distance, and segment details.',
    parameters: {
      type: 'object',
      properties: {
        locations: {
          type: 'array',
          description: 'Array of location names in order of travel (e.g., ["Zagreb", "Plitvice Lakes", "Split", "Dubrovnik"])',
          items: { type: 'string' },
          minItems: 2,
        },
        travelMode: {
          type: 'string',
          description: 'Preferred travel mode for time estimates',
          enum: ['drive', 'fly', 'mixed'],
        },
      },
      required: ['locations'],
    },
  },
};

/**
 * Tool: geocode_location
 * Get coordinates for a location
 */
export const GEOCODE_LOCATION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'geocode_location',
    description: 'Get the latitude and longitude coordinates for a location. Use this when you need precise coordinates for mapping or calculations.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Location name to geocode (city, address, or landmark)',
        },
      },
      required: ['location'],
    },
  },
};

/**
 * Tool: add_traveler
 * Add a traveler to the itinerary
 */
export const ADD_TRAVELER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_traveler',
    description: 'Add a traveler to the itinerary. Call this for each person traveling when their name or details are mentioned. Capture all travelers mentioned in conversation.',
    parameters: {
      type: 'object',
      properties: {
        firstName: {
          type: 'string',
          description: 'First name of the traveler (required)',
        },
        lastName: {
          type: 'string',
          description: 'Last name (optional if not provided)',
        },
        middleName: {
          type: 'string',
          description: 'Middle name (optional)',
        },
        email: {
          type: 'string',
          description: 'Email address (optional)',
        },
        phone: {
          type: 'string',
          description: 'Phone number (optional)',
        },
        type: {
          type: 'string',
          enum: ['adult', 'child', 'infant', 'senior'],
          description: 'Traveler type - adult (18+), child (2-17), infant (under 2), senior (65+)',
        },
        age: {
          type: 'number',
          description: 'Age of traveler (especially important for children)',
        },
        dateOfBirth: {
          type: 'string',
          format: 'date',
          description: 'Date of birth (YYYY-MM-DD format, optional)',
        },
        relationship: {
          type: 'string',
          description: 'Relationship to primary traveler (e.g., "partner", "spouse", "child", "friend", "parent", "sibling")',
        },
        isPrimary: {
          type: 'boolean',
          description: 'Whether this is the primary traveler (the user themselves). Set to true for the main user.',
        },
      },
      required: ['firstName', 'type'],
    },
  },
};

/**
 * Help agent tools
 * Minimal set for answering help questions and switching to Trip Designer
 */
export const HELP_AGENT_TOOLS: ToolDefinition[] = [
  SWITCH_TO_TRIP_DESIGNER_TOOL,
];

/**
 * Essential tools for initial context (new itineraries)
 * Minimal set to reduce token count on first message
 *
 * IMPORTANT: Includes segment-creating tools (add_flight, add_hotel, add_activity)
 * so the Trip Designer can capture bookings mentioned in the first message.
 */
export const ESSENTIAL_TOOLS: ToolDefinition[] = [
  GET_ITINERARY_TOOL,
  UPDATE_ITINERARY_TOOL,
  UPDATE_PREFERENCES_TOOL,
  ADD_TRAVELER_TOOL,
  ADD_FLIGHT_TOOL,
  ADD_HOTEL_TOOL,
  ADD_ACTIVITY_TOOL,
  SEARCH_WEB_TOOL,
  SEARCH_FLIGHTS_TOOL,
  SEARCH_HOTELS_TOOL,
];

/**
 * All available tools for the Trip Designer Agent
 */
export const ALL_TOOLS: ToolDefinition[] = [
  GET_ITINERARY_TOOL,
  GET_SEGMENT_TOOL,
  UPDATE_ITINERARY_TOOL,
  UPDATE_PREFERENCES_TOOL,
  ADD_TRAVELER_TOOL,
  ADD_FLIGHT_TOOL,
  ADD_HOTEL_TOOL,
  ADD_ACTIVITY_TOOL,
  ADD_TRANSFER_TOOL,
  ADD_MEETING_TOOL,
  UPDATE_SEGMENT_TOOL,
  DELETE_SEGMENT_TOOL,
  MOVE_SEGMENT_TOOL,
  REORDER_SEGMENTS_TOOL,
  SEARCH_WEB_TOOL,
  SEARCH_FLIGHTS_TOOL,
  SEARCH_HOTELS_TOOL,
  SEARCH_TRANSFERS_TOOL,
  STORE_TRAVEL_INTELLIGENCE_TOOL,
  RETRIEVE_TRAVEL_INTELLIGENCE_TOOL,
  // Geography tools
  GET_DISTANCE_TOOL,
  SHOW_ROUTE_TOOL,
  GEOCODE_LOCATION_TOOL,
];

/**
 * Tool names enum for type safety
 */
export const ToolName = {
  GET_ITINERARY: 'get_itinerary',
  GET_SEGMENT: 'get_segment',
  UPDATE_ITINERARY: 'update_itinerary',
  UPDATE_PREFERENCES: 'update_preferences',
  ADD_TRAVELER: 'add_traveler',
  ADD_FLIGHT: 'add_flight',
  ADD_HOTEL: 'add_hotel',
  ADD_ACTIVITY: 'add_activity',
  ADD_TRANSFER: 'add_transfer',
  ADD_MEETING: 'add_meeting',
  UPDATE_SEGMENT: 'update_segment',
  DELETE_SEGMENT: 'delete_segment',
  MOVE_SEGMENT: 'move_segment',
  REORDER_SEGMENTS: 'reorder_segments',
  SEARCH_WEB: 'search_web',
  SEARCH_FLIGHTS: 'search_flights',
  SEARCH_HOTELS: 'search_hotels',
  SEARCH_TRANSFERS: 'search_transfers',
  STORE_TRAVEL_INTELLIGENCE: 'store_travel_intelligence',
  RETRIEVE_TRAVEL_INTELLIGENCE: 'retrieve_travel_intelligence',
  SWITCH_TO_TRIP_DESIGNER: 'switch_to_trip_designer',
  // Geography tools
  GET_DISTANCE: 'get_distance',
  SHOW_ROUTE: 'show_route',
  GEOCODE_LOCATION: 'geocode_location',
} as const;

export type ToolName = (typeof ToolName)[keyof typeof ToolName];
