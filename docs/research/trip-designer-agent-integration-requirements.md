# Trip Designer Agent - Technical Integration Requirements Research

**Research Date:** 2025-12-18
**Project:** Itinerizer Trip Planning System
**Status:** Technical Requirements Discovery

## Executive Summary

This research document covers the technical requirements for building an intelligent Trip Designer agent that can help users plan and optimize travel itineraries through conversational interaction. The system will integrate:

1. **OpenRouter Web Search** for real-time travel information lookup
2. **SERP APIs** for flight, hotel, and transportation pricing
3. **High-reasoning LLMs** for intelligent planning and tool orchestration
4. **Session compression** strategies for maintaining long conversations
5. **Real-time document updates** with conflict resolution

---

## 1. OpenRouter Web Search Integration

### Overview

OpenRouter now supports web search capabilities for all 300+ models through their unified API. This enables LLMs to access real-time information about destinations, events, weather, and travel conditions.

### How It Works

Web search is enabled by appending `:online` to any model name:

```typescript
// Example: Enable web search for Claude Sonnet
const model = "anthropic/claude-sonnet-4.5:online";
```

### API Integration Pattern

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/itinerator',
    'X-Title': 'Itinerizer Trip Designer',
  },
});

// Method 1: Using :online suffix
const response = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4.5:online',
  messages: [
    {
      role: 'user',
      content: 'What are the best restaurants in Rome for authentic pasta?'
    }
  ],
});

// Method 2: Using plugins parameter for more control
const responseWithPlugins = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4.5',
  messages: [
    {
      role: 'user',
      content: 'Find current hotel prices in Tokyo for December 2025'
    }
  ],
  plugins: [
    {
      id: 'web',
      max_results: 5,  // Default: 5, max: 10
      search_prompt: 'Relevant travel information:'
    }
  ]
});
```

### Search Engines

OpenRouter uses **Exa.ai** for web search with two modes:
- **Auto mode** (default): Combines keyword search and embeddings-based semantic search
- **Native mode**: Uses provider's built-in search (e.g., Perplexity models have native search)

```typescript
// Specify search engine
plugins: [
  {
    id: 'web',
    engine: 'exa',  // or 'native'
    max_results: 5
  }
]
```

### Cost Considerations

**Exa Search Pricing:**
- $4.00 per 1,000 search results
- Default `max_results: 5` = **$0.02 per request**
- Maximum `max_results: 10` = **$0.04 per request**

**Total Cost Per Trip Planning Request:**
- Base LLM cost (varies by model, see section 3)
- Web search cost: $0.02-$0.04
- Prompt tokens from search results (typically 500-2000 tokens)

**Example Trip Planning Session Costs:**
```
Initial planning (2 searches):     $0.04
Destination research (3 searches): $0.06
Activity lookup (2 searches):      $0.04
Total web search cost:             $0.14
Plus LLM tokens (varies by model)
```

### Response Format

Search results are automatically integrated into the LLM's context. The model receives:

```json
{
  "search_results": [
    {
      "title": "Top 10 Restaurants in Rome",
      "url": "https://example.com/rome-restaurants",
      "snippet": "Best authentic pasta spots...",
      "published_date": "2025-11-15"
    }
  ]
}
```

The LLM then synthesizes this information into its response naturally.

### Supported Models

**All 300+ OpenRouter models support web search**, including:
- Anthropic Claude 3.5 Sonnet, Sonnet 4, Sonnet 4.5
- OpenAI GPT-4o, GPT-4-turbo
- Google Gemini 2.0 Flash (with native search)
- DeepSeek R1 (reasoning with web search)
- Meta Llama models
- Perplexity models (native search built-in)

### Recommended Use Cases for Trip Designer

1. **Real-time Travel Information:**
   - "What's the weather in Bali next month?"
   - "Are there any festivals in Barcelona in March?"

2. **Current Pricing and Availability:**
   - "What are hotel prices in Paris for next weekend?"
   - "Find flight prices from NYC to London"

3. **Destination Research:**
   - "What are the top attractions in Kyoto?"
   - "Best local restaurants in Lisbon"

4. **Event and Activity Discovery:**
   - "Find concerts and shows in London this summer"
   - "Outdoor activities near Banff in July"

### Implementation in Existing LLMService

Your current `LLMService` already uses OpenRouter. To add web search:

```typescript
// In src/services/llm.service.ts
export interface LLMConfig {
  apiKey: string;
  defaultModel: string;
  enableWebSearch?: boolean;
  maxSearchResults?: number;
}

export class LLMService {
  private config: LLMConfig;

  async chat(messages: Message[], options?: {
    enableSearch?: boolean;
    maxSearchResults?: number;
  }): Promise<ChatResponse> {
    const useSearch = options?.enableSearch ?? this.config.enableWebSearch;
    const model = useSearch
      ? `${this.config.defaultModel}:online`
      : this.config.defaultModel;

    const requestBody: any = {
      model,
      messages,
      stream: true,
    };

    // Alternative: Use plugins for more control
    if (useSearch && options?.maxSearchResults) {
      requestBody.model = this.config.defaultModel; // Without :online
      requestBody.plugins = [
        {
          id: 'web',
          max_results: options.maxSearchResults,
        }
      ];
    }

    return this.client.chat.completions.create(requestBody);
  }
}
```

**Sources:**
- [OpenRouter Web Search Documentation](https://openrouter.ai/docs/guides/features/web-search)
- [Turn Any LLM into a Web Search Model in OpenRouter](https://aiengineerguide.com/blog/openrouter-web-search/)
- [OpenRouter Review 2025](https://skywork.ai/blog/openrouter-review-2025/)

---

## 2. SERP API for Travel Pricing

### Overview

Your project already uses **SerpAPI** for flight and hotel search (see `TravelAgentService`). This section covers additional SERP APIs and alternatives for comprehensive travel pricing.

### Current SerpAPI Integration

**Existing Implementation:**
- Google Flights API (via SerpAPI)
- Google Hotels API (via SerpAPI)
- Base URL: `https://serpapi.com/search`

**Current Features:**
```typescript
// From src/services/travel-agent.service.ts
searchFlight(gap: LocationGap, preferences: TravelPreferences)
searchHotel(location, checkIn, checkOut, preferences)
searchTransfer(gap, preferences)
```

### SerpAPI Coverage

**1. Google Flights API**

```typescript
const flightParams = new URLSearchParams({
  engine: 'google_flights',
  departure_id: 'JFK',      // IATA code
  arrival_id: 'LHR',         // IATA code
  outbound_date: '2025-12-25',
  return_date: '2026-01-05', // Optional for round-trip
  type: '1',                 // 1=one-way, 2=round-trip
  currency: 'USD',
  hl: 'en',
  adults: '2',
  children: '1',
  travel_class: '1',         // 1=Economy, 2=Premium Economy, 3=Business, 4=First
  api_key: process.env.SERPAPI_KEY,
});

const response = await fetch(`https://serpapi.com/search?${flightParams}`);
const data = await response.json();

// Response structure
interface SerpFlightResponse {
  best_flights: Array<{
    flights: Array<{
      departure_airport: { id: string; name: string };
      arrival_airport: { id: string; name: string };
      airline: string;
      airline_logo: string;
      flight_number: string;
      departure_time: string;  // ISO 8601
      arrival_time: string;
      duration: number;        // Minutes
      airplane: string;
      travel_class: string;
      layovers?: Array<{
        duration: number;
        name: string;
        id: string;
      }>;
    }>;
    price: number;
    type: string;            // "Nonstop", "1 stop", etc.
    carbon_emissions: {
      this_flight: number;
      typical_for_route: number;
      difference_percent: number;
    };
  }>;
  other_flights: Array<{...}>;  // Similar structure
  price_insights: {
    lowest_price: number;
    price_level: string;      // "low", "typical", "high"
    typical_price_range: [number, number];
  };
}
```

**Advanced Features:**
- Multi-city flights: Use `multi_city` engine
- Flight tracking: Use `google_flights_booking_options` for specific flights
- Price alerts: Track price changes over time
- Carbon footprint data included

**2. Google Hotels API**

```typescript
const hotelParams = new URLSearchParams({
  engine: 'google_hotels',
  q: 'Hotels in Paris',
  check_in_date: '2025-12-20',
  check_out_date: '2025-12-25',
  adults: '2',
  children: '1',
  currency: 'USD',
  gl: 'us',
  hl: 'en',
  hotel_class: '4,5',        // Filter by star rating
  amenities: 'free_wifi,pool',
  api_key: process.env.SERPAPI_KEY,
});

