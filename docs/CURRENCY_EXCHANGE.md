# Currency Exchange Service

Comprehensive currency exchange and price parsing utilities for the itinerator project.

## Overview

The currency exchange system provides:
- **Currency conversion** via free APIs (Frankfurter, ExchangeRate-API)
- **Price parsing** from natural language text
- **24-hour caching** to minimize API calls
- **Automatic fallback** between APIs for reliability

## Components

### 1. Currency Types (`src/domain/types/currency.ts`)

Defines all currency-related types and mappings:

```typescript
import type { CurrencyCode, ParsedPrice, ExchangeRate } from './domain/types/currency';
import { CURRENCY_SYMBOL_MAP, CURRENCY_CODE_TO_SYMBOL } from './domain/types/currency';
```

**Key Types:**
- `CurrencyCode`: ISO 4217 codes (USD, EUR, JPY, etc.)
- `ExchangeRate`: Rate with timestamp and source
- `ParsedPrice`: Parsed price information from text
- `ConversionResult`: Result of currency conversion

### 2. Currency Exchange Service (`src/services/currency-exchange.service.ts`)

Fetches and caches exchange rates:

```typescript
import { CurrencyExchangeService } from './services/currency-exchange.service';

// Create service (with optional config)
const service = new CurrencyExchangeService({
  cacheDuration: 24 * 60 * 60 * 1000, // 24 hours (default)
  timeout: 5000, // API timeout (default)
});

// Get exchange rate
const rate = await service.getRate('JPY', 'USD');
// { from: 'JPY', to: 'USD', rate: 0.0067, timestamp: '2024-01-01T00:00:00Z', source: 'frankfurter' }

// Convert amount
const result = await service.convert(15000, 'JPY', 'USD');
// { originalAmount: 15000, originalCurrency: 'JPY', convertedAmount: 100.5, targetCurrency: 'USD', rate: 0.0067 }

// Clear cache (force fresh fetch)
service.clearCache();

// Get cache statistics
const stats = service.getCacheStats();
// { size: 2, entries: [{ key: 'JPY-USD', age: 123456 }, ...] }
```

### 3. Price Parser (`src/utils/price-parser.ts`)

Extract prices from natural language text:

```typescript
import { parsePrice, parsePrices, formatParsedPrice } from './utils/price-parser';

// Parse single price
const parsed = parsePrice('¥15,000-20,000 per person');
// {
//   original: '¥15,000-20,000 per person',
//   currency: 'JPY',
//   minAmount: 15000,
//   maxAmount: 20000,
//   isRange: true,
//   context: 'per person'
// }

// Parse multiple prices
const prices = parsePrices('$100 or €85 per night');
// [
//   { currency: 'USD', minAmount: 100, ... },
//   { currency: 'EUR', minAmount: 85, context: 'per night', ... }
// ]

// Format back to text
const formatted = formatParsedPrice(parsed);
// '¥15,000-20,000 per person'
```

### 4. Price Converter (`src/utils/price-converter.ts`)

Combine parsing and conversion:

```typescript
import { convertPriceString, convertParsedPrice } from './utils/price-converter';

// Convert price string with formatting
const converted = await convertPriceString('¥15,000-20,000 per person', 'USD');
// '¥15,000-20,000 (~101-134 USD) per person'

// Convert parsed price
const parsed = parsePrice('€50-75 per night');
const result = await convertParsedPrice(parsed, 'USD');
// { min: { convertedAmount: 54.5, ... }, max: { convertedAmount: 81.75, ... } }

// Batch convert multiple prices (shares cache)
const prices = ['¥15,000', '€100', '$50'];
const converted = await convertPriceStrings(prices, 'USD');
// ['¥15,000 (~101 USD)', '€100 (~109 USD)', '$50']
```

## Supported Currencies

The system supports 40+ currencies with proper symbol mapping:

| Currency | Code | Symbol(s) |
|----------|------|-----------|
| US Dollar | USD | $ |
| Euro | EUR | € |
| British Pound | GBP | £ |
| Japanese Yen | JPY | ¥ |
| Chinese Yuan | CNY | 元 |
| Korean Won | KRW | ₩ |
| Thai Baht | THB | ฿ |
| Singapore Dollar | SGD | S$ |
| Hong Kong Dollar | HKD | HK$ |
| Australian Dollar | AUD | A$ |

*See `src/domain/types/currency.ts` for complete list.*

## API Sources

### Primary: Frankfurter API
- **URL**: `https://api.frankfurter.dev`
- **Free**: No API key required
- **Rate Limit**: None (fair use)
- **Coverage**: 30+ currencies
- **Source**: European Central Bank data

### Fallback: ExchangeRate-API
- **URL**: `https://open.er-api.com`
- **Free Tier**: 1,500 requests/month
- **No API Key**: Uses public endpoint
- **Coverage**: 160+ currencies

