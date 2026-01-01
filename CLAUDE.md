# Itinerator - Project Overview

A modern travel itinerary management system with CLI and web interfaces.

## Architecture Overview

```
itinerator/
├── src/                    # Core TypeScript library
│   ├── domain/             # Types, schemas, branded types
│   ├── services/           # Business logic services
│   └── storage/            # Storage backends (JSON, Blob)
├── viewer-svelte/          # SvelteKit full-stack application
│   └── src/routes/api/     # SvelteKit API routes
└── dist/                   # CLI build output (tsup)
```

## Deployment Model

This project uses **SvelteKit for both frontend and API** with shared business logic:

| Component | Local Development | Production (Vercel) |
|-----------|-------------------|---------------------|
| **Frontend** | SvelteKit on port 5176 | SvelteKit on Vercel |
| **API** | SvelteKit routes `/api/v1/*` | SvelteKit routes `/api/v1/*` |
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
# Local Development
cd viewer-svelte && npm run dev  # Frontend + API on :5176

# Build CLI
npm run build           # Creates dist/index.js

# Run CLI
npx itinerator [command]
```

## Key Technologies

- **TypeScript 5.7** - Strict mode, branded types
- **Svelte 5** - Runes-based reactivity (.svelte.ts stores)
- **SvelteKit 2** - Full-stack framework with Vercel adapter
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
2. **API Routes**: All API routes in `viewer-svelte/src/routes/api/v1/`
3. **Storage**: All storage operations go through `ItineraryStorage` interface
4. **Validation**: Use Zod schemas for all data validation
5. **Error Handling**: Use Result types (`ok`/`err`) for error propagation
6. **CLI vs Web**: CLI uses core library directly; web goes through SvelteKit API routes

## Agent Memories

Detailed operational procedures are stored in:
- `.claude-mpm/memories/ops_memories.md` - Deployment and server configuration
- `.claude-mpm/memories/engineer_memories.md` - Code patterns and conventions

---

*See ops agent memories for detailed deployment procedures.*