// Response structure
interface SerpHotelResponse {
  properties: Array<{
    name: string;
    description: string;
    link: string;
    gps_coordinates: { latitude: number; longitude: number };
    check_in_time: string;
    check_out_time: string;
    rate_per_night: {
      lowest: string;          // "$250"
      extracted_lowest: number; // 250
      before_taxes_fees: string;
      extracted_before_taxes_fees: number;
    };
    total_rate: {
      lowest: string;
      extracted_lowest: number;
    };
    deal: string;              // "23% less than usual"
    deal_description: string;
    overall_rating: number;
    reviews: number;
    hotel_class: string;       // "4-star hotel"
    amenities: string[];
    nearby_places: Array<{
      name: string;
      transportations: Array<{
        type: string;          // "Walking", "Driving"
        duration: string;      // "5 min"
      }>;
    }>;
    images: Array<{
      thumbnail: string;
      original_image: string;
    }>;
    extracted_hotel_class: number;  // 4
  }>;
  brand_information: {
    name: string;
    property_count: number;
  };
}
```

**3. Google Maps Local Search (for transfers/activities)**

```typescript
const localParams = new URLSearchParams({
  engine: 'google_maps',
  q: 'taxi service near JFK Airport',
  ll: '@40.6413111,-73.7781391,15z',  // Coordinates
  type: 'search',
  api_key: process.env.SERPAPI_KEY,
});

// Response includes local businesses, services, hours, pricing
```

### SerpAPI Pricing

**Plans (as of 2025):**
- **Free Plan:** 100 searches/month
- **Developer:** $50/month - 5,000 searches ($0.01/search)
- **Production:** $250/month - 30,000 searches ($0.0083/search)
- **Enterprise:** Custom pricing

**Cost Per Trip Planning Session:**
```
Flight search: 1-2 requests    = $0.01-$0.02
Hotel search: 1-2 requests     = $0.01-$0.02
Local search: 0-1 requests     = $0.00-$0.01
Total per session:             = $0.02-$0.05
```

For 1000 trips/month: ~$30-50 in SerpAPI costs

### Alternative APIs

**1. Amadeus Self-Service API**

Best for comprehensive flight data with NDC (New Distribution Capability) support.

```typescript
// Amadeus Flight Offers Search
const amadeusConfig = {
  clientId: process.env.AMADEUS_API_KEY,
  clientSecret: process.env.AMADEUS_API_SECRET,
  hostname: 'production' // or 'test'
};

const amadeus = new Amadeus(amadeusConfig);

const flightOffers = await amadeus.shopping.flightOffersSearch.get({
  originLocationCode: 'JFK',
  destinationLocationCode: 'LHR',
  departureDate: '2025-12-20',
  adults: '2',
  children: '1',
  travelClass: 'ECONOMY',
  currencyCode: 'USD',
  max: 50,
});

// Response includes:
// - Multiple fare families
// - Baggage allowances
// - Seat availability
// - Ancillary services pricing
// - Booking class codes
```

**Amadeus Coverage:**
- Flights: 400+ airlines
- Hotels: 150,000+ properties
- Car rentals: Major providers
- Activities: 300,000+ tours and activities

**Pricing:**
- **Free Tier:** Limited test environment access
- **Pay-as-you-go:** Varies by endpoint ($0.005-$0.05 per request)
- Generally more expensive than SerpAPI but more booking-ready data

**2. Kiwi Tequila API**

Best for multi-modal routes (flights + trains + buses) and "virtual interlining."

```typescript
const kiwiParams = new URLSearchParams({
  fly_from: 'JFK',
  fly_to: 'LHR',
  date_from: '20/12/2025',
  date_to: '25/12/2025',
  adults: 2,
  children: 1,
  curr: 'USD',
  locale: 'en',
  limit: 20,
});

const kiwiResponse = await fetch(
  `https://api.tequila.kiwi.com/v2/search?${kiwiParams}`,
  {
    headers: {
      'apikey': process.env.KIWI_API_KEY,
    }
  }
);

// Supports virtual interlining: booking separate tickets as single itinerary
// Includes trains, buses, ferries alongside flights
```

**Pricing:**
- **Free Tier:** 100 requests/month
- **Startup:** $50/month - 1,000 requests
- **Business:** Custom pricing

**3. Skyscanner API**

Best for price comparison and free tier access.

```typescript
// Skyscanner Live Pricing API
const skyscannerLive = {
  market: 'US',
  currency: 'USD',
  locale: 'en-US',
  originPlace: 'JFK',
  destinationPlace: 'LHR',
  outboundDate: '2025-12-20',
  inboundDate: '2025-12-27',
  adults: 2,
  children: 1,
  cabinClass: 'Economy',
};

// Note: Skyscanner API requires partnership approval
// Free for approved partners
// Offers Browse API (cached prices) and Live API (real-time)
```

**Pricing:**
- **Free** for approved partners
- Best for startups and MVPs
- Approval process can take 2-4 weeks

**4. Rome2Rio API (Ground Transportation)**

Best for multi-modal route planning (trains, buses, ferries, taxis).

```typescript
const rome2rioParams = new URLSearchParams({
  key: process.env.ROME2RIO_API_KEY,
  oName: 'Charles de Gaulle Airport',
  dName: 'Eiffel Tower, Paris',
  languageCode: 'en',
});

const route = await fetch(
  `https://free.rome2rio.com/api/1.5/json/Search?${rome2rioParams}`
);

// Response includes:
// - Multiple route options (train, bus, taxi, rideshare)
// - Estimated times
// - Price ranges
// - Transfer points
// - Schedules (where available)
```

**Pricing:**
- **Free Tier:** 1,000 requests/month
- **Paid Plans:** $10/month for 10,000 requests ($0.001/request)
- Much cheaper than flight APIs

**5. Hotelbeds API (Hotels)**

Best for global hotel inventory with competitive pricing.

```typescript
// Hotelbeds APItude
const hotelbeds = {
  stay: {
    checkIn: '2025-12-20',
    checkOut: '2025-12-25',
  },
  occupancies: [
    { rooms: 1, adults: 2, children: 1, childrenAges: [10] }
  ],
  geolocation: {
    latitude: 48.8566,
    longitude: 2.3522,
    radius: 5,
    unit: 'km',
  },
};

// Includes:
// - Real-time availability
// - Dynamic pricing
// - Cancellation policies
// - Photos and amenities
// - Direct booking integration
```

**Pricing:**
- Pay-per-booking model (no search fees)
- Commission: 10-25% depending on volume
- Best for apps that actually book (not just search)

### Recommended API Stack for Itinerizer

**Option A: Cost-Optimized (MVP)**
```
Flights: SerpAPI Google Flights ($0.01/search)
Hotels: SerpAPI Google Hotels ($0.01/search)
Ground Transport: Rome2Rio API ($0.001/search)
Total: ~$0.02-$0.03 per trip
```

**Option B: Booking-Ready**
```
Flights: Amadeus API ($0.005-$0.05/search)
Hotels: Hotelbeds API (pay-per-booking)
Ground Transport: Rome2Rio API ($0.001/search)
Total: ~$0.05-$0.10 per search, commission on bookings
```

**Option C: Free Tier (Testing)**
```
Flights: Skyscanner API (free for approved partners)
Hotels: SerpAPI Google Hotels (100 free/month)
Ground Transport: Rome2Rio API (1,000 free/month)
Total: Free for low volume
```

### Implementation Recommendations

**Enhance TravelAgentService:**

```typescript
// src/services/travel-agent.service.ts
export class TravelAgentService {
  // Add multi-modal transport search
  async searchGroundTransport(
    origin: Location,
    destination: Location,
    date: Date
  ): Promise<TransportOptions> {
    // Use Rome2Rio for comprehensive ground transport options
    const rome2rioParams = new URLSearchParams({
      key: this.config.rome2rioApiKey,
      oName: `${origin.name}, ${origin.city}`,
      dName: `${destination.name}, ${destination.city}`,
      languageCode: 'en',
    });

    const response = await fetch(
      `https://free.rome2rio.com/api/1.5/json/Search?${rome2rioParams}`
    );
    const data = await response.json();

    // Parse routes: train, bus, taxi, rideshare
    return this.parseRome2RioResponse(data);
  }

