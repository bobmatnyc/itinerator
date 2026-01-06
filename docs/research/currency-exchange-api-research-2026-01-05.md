# Currency Exchange Rate API Research

**Date:** 2026-01-05
**Researcher:** AI Research Agent
**Project:** Itinerator - Travel Itinerary Management System

## Executive Summary

This research evaluates free currency exchange rate APIs for converting prices in itinerary segments (e.g., "¥15,000-20,000 per person") to the traveler's home currency (e.g., "$100-135 USD"). The recommended solution is **Frankfurter API** with a 24-hour cache strategy and regex-based text parsing.

**Key Recommendations:**
1. **Primary API:** Frankfurter (api.frankfurter.dev) - Free, no API key, 200+ currencies
2. **Caching:** 24-hour in-memory cache (rates update daily at 16:00 CET)
3. **Fallback:** Open.er-api.com (same interface, no key required)
4. **Text Parsing:** Regex extraction with Unicode currency symbol support
5. **Storage:** Extend existing `Money` type with `convertedAmount` field

---

## API Comparison

### Evaluated APIs

| API | Free Tier | API Key | Rate Limits | Currencies | Update Frequency | Data Source |
|-----|-----------|---------|-------------|------------|------------------|-------------|
| **Frankfurter** | Unlimited | No | Soft (daily OK) | 200+ | Daily ~16:00 CET | ECB |
| **Open.er-api.com** | Unlimited | No | Soft (hourly OK) | 170+ | Daily | Commercial |
| **ExchangeRate-API** | Soft limit | No | Hourly OK | 160+ | Daily | Commercial |
| **CurrencyBeacon** | 5,000/month | Yes | Hourly updates | 200+ | Hourly | Commercial |
| **Fixer.io** | 100/month | Yes | Hourly | 170+ | Hourly | Commercial |

### Detailed Analysis

#### 🟢 **Frankfurter API (RECOMMENDED)**

**Pros:**
- ✅ **No API key required** - Works immediately without setup
- ✅ **Unlimited requests** - No hard rate limits (soft limit is generous)
- ✅ **200+ currencies** - Covers all major and minor currencies
- ✅ **Open source** - Can self-host if needed (Docker available)
- ✅ **10+ years stable** - Long-term reliability
- ✅ **Vercel-friendly** - No filesystem requirements, pure HTTP API
- ✅ **ECB data source** - European Central Bank (institutional quality)
- ✅ **Simple REST API** - Clean JSON responses
- ✅ **HTTPS only** - Secure by default

**Cons:**
- ⚠️ **Daily updates only** - Rates refresh once per day (~16:00 CET)
- ⚠️ **Soft rate limit** - High-volume queries discouraged (use cache)
- ⚠️ **No real-time rates** - Not suitable for financial trading (fine for travel)

**API Endpoints:**
```typescript
// Latest rates
GET https://api.frankfurter.dev/v1/latest?base=JPY&symbols=USD

// Historical rates (if needed)
GET https://api.frankfurter.dev/v1/2026-01-05?base=JPY&symbols=USD

// All supported currencies
GET https://api.frankfurter.dev/v1/currencies
```

**Response Format:**
```json
{
  "base": "JPY",
  "date": "2026-01-05",
  "rates": {
    "USD": 0.0067
  }
}
```

**Rate Limit Behavior:**
- No hard limit, but soft cap for abuse prevention
- Recommended: 1 request per 24 hours (daily cache)
- Acceptable: 1 request per hour if needed
- Over-usage: HTTP 429 responses, 20-minute timeout

**Self-Hosting Option:**
```bash
docker run -d -p 8080:8080 hakanensari/frankfurter
```

#### 🟡 **Open.er-api.com (FALLBACK)**

**Pros:**
- ✅ **No API key** - Same as Frankfurter
- ✅ **170+ currencies** - Good coverage
- ✅ **Daily updates** - Similar to Frankfurter
- ✅ **Deprecation warnings** - `time_eol` field for API lifecycle management

**Cons:**
- ⚠️ **Less transparent** - Commercial service with unclear backing
- ⚠️ **Attribution required** - Must credit in UI
- ⚠️ **No redistribution** - Cannot share rate data

**API Endpoint:**
```typescript
GET https://open.er-api.com/v6/latest/JPY
```

**Response Format:**
```json
{
  "result": "success",
  "base_code": "JPY",
  "rates": {
    "USD": 0.0067
  },
  "time_eol": null
}
```

