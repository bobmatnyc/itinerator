# Dual Storage Implementation

This document describes the dual storage backend implementation for Itinerator, which automatically switches between Vercel Blob (production) and filesystem (local development) based on environment configuration.

## Overview

The application supports two storage backends:

1. **Vercel Blob Storage** - Cloud storage for production deployments
2. **Filesystem Storage** - Local JSON files for development

The appropriate backend is automatically selected based on the presence of the `BLOB_READ_WRITE_TOKEN` environment variable.

## Architecture

### Storage Interface

All storage backends implement the `ItineraryStorage` interface:

```typescript
interface ItineraryStorage {
  initialize(): Promise<Result<void, StorageError>>;
  save(itinerary: Itinerary): Promise<Result<Itinerary, StorageError>>;
  load(id: ItineraryId): Promise<Result<Itinerary, StorageError>>;
  delete(id: ItineraryId): Promise<Result<void, StorageError>>;
  list(): Promise<Result<ItinerarySummary[], StorageError>>;
  exists(id: ItineraryId): Promise<boolean>;
}
```

### Storage Factory

The `createItineraryStorage()` factory function automatically selects the appropriate backend:

```typescript
import { createItineraryStorage } from './storage';

// Auto-detects based on environment
const storage = createItineraryStorage('./data/itineraries');
await storage.initialize();
```

**Selection Logic:**
- If `BLOB_READ_WRITE_TOKEN` is set → `BlobItineraryStorage`
- Otherwise → `JsonItineraryStorage`

## Implementations

### 1. Filesystem Storage (`JsonItineraryStorage`)

**File:** `src/storage/json-storage.ts`

**Features:**
- Stores itineraries as JSON files in a local directory
- Atomic writes using temporary files
- Automatic Date serialization/deserialization
- Zod schema validation on load

**Usage:**
```typescript
const storage = new JsonItineraryStorage('./data/itineraries');
await storage.initialize(); // Creates directory if needed
```

**Storage Pattern:**
```
data/itineraries/
  └── {itinerary-id}.json
```

### 2. Vercel Blob Storage (`BlobItineraryStorage`)

**File:** `src/storage/blob-storage.ts`

**Features:**
- Stores itineraries in Vercel Blob cloud storage
- Public access URLs for blob content
- Automatic Date serialization/deserialization
- Zod schema validation on load

**Requirements:**
- `BLOB_READ_WRITE_TOKEN` environment variable must be set
- Uses `@vercel/blob` package

**Usage:**
```typescript
// Requires BLOB_READ_WRITE_TOKEN environment variable
const storage = new BlobItineraryStorage();
await storage.initialize(); // No-op for blob storage
```

**Storage Pattern:**
```
itineraries/{itinerary-id}.json
```

**API Operations:**
- `put()` - Upload blob with JSON content
- `list()` - List all blobs with prefix
- `head()` - Check if blob exists and get metadata
- `del()` - Delete blob by URL
- `fetch()` - Download blob content

## Environment Configuration

### Local Development

No configuration needed. Storage automatically uses filesystem:

```bash
# No BLOB_READ_WRITE_TOKEN set
npm run dev
```

Itineraries are stored in `./data/itineraries/`

### Production (Vercel)

Set the environment variable in Vercel dashboard:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

Vercel automatically provides this token in production environments.

## SvelteKit Integration

The SvelteKit viewer uses the storage factory in `hooks.server.ts`:

```typescript
import { createItineraryStorage } from '$services/../storage/index.js';

// Auto-detects environment and creates appropriate storage
const storage = createItineraryStorage(itinerariesDir);
await storage.initialize();

// Use storage with services
const itineraryService = new ItineraryService(storage);
```

## Error Handling

Both storage backends return `Result<T, StorageError>` for operations that can fail:

```typescript
const result = await storage.load(id);

if (result.success) {
  const itinerary = result.value;
  console.log('Loaded:', itinerary.title);
} else {
  console.error('Error:', result.error.message);
  // result.error.code: 'NOT_FOUND' | 'READ_ERROR' | 'VALIDATION_ERROR'
}
```