  // Add car rental search
  async searchCarRental(
    location: Location,
    pickupDate: Date,
    returnDate: Date
  ): Promise<CarRentalOptions> {
    // Use SerpAPI Google Search or dedicated car rental API
    const params = new URLSearchParams({
      engine: 'google',
      q: `car rental ${location.city}`,
      api_key: this.config.serpApiKey,
    });

    // Parse rental companies, prices, vehicle types
  }

  // Aggregate pricing across multiple APIs
  async aggregatePricing(
    searchCriteria: SearchCriteria
  ): Promise<AggregatedResults> {
    // Query multiple APIs in parallel
    const [serpResults, amadeusResults, kiwiResults] = await Promise.all([
      this.searchWithSerpAPI(searchCriteria),
      this.searchWithAmadeus(searchCriteria),
      this.searchWithKiwi(searchCriteria),
    ]);

    // Merge, deduplicate, and rank results
    return this.rankResults([...serpResults, ...amadeusResults, ...kiwiResults]);
  }
}
```

**Sources:**
- [SerpAPI Travel Information](https://serpapi.com/use-cases/travel-information)
- [Best Travel APIs 2025](https://www.gurutechnolabs.com/best-travel-apis-for-travel-business/)
- [Skyscanner Flight API Integration Guide](https://www.oneclickitsolution.com/blog/skyscanner-flight-api)
- [Top 14 Travel APIs](https://www.flightapi.io/blog/travel-apis/)

---

## 3. High-Thinking LLM Options for Tool Calling

### Model Comparison Matrix

| Model | Context Window | Input Cost (per 1M tokens) | Output Cost (per 1M tokens) | Tool Calling | Streaming | Speed (tokens/s) | Best Use Case |
|-------|----------------|----------------------------|----------------------------|--------------|-----------|------------------|---------------|
| **Claude Sonnet 4.5** | 200K | $3.00 | $15.00 | ✅ Advanced | ✅ | 80 | Agentic workflows, complex tool orchestration |
| **Claude Sonnet 4** | 200K | $3.00 | $15.00 | ✅ Advanced | ✅ | 80 | Coding tasks, reasoning |
| **Claude Opus 4.5** | 200K | $15.00 | $75.00 | ✅ Advanced | ✅ | 60 | Most complex reasoning, highest accuracy |
| **GPT-4o** | 128K | $2.50 | $10.00 | ✅ | ✅ | 100 | Fast responses, math, multimodal |
| **GPT-4-turbo** | 128K | $10.00 | $30.00 | ✅ | ✅ | 80 | Legacy, being phased out |
| **DeepSeek R1** | 64K | $0.55 | $2.19 | ✅ | ✅ | 34 | Budget reasoning, open-source |
| **DeepSeek V3.2** | 64K | $0.27 | $1.10 | ✅ Advanced | ✅ | 40 | Agentic tool use, efficiency |
| **Gemini 2.0 Flash** | 1M | $0.10 | $0.40 | ✅ | ✅ Native Search | 120 | Massive context, speed, web search |
| **OpenAI O1** | 200K | $15.00 | $60.00 | ⚠️ Limited | ❌ | 15 | Complex reasoning, math proofs |

### Detailed Model Analysis

**1. Claude Sonnet 4.5** (Recommended for Trip Designer)

**Strengths:**
- **Agentic Capabilities:** Best-in-class tool orchestration with speculative parallel execution
- **Context Management:** 200K context window = ~150K words or 300 pages
- **Tool Calling:** Advanced parallel tool calls, automatic retry on failure
- **Accuracy:** 92% on HumanEval coding benchmark
- **Cost-Effective:** $3/$15 per million tokens (cheaper input than Opus)

**Tool Calling Features:**
```typescript
// Claude Sonnet 4.5 supports:
// 1. Parallel tool execution
const response = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4.5',
  messages: [...],
  tools: [
    { type: 'function', function: { name: 'search_flights', ... }},
    { type: 'function', function: { name: 'search_hotels', ... }},
    { type: 'function', function: { name: 'check_weather', ... }},
  ],
  tool_choice: 'auto',
  parallel_tool_calls: true,  // Call multiple tools simultaneously
});

// 2. Speculative execution (retry failed tools)
// 3. Context caching (reduce costs for repeated prompts)
```

**Trip Planning Use Case:**
- Simultaneously search flights, hotels, and activities
- Maintain multi-turn conversation about trip details
- Reason about trade-offs (cost vs. convenience, time vs. attractions)
- Handle complex multi-city itineraries

**Cost Example (Trip Planning Session):**
```
Initial planning: 5K tokens in, 3K tokens out
  Input: $0.015, Output: $0.045, Total: $0.06

Refinement (2 turns): 8K tokens in, 5K tokens out
  Input: $0.024, Output: $0.075, Total: $0.10

Flight search (3 calls): 4K tokens in, 2K tokens out
  Input: $0.012, Output: $0.030, Total: $0.04

Hotel search (2 calls): 3K tokens in, 2K tokens out
  Input: $0.009, Output: $0.030, Total: $0.04

Total session cost: ~$0.24
```

**2. GPT-4o**

**Strengths:**
- **Speed:** 24% faster than Claude Sonnet (7.5s vs 9.3s avg latency)
- **TTFT:** 2x faster time-to-first-token (0.56s vs 1.23s)
- **Math:** Better at mathematical reasoning (76.6% vs 71.1% on MATH benchmark)
- **Streaming:** Excellent streaming support (100 tokens/s)
- **Output Tokens:** 16,384 max output vs Claude's 8,192

**Weaknesses:**
- Smaller context (128K vs 200K)
- Less sophisticated tool orchestration
- Slightly more expensive for creative tasks

**Best For:**
- Real-time streaming responses in UI
- Mathematical calculations (cost optimization, budget allocation)
- Fast conversational interactions
- When low latency matters

**Cost Example:**
```
Same trip planning session:
Input: 20K tokens × $2.50/1M = $0.05
Output: 12K tokens × $10.00/1M = $0.12
Total: $0.17 (30% cheaper than Claude)
```

**3. DeepSeek R1** (Budget Option)

**Strengths:**
- **Ultra Low Cost:** $0.55 input, $2.19 output (27x cheaper than O1)
- **Open Source:** MIT licensed, can self-host
- **Reasoning Tokens:** Visible reasoning process
- **Performance:** Comparable to O1 on reasoning tasks
- **Tool Use:** V3.2 optimized for agentic workflows

**Weaknesses:**
- Smaller context (64K tokens)
- Slower speed (34 tokens/s)
- Less polished than Claude/GPT
- OpenRouter markup (use DeepSeek API directly for best pricing)

**Best For:**
- High-volume, cost-sensitive applications
- Complex reasoning without premium pricing
- Self-hosted deployments (compliance requirements)

**Cost Example:**
```
Same trip planning session:
Input: 20K tokens × $0.55/1M = $0.011
Output: 12K tokens × $2.19/1M = $0.026
Total: $0.037 (15% of Claude's cost)
```

**4. Gemini 2.0 Flash Thinking** (Experimental)

**Strengths:**
- **Massive Context:** 1 million tokens (5x larger than Claude)
- **Native Web Search:** Built-in search without plugins
- **Speed:** 120 tokens/s
- **Ultra Low Cost:** $0.10 input, $0.40 output

**Weaknesses:**
- Still in experimental phase
- Tool calling less mature than Claude
- Google ecosystem lock-in

**Best For:**
- Entire trip documents in context (all confirmations, emails, PDFs)
- Web search without OpenRouter plugins
- Extreme budget constraints

### Tool Calling Comparison

**Claude Sonnet 4.5 Tool Calling:**

```typescript
// Define tools with rich schemas
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_flights',
      description: 'Search for flights between two cities',
      parameters: {
        type: 'object',
        properties: {
          origin: { type: 'string', description: 'Origin airport code (IATA)' },
          destination: { type: 'string', description: 'Destination airport code (IATA)' },
          date: { type: 'string', format: 'date' },
          passengers: {
            type: 'object',
            properties: {
              adults: { type: 'number' },
              children: { type: 'number' },
              infants: { type: 'number' },
            }
          },
          cabin_class: { type: 'string', enum: ['economy', 'premium', 'business', 'first'] },
        },
        required: ['origin', 'destination', 'date'],
      }
    }
  }
];

const response = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4.5',
  messages: [
    {
      role: 'user',
      content: 'Plan a trip from NYC to London for 2 adults and 1 child, departing Dec 20'
    }
  ],
  tools,
  tool_choice: 'auto',
  parallel_tool_calls: true,
});

