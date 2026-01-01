/**
 * Traveler Persona Agent for End-to-End Testing
 * Simulates different traveler types interacting with Trip Designer
 * Tests full API → Service → Data flow with realistic user behavior
 *
 * Usage:
 *   npx tsx tests/e2e/traveler-persona-agent.ts
 *   npx tsx tests/e2e/traveler-persona-agent.ts --persona=romantic-couple
 *   npx tsx tests/e2e/traveler-persona-agent.ts --type=family
 *   npx tsx tests/e2e/traveler-persona-agent.ts --model=gpt-4o
 *
 * @module tests/e2e/traveler-persona-agent
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import type { Itinerary } from '../../src/domain/types/itinerary.js';
import type { SegmentType } from '../../src/domain/types/common.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ===== TYPES =====

interface TravelerInfo {
  name: string;
  type: 'adult' | 'child' | 'infant';
  age?: number;
}

interface TripPreferences {
  budget: 'budget' | 'moderate' | 'luxury';
  pace: 'relaxed' | 'moderate' | 'packed';
  accommodation: 'hostel' | 'hotel' | 'resort' | 'boutique' | 'airbnb';
  interests: string[];
  dietaryRestrictions?: string[];
  mobilityNeeds?: string[];
}

interface TripRequest {
  destination?: string;
  origin: string;
  duration: string;
  dates?: { start: string; end: string };
  specialRequests?: string[];
}

interface PersonaExpectations {
  minSegments: number;
  expectedSegmentTypes: SegmentType[];
  shouldInclude?: string[];
  shouldNotInclude?: string[];
  budgetRange?: { min: number; max: number };
}

interface TravelerPersona {
  id: string;
  name: string;
  type: 'solo' | 'couple' | 'family' | 'business' | 'luxury' | 'budget' | 'adventure' | 'senior';
  travelers: TravelerInfo[];
  preferences: TripPreferences;
  tripRequest: TripRequest;
  expectations: PersonaExpectations;
  communicationStyle?: string;
  sampleBookingPhrases?: string[];
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: string[];
}

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

interface ValidationResult {
  valid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  metrics: {
    segmentCount: number;
    segmentTypesCovered: string[];
    keywordsFound: string[];
    forbiddenFound: string[];
    budgetCompliance?: boolean;
  };
}

interface ConversationResult {
  valid: boolean;
  turns: number;
  duration: number;
  itinerary?: Itinerary;
  validation: ValidationResult;
  errors: string[];
  estimatedCost?: number;
  transcript: ConversationMessage[];
}

interface PersonaTestResult {
  persona: string;
  success: boolean;
  conversationTurns: number;
  itinerary?: Itinerary;
  validation: ValidationResult;
  errors: string[];
  duration: number;
  cost?: number;
}

interface TestOptions {
  model?: string;
  apiBaseUrl?: string;
  maxTurns?: number;
  saveResults?: boolean;
  verbose?: boolean;
}

interface AgentOptions {
  model?: string;
  apiBaseUrl?: string;
  maxTurns?: number;
  verbose?: boolean;
  openrouterApiKey?: string;
  userEmail?: string;
}

interface SSEEvent {
  event: string;
  data: string;
}

// ===== PERSONA DEFINITIONS =====

const PERSONAS: TravelerPersona[] = [
  {
    id: 'solo-backpacker',
    name: 'Alex the Backpacker',
    type: 'solo',
    travelers: [{ name: 'Alex', type: 'adult', age: 28 }],
    preferences: {
      budget: 'budget',
      pace: 'packed',
      accommodation: 'hostel',
      interests: ['hiking', 'local food', 'nightlife', 'photography'],
    },
    tripRequest: {
      origin: 'NYC',
      destination: 'Southeast Asia',
      duration: '3 weeks',
    },
    expectations: {
      minSegments: 10,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
      shouldInclude: ['hostel', 'street food', 'temple'],
      shouldNotInclude: ['luxury', 'resort', 'fine dining'],
    },
    communicationStyle: 'casual, enthusiastic, uses slang, values authenticity',
    sampleBookingPhrases: [
      'Book that flight for me',
      'Add that hostel to my trip',
      'I want to reserve that',
      'Put that activity on my itinerary',
      'Go ahead and add that'
    ]
  },

  {
    id: 'romantic-couple',
    name: 'Sarah & Michael',
    type: 'couple',
    travelers: [
      { name: 'Sarah', type: 'adult', age: 32 },
      { name: 'Michael', type: 'adult', age: 34 }
    ],
    preferences: {
      budget: 'luxury',
      pace: 'relaxed',
      accommodation: 'boutique',
      interests: ['wine tasting', 'spa', 'fine dining', 'romantic views'],
    },
    tripRequest: {
      origin: 'LAX',
      destination: 'Italy',
      duration: '10 days',
      specialRequests: ['anniversary trip', 'prefer Amalfi Coast'],
    },
    expectations: {
      minSegments: 8,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY', 'TRANSFER'],
      shouldInclude: ['romantic', 'wine', 'sunset'],
      shouldNotInclude: ['budget', 'hostel', 'family-friendly'],
    },
    communicationStyle: 'polite, detail-oriented, appreciates recommendations, romantic',
    sampleBookingPhrases: [
      'Please book that hotel for us',
      'We would like to reserve that restaurant',
      'Add that wine tour to our itinerary',
      'Please add that to our trip',
      'Book that for our anniversary trip'
    ]
  },

  {
    id: 'family-vacation',
    name: 'The Johnson Family',
    type: 'family',
    travelers: [
      { name: 'David', type: 'adult', age: 42 },
      { name: 'Lisa', type: 'adult', age: 40 },
      { name: 'Emma', type: 'child', age: 12 },
      { name: 'Jake', type: 'child', age: 8 }
    ],
    preferences: {
      budget: 'moderate',
      pace: 'relaxed',
      accommodation: 'resort',
      interests: ['Walt Disney World Magic Kingdom', 'Universal Studios Orlando', 'resort pools', 'beach', 'kid-friendly activities'],
      dietaryRestrictions: ['nut allergy'],
    },
    tripRequest: {
      origin: 'Chicago',
      destination: 'Orlando',
      duration: '1 week',
      dates: { start: '2025-06-15', end: '2025-06-22' },
    },
    expectations: {
      minSegments: 6,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
      shouldInclude: ['Disney', 'Universal', 'pool', 'resort', 'family'],
      shouldNotInclude: ['nightclub', 'bar crawl', 'adults-only'],
    },
    communicationStyle: 'practical, safety-conscious, kid-focused, organized',
    sampleBookingPhrases: [
      'Book those Disney tickets for our family',
      'Please add that resort to our itinerary',
      'Reserve that family-friendly restaurant',
      'Add those theme park tickets',
      'Book that for all four of us',
      'Book pool access at the resort',
      'Reserve a cabana by the pool',
      'Get us Magic Kingdom tickets for multiple days',
      'Add Universal Studios to our trip'
    ]
  },

  {
    id: 'business-traveler',
    name: 'Jennifer Chen',
    type: 'business',
    travelers: [{ name: 'Jennifer', type: 'adult', age: 45 }],
    preferences: {
      budget: 'moderate',
      pace: 'packed',
      accommodation: 'hotel',
      interests: ['efficient transport', 'business amenities', 'quick meals'],
    },
    tripRequest: {
      origin: 'SFO',
      destination: 'Tokyo',
      duration: '5 days',
      specialRequests: ['meetings in Shibuya', 'need reliable wifi', 'prefer business hotels'],
    },
    expectations: {
      minSegments: 5,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'MEETING', 'TRANSFER'],
      shouldInclude: ['business', 'wifi', 'central'],
      shouldNotInclude: ['beach', 'resort', 'leisure'],
    },
    communicationStyle: 'direct, time-conscious, efficiency-focused, professional',
    sampleBookingPhrases: [
      'Book that business class flight',
      'Reserve that hotel near Shibuya',
      'Add that airport transfer',
      'Book that meeting room',
      'I need that booked ASAP'
    ]
  },

  {
    id: 'luxury-retirees',
    name: 'The Hendersons',
    type: 'senior',
    travelers: [
      { name: 'Robert', type: 'adult', age: 68 },
      { name: 'Margaret', type: 'adult', age: 65 }
    ],
    preferences: {
      budget: 'luxury',
      pace: 'relaxed',
      accommodation: 'resort',
      interests: ['history', 'art', 'fine dining', 'scenic views'],
      mobilityNeeds: ['limited walking', 'prefer elevators'],
    },
    tripRequest: {
      origin: 'Miami',
      destination: 'Mediterranean cruise',
      duration: '2 weeks',
    },
    expectations: {
      minSegments: 4,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
      shouldInclude: ['accessible', 'luxury', 'guided tour'],
      shouldNotInclude: ['hiking', 'adventure', 'budget'],
    },
    communicationStyle: 'thoughtful, experienced, values comfort, appreciates culture',
    sampleBookingPhrases: [
      'Please book that luxury suite for us',
      'Reserve that guided museum tour',
      'Add that fine dining restaurant',
      'Book that first-class cabin',
      'We would like to reserve that'
    ]
  },

  {
    id: 'adventure-group',
    name: 'Adventure Squad',
    type: 'adventure',
    travelers: [
      { name: 'Mike', type: 'adult', age: 30 },
      { name: 'Sara', type: 'adult', age: 29 },
      { name: 'Tom', type: 'adult', age: 31 },
      { name: 'Anna', type: 'adult', age: 28 }
    ],
    preferences: {
      budget: 'moderate',
      pace: 'packed',
      accommodation: 'airbnb',
      interests: ['zip-lining tours', 'volcano hiking', 'whitewater rafting', 'jungle trekking', 'extreme sports'],
    },
    tripRequest: {
      origin: 'Denver',
      destination: 'Costa Rica',
      duration: '10 days',
      specialRequests: ['want to try zip-lining', 'rainforest hike'],
    },
    expectations: {
      minSegments: 6,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
      shouldInclude: ['adventure', 'zip', 'hike'],
      shouldNotInclude: ['spa', 'relaxation', 'shopping'],
    },
    communicationStyle: 'energetic, adventurous, group-oriented, seeks thrills',
    sampleBookingPhrases: [
      'Book that zip-lining tour for all of us',
      'Add that rafting adventure',
      'Reserve those spots on the hike',
      'Sign us up for that',
      'Book that extreme sports package',
      'Book that zip-line tour right now',
      'Sign all four of us up for the hike',
      'Reserve that adventure package for the group',
      'Add that volcano hike to our itinerary'
    ]
  },

  {
    id: 'budget-student',
    name: 'Jordan',
    type: 'budget',
    travelers: [{ name: 'Jordan', type: 'adult', age: 22 }],
    preferences: {
      budget: 'budget',
      pace: 'moderate',
      accommodation: 'hostel',
      interests: ['museums (free days)', 'walking tours', 'street food', 'parks'],
    },
    tripRequest: {
      origin: 'Boston',
      destination: 'Europe',
      duration: '2 weeks',
      specialRequests: ['staying under $50/day', 'want to see multiple cities'],
    },
    expectations: {
      minSegments: 8,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
      shouldInclude: ['hostel', 'free', 'walking', 'budget'],
      shouldNotInclude: ['luxury', 'michelin', 'five-star'],
    },
    communicationStyle: 'budget-conscious, flexible, curious, student mindset',
    sampleBookingPhrases: [
      'Book that cheap hostel',
      'Add that free walking tour',
      'Reserve that budget flight',
      'Add that to my trip',
      'Book that for me'
    ]
  },

  {
    id: 'open-ended',
    name: 'Curious Traveler',
    type: 'solo',
    travelers: [{ name: 'Pat', type: 'adult', age: 35 }],
    preferences: {
      budget: 'moderate',
      pace: 'moderate',
      accommodation: 'hotel',
      interests: ['surprise me', 'local experiences', 'off the beaten path'],
    },
    tripRequest: {
      origin: 'Seattle',
      duration: '1 week',
      // NO destination - should prompt Trip Designer to ask questions
    },
    expectations: {
      minSegments: 5,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
      shouldInclude: ['unique', 'local'],
    },
    communicationStyle: 'open-minded, exploratory, trusts recommendations, adventurous',
    sampleBookingPhrases: [
      'Add that to my itinerary',
      'Book that for me',
      'Reserve that experience',
      'Sign me up for that',
      'I want to book that'
    ]
  }
];

// ===== TRAVELER PERSONA AGENT =====

class TravelerPersonaAgent {
  private persona: TravelerPersona;
  private model: string;
  private apiBaseUrl: string;
  private maxTurns: number;
  private verbose: boolean;
  private conversationHistory: ConversationMessage[];
  private itineraryId?: string;
  private sessionId?: string;
  private openai: OpenAI;
  private startTime: number;
  private sessionCookie: string | null = null;
  private userEmail: string;
  private openrouterApiKey: string;

  constructor(persona: TravelerPersona, options: AgentOptions) {
    this.persona = persona;
    this.model = options.model || 'anthropic/claude-sonnet-4';
    this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:5176/api/v1';
    this.maxTurns = options.maxTurns || 15;
    this.verbose = options.verbose ?? true;
    this.userEmail = options.userEmail || 'test@test.com';
    this.conversationHistory = [];
    this.startTime = Date.now();

    // Initialize OpenAI client for persona LLM
    this.openrouterApiKey = options.openrouterApiKey || process.env.OPENROUTER_API_KEY || '';
    if (!this.openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }

    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.openrouterApiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/yourusername/itinerator',
        'X-Title': 'Itinerator E2E Test'
      }
    });
  }

  /**
   * Authenticate with the API
   */
  private async authenticate(): Promise<void> {
    // Extract base URL without /api/v1
    const baseUrl = this.apiBaseUrl.replace(/\/api\/v1$/, '');

    if (this.verbose) console.log(`🔐 Authenticating as ${this.userEmail}...`);

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.userEmail })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${response.status} ${error}`);
    }

    // DEBUG: Log raw Set-Cookie headers
    console.log('\n🔍 DEBUG: Authentication Response Headers');
    console.log('Status:', response.status);

    // Try getSetCookie() first (newer API)
    const allCookies: string[] = [];
    if (typeof (response.headers as any).getSetCookie === 'function') {
      allCookies.push(...(response.headers as any).getSetCookie());
      console.log('Set-Cookie (via getSetCookie()):', allCookies);
    } else {
      // Fallback to get('set-cookie') which only returns first cookie
      const setCookie = response.headers.get('set-cookie');
      console.log('Set-Cookie (via get()):', setCookie);
      if (setCookie) {
        allCookies.push(setCookie);
      }
    }

    if (allCookies.length === 0) {
      throw new Error('No session cookie received from authentication');
    }

    // Extract both cookies
    let sessionValue = '';
    let emailValue = '';

    for (const cookieHeader of allCookies) {
      const sessionMatch = cookieHeader.match(/itinerator_session=([^;]+)/);
      const emailMatch = cookieHeader.match(/itinerator_user_email=([^;]+)/);

      if (sessionMatch) sessionValue = sessionMatch[1];
      if (emailMatch) emailValue = emailMatch[1];
    }

    if (!sessionValue) {
      throw new Error('itinerator_session cookie not found in response');
    }

    // Build cookie string for subsequent requests
    // If server didn't send email cookie, construct it manually
    if (!emailValue) {
      emailValue = encodeURIComponent(this.userEmail);
      console.log('⚠️  Server did not send itinerator_user_email cookie, constructing manually');
    }

    this.sessionCookie = `itinerator_session=${sessionValue}; itinerator_user_email=${emailValue}`;

    console.log('✅ Session cookie stored:', this.sessionCookie);
    console.log('');

    if (this.verbose) console.log(`✅ Authenticated successfully`);
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(includeAIKey = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add session cookie for authentication
    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
      console.log('🔍 DEBUG: Cookie header being sent:', this.sessionCookie);
    } else {
      console.log('⚠️  WARNING: No session cookie available');
    }

    // Add X-User-Email header as fallback for server-side fetch
    headers['X-User-Email'] = this.userEmail;

    // Add OpenRouter API key for AI-powered endpoints
    if (includeAIKey) {
      headers['X-OpenRouter-API-Key'] = this.openrouterApiKey;
    }

    return headers;
  }

  /**
   * Generate realistic user message as this persona would speak
   */
  private async generateUserMessage(context: {
    isFirstMessage: boolean;
    lastAssistantMessage?: string;
    itinerary?: Itinerary;
  }): Promise<string> {
    const bookingPhrasesSection = this.persona.sampleBookingPhrases
      ? `\n\nBOOKING LANGUAGE - Use explicit booking requests like:
${this.persona.sampleBookingPhrases.map(p => `- "${p}"`).join('\n')}

IMPORTANT: When the Trip Designer suggests specific flights, hotels, activities, or restaurants, respond with EXPLICIT booking language.
Use phrases like "book that", "add that to my itinerary", "reserve that", "I want to book", etc.
Do NOT just say "that sounds good" or "I like that" - actively REQUEST the booking.`
      : '';

    const systemPrompt = `You are roleplaying as ${this.persona.name}, a ${this.persona.type} traveler.

PERSONA DETAILS:
- Travelers: ${this.persona.travelers.map(t => `${t.name} (${t.type}, age ${t.age || 'unknown'})`).join(', ')}
- Budget: ${this.persona.preferences.budget}
- Pace: ${this.persona.preferences.pace}
- Accommodation preference: ${this.persona.preferences.accommodation}
- Interests: ${this.persona.preferences.interests.join(', ')}
${this.persona.preferences.dietaryRestrictions ? `- Dietary restrictions: ${this.persona.preferences.dietaryRestrictions.join(', ')}` : ''}
${this.persona.preferences.mobilityNeeds ? `- Mobility needs: ${this.persona.preferences.mobilityNeeds.join(', ')}` : ''}

TRIP REQUEST:
- Origin: ${this.persona.tripRequest.origin}
${this.persona.tripRequest.destination ? `- Destination: ${this.persona.tripRequest.destination}` : '- Destination: Open to suggestions'}
- Duration: ${this.persona.tripRequest.duration}
${this.persona.tripRequest.dates ? `- Dates: ${this.persona.tripRequest.dates.start} to ${this.persona.tripRequest.dates.end}` : ''}
${this.persona.tripRequest.specialRequests ? `- Special requests: ${this.persona.tripRequest.specialRequests.join(', ')}` : ''}

