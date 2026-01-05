# Itinerator - Project Overview for AI Agents

A modern travel itinerary management system with CLI and web interfaces.

## Priority Legend

- 🔴 **Critical** - Core functionality, blocking issues
- 🟡 **Important** - Significant features, quality improvements
- 🟢 **Nice-to-have** - Enhancements, optimizations
- ⚪ **Backlog** - Future considerations

## Architecture Overview

```
itinerator/
├── src/                    # Core TypeScript library
│   ├── domain/             # Types, schemas, branded types
│   ├── services/           # Business logic services
│   └── storage/            # Storage backends (JSON, Blob)
├── viewer-svelte/          # SvelteKit full-stack application
│   ├── src/routes/         # Frontend pages (Svelte 5)
│   └── src/routes/api/v1/  # SvelteKit API routes
├── tests/
│   ├── unit/               # Unit tests (Vitest)
│   ├── integration/        # Integration tests
│   ├── e2e/                # End-to-end tests (🟡 Traveler personas)
│   └── eval/               # 🟡 Model evaluation suite
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

### Using Makefile (🔴 Preferred)

```bash
# Development
make dev                # Start SvelteKit dev server (frontend + API)
make build              # Build CLI and viewer

# Testing
make test               # Run all tests
make test-e2e           # Run E2E tests
make test-persona       # Run traveler persona tests
make test-eval          # Run model evaluation

# Quality
make lint               # Check code quality
make quality            # All quality checks (lint + typecheck)