// Claude's response might call multiple tools:
// 1. search_flights(origin='JFK', destination='LHR', date='2025-12-20', passengers={adults:2, children:1})
// 2. check_weather(city='London', date='2025-12-20')
// 3. search_hotels(city='London', check_in='2025-12-20', guests=3)
```

**GPT-4o Tool Calling:**

```typescript
// Similar schema, but different execution strategy
// GPT-4o tends to call tools sequentially by default
// Use function_call: 'auto' for more control

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  functions: tools,  // Legacy format, use 'tools' for new API
  function_call: 'auto',
});

// GPT-4o is better at:
// - Mathematical calculations in tool parameters
// - Handling ambiguous tool inputs
// - Faster tool call parsing
```

**DeepSeek V3.2 Tool Calling:**

```typescript
// DeepSeek uses standard OpenAI format
// V3.2 specifically optimized for agentic tool use

const response = await client.chat.completions.create({
  model: 'deepseek/deepseek-v3.2',
  messages: [...],
  tools,
  tool_choice: 'auto',
});

// DeepSeek V3.2 features:
// - Large-scale agentic task synthesis
// - Better compliance in tool usage
// - Improved generalization across tools
```

### Streaming Support

All recommended models support streaming via Server-Sent Events (SSE):

```typescript
const stream = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4.5',
  messages: [...],
  tools,
  stream: true,
});

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;

  // Stream text
  if (delta?.content) {
    process.stdout.write(delta.content);
  }

  // Stream tool calls
  if (delta?.tool_calls) {
    for (const toolCall of delta.tool_calls) {
      console.log('Tool:', toolCall.function.name);
      console.log('Args:', toolCall.function.arguments);
    }
  }
}
```

**Fine-Grained Tool Streaming (Anthropic Only):**

```typescript
// Anthropic models support streaming individual tool call arguments
const stream = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4.5',
  messages: [...],
  tools,
  stream: true,
  extra_headers: {
    'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14'
  }
});

// Receive tool arguments incrementally as they're generated
// Useful for showing progress: "Searching flights... NYC to London... 2 passengers..."
```

### Recommendation for Itinerizer Trip Designer

**Primary Model: Claude Sonnet 4.5**

**Reasons:**
1. **Best Tool Orchestration:** Parallel tool calls = faster trip planning
2. **Large Context:** 200K tokens = entire trip history in memory
3. **Reasoning:** Best for trade-off analysis (cost vs. time vs. experience)
4. **Streaming:** Smooth UI with real-time updates
5. **Cost:** Competitive at $3/$15 per million tokens

**Secondary Model: GPT-4o**

**When to use:**
- User prioritizes speed (premium tier)
- Mathematical budget optimization
- Faster time-to-first-token for conversational feel

**Budget Model: DeepSeek R1/V3.2**

**When to use:**
- Free tier users
- High-volume batch operations
- Cost is primary constraint
- Self-hosted deployment

**Hybrid Strategy:**

```typescript
export class TripDesignerService {
  async planTrip(request: TripRequest, tier: 'free' | 'pro' | 'premium') {
    const model = this.selectModel(tier);

    // Use DeepSeek for initial research (cheap)
    const research = await this.research(request, 'deepseek/deepseek-r1');

    // Use Claude Sonnet for final planning (quality)
    const plan = await this.plan(research, 'anthropic/claude-sonnet-4.5');

    // Use GPT-4o for real-time chat (speed)
    if (tier === 'premium') {
      const chat = await this.chat(plan, 'openai/gpt-4o');
    }
  }

  private selectModel(tier: string): string {
    switch (tier) {
      case 'free':
        return 'deepseek/deepseek-r1:free';
      case 'pro':
        return 'anthropic/claude-sonnet-4.5';
      case 'premium':
        return 'openai/gpt-4o';
    }
  }
}
```

**Sources:**
- [Claude 3.5 Sonnet vs GPT-4o Comparison](https://galileo.ai/blog/claude-3-5-sonnet-vs-gpt-4o-enterprise-ai-model-comparison)
- [DeepSeek R1 Cost and Pricing](https://prompt.16x.engineer/blog/deepseek-r1-cost-pricing-speed)
- [OpenRouter Models](https://openrouter.ai/models)
- [Claude Sonnet 4.5 on OpenRouter](https://openrouter.ai/anthropic/claude-sonnet-4.5)

---

## 4. Session Compaction Strategies

### The Context Window Challenge

**Problem:**
- Trip planning involves long conversations (20-50+ turns)
- Each turn adds 500-2000 tokens
- 50-turn conversation = 50K-100K tokens
- Claude Sonnet 4.5: 200K limit
- GPT-4o: 128K limit
- **Solution:** Compress context without losing critical information

### Compression Techniques

**1. Contextual Summarization (Recommended)**

Periodically summarize old messages while keeping recent messages intact.

```typescript
export interface ConversationState {
  summary: string;           // Compressed history
  recentMessages: Message[]; // Last 10-20 messages verbatim
  facts: KeyFact[];          // Extracted structured data
  preferences: UserPreferences;
}

export class SessionManager {
  private readonly RECENT_MESSAGE_THRESHOLD = 15;
  private readonly SUMMARIZATION_TRIGGER = 25;

  async compressIfNeeded(
    messages: Message[],
    state: ConversationState
  ): Promise<ConversationState> {
    if (messages.length < this.SUMMARIZATION_TRIGGER) {
      return state;
    }

    // Separate old and recent messages
    const oldMessages = messages.slice(0, -this.RECENT_MESSAGE_THRESHOLD);
    const recentMessages = messages.slice(-this.RECENT_MESSAGE_THRESHOLD);

    // Summarize old messages
    const newSummary = await this.summarize(oldMessages, state.summary);

    // Extract facts from old messages
    const newFacts = await this.extractFacts(oldMessages);

    return {
      summary: newSummary,
      recentMessages,
      facts: [...state.facts, ...newFacts],
      preferences: state.preferences,
    };
  }

  private async summarize(
    messages: Message[],
    previousSummary: string
  ): Promise<string> {
    const prompt = `Previous summary: ${previousSummary}

New messages:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Create a concise summary that:
1. Updates the previous summary with new information
2. Preserves trip requirements (dates, locations, budget, preferences)
3. Tracks decisions made (confirmed flights, rejected hotels)
4. Maintains user preferences and constraints
5. Keeps timeline of events

Maximum 300 words.`;

    const response = await this.llm.chat([
      { role: 'system', content: 'You are a trip planning assistant summarizing conversation history.' },
      { role: 'user', content: prompt }
    ]);

    return response.content;
  }

  private async extractFacts(messages: Message[]): Promise<KeyFact[]> {
    const prompt = `Extract structured facts from this conversation:

${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Return JSON array of facts:
[
  {
    "type": "destination",
    "value": "Paris, France",
    "confidence": 1.0,
    "source": "user explicitly stated"
  },
  {
    "type": "budget",
    "value": "$5000 total",
    "confidence": 0.9,
    "source": "user mentioned 5k budget"
  },
  {
    "type": "constraint",
    "value": "No early morning flights",
    "confidence": 1.0,
    "source": "user preference"
  }
]`;

    const response = await this.llm.chat([
      { role: 'system', content: 'You extract structured facts from conversations.' },
      { role: 'user', content: prompt }
    ], { response_format: { type: 'json_object' } });

    return JSON.parse(response.content).facts;
  }

  // Build compressed context for next LLM call
  buildContext(state: ConversationState): Message[] {
    return [
      {
        role: 'system',
        content: `Trip Planning Context:

CONVERSATION SUMMARY:
${state.summary}

KEY FACTS:
${state.facts.map(f => `- ${f.type}: ${f.value}`).join('\n')}

USER PREFERENCES:
${JSON.stringify(state.preferences, null, 2)}

Continue the conversation using this context.`
      },
      ...state.recentMessages
    ];
  }
}
```

**Benefits:**
- Keeps recent context verbatim (maintains conversation flow)
- Compresses old messages (saves tokens)
- Extracts structured data (queryable facts)
- Balances token usage and accuracy

**2. Memory Formation (Semantic Extraction)**

Instead of compressing everything, identify what's worth remembering.

```typescript
interface TripMemory {
  // Episodic: Specific events in conversation
  episodes: Array<{
    turn: number;
    summary: string;
    importance: number;  // 0-1 score
    type: 'decision' | 'preference' | 'constraint' | 'info';
  }>;

