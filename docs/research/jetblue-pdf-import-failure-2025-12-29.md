# JetBlue PDF Import Failure Investigation

**Date:** 2025-12-29
**Issue:** PDF parsing returns "no segments found" for JetBlue flight confirmation
**PDF File:** `~/Downloads/JetBlue - Print confirmation.pdf`

## Summary

The PDF import failed to extract flight segments from a JetBlue confirmation PDF despite the PDF containing clear flight information. The investigation reveals there are TWO separate import systems in the codebase with different architectures.

## PDF Content Analysis

### Successfully Extracted Text

The PDF contains all necessary flight information:

```
JOAN DINOWITZ's Trip Confirmation
Confirmation code: KDNZEJ

Flight summary:
- New York, NY (JFK) → St. Maarten (SXM)
- Thursday, January 8, 2026 - Thursday, January 15, 2026
- Roundtrip, 2 ADULTS

Flight 1 (Outbound):
- B6 887, Seat: 2C
- Departure: JFK Thu, Jan 8, 2026 11:18am
- Arrival: SXM Thu, Jan 8, 2026 4:21pm
- Aircraft: A321
- eTicket: 2792199366187

Flight 2 (Return):
- B6 788, Seat: 11A
- Departure: SXM Thu, Jan 15, 2026 3:43pm
- Arrival: JFK Thu, Jan 15, 2026 7:18pm
- Aircraft: A321
- eTicket: 2792199366187

Passenger 2: ROBERT MATSUOKA (similar details)
```

**Key Data Points Present:**
- ✅ Confirmation code (KDNZEJ)
- ✅ Flight numbers (B6 887, B6 788)
- ✅ Airport codes (JFK, SXM)
- ✅ Dates (Jan 8, 2026, Jan 15, 2026)
- ✅ Times (11:18am, 4:21pm, 3:43pm, 7:18pm)
- ✅ Passenger names
- ✅ Seat assignments
- ✅ eTicket numbers

## Import System Architecture

### Two Separate Import Systems

The codebase has **two different import services** with different purposes:

#### 1. DocumentImportService (Legacy CLI)
**Location:** `src/services/document-import.service.ts`
**Purpose:** Full PDF itinerary import for CLI
**Flow:**
```
PDF File
  → PDFExtractorService (pdf-parse)
  → MarkdownConverterService
  → LLMService (OpenRouter)
  → Full Itinerary Schema
```

**Issues:**
- Uses old import config system (`YamlConfigStorage`)
- API connection test failing
- Designed for complete PDF itinerary documents, not confirmation emails

#### 2. ImportService (Unified Web API)
**Location:** `src/services/import/index.ts`
**Purpose:** Unified import for web API (email, PDF, text, etc.)
**Flow:**
```
Import Request
  → FormatDetector
  → ParserRegistry.get(format)
  → PDFParser (for PDFs)
      → pdf-parse.default(buffer)
      → LLMExtractor.extract(text)
      → Segment[] extraction
```

**Key Components:**
- `PDFParser` (`src/services/import/parsers/pdf.parser.ts`)
- `LLMExtractor` (`src/services/import/extractors/llm.extractor.ts`)
- Modern architecture with format auto-detection

## Root Cause Analysis

### Current Findings

1. **PDF Text Extraction Working:** The PDF is successfully parsed by `pdf-parse` and text is extracted

2. **Two Separate Implementations:**
   - Old `DocumentImportService` is for CLI and expects full itineraries
   - New `ImportService` is for web API and handles individual bookings
   - They use different prompts and validation schemas

3. **LLM Extraction Prompt (ImportService):**
```typescript
const EXTRACTION_PROMPT = `You are an expert at extracting travel booking details...
Extract ALL booking information and return structured JSON matching the segment schema.

Common document types:
- Flight confirmations (airlines, booking sites)
- Hotel confirmations
- Activity bookings
...
```

### Potential Issues

1. **LLM Response Not Validated:**
   - The LLM might be returning valid JSON but with no segments
   - Validation happens in `validateAndConvertSegments()` but console.warns are not visible
   - Segments could be filtered out due to validation failures

2. **Date Format Issues:**
   - Prompt requires ISO 8601 format
   - PDF has dates like "Thu, Jan 8, 2026" and times like "11:18am"
   - LLM must convert these correctly

3. **Missing Flight Number Context:**
   - The PDF shows "B6 887" as flight number
   - LLM needs to recognize "B6" as JetBlue airline code

## Investigation Steps Attempted

1. ✅ Read PDF file - Successfully extracted text
2. ✅ Read import service code - Found TWO separate services
3. ✅ Read PDF parser - Uses pdf-parse correctly
4. ✅ Read LLM extractor - Found validation logic
5. ❌ Test actual import - CLI API connection failing (different system)
6. ⏸️ Need to test web API import system

## Next Steps Required

### 1. Test the Web API Import System

Create a test that uses the actual `ImportService` (not `DocumentImportService`):

```typescript
import { ImportService } from './src/services/import/index.js';
import { readFileSync } from 'fs';