COMMUNICATION STYLE: ${this.persona.communicationStyle}${bookingPhrasesSection}

Generate ONLY your response as this traveler would naturally speak. Be conversational and authentic to the persona.
Do NOT include any explanations, meta-commentary, or role labels - just the message content.`;

    if (context.isFirstMessage) {
      const userPrompt = `Generate your initial trip planning request to the Trip Designer. Introduce yourself naturally and describe what you're looking for in this trip. Be specific but conversational.`;

      const response = await this.openai.chat.completions.create({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 300
      });

      return response.choices[0]?.message?.content || 'Hi! I need help planning a trip.';
    }

    // Generate response to assistant's question
    const conversationContext = this.conversationHistory
      .slice(-4)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    const userPrompt = `The Trip Designer just said:
"${context.lastAssistantMessage}"

Generate your natural response as ${this.persona.name}. Answer their questions based on your persona details above. Be helpful but stay in character.

CRITICAL: If the Trip Designer is suggesting or recommending a specific flight, hotel, restaurant, activity, or any bookable item, you MUST respond with an EXPLICIT booking request using phrases like:
- "Book that [thing] for me"
- "Add that to my itinerary"
- "Reserve that [thing]"
- "I want to book that"
- "Please add that to my trip"

Do NOT just say "that sounds good" or "I like that" - you must EXPLICITLY REQUEST the booking.`;

    const response = await this.openai.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Previous conversation:\n${conversationContext}\n\n${userPrompt}` }
      ],
      temperature: 0.8,
      max_tokens: 300
    });

    return response.choices[0]?.message?.content || 'Yes, that sounds good.';
  }

  /**
   * Create itinerary via API
   */
  private async createItinerary(): Promise<string> {
    const url = `${this.apiBaseUrl}/itineraries`;
    const body = {
      title: `${this.persona.name}'s Trip`,
      description: `Test itinerary for ${this.persona.type} persona`,
      draft: false,  // Must be false to persist to storage
      tripType: this.persona.type === 'business' ? 'BUSINESS' : 'LEISURE'
    };

    console.log('\n🔍 DEBUG: Creating itinerary');
    console.log('URL:', url);
    console.log('Headers:', JSON.stringify(this.getHeaders(), null, 2));
    console.log('Body:', JSON.stringify(body, null, 2));

    let response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

    // Retry once on 403 with fresh authentication
    if (response.status === 403) {
      console.log('🔄 Session expired, re-authenticating...');
      await this.authenticate();
      response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      console.log('Response Status after re-auth:', response.status);
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Response Body:', error);
      if (this.verbose) {
        console.error(`❌ Failed to create itinerary: ${response.status}`);
        console.error(`Response: ${error}`);
      }
      throw new Error(`Failed to create itinerary: ${response.status} ${error}`);
    }

    const data = await response.json();
    console.log('✅ Itinerary created:', data.id);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    console.log('');

    return data.id;
  }

  /**
   * Create Trip Designer session via API
   */
  private async createSession(itineraryId: string): Promise<string> {
    const url = `${this.apiBaseUrl}/designer/sessions`;
    const body = {
      itineraryId,
      mode: 'trip-designer'
    };

    console.log('\n🔍 DEBUG: Creating session');
    console.log('URL:', url);
    console.log('Itinerary ID:', itineraryId);
    console.log('Headers:', JSON.stringify(this.getHeaders(true), null, 2));
    console.log('Body:', JSON.stringify(body, null, 2));

    let response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(body)
    });

    console.log('Response Status:', response.status);

    // Retry once on 403 with fresh authentication
    if (response.status === 403) {
      console.log('🔄 Session expired, re-authenticating...');
      await this.authenticate();
      response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(body)
      });
      console.log('Response Status after re-auth:', response.status);
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Response Body:', error);
      if (this.verbose) {
        console.error(`❌ Failed to create session: ${response.status}`);
        console.error(`Response: ${error}`);
      }
      throw new Error(`Failed to create session: ${response.status} ${error}`);
    }

    const data = await response.json();
    console.log('✅ Session created:', data.sessionId);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    console.log('');

    return data.sessionId;
  }

  /**
   * Send message to Trip Designer and get streaming response
   */
  private async sendMessage(message: string): Promise<{
    response: string;
    toolCalls: string[];
    itineraryUpdated: boolean;
  }> {
    if (!this.sessionId) {
      throw new Error('No session ID - must create session first');
    }

    let response = await fetch(
      `${this.apiBaseUrl}/designer/sessions/${this.sessionId}/messages/stream`,
      {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify({ message })
      }
    );

    // Retry once on 403 with fresh authentication
    if (response.status === 403) {
      console.log('🔄 Session expired, re-authenticating...');
      await this.authenticate();
      response = await fetch(
        `${this.apiBaseUrl}/designer/sessions/${this.sessionId}/messages/stream`,
        {
          method: 'POST',
          headers: this.getHeaders(true),
          body: JSON.stringify({ message })
        }
      );
    }

    if (!response.ok) {
      const error = await response.text();
      if (this.verbose) {
        console.error(`❌ Failed to send message: ${response.status}`);
        console.error(`Response: ${error}`);
      }
      throw new Error(`Failed to send message: ${response.status} ${error}`);
    }

    // Parse SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let assistantMessage = '';
    const toolCalls: string[] = [];
    let itineraryUpdated = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;

          if (line.startsWith('event: ')) {
            const event = line.substring(7).trim();
            continue;
          }

          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            try {
              const parsed = JSON.parse(data);

              // Handle different event types
              if (parsed.content) {
                assistantMessage += parsed.content;
              }
              if (parsed.name) {
                toolCalls.push(parsed.name);
              }
              if (parsed.itineraryUpdated) {
                itineraryUpdated = true;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      response: assistantMessage.trim(),
      toolCalls,
      itineraryUpdated
    };
  }

  /**
   * Get itinerary details via API
   */
  private async getItinerary(): Promise<Itinerary> {
    if (!this.itineraryId) {
      throw new Error('No itinerary ID');
    }

    let response = await fetch(`${this.apiBaseUrl}/itineraries/${this.itineraryId}`, {
      headers: this.getHeaders()
    });

    // Retry once on 403 with fresh authentication
    if (response.status === 403) {
      console.log('🔄 Session expired, re-authenticating...');
      await this.authenticate();
      response = await fetch(`${this.apiBaseUrl}/itineraries/${this.itineraryId}`, {
        headers: this.getHeaders()
      });
    }

    if (!response.ok) {
      const error = await response.text();
      if (this.verbose) {
        console.error(`❌ Failed to get itinerary: ${response.status}`);
        console.error(`Response: ${error}`);
      }
      throw new Error(`Failed to get itinerary: ${response.status} ${error}`);
    }

    return await response.json();
  }

  /**
   * Run full conversation until trip is planned
   */
  async runConversation(): Promise<ConversationResult> {
    const errors: string[] = [];
    let itinerary: Itinerary | undefined;

    try {
      // 0. Authenticate first
      await this.authenticate();

      // 1. Create itinerary
      if (this.verbose) console.log(`\n🎭 ${this.persona.name} - Creating itinerary...`);
      this.itineraryId = await this.createItinerary();
      if (this.verbose) console.log(`✅ Itinerary created: ${this.itineraryId}`);

      // 2. Create session
      if (this.verbose) console.log('🎭 Creating Trip Designer session...');
      this.sessionId = await this.createSession(this.itineraryId);
      if (this.verbose) console.log(`✅ Session created: ${this.sessionId}`);

      // 3. Start conversation
      const firstMessage = await this.generateUserMessage({ isFirstMessage: true });
      if (this.verbose) console.log(`\n👤 ${this.persona.name}: ${firstMessage}\n`);

      this.conversationHistory.push({
        role: 'user',
        content: firstMessage,
        timestamp: new Date()
      });

      const { response, toolCalls, itineraryUpdated } = await this.sendMessage(firstMessage);
      if (this.verbose) {
        console.log(`🤖 Trip Designer: ${response}`);
        if (toolCalls.length > 0) {
          console.log(`🔧 Tool calls: ${toolCalls.join(', ')}`);
        }
      }

      this.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        toolCalls
      });

      // 4. Continue conversation
      let turns = 1;
      let lastResponse = response;

      while (turns < this.maxTurns) {
        // Check if conversation is complete
        if (this.isConversationComplete(lastResponse, itinerary)) {
          if (this.verbose) console.log('\n✅ Conversation complete!');
          break;
        }

        // Generate next user message
        const userMessage = await this.generateUserMessage({
          isFirstMessage: false,
          lastAssistantMessage: lastResponse,
          itinerary
        });

        if (this.verbose) console.log(`\n👤 ${this.persona.name}: ${userMessage}\n`);

        this.conversationHistory.push({
          role: 'user',
          content: userMessage,
          timestamp: new Date()
        });

        const result = await this.sendMessage(userMessage);
        if (this.verbose) {
          console.log(`🤖 Trip Designer: ${result.response}`);
          if (result.toolCalls.length > 0) {
            console.log(`🔧 Tool calls: ${result.toolCalls.join(', ')}`);
          }
        }

        this.conversationHistory.push({
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          toolCalls: result.toolCalls
        });

        lastResponse = result.response;
        turns++;

        // Get updated itinerary periodically
        if (result.itineraryUpdated || turns % 3 === 0) {
          itinerary = await this.getItinerary();
        }
      }

      // 5. Get final itinerary
      itinerary = await this.getItinerary();

      // 6. Validate itinerary
      const validation = this.validateItinerary(itinerary);

      const duration = Date.now() - this.startTime;

      return {
        valid: validation.valid,
        turns: this.conversationHistory.filter(m => m.role === 'user').length,
        duration,
        itinerary,
        validation,
        errors,
        transcript: this.conversationHistory
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));

      return {
        valid: false,
        turns: this.conversationHistory.filter(m => m.role === 'user').length,
        duration: Date.now() - this.startTime,
        itinerary,
        validation: {
          valid: false,
          score: 0,
          issues: [{ severity: 'error', category: 'execution', message: errors.join('; ') }],
          metrics: {
            segmentCount: 0,
            segmentTypesCovered: [],
            keywordsFound: [],
            forbiddenFound: []
          }
        },
        errors,
        transcript: this.conversationHistory
      };
    }
  }

  /**
   * Check if conversation is complete
   */
  private isConversationComplete(lastResponse: string, itinerary?: Itinerary): boolean {
    // Simple heuristic: look for completion phrases
    const completionPhrases = [
      'itinerary is complete',
      'trip is ready',
      'all set',
      'booked everything',
      'your trip is planned'
    ];

    const hasCompletionPhrase = completionPhrases.some(phrase =>
      lastResponse.toLowerCase().includes(phrase)
    );

    // Check if we have a reasonable itinerary
    const hasSegments = itinerary && itinerary.segments.length >= this.persona.expectations.minSegments;

    return hasCompletionPhrase && !!hasSegments;
  }

  /**
   * Validate final itinerary against persona expectations
   */
  validateItinerary(itinerary: Itinerary): ValidationResult {
    const issues: ValidationIssue[] = [];
    let score = 100;

    // Check minimum segments
    if (itinerary.segments.length < this.persona.expectations.minSegments) {
      issues.push({
        severity: 'error',
        category: 'segments',
        message: `Too few segments: expected at least ${this.persona.expectations.minSegments}, got ${itinerary.segments.length}`,
        expected: this.persona.expectations.minSegments,
        actual: itinerary.segments.length
      });
      score -= 30;
    }

    // Check expected segment types
    const segmentTypes = new Set(itinerary.segments.map(s => s.type));
    const expectedTypes = this.persona.expectations.expectedSegmentTypes;
    const missingTypes = expectedTypes.filter(t => !segmentTypes.has(t));

    if (missingTypes.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'segment_types',
        message: `Missing expected segment types: ${missingTypes.join(', ')}`,
        expected: expectedTypes,
        actual: Array.from(segmentTypes)
      });
      score -= 10 * missingTypes.length;
    }

    // Check for required keywords
    const itineraryText = JSON.stringify(itinerary).toLowerCase();
    const keywordsFound: string[] = [];
    const keywordsMissing: string[] = [];

    for (const keyword of this.persona.expectations.shouldInclude || []) {
      if (itineraryText.includes(keyword.toLowerCase())) {
        keywordsFound.push(keyword);
      } else {
        keywordsMissing.push(keyword);
      }
    }

    if (keywordsMissing.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'keywords',
        message: `Missing expected keywords: ${keywordsMissing.join(', ')}`,
        expected: this.persona.expectations.shouldInclude,
        actual: keywordsFound
      });
      score -= 5 * keywordsMissing.length;
    }

    // Check for forbidden elements
    const forbiddenFound: string[] = [];
    for (const forbidden of this.persona.expectations.shouldNotInclude || []) {
      if (itineraryText.includes(forbidden.toLowerCase())) {
        forbiddenFound.push(forbidden);
      }
    }

    if (forbiddenFound.length > 0) {
      issues.push({
        severity: 'error',
        category: 'forbidden',
        message: `Found forbidden elements: ${forbiddenFound.join(', ')}`,
        expected: 'none',
        actual: forbiddenFound
      });
      score -= 15 * forbiddenFound.length;
    }

    // Check budget if specified
    let budgetCompliance: boolean | undefined;
    if (this.persona.expectations.budgetRange && itinerary.totalPrice) {
      const total = itinerary.totalPrice.amount;
      const { min, max } = this.persona.expectations.budgetRange;
      budgetCompliance = total >= min && total <= max;

      if (!budgetCompliance) {
        issues.push({
          severity: 'warning',
          category: 'budget',
          message: `Price outside expected range: ${total} not in [${min}, ${max}]`,
          expected: this.persona.expectations.budgetRange,
          actual: total
        });
        score -= 20;
      }
    }

    return {
      valid: score >= 60 && issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(0, score),
      issues,
      metrics: {
        segmentCount: itinerary.segments.length,
        segmentTypesCovered: Array.from(segmentTypes),
        keywordsFound,
        forbiddenFound,
        budgetCompliance
      }
    };
  }
}