  // Semantic: General knowledge extracted
  semantic: {
    destinations: Destination[];
    budget: BudgetConstraints;
    travelers: TravelerInfo[];
    dates: DateRange;
    preferences: {
      flightClass: string;
      hotelStars: number;
      activities: string[];
      dietary: string[];
      accessibility: string[];
    };
  };

  // Procedural: How user interacts
  procedural: {
    decisionStyle: 'detailed' | 'quick' | 'exploratory';
    priceThreshold: number;
    typicalSessionLength: number;
  };
}

export class MemoryManager {
  async formMemory(
    messages: Message[],
    currentMemory: TripMemory
  ): Promise<TripMemory> {
    // Identify important turns
    const importantTurns = await this.scoreImportance(messages);

    // Extract semantic information
    const semantic = await this.extractSemantic(messages);

    // Update procedural patterns
    const procedural = this.updateProcedural(messages, currentMemory.procedural);

    return {
      episodes: [
        ...currentMemory.episodes,
        ...importantTurns.map(turn => ({
          turn: turn.index,
          summary: turn.summary,
          importance: turn.score,
          type: turn.type,
        }))
      ].slice(-50), // Keep last 50 episodes
      semantic: this.mergeSemantic(currentMemory.semantic, semantic),
      procedural,
    };
  }

  private async scoreImportance(messages: Message[]): Promise<ImportantTurn[]> {
    // Use lightweight model to score each turn's importance
    const prompt = `Score each conversation turn for importance (0-1):

Importance criteria:
- 1.0: Decision made (booked flight, confirmed hotel)
- 0.8: Strong preference stated (must have, won't accept)
- 0.6: Constraint added (budget limit, time constraint)
- 0.4: Information provided (dates, destinations)
- 0.2: General discussion
- 0.0: Small talk, acknowledgments

Conversation:
${messages.map((m, i) => `${i}. ${m.role}: ${m.content}`).join('\n')}

Return JSON: [{"turn": 0, "score": 0.8, "type": "preference", "summary": "..."}, ...]`;

    const response = await this.llm.chat([
      { role: 'system', content: 'You are an expert at identifying important information.' },
      { role: 'user', content: prompt }
    ], {
      model: 'deepseek/deepseek-r1',  // Use cheap model for scoring
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.content).turns;
  }
}
```

**Benefits:**
- Only remembers what matters
- Structured data is queryable
- Learns user patterns over time
- Efficient token usage

**3. Vector-Based Memory (Semantic Search)**

Store past conversations as embeddings for retrieval.

```typescript
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

export class VectorMemoryManager {
  private vectorStore: MemoryVectorStore;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',  // $0.02 per 1M tokens
    });

    this.vectorStore = new MemoryVectorStore(this.embeddings);
  }

  async addConversationTurn(turn: Message, metadata: Record<string, any>) {
    // Store each turn as a vector
    await this.vectorStore.addDocuments([
      {
        pageContent: `${turn.role}: ${turn.content}`,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          role: turn.role,
        }
      }
    ]);
  }

  async retrieveRelevantContext(
    query: string,
    k: number = 5
  ): Promise<Message[]> {
    // Search for semantically similar past conversations
    const results = await this.vectorStore.similaritySearch(query, k);

    return results.map(doc => ({
      role: doc.metadata.role,
      content: doc.pageContent,
    }));
  }

  async buildContextWithRetrieval(
    currentMessage: string,
    systemPrompt: string
  ): Promise<Message[]> {
    // Retrieve relevant past context
    const relevantContext = await this.retrieveRelevantContext(currentMessage);

    return [
      {
        role: 'system',
        content: `${systemPrompt}

RELEVANT PAST CONTEXT:
${relevantContext.map(m => m.content).join('\n---\n')}`
      },
      {
        role: 'user',
        content: currentMessage
      }
    ];
  }
}
```

**Benefits:**
- Find relevant past conversations semantically
- Works well for FAQ-style questions
- No need to keep entire history in context
- Scales to very long sessions

**Costs:**
- Embedding: $0.02 per 1M tokens (text-embedding-3-small)
- 50-turn conversation: ~50K tokens to embed = $0.001
- Storage: In-memory or vector DB (Pinecone, Weaviate, etc.)

**4. Multi-Level Memory Hierarchy**

Combine all approaches for best results.

```typescript
export interface HierarchicalMemory {
  // Working memory: Current session (last 10 messages verbatim)
  working: Message[];

  // Short-term memory: Recent session compressed (last 50 turns summarized)
  shortTerm: {
    summary: string;
    keyDecisions: Decision[];
    extractedFacts: Fact[];
  };

  // Long-term memory: Semantic knowledge (across sessions)
  longTerm: {
    userProfile: UserProfile;
    pastTrips: TripSummary[];
    preferences: LearnedPreferences;
    patterns: BehavioralPatterns;
  };

  // Episodic memory: Important moments (high-importance turns)
  episodic: Array<{
    sessionId: string;
    timestamp: Date;
    turn: number;
    content: string;
    importance: number;
    type: 'decision' | 'milestone' | 'preference';
  }>;

  // Vector memory: Semantic search (all past conversations as embeddings)
  vectorStore: VectorStoreRetriever;
}

export class HierarchicalMemoryManager {
  async buildOptimalContext(
    currentMessage: string,
    memory: HierarchicalMemory,
    maxTokens: number = 100000
  ): Promise<Message[]> {
    let tokens = 0;
    const context: Message[] = [];

    // 1. Always include working memory (highest priority)
    context.push(...memory.working);
    tokens += this.countTokens(memory.working);

    // 2. Add short-term summary
    if (tokens < maxTokens * 0.5) {
      context.unshift({
        role: 'system',
        content: `RECENT SESSION SUMMARY:\n${memory.shortTerm.summary}`
      });
      tokens += this.countTokens(memory.shortTerm.summary);
    }

    // 3. Add relevant episodic memories
    const relevantEpisodes = memory.episodic
      .filter(e => this.isRelevant(e, currentMessage))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);

    if (tokens < maxTokens * 0.7) {
      context.unshift({
        role: 'system',
        content: `KEY PAST MOMENTS:\n${relevantEpisodes.map(e => e.content).join('\n')}`
      });
      tokens += this.countTokens(relevantEpisodes);
    }

    // 4. Add vector search results
    if (tokens < maxTokens * 0.8) {
      const vectorResults = await memory.vectorStore.retrieve(currentMessage, 3);
      context.unshift({
        role: 'system',
        content: `RELEVANT PAST CONTEXT:\n${vectorResults.map(r => r.content).join('\n')}`
      });
      tokens += this.countTokens(vectorResults);
    }

    // 5. Add long-term user profile
    context.unshift({
      role: 'system',
      content: `USER PROFILE:\n${JSON.stringify(memory.longTerm.userProfile, null, 2)}`
    });

    return context;
  }
}
```

**Benefits:**
- Optimal token usage across memory levels
- Most relevant information always included
- Scales to arbitrarily long sessions
- Balances recency, relevance, and importance

### KV Cache Compression (Advanced)

For self-hosted models, use KV cache compression like **KVzip**.

**KVzip Performance:**
- 3-4x memory reduction
- 2x faster response times
- No accuracy loss
- Works with Llama 3.1, Qwen 2.5, Gemma 3
- Supports up to 170K token contexts

**Not applicable to OpenRouter**, but useful if you move to self-hosted deployment.

### Prompt Compression with LLMLingua

Compress prompts before sending to LLM.

```bash
pip install llmlingua
```

```typescript
import { LLMLingua } from 'llmlingua';

const compressor = new LLMLingua({
  model: 'microsoft/llmlingua-2-small',
});

const longPrompt = `[Your 10,000 token prompt here...]`;

const compressed = await compressor.compress(longPrompt, {
  compressionRatio: 0.5,  // Compress to 50% of original
  keepFirstSentence: true,
  keepLastSentence: true,
});

// Use compressed prompt
const response = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4.5',
  messages: [
    { role: 'user', content: compressed.compressedPrompt }
  ]
});
```

**LongLLMLingua for RAG:**
- 21.4% improvement at 4x compression
- 2.1x end-to-end latency acceleration
- Best for retrieval-augmented generation

**Costs:**
- Compression adds 100-200ms latency
- But saves 50% on token costs
- Net benefit: Faster and cheaper

### Recommendation for Itinerizer

**Tier 1: Contextual Summarization + Memory Formation**

```typescript
export class TripDesignerSessionManager {
  private memory: HierarchicalMemory;