**Error Codes:**
- `NOT_FOUND` - Itinerary doesn't exist
- `READ_ERROR` - Failed to read from storage
- `WRITE_ERROR` - Failed to write to storage
- `VALIDATION_ERROR` - Data doesn't match schema

## Data Format

Both backends store identical JSON structure:

```json
{
  "id": "uuid-v4",
  "title": "Trip to Paris",
  "status": "draft",
  "startDate": "2024-06-01T00:00:00.000Z",
  "endDate": "2024-06-07T23:59:59.999Z",
  "travelers": [...],
  "segments": [...],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T14:20:00.000Z",
  "version": 1
}
```

**Date Handling:**
- Dates are serialized as ISO 8601 strings
- Automatically revived as Date objects on load
- Pattern: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/`

## Testing

To test storage selection:

```typescript
// Test filesystem storage
delete process.env.BLOB_READ_WRITE_TOKEN;
const fsStorage = createItineraryStorage('./data/test');
console.log(fsStorage.constructor.name); // JsonItineraryStorage

// Test blob storage
process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
const blobStorage = createItineraryStorage();
console.log(blobStorage.constructor.name); // BlobItineraryStorage
```

## Migration

### From Filesystem to Vercel Blob

1. Set `BLOB_READ_WRITE_TOKEN` in Vercel
2. Deploy application
3. Use the CLI to re-import itineraries (if needed)

**Note:** No automatic migration tool exists yet. Consider implementing a migration script if you have many itineraries to move.

### From Vercel Blob to Filesystem

1. Download all blobs using the list API
2. Save JSON files to `./data/itineraries/`
3. Remove `BLOB_READ_WRITE_TOKEN`
4. Restart application

## Performance Considerations

### Filesystem Storage
- **Pros:** Fast local access, no API limits, offline-capable
- **Cons:** Not suitable for distributed deployments, requires persistent filesystem

### Vercel Blob Storage
- **Pros:** Scalable, distributed, no local storage needed
- **Cons:** Network latency, API rate limits, requires internet connection

## Future Enhancements

Potential improvements:

1. **Caching Layer** - Add in-memory cache for frequently accessed itineraries
2. **Migration Tool** - CLI command to migrate between backends
3. **Backup Strategy** - Automatic backups from Blob to filesystem
4. **Additional Backends** - Support for S3, Google Cloud Storage, etc.
5. **Compression** - Compress JSON before storing in Blob

## Troubleshooting

### "BLOB_READ_WRITE_TOKEN environment variable is required"

The `BlobItineraryStorage` constructor throws this error if the token is not set. This is intentional to fail fast in production if misconfigured.

**Solution:** Set the environment variable in Vercel dashboard or `.env` file.

### "Blob not found" errors

The blob storage may return 404 errors if:
- Itinerary was deleted
- Never existed
- Network issues

**Solution:** Check blob exists using `exists()` before loading.

### Schema validation errors

Both backends validate data with Zod schemas. Validation errors indicate:
- Corrupted data
- Schema mismatch (old data format)
- Manual file editing

**Solution:**
- Re-import data from source
- Update schema to handle legacy formats
- Fix JSON manually if possible

## Security

### Vercel Blob
- Token stored in environment variables (never committed)
- Blobs are public by default (set `access: 'public'`)
- Consider private blobs with signed URLs for sensitive data

### Filesystem
- Files stored with default filesystem permissions
- Consider encrypting sensitive itinerary data at rest
- Ensure proper file permissions in production

## Related Files

- `src/storage/storage.interface.ts` - Storage interface definition
- `src/storage/json-storage.ts` - Filesystem implementation
- `src/storage/blob-storage.ts` - Vercel Blob implementation
- `src/storage/index.ts` - Storage factory and exports
- `viewer-svelte/src/hooks.server.ts` - SvelteKit integration
