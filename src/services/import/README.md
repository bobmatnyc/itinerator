# Unified Import Service

Modular import system with auto-format detection and multiple entry points.

## Architecture

```
src/services/import/
├── index.ts              # Main ImportService export
├── types.ts              # Shared types
├── format-detector.ts    # Auto-detect format
├── parsers/
│   ├── index.ts          # Parser registry
│   ├── pdf.parser.ts     # PDF extraction
│   ├── email.parser.ts   # Email with Schema.org + LLM fallback
│   ├── ics.parser.ts     # iCalendar/ICS files
│   ├── text.parser.ts    # Plain text with LLM
│   └── json.parser.ts    # Direct JSON validation
├── extractors/
│   ├── llm.extractor.ts  # LLM-based extraction (Claude)
│   └── schema-org.extractor.ts  # Schema.org JSON-LD extraction
└── utils/
    └── html-to-text.ts   # HTML stripping utility
```

## Features

### Auto-Format Detection

The service automatically detects format from:
- **MIME type** (`application/pdf`, `text/calendar`, etc.)
- **File extension** (`.pdf`, `.ics`, `.json`, etc.)
- **Content inspection** (magic bytes, JSON structure, ICS headers)

### Supported Formats

| Format | Parser | Strategy |
|--------|--------|----------|
| **PDF** | PDFParser | Extract text → LLM extraction |
| **Email/HTML** | EmailParser | Schema.org (free) → LLM fallback |
| **ICS** | ICSParser | Native parsing → segment conversion |
| **Text** | TextParser | Direct LLM extraction |
| **JSON** | JSONParser | Zod schema validation |

### Extractors

**Schema.org Extractor** (free, instant):
- Extracts JSON-LD structured data from HTML
- Handles: FlightReservation, LodgingReservation, EventReservation, etc.
- High confidence (0.95) for structured data

**LLM Extractor** (requires API key):
- Uses Claude 3.5 Haiku via OpenRouter
- Handles unstructured text
- Variable confidence based on data clarity

## Usage

### Basic Import

```typescript
import { ImportService } from './services/import';

const importService = new ImportService({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Auto-detect and import
const result = await importService.import({
  source: 'upload',
  content: buffer,
  filename: 'booking.pdf',
  mimeType: 'application/pdf',
});

if (result.success) {
  console.log(`Found ${result.segments.length} bookings`);
  console.log(`Confidence: ${result.confidence}`);
}
```

### Entry Points

```typescript
// From file upload
const result = await importService.importFromUpload(
  buffer,
  'confirmation.pdf',
  'application/pdf'
);

// From email
const result = await importService.importFromEmail(htmlContent, {
  fromEmail: 'booking@airline.com',
  subject: 'Flight Confirmation',
  receivedAt: new Date().toISOString(),
});

// From plain text
const result = await importService.importFromText(
  'Flight AA123 from JFK to LAX on 2024-01-15...'
);

// From URL
const result = await importService.importFromUrl(
  'https://example.com/booking.pdf'
);
```

### Import Result

```typescript
interface ImportResult {
  success: boolean;
  format: ImportFormat;
  segments: ExtractedSegment[];
  confidence: number;      // 0-1
  summary?: string;
  rawText?: string;        // For debugging
  errors?: string[];
}

interface ExtractedSegment extends Segment {
  confidence: number;      // Per-segment confidence
}
```

## API Routes

### POST /api/v1/import/upload

Upload file and extract bookings.

**Request:**
```bash
curl -X POST \
  -F "file=@booking.pdf" \
  http://localhost:5176/api/v1/import/upload
```

**Response:**
```json
{
  "success": true,
  "format": "pdf",
  "segments": [...],
  "confidence": 0.85,
  "summary": "Found 2 booking(s) from PDF"
}
```

### POST /api/v1/import/email

Webhook for inbound.new email service.