const apiKey = process.env.OPENROUTER_API_KEY;
const importService = new ImportService({ apiKey });

const pdfBuffer = readFileSync('~/Downloads/JetBlue - Print confirmation.pdf');
const result = await importService.importFromUpload(
  pdfBuffer,
  'JetBlue - Print confirmation.pdf',
  'application/pdf'
);

console.log('Result:', JSON.stringify(result, null, 2));
```

### 2. Add Debug Logging to LLM Extractor

Add logging to see:
- What text is sent to the LLM
- What JSON the LLM returns
- Which segments fail validation and why

```typescript
// In llm.extractor.ts validateAndConvertSegments()
console.log('LLM returned segments:', segments);
segments.forEach((seg, i) => {
  console.log(`Validating segment ${i}:`, seg);
});
```

### 3. Test with Direct LLM Call

Make a direct OpenRouter call with the PDF text to see raw LLM response:

```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
    "model": "anthropic/claude-3.5-haiku",
    "messages": [{
      "role": "system",
      "content": "Extract flight booking details..."
    }, {
      "role": "user",
      "content": "<PDF_TEXT_HERE>"
    }],
    "response_format": {"type": "json_object"}
  }'
```

### 4. Check Segment Validation

The validation in `validateAndConvertSegments()` silently filters out invalid segments:

```typescript
.filter((s): s is ExtractedSegment => s !== null);
```

Need to check:
- Are segments being created but failing validation?
- What specific validation is failing?
- Are date conversions working?

### 5. Review Prompt Engineering

The extraction prompt might need enhancement for confirmation emails vs. full itineraries:
- Add explicit examples for JetBlue format
- Specify how to handle roundtrip flights
- Clarify eTicket vs. confirmation number

## Recommendations

### Immediate Actions

1. **Enable verbose logging** in `LLMExtractor.validateAndConvertSegments()` to see why segments are being filtered
2. **Test the web API `ImportService`** directly (not the CLI `DocumentImportService`)
3. **Capture and inspect the raw LLM response** to see what JSON structure is being returned

### Long-Term Improvements

1. **Consolidate import systems:** Two separate import services is confusing and error-prone
2. **Better error reporting:** Don't silently filter out invalid segments - return validation errors
3. **Add integration tests:** Test actual airline confirmation formats (JetBlue, United, Delta, etc.)
4. **Enhance prompts:** Add airline-specific examples and edge cases

## Files Analyzed

- ✅ `src/services/email-import.service.ts` - Email-based import (not PDF)
- ✅ `src/services/import/index.ts` - Unified import service
- ✅ `src/services/import/parsers/pdf.parser.ts` - PDF text extraction
- ✅ `src/services/import/extractors/llm.extractor.ts` - LLM segment extraction
- ✅ `src/services/import/types.ts` - Import type definitions
- ✅ `src/services/document-import.service.ts` - Legacy CLI import service
- ✅ `src/cli/commands/import/file.ts` - CLI import command

## **ROOT CAUSE IDENTIFIED** ✅

### The Bug

**File:** `src/services/import/parsers/pdf.parser.ts`
**Line:** 40
**Issue:** Incorrect CommonJS/ESM import usage

```typescript
// WRONG (current code):
import * as pdfParse from 'pdf-parse';
...
const data = await pdfParse(buffer);  // ❌ ERROR: pdfParse is not a function

// CORRECT (should be):
import * as pdfParse from 'pdf-parse';
...
const data = await pdfParse.default(buffer);  // ✅ OR use default import
```

**Error Message:** `"(0 , __vite_ssr_import_0__) is not a function"`

### Why This Happens

The `pdf-parse` package is a CommonJS module with a default export. When imported as a namespace (`import * as`), you must access the default export via `.default`. The current code attempts to call the namespace object as a function, which fails.

### The Fix

**Option 1: Use .default (minimal change)**
```typescript
// Line 40
const data = await pdfParse.default(buffer);
```

**Option 2: Change import to default (cleaner)**
```typescript
// Line 6
import pdfParse from 'pdf-parse';

// Line 40 stays the same
const data = await pdfParse(buffer);
```

### Verification

Tested via web API `/api/v1/import/upload` endpoint:

```bash
curl -X POST http://localhost:5176/api/v1/import/upload \
  -F "file=@~/Downloads/JetBlue - Print confirmation.pdf" \
  -H "Cookie: itinerator_session=authenticated"
```

**Result:** Error occurred before LLM was even called, proving the bug is in PDF parsing, not LLM extraction.

## Impact

**Severity:** HIGH
**Affected:** ALL PDF imports via the web API
**User Impact:** No PDF confirmations can be imported at all

The LLM extraction code is likely working fine - we never reached it because pdf-parse throws an error first.

## Conclusion

The issue is a simple CommonJS/ESM import bug in the PDF parser. The PDF text extraction never ran, so the LLM never received the flight data. Once this bug is fixed, the rest of the import pipeline should work correctly (assuming no other issues exist downstream).
