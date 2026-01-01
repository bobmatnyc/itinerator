# Import Metadata Enhancement - Implementation Summary

## Overview

Enhanced the document import process to automatically populate rich metadata on both the itinerary and its segments during import operations.

## Changes Made

### 1. Modified `src/services/document-import.service.ts`

#### Added Imports
- `basename` from `node:path` - to extract filename from full path
- `TokenUsage` type from import types

#### Enhanced Methods

##### `import()` method
- Added timing tracking (`startTime`, `endTime`)
- Call to `enhanceItineraryMetadata()` after LLM parsing
- Metadata enhancement occurs before saving to storage

##### `importWithValidation()` method
- Added timing tracking (`startTime`, `endTime`)
- Call to `enhanceItineraryMetadata()` after LLM parsing and gap filling
- Metadata enhancement occurs before saving to storage

#### New Private Method: `enhanceItineraryMetadata()`

Populates comprehensive metadata on the itinerary and its segments:

```typescript
private enhanceItineraryMetadata(
  itinerary: Itinerary,
  filePath: string,
  usage: TokenUsage,
  startTime: number,
  endTime: number
): Itinerary
```

## Metadata Structure

### Itinerary-Level Metadata

The following metadata is added to `itinerary.metadata`:

```typescript
{
  importSource: {
    filename: string;        // e.g., "trip-itinerary.pdf"
    importedAt: string;      // ISO 8601 timestamp
    model: string;           // e.g., "anthropic/claude-3-haiku"
    processingTimeMs: number; // Total processing time in milliseconds
  },
  llmUsage: {
    promptTokens: number;    // Input tokens used
    completionTokens: number; // Output tokens generated
    totalCost: number;       // Total cost in USD
  }
}
```

### Segment-Level Metadata

For each segment with `source: 'import'`, the following is added to `segment.sourceDetails`:

```typescript
{
  model: string;      // LLM model used for parsing
  timestamp: Date;    // When the segment was imported
  // ... other existing sourceDetails fields
}
```

**Note**: Agent-generated segments (gap-filling placeholders) are NOT modified, preserving their original sourceDetails.

## Type Safety

- All metadata is optional and backward compatible
- Existing itineraries without this metadata will continue to work
- The `metadata: Record<string, unknown>` field on `Itinerary` allows for flexible metadata storage
- The `sourceDetails?: SegmentSourceDetails` field on segments is already optional

## Benefits

1. **Traceability**: Track which file and model generated each itinerary
2. **Cost Analysis**: Monitor LLM usage and costs per import
3. **Performance Metrics**: Track processing times for optimization
4. **Audit Trail**: Know when and how segments were created
5. **Debugging**: Easier to diagnose import issues with comprehensive metadata

## Example Usage

```typescript
import { DocumentImportService } from './services/document-import.service.js';

const service = new DocumentImportService(config);

const result = await service.import('./trip.pdf', {
  model: 'anthropic/claude-3-haiku',
  saveToStorage: true,
});

if (result.success) {
  const { parsedItinerary } = result.value;

  // Access itinerary metadata
  console.log(parsedItinerary.metadata.importSource.filename);
  console.log(parsedItinerary.metadata.importSource.processingTimeMs);
  console.log(parsedItinerary.metadata.llmUsage.totalCost);

  // Access segment metadata
  console.log(parsedItinerary.segments[0].sourceDetails?.model);
  console.log(parsedItinerary.segments[0].sourceDetails?.timestamp);
}
```

## Testing

### Verification Steps

1. Build the project: `npm run build`
2. Import a PDF using the CLI: `npm run cli import file <pdf-path>`
3. Check the generated JSON file in `data/itineraries/`
4. Verify metadata fields are present

### Expected Output Structure

```json
{
  "id": "...",
  "title": "...",
  "metadata": {
    "importSource": {
      "filename": "trip-itinerary.pdf",
      "importedAt": "2025-12-18T22:30:45.123Z",
      "model": "anthropic/claude-3-haiku",
      "processingTimeMs": 3421
    },
    "llmUsage": {
      "promptTokens": 2341,
      "completionTokens": 1523,
      "totalCost": 0.0023
    }
  },
  "segments": [
    {
      "id": "...",
      "type": "FLIGHT",
      "source": "import",
      "sourceDetails": {
        "model": "anthropic/claude-3-haiku",
        "timestamp": "2025-12-18T22:30:45.123Z"
      },
      ...
    }
  ]
}
```

## Backward Compatibility

- Existing itinerary files continue to work (metadata is optional)
- Existing imports without metadata are still valid
- No schema migrations required
- No breaking changes to existing APIs

## Files Modified

- `/Users/masa/Projects/itinerator/src/services/document-import.service.ts`

## LOC Delta

- **Added**: ~65 lines (method + enhancements)
- **Modified**: ~20 lines (timing, method calls)
- **Net Change**: +85 lines

---

**Implementation Date**: 2025-12-18
**Status**: ✓ Complete and tested
