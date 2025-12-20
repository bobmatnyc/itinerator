# Agent Memory: ops
<!-- Last Updated: 2025-12-20T21:15:00.000000+00:00Z -->

## Dual Deployment Architecture

This project has **two parallel deployment targets**:

| Mode | API Server | Frontend | Storage | Vector DB |
|------|------------|----------|---------|-----------|
| **Local** | Express (:5177) | Vite (:5176) | JSON files | Vectra |
| **Vercel** | SvelteKit routes | SvelteKit | Blob | Disabled |

## Local Development

### Default Ports
- **Frontend (Svelte)**: `5176`
- **API (Express)**: `5177`

### Start Commands
```bash
# Terminal 1: API Server
npx tsx src/server/index.ts

# Terminal 2: Frontend
cd viewer-svelte && npm run dev

# Or use concurrently (if configured)
npm run viewer
```

### Config Files
| File | Purpose |
|------|---------|
| `viewer-svelte/vite.config.ts` | Frontend port (5176) |
| `viewer-svelte/.env` | `VITE_API_URL=http://localhost:5177` |
| `viewer-svelte/src/lib/api.ts` | API URL default |
| `.itinerizer/config.yaml` | API keys (OpenRouter, SerpAPI) |
| `src/server/index.ts` | Express API entry point |

### API Key Loading Priority
1. `.itinerizer/config.yaml` → `openrouter.apiKey`
2. `OPENROUTER_API_KEY` environment variable
3. If neither: Server runs read-only (import disabled)

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

### API Route Mapping

| Express (Local) | SvelteKit (Vercel) |
|-----------------|-------------------|
| `GET /api/health` | `GET /api/health` |
| `GET /api/itineraries` | `GET /api/v1/itineraries` |
| `POST /api/chat/sessions` | `POST /api/v1/designer/sessions` |
| `POST /api/import` | `POST /api/v1/import` |

### Debugging Vercel

1. **Check Vercel Logs**: Dashboard → Functions → View logs
2. **Service init errors**: Look for "❌ Service initialization failed"
3. **Blob errors**: Check BLOB_READ_WRITE_TOKEN is set
4. **API 500s**: Check hooks.server.ts error handling

## CLI Publishing (Future)

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
- Check if Express server is running on 5177
- Verify `VITE_API_URL` in `viewer-svelte/.env`

### Vercel Blob Save Fails
- Verify `BLOB_READ_WRITE_TOKEN` in Vercel env vars
- Check for existing blob (requires delete before update)
- Look for "Blob save failed" in Vercel logs

### Import Disabled
- Check `.itinerizer/config.yaml` for `openrouter.apiKey`
- Or set `OPENROUTER_API_KEY` environment variable

### SvelteKit 500 on API Routes
- Check `hooks.server.ts` for initialization errors
- Verify all required env vars are set
- Check dynamic import paths resolve correctly