  async processUserMessage(message: string): Promise<string> {
    // 1. Add to working memory
    this.memory.working.push({ role: 'user', content: message });

    // 2. Check if compression needed
    if (this.memory.working.length > 15) {
      await this.compressShortTerm();
    }

    // 3. Build optimal context
    const context = await this.buildOptimalContext(message);

    // 4. Call LLM with compressed context
    const response = await this.llm.chat(context, {
      model: 'anthropic/claude-sonnet-4.5',
      tools: this.tools,
    });

    // 5. Add response to working memory
    this.memory.working.push({ role: 'assistant', content: response.content });

    // 6. Extract and store facts
    await this.extractFacts(message, response.content);

    return response.content;
  }

  private async compressShortTerm() {
    // Move oldest 10 messages to short-term summary
    const toCompress = this.memory.working.slice(0, -15);

    const summary = await this.summarize(toCompress);
    const facts = await this.extractFacts(toCompress);

    this.memory.shortTerm = {
      summary: this.memory.shortTerm.summary + '\n\n' + summary,
      keyDecisions: [...this.memory.shortTerm.keyDecisions, ...facts.decisions],
      extractedFacts: [...this.memory.shortTerm.extractedFacts, ...facts.general],
    };

    // Keep only last 15 messages in working memory
    this.memory.working = this.memory.working.slice(-15);
  }
}
```

**Tier 2: Add Vector Search (Optional)**

For users with multiple sessions or complex trip planning:

```typescript
// When user references past conversations:
// "Remember that trip to Paris we planned last month?"

const relevantPastContext = await this.vectorMemory.retrieve(
  "Paris trip plan last month",
  k: 3
);

// Include in context
context.unshift({
  role: 'system',
  content: `PAST TRIP REFERENCE:\n${relevantPastContext}`
});
```

**Token Budget Management:**

```typescript
export class TokenBudgetManager {
  private readonly MODEL_LIMITS = {
    'anthropic/claude-sonnet-4.5': 200000,
    'openai/gpt-4o': 128000,
    'deepseek/deepseek-r1': 64000,
  };

  calculateTokenBudget(model: string): {
    maxInput: number;
    reserveForOutput: number;
    availableForContext: number;
  } {
    const limit = this.MODEL_LIMITS[model];

    return {
      maxInput: limit * 0.8,           // 80% for input
      reserveForOutput: limit * 0.2,   // 20% for output
      availableForContext: limit * 0.6, // 60% for conversation context
    };
  }

  async fitContextToBudget(
    context: Message[],
    budget: number
  ): Promise<Message[]> {
    let currentTokens = this.countTokens(context);

    if (currentTokens <= budget) {
      return context;
    }

    // Strategy: Remove oldest messages first (except system prompt)
    const system = context.filter(m => m.role === 'system');
    const conversation = context.filter(m => m.role !== 'system');

    while (currentTokens > budget && conversation.length > 5) {
      conversation.shift(); // Remove oldest
      currentTokens = this.countTokens([...system, ...conversation]);
    }

    return [...system, ...conversation];
  }
}
```

**Sources:**
- [LLM Chat History Summarization Guide](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025)
- [Recursively Summarizing Enables Long-Term Dialogue Memory](https://www.sciencedirect.com/science/article/abs/pii/S0925231225008653)
- [ACON: Optimizing Context Compression for Long-horizon LLM Agents](https://arxiv.org/html/2510.00615v1)
- [LLMLingua: Prompt Compression](https://www.microsoft.com/en-us/research/blog/llmlingua-innovating-llm-efficiency-with-prompt-compression/)

---

## 5. Real-time Document Updates

### The Challenge

Trip planning involves continuously updating a JSON document (itinerary) while:
- Agent makes changes (adds flights, hotels, activities)
- User might edit simultaneously (changes dates, preferences)
- UI needs real-time updates (streaming progress)

**Conflict scenarios:**
1. Agent adds flight while user changes departure date
2. Agent optimizes route while user adds new destination
3. Multiple agent tool calls modify same itinerary section

### Patterns for Real-time Updates

**1. Operational Transformation (OT)**

Used by Google Docs for collaborative editing.

```typescript
interface Operation {
  type: 'insert' | 'delete' | 'update' | 'move';
  path: string[];              // JSON path: ['segments', 0, 'startDatetime']
  value?: any;
  oldValue?: any;
  timestamp: number;
  source: 'agent' | 'user';
  clientId: string;
}

export class OperationalTransformManager {
  private operations: Operation[] = [];
  private serverState: Itinerary;

  // Transform operations when they conflict
  transform(op1: Operation, op2: Operation): Operation {
    // If both operations target same path
    if (this.samePath(op1.path, op2.path)) {
      // Last-write-wins strategy
      if (op1.timestamp > op2.timestamp) {
        return op1;
      } else {
        // Transform op1 based on op2
        return this.adjustOperation(op1, op2);
      }
    }

    // If op2 affects op1's path (e.g., array index shift)
    if (this.affectsPath(op2, op1.path)) {
      return this.adjustPath(op1, op2);
    }

    return op1;
  }

  private adjustPath(op: Operation, baseOp: Operation): Operation {
    // Example: If baseOp inserts at segments[2],
    // and op targets segments[3], shift to segments[4]
    if (baseOp.type === 'insert') {
      const [collection, indexStr] = baseOp.path;
      const index = parseInt(indexStr);

      if (op.path[0] === collection) {
        const opIndex = parseInt(op.path[1]);
        if (opIndex >= index) {
          return {
            ...op,
            path: [collection, String(opIndex + 1), ...op.path.slice(2)],
          };
        }
      }
    }

    return op;
  }

  async applyOperations(ops: Operation[]): Promise<Itinerary> {
    let state = { ...this.serverState };

    // Sort by timestamp
    const sortedOps = ops.sort((a, b) => a.timestamp - b.timestamp);

    // Transform and apply each operation
    for (let i = 0; i < sortedOps.length; i++) {
      let op = sortedOps[i];

      // Transform against all previous operations
      for (let j = 0; j < i; j++) {
        op = this.transform(op, sortedOps[j]);
      }

      // Apply operation
      state = this.applyOperation(state, op);
    }

    this.serverState = state;
    return state;
  }

  private applyOperation(state: Itinerary, op: Operation): Itinerary {
    const newState = { ...state };

    switch (op.type) {
      case 'insert':
        this.insertAt(newState, op.path, op.value);
        break;
      case 'delete':
        this.deleteAt(newState, op.path);
        break;
      case 'update':
        this.updateAt(newState, op.path, op.value);
        break;
      case 'move':
        this.moveAt(newState, op.path, op.value);
        break;
    }

    return newState;
  }
}
```

**Usage:**

```typescript
// Agent adds flight
const agentOp: Operation = {
  type: 'insert',
  path: ['segments', String(itinerary.segments.length)],
  value: newFlight,
  timestamp: Date.now(),
  source: 'agent',
  clientId: 'agent-1',
};

// User updates dates (simultaneously)
const userOp: Operation = {
  type: 'update',
  path: ['startDate'],
  value: '2025-12-25',
  oldValue: '2025-12-20',
  timestamp: Date.now() + 10, // 10ms later
  source: 'user',
  clientId: 'user-browser',
};

// Server transforms and applies both
const finalState = await otManager.applyOperations([agentOp, userOp]);
```

**2. Conflict-Free Replicated Data Types (CRDTs)**

Better for peer-to-peer scenarios (user edits while offline).

```typescript
import * as Y from 'yjs';

export class CRDTItineraryManager {
  private doc: Y.Doc;
  private itinerary: Y.Map<any>;
  private segments: Y.Array<any>;

  constructor() {
    this.doc = new Y.Doc();
    this.itinerary = this.doc.getMap('itinerary');
    this.segments = this.doc.getArray('segments');

    // Listen to changes
    this.segments.observe(event => {
      console.log('Segments changed:', event.changes);
      this.onSegmentsChanged(event);
    });
  }

  // Add segment (agent or user)
  addSegment(segment: Segment) {
    this.segments.push([segment]);
  }

  // Update segment
  updateSegment(index: number, updates: Partial<Segment>) {
    const segment = this.segments.get(index);
    const updated = { ...segment, ...updates };
    this.segments.delete(index, 1);
    this.segments.insert(index, [updated]);
  }

  // Move segment
  moveSegment(fromIndex: number, toIndex: number) {
    const segment = this.segments.get(fromIndex);
    this.segments.delete(fromIndex, 1);
    this.segments.insert(toIndex, [segment]);
  }

