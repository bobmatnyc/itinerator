# Currency Conversion Display Implementation

## Overview

Added currency conversion display to SegmentCard components, showing prices in both the original currency and the user's preferred home currency.

## Changes Made

### 1. Currency Types (`viewer-svelte/src/lib/types/currency.ts`)

Added currency type definitions for the viewer:
- `CurrencyCode`: ISO 4217 currency codes (USD, EUR, JPY, etc.)
- `ConversionResult`: Interface for currency conversion results

### 2. Currency Exchange Service (`viewer-svelte/src/lib/services/currency-exchange.service.ts`)

Created a currency exchange service with the following features:
- **Dual API sources**: Frankfurter (primary) and ExchangeRate-API (fallback)
- **24-hour caching**: Minimizes API calls with configurable cache duration
- **Automatic fallback**: Falls back to secondary API if primary fails
- **Timeout handling**: 5-second timeout for API requests

**API Endpoints Used:**
- Primary: `https://api.frankfurter.dev/v1/latest` (free, no API key)
- Fallback: `https://open.er-api.com/v6/latest` (free, 1,500 requests/month)

### 3. API Route (`viewer-svelte/src/routes/api/v1/currency/convert/+server.ts`)

Created REST API endpoint for currency conversion:
```
GET /api/v1/currency/convert?from=JPY&to=USD&amount=15000
```

**Features:**
- Validates parameters (from, to, amount)
- Shared service instance for cache benefits
- Error handling with detailed messages

### 4. PriceDisplay Component (`viewer-svelte/src/lib/components/PriceDisplay.svelte`)

Reusable Svelte 5 component for displaying prices with conversion:

**Props:**
- `amount`: Price amount in smallest unit (cents)
- `currency`: ISO currency code
- `targetCurrency`: Target currency for conversion (default: USD)
- `showConversion`: Whether to show converted price (default: true)

**Display Format:**
- Original: `¥15,000 JPY`
- With conversion: `¥15,000 JPY (~$100.23)`
- Same currency: `$100.00` (no conversion needed)

**Features:**
- Async conversion with loading state
- Error handling (falls back to original price)
- Reactive updates when amount/currency changes
- Graceful degradation on API errors

### 5. SegmentCard Updates (`viewer-svelte/src/lib/components/SegmentCard.svelte`)

Enhanced SegmentCard to display prices with conversion:

**New Features:**
- Added `targetCurrency` prop (passed from parent)
- `getSegmentPrice()`: Helper to extract price from segment (checks `totalPrice` then `price`)
- Price display section showing original + converted price
- Placed after notes, before review/booking links

**Price Display Logic:**
```svelte
{#if priceInfo}
  <div class="text-sm ml-11 flex items-center gap-2">
    <span class="text-minimal-text-muted">Price:</span>
    <PriceDisplay
      amount={priceInfo.amount}
      currency={priceInfo.currency}
      {targetCurrency}
      showConversion={priceInfo.currency !== targetCurrency}
    />
  </div>
{/if}
```

### 6. ItineraryDetail Updates (`viewer-svelte/src/lib/components/ItineraryDetail.svelte`)

Added support for passing target currency to segments:

**New Derivation:**
```typescript
let targetCurrency = $derived(
  (itinerary.tripPreferences?.homeCurrency as any) || 'USD'
);
```

**Propagation:**
- Passes `targetCurrency` prop to all SegmentCard instances
- Uses value from `itinerary.tripPreferences.homeCurrency`
- Defaults to USD if not set

### 7. Type Updates (`viewer-svelte/src/lib/types.ts`)

Added `homeCurrency` field to `TripTravelerPreferences`:
```typescript
export interface TripTravelerPreferences {
  // ... existing fields
  homeCurrency?: string;
}
```

## Usage Example

### Setting Home Currency

Users can set their home currency in trip preferences (future enhancement):
```typescript
itinerary.tripPreferences = {
  homeCurrency: 'USD',
  // ... other preferences
};
```

### Price Display

When a segment has a price field:
```typescript
segment.price = {
  amount: 1500000, // ¥15,000 in cents
  currency: 'JPY'
};
```

The display will show:
```
Price: ¥15,000 JPY (~$100.23 USD)
```

## Architecture Decisions

### Why Two API Sources?

- **Reliability**: Fallback ensures service availability
- **No API keys**: Both services offer free tiers without authentication
- **Geographic diversity**: Frankfurter (EU) and ExchangeRate-API (global)

### Why 24-Hour Cache?

- **API rate limits**: Free tiers have request limits
- **Exchange rates**: Don't change frequently enough to need real-time updates
- **Performance**: Eliminates network latency for cached conversions

### Why Cents for Amount?

- **Precision**: Avoids floating-point arithmetic errors
- **Consistency**: Matches the `Money` type in core domain
- **Standard practice**: Common in financial applications

### Why Async Conversion?

- **Non-blocking**: Doesn't delay initial render
- **Progressive enhancement**: Shows original price immediately
- **Graceful degradation**: Falls back to original if conversion fails

## Future Enhancements

1. **User Settings**: Add UI for users to set their home currency
2. **Bulk Conversion**: Pre-fetch rates for all currencies in itinerary
3. **Price Parsing**: Extract and convert prices from descriptions (e.g., "Expect ¥15,000-20,000 per person")
4. **Offline Support**: Use cached rates when offline
5. **Historical Rates**: Show rate at time of booking vs. current rate
6. **Multiple Currencies**: Support displaying in multiple target currencies simultaneously

## Testing

### Build Verification

Build completed successfully with no TypeScript errors:
```bash
cd viewer-svelte && npm run build
# ✓ built in 4.39s
```

### Manual Testing Steps

1. Create itinerary with segments containing prices
2. Set different currencies on segments (JPY, EUR, GBP, etc.)
3. Set home currency in trip preferences
4. Verify conversion displays correctly
5. Test with same currency (should skip conversion)
6. Test with network offline (should gracefully degrade)

### Test Currencies

Common test scenarios:
- JPY → USD (large numbers, no decimal)
- EUR → USD (decimal amounts)
- GBP → USD (decimal amounts)
- THB → USD (Asian currency)
- CNY → USD (Chinese Yuan)

## LOC Delta

```
Added:
- viewer-svelte/src/lib/types/currency.ts: 26 lines
- viewer-svelte/src/lib/services/currency-exchange.service.ts: 219 lines
- viewer-svelte/src/routes/api/v1/currency/convert/+server.ts: 50 lines
- viewer-svelte/src/lib/components/PriceDisplay.svelte: 114 lines
- viewer-svelte/src/lib/components/SegmentCard.svelte: +30 lines (modifications)
- viewer-svelte/src/lib/components/ItineraryDetail.svelte: +3 lines (modifications)
- viewer-svelte/src/lib/types.ts: +1 line (modification)

Total: ~443 lines added
Removed: 0 lines
Net Change: +443 lines
```

## Related Files

### Core Domain (Reference)
- `src/domain/types/currency.ts`: Currency type definitions
- `src/services/currency-exchange.service.ts`: Core currency service
- `src/utils/price-parser.ts`: Price parsing utilities
- `src/utils/price-converter.ts`: Price conversion utilities

### Documentation
- `docs/research/currency-exchange-api-research-2026-01-05.md`: API research
- `examples/currency-conversion-example.ts`: Usage examples

## Dependencies

No new external dependencies added. Uses browser's native `fetch` API.

## Browser Compatibility

- Requires modern browser with `fetch` support
- AbortController for request timeouts
- Svelte 5 runes API
