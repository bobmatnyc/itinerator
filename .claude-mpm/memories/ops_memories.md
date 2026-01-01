# Agent Memory: ops
<!-- Last Updated: 2025-12-22T00:00:00.000000+00:00Z -->

## Unified SvelteKit Architecture

This project has **two interfaces** sharing the same core library:

### Web Application (SvelteKit)
- **Local**: SvelteKit dev server on port 5176 (frontend + API routes)
- **Production**: Vercel (frontend + API routes)
- **API Routes**: `/api/v1/*` served by SvelteKit
- **Storage**: JSON files (local) or Vercel Blob (production)

### CLI (TypeScript)
- **Direct imports**: Uses `src/` library without HTTP
- **Storage**: JSON files in `./data/` directory
- **Build**: `npm run build` → `dist/index.js`
- **Usage**: `npx itinerator [command]`

| Mode | API Server | Frontend | Storage | Vector DB |
|------|------------|----------|---------|-----------|
| **Local** | SvelteKit routes (:5176) | SvelteKit (:5176) | JSON files | Vectra |
| **Vercel** | SvelteKit routes | SvelteKit | Blob | Disabled |
| **CLI** | No HTTP (direct imports) | N/A | JSON files | Vectra |

**No Express server** - all HTTP API routes are handled by SvelteKit at `/api/v1/*`.

## Local Development

### Default Port
- **SvelteKit (Frontend + API)**: `5176`

### Start Commands
```bash
# Single server for frontend AND API
cd viewer-svelte && npm run dev

# Alternative from root
npm run viewer
```

### Config Files
| File | Purpose |
|------|---------|
| `viewer-svelte/vite.config.ts` | SvelteKit port (5176) |
| `viewer-svelte/.env` | OpenRouter API key, local config |
| `viewer-svelte/src/lib/api.ts` | API client (uses relative paths) |
| `.itinerator/config.yaml` | CLI-only config (not used by web) |

### API Key Loading

**Web Application**:
- User provides OpenRouter API key in browser (stored in localStorage)
- API key passed from client to server on each request
- No server-side API key storage required

**CLI**:
1. `.itinerator/config.yaml` → `openrouter.apiKey`
2. `OPENROUTER_API_KEY` environment variable
3. If neither: CLI features disabled

### Local Storage Paths
```
data/
├── itineraries/    # JSON itinerary files
├── uploads/        # Uploaded PDFs/documents
├── imports/        # Import cost logs
└── vectra/         # Vector database
```

## Vercel Production Deployment

### Deployment Path
```
viewer-svelte/  →  Vercel (automatic via GitHub)
```

### Required Environment Variables (Vercel Dashboard)
| Variable | Required | Purpose |
|----------|----------|---------|
| `BLOB_READ_WRITE_TOKEN` | **Yes** | Vercel Blob storage access |
| `OPENROUTER_API_KEY` | For AI | Trip Designer, Import |
| `SERPAPI_KEY` | For search | Travel Agent web search |

### Vercel Blob Storage

**Automatic Detection**: Storage type auto-selected based on `BLOB_READ_WRITE_TOKEN`:
```typescript
if (process.env.BLOB_READ_WRITE_TOKEN) {
  return new BlobItineraryStorage();  // Cloud
}
return new JsonItineraryStorage();    // Filesystem
```

**Blob Key Pattern**: `itineraries/{uuid}.json`

**Update Behavior**: Blob updates require delete-then-put:
```typescript
// 1. Check if exists
const existing = await head(key);
if (existing) {
  await del(existing.url);  // Delete first
}
// 2. Put new content
await put(key, data, { addRandomSuffix: false });
```

### Services Initialization (hooks.server.ts)

Services are conditionally loaded in SvelteKit hooks:

| Service | Vercel | Condition |
|---------|--------|-----------|
| ItineraryService | Yes | Always |
| SegmentService | Yes | Always |
| ImportService | Conditional | OPENROUTER_API_KEY |
| TripDesignerService | Conditional | OPENROUTER_API_KEY |
| TravelAgentService | Conditional | SERPAPI_KEY |
| TravelAgentFacade | Yes | Always (wraps optional) |
| KnowledgeService | **No** | Requires filesystem |

**Dynamic Imports**: Optional services use dynamic imports to avoid bundling issues:
```typescript
if (apiKey) {
  const { ServiceClass } = await import('./service.js');
  service = new ServiceClass(config);
}
```

### API Routes (SvelteKit)

All routes are under `/api/v1/*` in both local and production:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/itineraries` | List itineraries (filtered by userId) |
| `GET /api/v1/itineraries/[id]` | Get single itinerary |
| `POST /api/v1/itineraries` | Create itinerary |
| `PUT /api/v1/itineraries/[id]` | Update itinerary |
| `DELETE /api/v1/itineraries/[id]` | Delete itinerary |
| `POST /api/v1/designer/sessions` | Create Trip Designer session |
| `POST /api/v1/designer/sessions/[id]/messages` | Send message to session |
| `GET /api/v1/designer/sessions/[id]/messages/stream` | Stream session messages (SSE) |

### Debugging Vercel

1. **Check Vercel Logs**: Dashboard → Functions → View logs
2. **Service init errors**: Look for "❌ Service initialization failed"
3. **Blob errors**: Check BLOB_READ_WRITE_TOKEN is set
4. **API 500s**: Check hooks.server.ts error handling

## CLI Architecture

The CLI uses the **core library directly** without HTTP requests:

```typescript
// CLI imports services directly from src/
import { ItineraryService } from '../services/index.js';
import { createItineraryStorage } from '../storage/index.js';

// No HTTP - direct function calls
const storage = createItineraryStorage();
const service = new ItineraryService(storage);
const result = await service.getItineraries();
```

### Build CLI
```bash
npm run build                    # tsup → dist/index.js
npm run typecheck               # Verify types
```

### NPM Publish (Not Yet Published)
```bash
npm version patch|minor|major    # Bump version
npm publish                       # Publish to npm
```

## Schema Normalization

LLM outputs are automatically normalized during import.

**Manual Normalization**:
```bash
npx tsx scripts/normalize-existing.ts
```

**Validation**:
```bash
npx tsx scripts/validate-itineraries.ts
```

## Troubleshooting

### Local API Returns 404
- Check if SvelteKit dev server is running on port 5176
- Verify API routes exist in `viewer-svelte/src/routes/api/v1/`
- Check browser console for CORS or network errors

### Vercel Blob Save Fails
- Verify `BLOB_READ_WRITE_TOKEN` in Vercel env vars
- Check for existing blob (requires delete before update)
- Look for "Blob save failed" in Vercel logs

### Import Disabled
- Check `.itinerator/config.yaml` for `openrouter.apiKey`
- Or set `OPENROUTER_API_KEY` environment variable

### SvelteKit 500 on API Routes
- Check `hooks.server.ts` for initialization errors
- Verify all required env vars are set
- Check dynamic import paths resolve correctly