  // Sync with remote
  async syncWithServer(serverState: Uint8Array) {
    Y.applyUpdate(this.doc, serverState);
  }

  // Get current state
  toJSON(): Itinerary {
    return {
      id: this.itinerary.get('id'),
      title: this.itinerary.get('title'),
      segments: this.segments.toArray(),
      // ... other fields
    };
  }

  // Export state for sync
  getUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }
}
```

**Usage:**

```typescript
// Client-side
const clientCRDT = new CRDTItineraryManager();
clientCRDT.addSegment(newFlight);

// Agent-side
const agentCRDT = new CRDTItineraryManager();
agentCRDT.addSegment(newHotel);

// Merge states (no conflicts!)
const clientUpdate = clientCRDT.getUpdate();
const agentUpdate = agentCRDT.getUpdate();

agentCRDT.syncWithServer(clientUpdate);
clientCRDT.syncWithServer(agentUpdate);

// Both converge to same state
assert.deepEqual(clientCRDT.toJSON(), agentCRDT.toJSON());
```

**3. Last-Write-Wins (LWW) with Conflict Detection**

Simplest approach: timestamp-based resolution with user notification.

```typescript
interface TimestampedItinerary extends Itinerary {
  version: number;
  lastModified: number;
  lastModifiedBy: 'agent' | 'user';
}

export class LWWItineraryManager {
  private current: TimestampedItinerary;

  async updateItinerary(
    updates: Partial<Itinerary>,
    source: 'agent' | 'user',
    expectedVersion: number
  ): Promise<{
    success: boolean;
    conflict?: boolean;
    resolution?: 'accepted' | 'rejected' | 'merged';
    itinerary: TimestampedItinerary;
  }> {
    // Check for version conflict
    if (expectedVersion !== this.current.version) {
      // Conflict detected!
      return this.resolveConflict(updates, source, expectedVersion);
    }

    // No conflict, apply updates
    this.current = {
      ...this.current,
      ...updates,
      version: this.current.version + 1,
      lastModified: Date.now(),
      lastModifiedBy: source,
    };

    return {
      success: true,
      itinerary: this.current,
    };
  }

  private async resolveConflict(
    updates: Partial<Itinerary>,
    source: 'agent' | 'user',
    expectedVersion: number
  ): Promise<any> {
    // Get conflicting fields
    const conflicts = this.detectConflicts(updates, this.current);

    if (conflicts.length === 0) {
      // No actual conflicts (different fields updated)
      return this.mergeUpdates(updates, this.current);
    }

    // User changes always win over agent
    if (source === 'user') {
      this.current = {
        ...this.current,
        ...updates,
        version: this.current.version + 1,
        lastModified: Date.now(),
        lastModifiedBy: 'user',
      };

      return {
        success: true,
        conflict: true,
        resolution: 'user_override',
        itinerary: this.current,
      };
    }

    // Agent loses to user
    return {
      success: false,
      conflict: true,
      resolution: 'rejected',
      reason: 'User modified itinerary while agent was working',
      itinerary: this.current,
    };
  }

  private detectConflicts(
    updates: Partial<Itinerary>,
    current: Itinerary
  ): string[] {
    const conflicts: string[] = [];

    for (const key in updates) {
      if (updates[key] !== current[key]) {
        conflicts.push(key);
      }
    }

    return conflicts;
  }
}
```

**4. Streaming Partial Updates**

Stream itinerary changes to UI in real-time.

```typescript
import { EventEmitter } from 'events';

export interface ItineraryUpdate {
  type: 'segment_added' | 'segment_updated' | 'segment_removed' | 'metadata_updated';
  path: string[];
  value?: any;
  oldValue?: any;
  timestamp: number;
  source: 'agent' | 'user';
}

export class StreamingItineraryManager extends EventEmitter {
  private itinerary: Itinerary;

  // Stream updates via Server-Sent Events (SSE)
  async streamAgentUpdates(
    request: TripRequest,
    responseStream: WritableStream
  ): Promise<void> {
    const encoder = new TextEncoder();

    // Listen to itinerary changes
    this.on('update', (update: ItineraryUpdate) => {
      const data = JSON.stringify(update);
      responseStream.write(encoder.encode(`data: ${data}\n\n`));
    });

    // Run agent with streaming tool calls
    const stream = await this.llm.chat([
      { role: 'system', content: 'Plan a trip...' },
      { role: 'user', content: request.userMessage },
    ], {
      model: 'anthropic/claude-sonnet-4.5',
      tools: this.tools,
      stream: true,
    });

    for await (const chunk of stream) {
      const toolCall = chunk.choices[0]?.delta?.tool_calls?.[0];

      if (toolCall) {
        // Agent calling tool (e.g., add_flight)
        if (toolCall.function.name === 'add_flight') {
          const args = JSON.parse(toolCall.function.arguments);
          const segment = this.createFlightSegment(args);

          // Update itinerary
          this.itinerary.segments.push(segment);

          // Emit update event
          this.emit('update', {
            type: 'segment_added',
            path: ['segments', String(this.itinerary.segments.length - 1)],
            value: segment,
            timestamp: Date.now(),
            source: 'agent',
          });
        }
      }
    }

    // Send final state
    responseStream.write(encoder.encode('data: [DONE]\n\n'));
    responseStream.close();
  }

  // Handle user edits during streaming
  async handleUserEdit(
    update: Partial<Itinerary>,
    source: 'user'
  ): Promise<void> {
    // Apply user changes immediately
    Object.assign(this.itinerary, update);

    // Broadcast to all listeners
    this.emit('update', {
      type: 'metadata_updated',
      path: Object.keys(update),
      value: update,
      timestamp: Date.now(),
      source: 'user',
    });

    // If agent is currently streaming, it should:
    // 1. Finish current tool call
    // 2. Re-plan with updated itinerary
    this.emit('user_override', update);
  }
}
```

**Client-side (React):**

```tsx
import { useEffect, useState } from 'react';