// ===== TEST RUNNER =====

async function runPersonaTests(options: TestOptions = {}): Promise<void> {
  const results: PersonaTestResult[] = [];

  console.log('🧪 Starting Traveler Persona E2E Tests\n');
  console.log(`Model: ${options.model || 'anthropic/claude-sonnet-4'}`);
  console.log(`API: ${options.apiBaseUrl || 'http://localhost:5176/api/v1'}`);
  console.log(`Max turns: ${options.maxTurns || 15}\n`);

  for (const persona of PERSONAS) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧑 Testing persona: ${persona.name} (${persona.type})`);
    console.log(`${'='.repeat(80)}`);

    const agent = new TravelerPersonaAgent(persona, {
      model: options.model,
      apiBaseUrl: options.apiBaseUrl,
      maxTurns: options.maxTurns,
      verbose: options.verbose ?? true
    });

    try {
      const result = await agent.runConversation();

      results.push({
        persona: persona.id,
        success: result.valid,
        conversationTurns: result.turns,
        itinerary: result.itinerary,
        validation: result.validation,
        errors: result.errors,
        duration: result.duration,
        cost: result.estimatedCost
      });

      console.log(`\n📊 Test Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Score: ${result.validation.score}/100`);
      console.log(`Turns: ${result.turns}`);
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);

      if (result.validation.issues.length > 0) {
        console.log('\n⚠️  Issues:');
        for (const issue of result.validation.issues) {
          console.log(`  [${issue.severity}] ${issue.category}: ${issue.message}`);
        }
      }

    } catch (error) {
      console.error(`\n❌ Test failed with error: ${error}`);
      results.push({
        persona: persona.id,
        success: false,
        conversationTurns: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        validation: {
          valid: false,
          score: 0,
          issues: [],
          metrics: {
            segmentCount: 0,
            segmentTypesCovered: [],
            keywordsFound: [],
            forbiddenFound: []
          }
        },
        duration: 0
      });
    }
  }

  // Generate summary report
  await generateReport(results, options);
}

async function generateReport(results: PersonaTestResult[], options: TestOptions): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = join(__dirname, 'results');

  // Ensure results directory exists
  await mkdir(resultsDir, { recursive: true });

  // Save JSON results
  const jsonPath = join(resultsDir, `persona-test-${timestamp}.json`);
  await writeFile(jsonPath, JSON.stringify(results, null, 2));

  // Generate markdown report
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  let markdown = `# Traveler Persona E2E Test Results

**Date**: ${new Date().toISOString()}
**Model**: ${options.model || 'anthropic/claude-sonnet-4'}
**API**: ${options.apiBaseUrl || 'http://localhost:5176/api/v1'}

## Summary

- **Total Tests**: ${total}
- **Passed**: ${passed}
- **Failed**: ${total - passed}
- **Pass Rate**: ${passRate}%

## Results by Persona

| Persona | Type | Result | Score | Turns | Duration | Issues |
|---------|------|--------|-------|-------|----------|--------|
`;

  for (const result of results) {
    const persona = PERSONAS.find(p => p.id === result.persona);
    markdown += `| ${persona?.name || result.persona} | ${persona?.type || 'unknown'} | ${result.success ? '✅ PASS' : '❌ FAIL'} | ${result.validation.score}/100 | ${result.conversationTurns} | ${(result.duration / 1000).toFixed(1)}s | ${result.validation.issues.length} |\n`;
  }

  markdown += '\n## Detailed Results\n\n';

  for (const result of results) {
    const persona = PERSONAS.find(p => p.id === result.persona);
    markdown += `### ${persona?.name || result.persona}\n\n`;
    markdown += `**Status**: ${result.success ? '✅ PASS' : '❌ FAIL'}\n`;
    markdown += `**Score**: ${result.validation.score}/100\n`;
    markdown += `**Conversation Turns**: ${result.conversationTurns}\n`;
    markdown += `**Duration**: ${(result.duration / 1000).toFixed(2)}s\n\n`;

    if (result.validation.metrics) {
      markdown += '**Metrics**:\n';
      markdown += `- Segments: ${result.validation.metrics.segmentCount}\n`;
      markdown += `- Segment Types: ${result.validation.metrics.segmentTypesCovered.join(', ')}\n`;
      markdown += `- Keywords Found: ${result.validation.metrics.keywordsFound.join(', ') || 'none'}\n`;
      markdown += `- Forbidden Found: ${result.validation.metrics.forbiddenFound.join(', ') || 'none'}\n\n`;
    }

    if (result.validation.issues.length > 0) {
      markdown += '**Issues**:\n\n';
      for (const issue of result.validation.issues) {
        markdown += `- **[${issue.severity}]** ${issue.category}: ${issue.message}\n`;
      }
      markdown += '\n';
    }

    if (result.errors.length > 0) {
      markdown += '**Errors**:\n\n';
      for (const error of result.errors) {
        markdown += `- ${error}\n`;
      }
      markdown += '\n';
    }

    markdown += '---\n\n';
  }

  const mdPath = join(resultsDir, `persona-test-${timestamp}.md`);
  await writeFile(mdPath, markdown);

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 FINAL RESULTS');
  console.log(`${'='.repeat(80)}`);
  console.log(`\n✅ Passed: ${passed}/${total} (${passRate}%)`);
  console.log(`\n📄 Results saved to:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   MD:   ${mdPath}\n`);
}