**Request:**
```json
{
  "event": "email.received",
  "email": {
    "parsedData": {
      "from": { "address": "user@example.com" },
      "subject": "Flight Confirmation",
      "htmlBody": "<html>...</html>",
      "textBody": "..."
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "segmentsFound": 1,
  "confidence": 0.95,
  "summary": "Found 1 booking from Schema.org data",
  "addedToItinerary": "itin_123"
}
```

### POST /api/v1/import/text

Extract bookings from plain text.

**Request:**
```json
{
  "text": "Flight confirmation AA123...",
  "apiKey": "sk-or-...",
  "itineraryId": "itin_123"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "segments": [...],
  "confidence": 0.8,
  "summary": "Found 1 booking",
  "addedToItinerary": "itin_123",
  "addedSegmentIds": ["seg_456"]
}
```

## Parser Details

### PDF Parser

1. Extract text with `pdf-parse`
2. Pass to LLM extractor
3. Return structured segments

**Dependencies:** `pdf-parse`

### Email Parser

1. Try Schema.org JSON-LD extraction (free, instant)
2. If found, return with high confidence
3. Otherwise, convert HTML to text
4. Pass to LLM extractor

**Benefits:** Free for emails with structured data (most major travel providers)

### ICS Parser

1. Parse ICS with `node-ical`
2. Filter VEVENT entries
3. Guess segment type from summary/description
4. Convert to appropriate segment type

**Dependencies:** `node-ical`

### Text Parser

Direct LLM extraction for plain text.

### JSON Parser

Validate against Zod segment schema. Perfect confidence (1.0) for valid JSON.

## Extending the System

### Add New Parser

```typescript
import type { IParser, ImportRequest, ImportResult } from '../types';

export class MyParser implements IParser {
  supportedFormats = ['myformat'];

  async parse(request: ImportRequest): Promise<ImportResult> {
    // Parse content
    // Extract segments
    return {
      success: true,
      format: 'myformat',
      segments: [...],
      confidence: 0.9,
    };
  }
}
```

Register in `parsers/index.ts`:
```typescript
this.registerParser(new MyParser());
```

### Add New Extractor

Implement extraction logic for specific data sources (e.g., SABRE GDS, Amadeus API).

## Testing

```bash
# Unit tests
npm run test:unit src/services/import

# Integration tests
npm run test:integration -- import

# E2E tests
npm run test:e2e -- import
```

## Performance

| Format | Avg Time | Cost |
|--------|----------|------|
| Schema.org | <100ms | Free |
| PDF (LLM) | 2-5s | ~$0.001 |
| Email (LLM) | 1-3s | ~$0.001 |
| Text (LLM) | 1-2s | ~$0.001 |
| ICS | <500ms | Free |
| JSON | <50ms | Free |

## Error Handling

All parsers return consistent `ImportResult` objects:
- `success: false` with `errors` array
- Never throw exceptions
- Fallback to text parser for unknown formats
- Graceful degradation (Schema.org → LLM)

## Dependencies

**Required:**
- `openai` - LLM extraction via OpenRouter
- `pdf-parse` - PDF text extraction
- `node-ical` - ICS parsing
- `zod` - JSON schema validation

**Optional:**
- `jsdom` - Advanced HTML parsing (already in dependencies)

## Environment Variables

```bash
OPENROUTER_API_KEY=sk-or-...  # Required for LLM extraction
```

## Migration from Old Import Service

The old `import.service.ts` and `email-import.service.ts` are superseded by this unified service.

**Before:**
```typescript
const emailService = new EmailImportService({ apiKey });
const result = await emailService.extractBookings(email);
```

**After:**
```typescript
const importService = new ImportService({ apiKey });
const result = await importService.importFromEmail(content, metadata);
```

API routes have been updated to use the new service transparently.

## Future Enhancements

- [ ] Add DOCX parser for Word documents
- [ ] Add image OCR support for screenshots
- [ ] Add batch import for multiple files
- [ ] Add confidence threshold filtering
- [ ] Add segment deduplication
- [ ] Add attachment handling in email parser
- [ ] Add URL scraping for booking sites
