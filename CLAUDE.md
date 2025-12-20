# Itinerizer - Project Overview

A modern travel itinerary management system with CLI and web interfaces.

## Architecture Overview

```
itinerizer-ts/
├── src/                    # Core TypeScript library + Express API
│   ├── domain/             # Types, schemas, branded types
│   ├── services/           # Business logic services
│   ├── storage/            # Storage backends (JSON, Blob)
│   └── server/             # Express API (local development)
├── viewer-svelte/          # SvelteKit frontend (Vercel deployment)
│   └── src/routes/api/     # SvelteKit API routes (production)
└── dist/                   # CLI build output (tsup)
```

## Dual Deployment Model

This project has **two deployment targets** with shared business logic:

| Component | Local Development | Production (Vercel) |
|-----------|-------------------|---------------------|
| **Frontend** | `viewer-svelte` on port 5176 | SvelteKit on Vercel |
| **API** | Express on port 5177 | SvelteKit routes `/api/v1/*` |
| **Storage** | JSON files in `./data/` | Vercel Blob |
| **Vector DB** | Vectra (filesystem) | Disabled (no filesystem) |

### Storage Strategy

```typescript
// Auto-selects based on environment:
// - BLOB_READ_WRITE_TOKEN set → BlobItineraryStorage
// - Otherwise → JsonItineraryStorage (filesystem)
const storage = createItineraryStorage();
```

## Quick Start Commands

```bash
# Local Development (both servers)
npm run server          # API on :5177
cd viewer-svelte && npm run dev  # Frontend on :5176

# Build CLI
npm run build           # Creates dist/index.js

# Run CLI
npx itinerizer [command]
```

## Key Technologies

- **TypeScript 5.7** - Strict mode, branded types
- **Svelte 5** - Runes-based reactivity (.svelte.ts stores)
- **SvelteKit 2** - Vercel adapter, API routes
- **Express 5** - Local API server
- **Vercel Blob** - Cloud storage for itineraries
- **Vectra** - Local vector database (disabled on Vercel)
- **OpenRouter** - LLM API for Trip Designer
- **Zod** - Schema validation

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access | Production |
| `OPENROUTER_API_KEY` | LLM API access | For AI features |
| `SERPAPI_KEY` | Travel search | For Travel Agent |
| `VITE_API_URL` | Frontend API URL | Local dev only |

## Service Architecture

Services are conditionally initialized based on environment:

| Service | Local | Vercel | Requires |
|---------|-------|--------|----------|
| ItineraryService | Yes | Yes | Storage |
| SegmentService | Yes | Yes | Storage |
| ImportService | Yes | Yes | OPENROUTER_API_KEY |
| TripDesignerService | Yes | Yes | OPENROUTER_API_KEY |
| TravelAgentService | Yes | Yes | SERPAPI_KEY |
| KnowledgeService | Yes | No | Filesystem |

## Memory Integration

KuzuMemory is configured for intelligent context management.

### Available Commands:
- `kuzu-memory enhance <prompt>` - Enhance prompts with project context
- `kuzu-memory learn <content>` - Store learning from conversations
- `kuzu-memory recall <query>` - Query project memories
- `kuzu-memory stats` - View memory statistics

## Development Guidelines

1. **Svelte 5 Stores**: Use `.svelte.ts` extension for runes compatibility
2. **API Routes**: Duplicate changes in both Express and SvelteKit routes
3. **Storage**: All storage operations go through `ItineraryStorage` interface
4. **Validation**: Use Zod schemas for all data validation
5. **Error Handling**: Use Result types (`ok`/`err`) for error propagation

## Agent Memories

Detailed operational procedures are stored in:
- `.claude-mpm/memories/ops_memories.md` - Deployment and server configuration
- `.claude-mpm/memories/engineer_memories.md` - Code patterns and conventions

---

*See ops agent memories for detailed deployment procedures.*