// ===== CLI INTERFACE =====

async function main() {
  const args = process.argv.slice(2);

  // Parse CLI arguments
  const options: TestOptions = {
    verbose: true,
    saveResults: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--model' && args[i + 1]) {
      options.model = args[++i];
    } else if (arg === '--api' && args[i + 1]) {
      options.apiBaseUrl = args[++i];
    } else if (arg === '--max-turns' && args[i + 1]) {
      options.maxTurns = parseInt(args[++i], 10);
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--quiet') {
      options.verbose = false;
    } else if (arg === '--persona' && args[i + 1]) {
      const personaId = args[++i];
      const persona = PERSONAS.find(p => p.id === personaId);
      if (persona) {
        // Run single persona
        console.log(`🧪 Testing single persona: ${persona.name}\n`);
        const agent = new TravelerPersonaAgent(persona, options);
        const result = await agent.runConversation();

        console.log(`\n📊 Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Score: ${result.validation.score}/100`);
        console.log(`Turns: ${result.turns}`);
        console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);

        return;
      } else {
        console.error(`Error: Persona '${personaId}' not found`);
        console.log('Available personas:', PERSONAS.map(p => p.id).join(', '));
        process.exit(1);
      }
    } else if (arg === '--type' && args[i + 1]) {
      const type = args[++i];
      const personas = PERSONAS.filter(p => p.type === type);
      if (personas.length > 0) {
        console.log(`🧪 Testing personas of type: ${type}\n`);
        // Run personas of this type
        for (const persona of personas) {
          console.log(`\n${'='.repeat(80)}`);
          console.log(`🧑 Testing: ${persona.name}`);
          console.log(`${'='.repeat(80)}`);

          const agent = new TravelerPersonaAgent(persona, options);
          await agent.runConversation();
        }
        return;
      } else {
        console.error(`Error: No personas found for type '${type}'`);
        const types = [...new Set(PERSONAS.map(p => p.type))];
        console.log('Available types:', types.join(', '));
        process.exit(1);
      }
    } else if (arg === '--help') {
      console.log(`
Traveler Persona Agent - E2E Testing for Trip Designer

Usage:
  npx tsx tests/e2e/traveler-persona-agent.ts [options]

Options:
  --persona <id>       Test a specific persona by ID
  --type <type>        Test all personas of a specific type
  --model <model>      OpenRouter model to use (default: anthropic/claude-sonnet-4)
  --api <url>          API base URL (default: http://localhost:5176/api/v1)
  --max-turns <n>      Maximum conversation turns (default: 15)
  --verbose            Enable verbose debug output (default: true)
  --quiet              Disable verbose output
  --help               Show this help message

Available Personas:
${PERSONAS.map(p => `  ${p.id.padEnd(20)} - ${p.name} (${p.type})`).join('\n')}

Available Types:
  ${[...new Set(PERSONAS.map(p => p.type))].join(', ')}

Examples:
  npx tsx tests/e2e/traveler-persona-agent.ts
  npx tsx tests/e2e/traveler-persona-agent.ts --persona romantic-couple
  npx tsx tests/e2e/traveler-persona-agent.ts --type family
  npx tsx tests/e2e/traveler-persona-agent.ts --model gpt-4o
      `);
      return;
    }
  }

  // Run all personas
  await runPersonaTests(options);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { TravelerPersonaAgent, PERSONAS };
export type { TravelerPersona, ConversationResult, ValidationResult, TestOptions };