## Price Parsing Examples

The parser handles various formats:

```typescript
// Single values
parsePrice('$100')          // { minAmount: 100, currency: 'USD' }
parsePrice('¥15,000')       // { minAmount: 15000, currency: 'JPY' }
parsePrice('€50.50')        // { minAmount: 50.5, currency: 'EUR' }

// Ranges
parsePrice('$100-150')      // { minAmount: 100, maxAmount: 150, isRange: true }
parsePrice('¥15,000-20,000') // { minAmount: 15000, maxAmount: 20000, isRange: true }

// With context
parsePrice('$100 per person')  // { context: 'per person' }
parsePrice('€50 per night')    // { context: 'per night' }
parsePrice('₩50,000 pp')       // { context: 'pp' }

// European format
parsePrice('€1.500,50')     // { minAmount: 1500.5 } (thousands separator)

// Multi-character symbols
parsePrice('S$45')          // Singapore Dollar
parsePrice('HK$250')        // Hong Kong Dollar
parsePrice('A$100')         // Australian Dollar
```

## Caching Strategy

The service uses a 24-hour in-memory cache to minimize API calls:

1. **First Request**: Fetches from API, stores in cache
2. **Subsequent Requests**: Returns cached rate (if < 24 hours old)
3. **Cache Expiry**: After 24 hours, fetches fresh rate
4. **Same Currency**: Always returns rate=1 (no API call)

Benefits:
- Reduces API calls by ~99% for typical usage
- Improves response time (instant for cached rates)
- Stays within free tier limits
- Still fresh enough for travel planning

## Error Handling

The service implements robust error handling:

```typescript
try {
  const rate = await service.getRate('JPY', 'USD');
} catch (error) {
  // Error if both APIs fail
  console.error('Failed to fetch rate:', error.message);
}

// Price parsing returns null on failure
const parsed = parsePrice('no currency here');
// null

// Conversion helpers return original text on error
const converted = await convertPriceString('invalid', 'USD');
// 'invalid' (original returned on error)
```

## Integration with Itinerator

### In Trip Designer

Convert activity prices to traveler's preferred currency:

```typescript
// In activity recommendation
const activity = {
  name: 'Sushi Making Class',
  price: '¥15,000-20,000 per person',
};

// Convert to traveler's currency
const converted = await convertPriceString(
  activity.price,
  traveler.preferredCurrency || 'USD'
);
// '¥15,000-20,000 (~101-134 USD) per person'
```

### In Segment Service

Add price conversions to segments:

```typescript
const segment = {
  title: 'Tokyo to Kyoto',
  estimatedCost: '¥15,000',
};

const convertedCost = await convertPriceString(
  segment.estimatedCost,
  'USD'
);
// '¥15,000 (~101 USD)'
```

### In Itinerary Display

Show all prices in user's preferred currency:

```typescript
const prices = segments.map(s => s.estimatedCost);
const converted = await convertPriceStrings(prices, userCurrency);
// Display converted prices in viewer
```

## Testing

Comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific tests
npm test -- tests/unit/utils/price-parser.test.ts
npm test -- tests/unit/services/currency-exchange.service.test.ts
```

Test coverage:
- ✅ 26 price parser tests
- ✅ 11 currency exchange service tests
- ✅ Multiple currency formats
- ✅ Edge cases and error handling
- ✅ Caching behavior

## Performance Considerations

### API Calls
- **Without cache**: 1 API call per conversion (slow, hits rate limits)
- **With 24h cache**: ~1 API call per day per currency pair (fast, efficient)

### Example Usage Pattern
```typescript
// Trip with 10 activities in Japan, viewed by 5 travelers
// Without cache: 10 activities × 5 viewers = 50 API calls
// With cache: 1 API call (JPY→USD cached for all)
```

### Memory Usage
- Cache size: ~100 bytes per currency pair
- Typical usage: 5-10 pairs = 500-1000 bytes
- Cache auto-expires after 24 hours

## Future Enhancements

Potential improvements:
- 🟢 Persistent cache (Redis/filesystem) for cross-session
- 🟢 Historical rates for past trip dates
- 🟢 Cryptocurrency support
- 🟢 Offline fallback rates
- 🟢 Rate change notifications

## Related Files

- `/src/domain/types/currency.ts` - Type definitions
- `/src/services/currency-exchange.service.ts` - Exchange rate service
- `/src/utils/price-parser.ts` - Price parsing utilities
- `/src/utils/price-converter.ts` - Combined parsing + conversion
- `/tests/unit/utils/price-parser.test.ts` - Parser tests
- `/tests/unit/services/currency-exchange.service.test.ts` - Service tests

---

**Priority**: 🟡 Important - Enhances UX by showing prices in familiar currency