#### 🔴 **NOT RECOMMENDED: Paid/Limited APIs**

**ExchangeRatesAPI.io:**
- ❌ Only 250 requests/month on free tier
- ❌ Requires API key
- ❌ Too restrictive for production

**Fixer.io:**
- ❌ Only 100 requests/month on free tier
- ❌ Requires API key
- ❌ Too restrictive for production

**CurrencyBeacon:**
- ⚠️ 5,000 requests/month is generous BUT
- ❌ Requires API key (another secret to manage)
- ❌ Hourly updates unnecessary for travel planning

---

## Implementation Strategy

### 1. Service Architecture

```typescript
// src/services/currency-exchange.service.ts

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  date: string;
  source: 'frankfurter' | 'open.er-api';
}

interface CachedRate extends ExchangeRate {
  cachedAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
}

class CurrencyExchangeService {
  private cache: Map<string, CachedRate> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  async getExchangeRate(from: string, to: string): Promise<ExchangeRate> {
    // 1. Check cache first
    const cached = this.getCachedRate(from, to);
    if (cached) return cached;

    // 2. Try Frankfurter (primary)
    try {
      const rate = await this.fetchFromFrankfurter(from, to);
      this.cacheRate(rate);
      return rate;
    } catch (error) {
      // 3. Fallback to Open.er-api
      const rate = await this.fetchFromOpenER(from, to);
      this.cacheRate(rate);
      return rate;
    }
  }

  private async fetchFromFrankfurter(from: string, to: string): Promise<ExchangeRate> {
    const url = `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return {
      from,
      to,
      rate: data.rates[to],
      date: data.date,
      source: 'frankfurter'
    };
  }

  private async fetchFromOpenER(from: string, to: string): Promise<ExchangeRate> {
    const url = `https://open.er-api.com/v6/latest/${from}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.result !== 'success') throw new Error(data['error-type']);

    return {
      from,
      to,
      rate: data.rates[to],
      date: new Date().toISOString().split('T')[0],
      source: 'open.er-api'
    };
  }

  private getCachedRate(from: string, to: string): ExchangeRate | null {
    const key = `${from}-${to}`;
    const cached = this.cache.get(key);

    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  private cacheRate(rate: ExchangeRate): void {
    const key = `${rate.from}-${rate.to}`;
    const now = Date.now();

    this.cache.set(key, {
      ...rate,
      cachedAt: now,
      expiresAt: now + this.CACHE_TTL
    });
  }

  async convertMoney(money: Money, targetCurrency: string): Promise<Money> {
    if (money.currency === targetCurrency) return money;

    const rate = await this.getExchangeRate(money.currency, targetCurrency);

    return {
      amount: Math.round(money.amount * rate.rate),
      currency: targetCurrency
    };
  }
}
```

### 2. Currency Symbol Mapping

```typescript
// src/utils/currency-symbols.ts

export const CURRENCY_SYMBOLS: Record<string, string> = {
  '¥': 'JPY',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR',
  '₽': 'RUB',
  '₩': 'KRW',
  '¢': 'USD', // Cents
  'C$': 'CAD',
  'A$': 'AUD',
  'NZ$': 'NZD',
  'HK$': 'HKD',
  'S$': 'SGD',
  'CHF': 'CHF',
  'kr': 'SEK', // Ambiguous: SEK, NOK, DKK (context needed)
};

export function detectCurrency(text: string): string | null {
  // Try Unicode currency symbol pattern
  const symbolMatch = text.match(/\p{Sc}/u);
  if (symbolMatch) {
    return CURRENCY_SYMBOLS[symbolMatch[0]] || null;
  }

  // Try ISO code pattern (e.g., "15000 JPY")
  const isoMatch = text.match(/\b([A-Z]{3})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  return null;
}
```

### 3. Price Text Parsing

```typescript
// src/utils/price-parser.ts

interface ParsedPrice {
  currency: string;
  min?: number;
  max?: number;
  value?: number;
  original: string;
}

export function parsePriceFromText(text: string): ParsedPrice | null {
  // Detect currency
  const currency = detectCurrency(text);
  if (!currency) return null;

  // Extract numbers (handles comma separators)
  const numberPattern = /[\d,]+(?:\.\d+)?/g;
  const matches = text.match(numberPattern);
  if (!matches) return null;

  // Clean numbers (remove commas)
  const numbers = matches.map(n => parseFloat(n.replace(/,/g, '')));

  // Determine if range or single value
  if (numbers.length >= 2) {
    // Range: "¥15,000-20,000"
    return {
      currency,
      min: numbers[0],
      max: numbers[1],
      original: text
    };
  } else if (numbers.length === 1) {
    // Single value: "¥15,000"
    return {
      currency,
      value: numbers[0],
      original: text
    };
  }

  return null;
}

// Examples:
// parsePriceFromText("¥15,000-20,000 per person")
// → { currency: "JPY", min: 15000, max: 20000, original: "..." }

// parsePriceFromText("$100 USD")
// → { currency: "USD", value: 100, original: "..." }

// parsePriceFromText("€50.50")
// → { currency: "EUR", value: 50.5, original: "..." }
```

### 4. Integration with Segment Schema

Extend the existing `Segment` schema to support converted prices:

```typescript
// src/domain/schemas/segment.schema.ts

export const segmentBookingSchema = z.object({
  // Existing fields...
  price: moneySchema.optional(),
  totalPrice: moneySchema.optional(),

  // NEW: Converted prices for traveler's home currency
  convertedPrice: moneySchema.optional(),
  convertedTotalPrice: moneySchema.optional(),

  // NEW: Exchange rate metadata
  exchangeRate: z.object({
    from: z.string(),
    to: z.string(),
    rate: z.number(),
    date: z.string(),
    source: z.enum(['frankfurter', 'open.er-api'])
  }).optional(),
});
```

### 5. Display Logic

```typescript
// viewer-svelte/src/lib/utils/currency-display.ts

export function formatPriceWithConversion(
  originalPrice: Money,
  convertedPrice?: Money,
  showBoth = true
): string {
  const original = formatMoney(originalPrice);

  if (!convertedPrice || !showBoth) return original;

  const converted = formatMoney(convertedPrice);
  return `${converted} (${original})`;
}

// Example output: "$135.00 USD (¥20,000 JPY)"
```

---

## Caching Strategy

### Cache Requirements

**Goals:**
- Minimize API requests (stay within soft limits)
- Provide fast responses (no blocking API calls)
- Handle rate freshness (24-hour data is acceptable)
- Support Vercel deployment (no filesystem cache)

**Solution: In-Memory Cache with 24-Hour TTL**

### Cache Implementation

```typescript
interface CacheEntry {
  data: ExchangeRate;
  cachedAt: number;
  expiresAt: number;
}

class CurrencyCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours

  get(from: string, to: string): ExchangeRate | null {
    const key = `${from}-${to}`;
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(from: string, to: string, data: ExchangeRate): void {
    const key = `${from}-${to}`;
    const now = Date.now();

    this.cache.set(key, {
      data,
      cachedAt: now,
      expiresAt: now + this.TTL
    });
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}
```

### Cache Behavior

**Daily Update Cycle:**
1. First request of the day: Fetch from API, cache for 24 hours
2. Subsequent requests: Serve from cache (instant response)
3. Next day: Cache expires, new API request made

**Memory Footprint:**
- Each cache entry: ~200 bytes
- 100 currency pairs: ~20 KB
- Negligible memory impact

**Vercel Considerations:**
- In-memory cache persists per serverless function instance
- Cold starts will have empty cache (first request fetches)
- Warm instances reuse cache across requests
- No shared cache across instances (acceptable for this use case)

### Alternative: Redis Cache (Future Enhancement)

If request volume increases significantly:

```typescript
// Using Vercel KV (Redis)
import { kv } from '@vercel/kv';

async getCachedRate(from: string, to: string): Promise<ExchangeRate | null> {
  const key = `exchange:${from}:${to}`;
  const cached = await kv.get<ExchangeRate>(key);
  return cached;
}

async cacheRate(rate: ExchangeRate): Promise<void> {
  const key = `exchange:${rate.from}:${rate.to}`;
  await kv.set(key, rate, { ex: 86400 }); // 24-hour expiry
}
```

**Costs:**
- Vercel KV free tier: 30,000 commands/month
- Sufficient for production workload
- Shared cache across all serverless instances

---

## Error Handling & Fallbacks

### Fallback Chain

```typescript
async getExchangeRate(from: string, to: string): Promise<ExchangeRate> {
  // 1. Try in-memory cache
  const cached = this.cache.get(from, to);
  if (cached) return cached;

  // 2. Try Frankfurter (primary)
  try {
    const rate = await this.fetchFromFrankfurter(from, to);
    this.cache.set(from, to, rate);
    return rate;
  } catch (primaryError) {
    console.warn('Frankfurter failed:', primaryError);

    // 3. Try Open.er-api (fallback)
    try {
      const rate = await this.fetchFromOpenER(from, to);
      this.cache.set(from, to, rate);
      return rate;
    } catch (fallbackError) {
      console.error('All exchange rate APIs failed:', fallbackError);

      // 4. Use default rate (if available)
      const defaultRate = this.getDefaultRate(from, to);
      if (defaultRate) return defaultRate;

      // 5. Throw error (no conversion possible)
      throw new Error(`Cannot fetch exchange rate for ${from} → ${to}`);
    }
  }
}
```

### Default Rates (Emergency Fallback)

```typescript
// Hard-coded rates for common pairs (updated manually)
const DEFAULT_RATES: Record<string, Record<string, number>> = {
  JPY: {
    USD: 0.0067,
    EUR: 0.0062,
    GBP: 0.0053
  },
  USD: {
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.5
  },
  // ... more pairs
};
```

### User-Facing Error Handling

```typescript
// In UI components
try {
  const convertedPrice = await currencyService.convertMoney(price, 'USD');
  return formatPriceWithConversion(price, convertedPrice);
} catch (error) {
  // Graceful degradation: show original price only
  console.error('Currency conversion failed:', error);
  return formatMoney(price); // Original currency
}
```

---

## Text Parsing Approach

### Regex Patterns

#### 1. Currency Symbol Detection

```typescript
// Unicode currency symbol pattern (supports all currencies)
const CURRENCY_SYMBOL_PATTERN = /\p{Sc}/u;

// Common symbols
const COMMON_SYMBOLS = /[¥$€£₹₽₩]/;

// ISO 4217 code pattern
const ISO_CODE_PATTERN = /\b([A-Z]{3})\b/;
```

#### 2. Number Extraction

```typescript
// Handle comma-separated thousands and decimals
const NUMBER_PATTERN = /[\d,]+(?:\.\d+)?/g;

// Examples matched:
// "15,000" → 15000
// "15000" → 15000
// "15,000.50" → 15000.5
// "15.000,50" → 15000.5 (European format - needs locale detection)
```

#### 3. Range Detection

```typescript
// Range patterns: "15,000-20,000" or "15,000 to 20,000"
const RANGE_PATTERN = /([\d,]+)\s*(?:-|to|–|—)\s*([\d,]+)/i;

// Price per unit: "per person", "each", "pp"
const PER_UNIT_PATTERN = /\b(?:per|each|pp|\/)\s*(\w+)/i;
```

### Complete Parser Function

```typescript
interface PriceRange {
  currency: string;
  min?: number;
  max?: number;
  value?: number;
  unit?: string; // "person", "night", "trip"
  original: string;
}

export function parsePriceFromText(text: string): PriceRange | null {
  // Step 1: Detect currency
  const currencySymbol = text.match(/\p{Sc}/u)?.[0];
  const currencyCode = text.match(/\b([A-Z]{3})\b/)?.[1];
  const currency = CURRENCY_SYMBOLS[currencySymbol || ''] || currencyCode;

  if (!currency) return null;

  // Step 2: Extract numbers
  const numbers = Array.from(text.matchAll(/[\d,]+(?:\.\d+)?/g))
    .map(m => parseFloat(m[0].replace(/,/g, '')));

  if (numbers.length === 0) return null;

  // Step 3: Detect unit (per person, per night, etc.)
  const unitMatch = text.match(/\b(?:per|each|\/)\s*(\w+)/i);
  const unit = unitMatch?.[1];

  // Step 4: Determine if range or single value
  const isRange = /-|to|–|—/.test(text) && numbers.length >= 2;

  return {
    currency,
    ...(isRange ? { min: numbers[0], max: numbers[1] } : { value: numbers[0] }),
    unit,
    original: text
  };
}
```

### Test Cases

```typescript
// Test: Single value with symbol
parsePriceFromText("¥15,000")
// → { currency: "JPY", value: 15000, original: "..." }

// Test: Range with symbol
parsePriceFromText("¥15,000-20,000 per person")
// → { currency: "JPY", min: 15000, max: 20000, unit: "person", original: "..." }

// Test: USD with dollar sign
parsePriceFromText("$100-150 USD")
// → { currency: "USD", min: 100, max: 150, original: "..." }

// Test: Euro with decimal
parsePriceFromText("€50.50")
// → { currency: "EUR", value: 50.5, original: "..." }

// Test: ISO code only
parsePriceFromText("15000 JPY to 20000 JPY")
// → { currency: "JPY", min: 15000, max: 20000, original: "..." }
```

---

## Integration Plan

### Phase 1: Core Service (Week 1)

**Tasks:**
1. Create `CurrencyExchangeService` with Frankfurter integration
2. Implement in-memory cache with 24-hour TTL
3. Add fallback to Open.er-api
4. Write unit tests for service

**Files to Create:**
- `src/services/currency-exchange.service.ts`
- `tests/services/currency-exchange.service.test.ts`

### Phase 2: Price Parsing (Week 1)

**Tasks:**
1. Create `parsePriceFromText()` utility function
2. Create `CURRENCY_SYMBOLS` mapping
3. Write unit tests for parser

**Files to Create:**
- `src/utils/price-parser.ts`
- `src/utils/currency-symbols.ts`
- `tests/unit/utils/price-parser.test.ts`

### Phase 3: Schema Extension (Week 1)

**Tasks:**
1. Extend `segmentBookingSchema` with converted fields
2. Add `exchangeRate` metadata field
3. Update TypeScript types
4. Migration script for existing data (no-op, new fields are optional)

**Files to Modify:**
- `src/domain/schemas/segment.schema.ts`
- `src/domain/types/segment.ts`

### Phase 4: UI Integration (Week 2)

**Tasks:**
1. Add currency preference to traveler profile
2. Auto-convert prices in SegmentCard component
3. Show conversion in tooltip/subtitle
4. Add "Convert prices" toggle in settings

**Files to Modify:**
- `viewer-svelte/src/lib/components/SegmentCard.svelte`
- `viewer-svelte/src/lib/components/TravelerFormDialog.svelte`
- `src/domain/schemas/traveler.schema.ts` (add `preferredCurrency` field)

### Phase 5: API Routes (Week 2)

**Tasks:**
1. Create `/api/v1/currency/convert` endpoint
2. Create `/api/v1/currency/rates` endpoint
3. Add error handling and rate limiting

**Files to Create:**
- `viewer-svelte/src/routes/api/v1/currency/convert/+server.ts`
- `viewer-svelte/src/routes/api/v1/currency/rates/+server.ts`

---

## Cost Analysis

### API Costs

**Frankfurter:**
- Free tier: Unlimited (with soft limits)
- Estimated usage: ~10-50 requests/day (with 24-hour cache)
- Monthly cost: $0

**Vercel Hosting:**
- Serverless function invocations: Free tier covers expected usage
- Bandwidth: Negligible (small JSON responses)
- Monthly cost: $0

**Total Monthly Cost: $0** (stays within free tiers)

### Performance Metrics

**API Latency:**
- Frankfurter response time: ~200-500ms (Europe-based servers)
- Cache hit: <1ms (in-memory)
- Cache miss: ~200-500ms (first request of the day)

**User Experience:**
- First page load: Slight delay for conversion (acceptable)
- Subsequent loads: Instant (cached)
- Fallback: Graceful degradation (show original price if conversion fails)

---

## Security Considerations

### API Key Management

**No API keys required** for recommended solution (Frankfurter + Open.er-api).

If using alternative APIs that require keys:
- Store in Vercel environment variables
- Never commit to git
- Rotate periodically

### Rate Limiting

Implement client-side rate limiting to prevent abuse:

```typescript
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 10;
  private readonly windowMs = 60000; // 1 minute

  async checkLimit(): Promise<boolean> {
    const now = Date.now();
    this.requests = this.requests.filter(t => t > now - this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      return false; // Rate limited
    }

    this.requests.push(now);
    return true; // OK to proceed
  }
}
```

### Input Validation

Validate currency codes before API requests:

```typescript
const VALID_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'AUD', 'CAD',
  // ... full list from Frankfurter /currencies endpoint
]);

function validateCurrencyCode(code: string): boolean {
  return VALID_CURRENCIES.has(code.toUpperCase());
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/services/currency-exchange.service.test.ts
describe('CurrencyExchangeService', () => {
  it('should fetch exchange rate from Frankfurter', async () => {
    const service = new CurrencyExchangeService();
    const rate = await service.getExchangeRate('JPY', 'USD');

    expect(rate.from).toBe('JPY');
    expect(rate.to).toBe('USD');
    expect(rate.rate).toBeGreaterThan(0);
    expect(rate.source).toBe('frankfurter');
  });

  it('should cache rates for 24 hours', async () => {
    const service = new CurrencyExchangeService();

    // First call: API request
    const rate1 = await service.getExchangeRate('JPY', 'USD');

    // Second call: Cache hit (should be instant)
    const start = Date.now();
    const rate2 = await service.getExchangeRate('JPY', 'USD');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10); // < 10ms for cache hit
    expect(rate1.rate).toBe(rate2.rate);
  });

  it('should fallback to Open.er-api if Frankfurter fails', async () => {
    // Mock Frankfurter to fail
    // Verify Open.er-api is called
  });
});
```

### Integration Tests

```typescript
// tests/integration/currency-conversion.test.ts
describe('Currency Conversion Integration', () => {
  it('should convert JPY price to USD in segment', async () => {
    const segment = {
      type: 'activity',
      booking: {
        price: { amount: 1500000, currency: 'JPY' } // ¥15,000 in cents
      }
    };

    const converted = await convertSegmentPrices(segment, 'USD');

    expect(converted.booking.convertedPrice).toBeDefined();
    expect(converted.booking.convertedPrice.currency).toBe('USD');
    expect(converted.booking.exchangeRate).toBeDefined();
  });
});
```

### E2E Tests

```typescript
// tests/e2e/currency-display.e2e.test.ts
test('should display converted prices in UI', async ({ page }) => {
  await page.goto('/itineraries/123');

  // Find segment with JPY price
  const segment = page.locator('[data-testid="segment-card"]').first();

  // Verify conversion is shown
  await expect(segment.locator('.converted-price')).toContainText('USD');
  await expect(segment.locator('.original-price')).toContainText('JPY');
});
```

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Historical Rates**
   - Use Frankfurter's historical endpoint
   - Show "Price when booked" vs "Current price"
   - Track price changes over time

2. **Currency Preferences**
   - Allow travelers to set preferred currency
   - Auto-convert all prices to preferred currency
   - Store preference in traveler profile

3. **Multi-Currency Support**
   - Support itineraries with multiple currencies
   - Show total cost in home currency
   - Currency breakdown by segment type

4. **Price Alerts**
   - Notify when exchange rates change significantly
   - "Book now" alerts when rates are favorable
   - Budget tracking in home currency

5. **Offline Support**
   - Cache rates in localStorage
   - Sync when online
   - Show "last updated" timestamp

6. **Admin Dashboard**
   - View cache statistics
   - Monitor API usage
   - Manually refresh rates

---

## Recommendation Summary

**Recommended Stack:**
1. **API:** Frankfurter (primary), Open.er-api (fallback)
2. **Caching:** 24-hour in-memory cache
3. **Parsing:** Regex-based with Unicode support
4. **Storage:** Extend existing `Money` schema
5. **UI:** Inline conversion with tooltip

**Implementation Priority:** 🟡 Important (enhances UX, not blocking)

**Estimated Effort:** 1-2 weeks (5 phases)

**Monthly Cost:** $0 (free tier)

**Risk Level:** Low (fallback chain, graceful degradation)

**User Value:** High (better price understanding, budget planning)

---

## References

### APIs
- [Frankfurter Documentation](https://frankfurter.dev/)
- [ExchangeRate-API Free Tier](https://www.exchangerate-api.com/docs/free)
- [Open.er-api.com Documentation](https://www.exchangerate-api.com/)
- [10 APIs For Currency Exchange Rates - Nordic APIs](https://nordicapis.com/10-apis-for-currency-exchange-rates/)
- [Best Free Exchange Rate APIs - Medium](https://medium.com/@adeltoft/best-free-exchange-rate-apis-3f35650af0e2)

### Parsing & Formatting
- [Parsing Currency Amount from String - JavaScript](https://nesin.io/blog/parse-currency-amount-from-string-javascript)
- [parsecurrency - npm](https://www.npmjs.com/package/parsecurrency)
- [Working with Currency Values in TypeScript](https://www.joshuaslate.com/blog/currency-values-in-typescript)
- [Intl.NumberFormat - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)

### Best Practices
- [How to Handle Monetary Values in JavaScript](https://frontstuff.io/how-to-handle-monetary-values-in-javascript)
- [Free Currency Converter API Comparison 2025](https://blog.apilayer.com/7-best-free-currency-converter-apis-in-2025/)

---

**Next Steps:**
1. Review recommendations with engineering team
2. Create implementation tickets for 5 phases
3. Start with Phase 1 (Core Service) - estimated 2-3 days
4. Deploy to staging for testing
5. Gather user feedback on conversion display

---

*Research completed on 2026-01-05 by AI Research Agent*