export function ItineraryViewer({ sessionId }: { sessionId: string }) {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [updates, setUpdates] = useState<ItineraryUpdate[]>([]);

  useEffect(() => {
    // Connect to SSE stream
    const eventSource = new EventSource(`/api/itinerary/${sessionId}/stream`);

    eventSource.addEventListener('update', (event) => {
      const update: ItineraryUpdate = JSON.parse(event.data);

      // Apply update to local state
      setItinerary(prev => applyUpdate(prev, update));

      // Show update in UI
      setUpdates(prev => [...prev, update]);
    });

    eventSource.addEventListener('error', (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    });

    return () => eventSource.close();
  }, [sessionId]);

  const handleUserEdit = async (field: string, value: any) => {
    // Optimistically update UI
    setItinerary(prev => ({ ...prev, [field]: value }));

    // Send to server
    await fetch(`/api/itinerary/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  };

  return (
    <div>
      <ItineraryEditor
        itinerary={itinerary}
        onEdit={handleUserEdit}
      />

      <UpdateFeed updates={updates} />
    </div>
  );
}

function applyUpdate(itinerary: Itinerary | null, update: ItineraryUpdate): Itinerary {
  if (!itinerary) return null;

  const newItinerary = { ...itinerary };

  switch (update.type) {
    case 'segment_added':
      newItinerary.segments = [...newItinerary.segments, update.value];
      break;
    case 'segment_updated':
      const index = parseInt(update.path[1]);
      newItinerary.segments[index] = { ...newItinerary.segments[index], ...update.value };
      break;
    case 'segment_removed':
      const removeIndex = parseInt(update.path[1]);
      newItinerary.segments = newItinerary.segments.filter((_, i) => i !== removeIndex);
      break;
    case 'metadata_updated':
      Object.assign(newItinerary, update.value);
      break;
  }

  return newItinerary;
}
```

**5. Redis for Real-time Sync**

Use Redis Pub/Sub for multi-client synchronization.

```typescript
import Redis from 'ioredis';

export class RedisItinerarySync {
  private redis: Redis;
  private pubsub: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.pubsub = new Redis(process.env.REDIS_URL);
  }

  async publishUpdate(
    sessionId: string,
    update: ItineraryUpdate
  ): Promise<void> {
    await this.redis.publish(
      `itinerary:${sessionId}`,
      JSON.stringify(update)
    );
  }

  async subscribeToUpdates(
    sessionId: string,
    callback: (update: ItineraryUpdate) => void
  ): Promise<void> {
    await this.pubsub.subscribe(`itinerary:${sessionId}`);

    this.pubsub.on('message', (channel, message) => {
      if (channel === `itinerary:${sessionId}`) {
        const update: ItineraryUpdate = JSON.parse(message);
        callback(update);
      }
    });
  }

  async saveItinerary(
    sessionId: string,
    itinerary: Itinerary
  ): Promise<void> {
    await this.redis.set(
      `itinerary:${sessionId}:current`,
      JSON.stringify(itinerary),
      'EX',
      3600 // Expire after 1 hour
    );
  }

  async getItinerary(sessionId: string): Promise<Itinerary | null> {
    const data = await this.redis.get(`itinerary:${sessionId}:current`);
    return data ? JSON.parse(data) : null;
  }
}
```

### Recommended Approach for Itinerizer

**Simple but Effective:**

1. **Optimistic UI Updates** (client applies changes immediately)
2. **Server-Sent Events** (agent streams updates to client)
3. **Last-Write-Wins with User Priority** (user edits override agent)
4. **Version Tracking** (detect conflicts)
5. **Conflict Notifications** (inform user when agent's work was overridden)

**Implementation:**

```typescript
// src/server/itinerary-sync.service.ts
export class ItinerarySyncService {
  private sessions = new Map<string, {
    itinerary: TimestampedItinerary;
    clients: Set<WritableStream>;
    agentActive: boolean;
  }>();

  async streamAgentPlan(
    sessionId: string,
    request: TripRequest
  ): Promise<ReadableStream> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.agentActive = true;

    return new ReadableStream({
      async start(controller) {
        const stream = await agent.planTrip(request, {
          model: 'anthropic/claude-sonnet-4.5',
          tools: [...],
          stream: true,
          onUpdate: (update: ItineraryUpdate) => {
            // Check if user made changes
            if (session.itinerary.lastModifiedBy === 'user' &&
                session.itinerary.lastModified > update.timestamp) {
              // User override - skip this update
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'conflict', message: 'User edit detected' })}\n\n`
              ));
              return;
            }

            // Apply agent update
            applyUpdate(session.itinerary, update);

            // Broadcast to all clients
            const data = JSON.stringify(update);
            for (const client of session.clients) {
              client.write(encoder.encode(`data: ${data}\n\n`));
            }
          }
        });

        session.agentActive = false;
        controller.close();
      }
    });
  }

  async handleUserEdit(
    sessionId: string,
    updates: Partial<Itinerary>,
    version: number
  ): Promise<{ success: boolean; conflict?: boolean }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Check version
    if (version !== session.itinerary.version) {
      return { success: false, conflict: true };
    }

    // Apply user changes
    session.itinerary = {
      ...session.itinerary,
      ...updates,
      version: session.itinerary.version + 1,
      lastModified: Date.now(),
      lastModifiedBy: 'user',
    };

    // Notify agent if active
    if (session.agentActive) {
      // Agent should re-plan with updated state
      this.notifyAgentOfUserEdit(sessionId, updates);
    }

    // Broadcast to clients
    const update: ItineraryUpdate = {
      type: 'metadata_updated',
      path: Object.keys(updates),
      value: updates,
      timestamp: Date.now(),
      source: 'user',
    };

    const data = JSON.stringify(update);
    for (const client of session.clients) {
      client.write(encoder.encode(`data: ${data}\n\n`));
    }

    return { success: true };
  }
}
```

**API Endpoints:**

```typescript
// GET /api/itinerary/:sessionId/stream
app.get('/api/itinerary/:sessionId/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sessionId = req.params.sessionId;
  const stream = syncService.createClientStream(sessionId, res);

  req.on('close', () => {
    syncService.removeClient(sessionId, stream);
  });
});

// PATCH /api/itinerary/:sessionId
app.patch('/api/itinerary/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { updates, version } = req.body;

  const result = await syncService.handleUserEdit(sessionId, updates, version);

  res.json(result);
});
```

**Sources:**
- [Real-Time Collaborative Editing Using CRDTs](http://www.diva-portal.org/smash/get/diva2:1304659/FULLTEXT01.pdf)
- [Yjs - Near-Realtime Collaborative Editing](http://results.learning-layers.eu/infrastructure/client-frameworks/yjs/)
- [How to Design a Real-Time Collaborative Document Editor](https://www.designgurus.io/blog/design-real-time-editor)
- [Seamless Real-Time Document Collaboration in Angular](https://www.syncfusion.com/blogs/post/angular-redis-word-document-collaboration)

---

## Implementation Roadmap

### Phase 1: Core Agent (Weeks 1-2)

1. **Enhance LLMService for Web Search**
   - Add `:online` suffix support
   - Implement plugins parameter
   - Cost tracking for web searches

2. **Create TripDesignerService**
   - Conversational planning interface
   - Tool definitions (search_flights, search_hotels, add_segment, etc.)
   - Streaming support

3. **Session Management**
   - Contextual summarization
   - Memory formation
   - Token budget management

### Phase 2: Real-time Updates (Week 3)

1. **Streaming API**
   - SSE endpoint for itinerary updates
   - WebSocket alternative (optional)
   - Redis integration for multi-instance

2. **Conflict Resolution**
   - Last-write-wins implementation
   - User priority enforcement
   - Version tracking

3. **Client UI**
   - Real-time itinerary viewer
   - Optimistic updates
   - Conflict notifications

### Phase 3: Advanced Features (Week 4)

1. **Multi-Modal Transport**
   - Rome2Rio integration
   - Ground transport search
   - Car rental pricing

2. **Cost Optimization**
   - Model selection by tier
   - Prompt compression
   - Context caching

3. **Long-term Memory**
   - Vector-based retrieval (optional)
   - User profile learning
   - Cross-session continuity

---

## Cost Analysis

### Per-Trip Planning Session

**Scenario:** User plans 7-day Europe trip with 3 flights, 4 hotels, 10 activities.

| Component | Cost | Notes |
|-----------|------|-------|
| **LLM Tokens (Claude Sonnet 4.5)** | $0.20-0.40 | 30K input, 20K output tokens |
| **Web Search (5 searches)** | $0.10 | 5 × $0.02 |
| **SerpAPI (7 queries)** | $0.07 | 3 flights + 4 hotels |
| **Embeddings (optional)** | $0.002 | 100K tokens embedded |
| **Total per session** | $0.37-0.57 | Mid-tier estimate |

**At scale (1000 trips/month):**
- LLM: $250-400
- Web Search: $100
- SerpAPI: $70
- **Total: $420-570/month**

**With budget tier (DeepSeek R1):**
- LLM: $40-60 (85% savings)
- Web Search: $100
- SerpAPI: $70
- **Total: $210-230/month** (50% savings)

---

## Conclusion

This research provides a comprehensive technical foundation for building an intelligent Trip Designer agent with:

1. **OpenRouter Web Search:** Enable real-time information lookup for destinations, events, weather, and travel conditions at $0.02-0.04 per search.

2. **SERP APIs:** Leverage SerpAPI ($0.01/search), Amadeus, Kiwi, or Skyscanner for flight/hotel pricing. Rome2Rio for ground transport ($0.001/search).

3. **High-Thinking LLMs:** Claude Sonnet 4.5 recommended for best tool orchestration ($3/$15 per 1M tokens). GPT-4o for speed. DeepSeek R1 for budget ($0.55/$2.19 per 1M tokens).

4. **Session Compression:** Use contextual summarization + memory formation. Keep last 15 messages verbatim, compress older messages, extract structured facts. Enables unlimited conversation length within token budgets.

5. **Real-time Updates:** Implement SSE streaming with last-write-wins conflict resolution. User edits always override agent. Optimistic UI updates with server reconciliation.

**Recommended Stack:**
- Primary LLM: Claude Sonnet 4.5 via OpenRouter
- Web Search: OpenRouter `:online` suffix
- Pricing APIs: SerpAPI + Rome2Rio
- Session Management: Contextual summarization + fact extraction
- Real-time Sync: Server-Sent Events + version tracking

**Total Cost:** $0.37-0.57 per trip planning session (mid-tier), $0.15-0.25 with budget tier.

---

**Next Steps:**

1. Set up OpenRouter API key with web search enabled
2. Implement `TripDesignerService` with streaming tool calls
3. Create session management with compression
4. Build SSE endpoint for real-time updates
5. Develop client UI with optimistic updates

**Questions or clarifications needed?** This research provides the foundation for implementation. Let me know which areas need deeper investigation.