# See all commands
make help
```

### Legacy npm scripts (still supported)

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
- **Vitest** - Testing framework
- **Biome** - Fast linting and formatting

## Environment Variables

| Variable | Purpose | Required | Priority |
|----------|---------|----------|----------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access | Production | 🔴 |
| `OPENROUTER_API_KEY` | LLM API access | For AI features | 🟡 |
| `SERPAPI_KEY` | Travel search | For Travel Agent | 🟢 |
| `VITE_API_URL` | Frontend API URL | Local dev only | ⚪ |

## Service Architecture

Services are conditionally initialized based on environment:

| Service | Local | Vercel | Requires | Priority |
|---------|-------|--------|----------|----------|
| ItineraryService | Yes | Yes | Storage | 🔴 |
| SegmentService | Yes | Yes | Storage | 🔴 |
| ImportService | Yes | Yes | OPENROUTER_API_KEY | 🟡 |
| TripDesignerService | Yes | Yes | OPENROUTER_API_KEY | 🟡 |
| TravelAgentService | Yes | Yes | SERPAPI_KEY | 🟢 |
| KnowledgeService | Yes | No | Filesystem | 🟢 |

## Recent Developments (Last 30 Days)

### 🟡 Trip Designer Tool Calling Improvements
- Enhanced flight booking workflow with explicit tool patterns
- Added few-shot examples for better tool usage
- Improved segment creation with proper auth handling
- Fixed session management and state persistence

### 🟡 E2E Testing Framework
- Traveler persona agents for realistic testing
- Three persona types: solo, couple, family
- Automated validation of itinerary quality
- Full API → Service → Data flow testing

**Run personas:**
```bash
make test-persona                    # All personas
npm run test:persona:solo            # Solo backpacker
npm run test:persona:couple          # Romantic couple
npm run test:persona:family          # Family with kids
```

### 🟡 Model Evaluation Suite
- Automated LLM performance comparison
- Metrics: quality, latency, cost, success rate
- Tool calling accuracy tracking
- Promptfoo integration for analysis

**Run evaluations:**
```bash
make test-eval                       # All evaluations
npm run eval:compare                 # Compare models
npm run eval:promptfoo:view          # View results dashboard
```

### 🔴 Agent Deployment Optimization
- Reduced from 44 → 12 actual agent files
- Improved memory system with 5 memory files
- Better configuration tracking in git

## Testing Strategy

### Unit Tests (🔴 Core)
```bash
make test-unit
```
- Service logic validation
- Schema parsing and validation
- Utility function testing

### Integration Tests (🟡 Important)
```bash
make test-integration
```
- Storage backend integration
- Service interaction testing
- API route validation

### E2E Tests (🟡 Important)
```bash
make test-e2e
```
- Full user flow testing
- Browser automation with Playwright
- API integration testing

### Persona Tests (🟡 Quality Assurance)
```bash
make test-persona
```
- Realistic user simulation
- Multi-turn conversation testing
- Quality validation with expectations

### Model Evaluation (🟢 Optimization)
```bash
make test-eval
```
- LLM performance benchmarking
- Cost and latency analysis
- Tool calling accuracy metrics

## Memory Integration

KuzuMemory is configured for intelligent context management.

### Available Commands:
- `kuzu-memory enhance <prompt>` - Enhance prompts with project context
- `kuzu-memory learn <content>` - Store learning from conversations
- `kuzu-memory recall <query>` - Query project memories
- `kuzu-memory stats` - View memory statistics

### Memory Files (🟡 Important)
- `.claude-mpm/memories/ops_memories.md` - Deployment and server config
- `.claude-mpm/memories/engineer_memories.md` - Code patterns and conventions
- `.claude-mpm/memories/qa_memories.md` - Testing patterns and workflows
- `.claude-mpm/memories/research_memories.md` - Architecture decisions
- `.claude-mpm/memories/agentic-coder-optimizer_memories.md` - Optimization patterns

## Development Guidelines

### 🔴 Critical Patterns

1. **Svelte 5 Stores**: Use `.svelte.ts` extension for runes compatibility
2. **API Routes**: All API routes in `viewer-svelte/src/routes/api/v1/`
3. **Storage**: All storage operations go through `ItineraryStorage` interface
4. **Validation**: Use Zod schemas for all data validation
5. **Error Handling**: Use Result types (`ok`/`err`) for error propagation

### 🟡 Important Patterns

6. **CLI vs Web**: CLI uses core library directly; web goes through SvelteKit API routes
7. **Type Safety**: 100% TypeScript strict mode, branded types for IDs
8. **Testing**: Minimum 90% coverage for core services
9. **Tool Calling**: Follow explicit patterns with few-shot examples

### 🟢 Best Practices

10. **Code Quality**: Use Biome for linting and formatting (`make lint-fix`)
11. **Commits**: Conventional commits format (feat/fix/docs/refactor/perf/test/chore)
12. **File Size**: Keep files under 800 lines, extract at 600 lines
13. **Documentation**: Document WHY, not WHAT (code shows what)

## AI Agent Roles

### Engineer
- Implements features following TypeScript/Svelte patterns
- Maintains type safety and test coverage
- Uses `engineer_memories.md` for code conventions

### QA
- Writes and runs E2E tests with personas
- Validates itinerary quality and LLM outputs
- Uses `qa_memories.md` for testing patterns

### Ops
- Manages deployment to Vercel
- Configures environment variables and Blob storage
- Uses `ops_memories.md` for deployment procedures

### Research
- Analyzes LLM performance with evaluation suite
- Investigates architecture improvements
- Uses `research_memories.md` for findings

### Agentic Coder Optimizer
- Improves project discoverability and documentation
- Enforces "one way to do anything" principle
- Uses `agentic-coder-optimizer_memories.md` for patterns

## Common Tasks

### 🔴 Start Development
```bash
make dev                  # Preferred
# OR
cd viewer-svelte && npm run dev
```

### 🔴 Build for Production
```bash
make build                # Build CLI and viewer
```

### 🟡 Run All Tests
```bash
make test                 # All tests
make test-coverage        # With coverage report
```

### 🟡 Deploy to Vercel
```bash
make deploy               # Production
make deploy-preview       # Preview deployment
```

### 🟢 Quality Checks
```bash
make quality              # Lint + typecheck
make format               # Format code
```

## Troubleshooting

### 🔴 API Routes Return 404
- Check SvelteKit dev server is running on port 5176
- Verify routes exist in `viewer-svelte/src/routes/api/v1/`

### 🔴 Vercel Blob Save Fails
- Verify `BLOB_READ_WRITE_TOKEN` in Vercel env vars
- Check Vercel logs for initialization errors

### 🟡 Trip Designer/Import Disabled
- Check `OPENROUTER_API_KEY` is set (web: `.env`, CLI: `config.yaml`)
- Run `npx itinerator setup` for CLI

### 🟢 Tests Failing
- Run `make clean` to remove build artifacts
- Ensure dependencies are up-to-date: `make install`
- Check specific test type: `make test-unit` vs `make test-e2e`

## Documentation Hierarchy

1. **README.md** - User-facing quick start and features
2. **CLAUDE.md** (this file) - AI agent instructions
3. **CODE.md** - Coding standards and patterns (coming soon)
4. **DEVELOPER.md** - Comprehensive developer guide (coming soon)
5. **DEPLOY.md** - Deployment procedures (coming soon)
6. **STRUCTURE.md** - Detailed project structure (coming soon)

## Agent Memories

Detailed operational procedures and patterns are stored in:

| Memory File | Purpose | Priority |
|-------------|---------|----------|
| `ops_memories.md` | Deployment and server configuration | 🔴 |
| `engineer_memories.md` | Code patterns and conventions | 🟡 |
| `qa_memories.md` | Testing patterns and E2E workflows | 🟡 |
| `research_memories.md` | Architecture decisions and findings | 🟢 |
| `agentic-coder-optimizer_memories.md` | Project optimization patterns | 🟢 |

---

*For detailed deployment procedures, see ops agent memories.*
*For coding conventions, see engineer agent memories.*
*For testing workflows, see qa agent memories.*
