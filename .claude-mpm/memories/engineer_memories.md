# Agent Memory: engineer
<!-- Last Updated: 2026-01-04 -->

## TypeScript Patterns

### Branded Types for IDs
- All IDs use branded types to prevent mixing: `ItineraryId`, `SegmentId`, `SessionId`
- Example: `export type ItineraryId = string & { readonly __brand: 'ItineraryId' };`
- Create with factory: `createItineraryId(uuid)` or `createItineraryId()` for new

### Result Types for Error Handling
- All service methods return `Result<T, Error>` from `neverthrow` library
- Use `ok(value)` for success, `err(error)` for failure
- Chain with `.map()`, `.mapErr()`, `.andThen()` for error propagation
- Example: `return ok(itinerary)` or `return err(new Error('Not found'))`

### Zod Schema Validation
- All domain types have corresponding Zod schemas
- Schema naming: `ItinerarySchema`, `SegmentSchema`, `FlightSchema`
- Parse with `.safeParse()` for Result-like behavior
- Use `.parse()` only when validation failure is truly exceptional

### Storage Interface Pattern
- All storage backends implement `ItineraryStorage` interface
- Auto-select storage based on environment: `createItineraryStorage()`
- JSON for local (filesystem), Blob for Vercel (cloud)
- Never access storage directly - always through interface

## Svelte 5 Patterns

### Runes-Based Stores
- Use `.svelte.ts` extension for store files with runes
- State: `let count = $state(0)` instead of `writable(0)`
- Derived: `let doubled = $derived(count * 2)` instead of `derived()`
- Effects: `$effect(() => { ... })` instead of subscriptions

### API Client Pattern
- All API calls go through `lib/api.ts` client
- Use relative paths: `/api/v1/itineraries` (no host needed)
- Return `Result<T, Error>` from API functions
- Handle loading/error states in components

### Component Structure
- Props: `let { prop1, prop2 = defaultValue }: Props = $props()`
- Events: Use callbacks in props, not `createEventDispatcher`
- Slots: `{@render children?.()}`
- Bindings: `bind:value={localState}`

## Service Architecture

### Service Initialization (SvelteKit hooks.server.ts)
- Services initialized once in `hooks.server.ts`
- Stored in `event.locals` for request access
- Conditional loading with dynamic imports for optional services
- Pattern:
```typescript
if (apiKey) {
  const { ServiceClass } = await import('./service.js');
  locals.service = new ServiceClass(config);
}
```

### Trip Designer Service
- Uses streaming for real-time responses
- Tool calling with explicit patterns (flights, hotels, activities)
- Session-based conversation with state persistence
- Few-shot examples for better tool usage

### Import Service
- LLM-based extraction from PDFs, emails, ICS files
- Schema normalization after extraction
- Cost tracking per import operation
- Multi-document import support

## Testing Patterns

### Unit Tests (Vitest)
- Test files: `*.test.ts` in `tests/unit/`
- Use `describe()` and `it()` blocks
- Mock storage with `InMemoryItineraryStorage`
- Example:
```typescript
describe('ItineraryService', () => {
  it('should create itinerary', async () => {
    const storage = new InMemoryItineraryStorage();
    const service = new ItineraryService(storage);
    const result = await service.createItinerary(data);
    expect(result.isOk()).toBe(true);
  });
});
```

### E2E Tests (Playwright + Vitest)
- Test files: `*.e2e.test.ts` in `tests/e2e/`
- Use Playwright for browser automation
- Test full user flows: create → edit → view → delete
- Verify API responses and UI updates

### Traveler Persona Tests
- Located in `tests/e2e/traveler-persona-agent.ts`
- Three persona types: solo, couple, family
- Each persona has unique preferences and expectations
- Validates itinerary structure, segment count, quality

### Model Evaluation
- Located in `tests/eval/`
- Metrics: quality score, latency, cost, success rate
- Compare models: OpenAI, Anthropic, Google, Meta
- Tool calling accuracy tracking
- Promptfoo integration for analysis

## Common Code Patterns

### Creating a New Service
1. Define interface in `src/services/`
2. Implement with dependency injection (storage, config)
3. Return `Result<T, Error>` from all methods
4. Add to `hooks.server.ts` initialization
5. Add to service locals type in `app.d.ts`

### Adding API Route
1. Create route in `viewer-svelte/src/routes/api/v1/`
2. Export `POST`, `GET`, `PUT`, `DELETE` functions
3. Access services from `locals`: `const { itineraryService } = locals;`
4. Return JSON with proper status codes
5. Handle errors with try/catch and return error responses

### Schema Changes
1. Update Zod schema in `src/domain/schemas/`
2. Update TypeScript type in `src/domain/types/`
3. Add migration script if needed (in `scripts/`)
4. Run normalization: `npx tsx scripts/normalize-existing.ts`
5. Validate: `npx tsx scripts/validate-itineraries.ts`

## File Organization

### Keep Files Focused
- Maximum 800 lines per file (hard limit)
- Plan modularization at 600 lines
- Extract related code into separate modules
- Use clear, descriptive filenames

### Module Structure
```
src/
├── domain/           # Pure types and schemas (no dependencies)
├── services/         # Business logic (depends on domain + storage)
├── storage/          # Storage backends (implements interfaces)
├── cli/              # CLI-specific code (commands, prompts, output)
└── utils/            # Pure utility functions
```

### Naming Conventions
- Files: kebab-case (`itinerary-service.ts`)
- Classes: PascalCase (`ItineraryService`)
- Functions: camelCase (`createItinerary`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)
- Types: PascalCase (`Itinerary`, `SegmentType`)

## Build and Deploy

### CLI Build
- `npm run build` → tsup → `dist/index.js`
- Entry point: `src/index.ts`
- Bundle format: ESM
- External deps: none (all bundled)

### Viewer Build
- `cd viewer-svelte && npm run build` → SvelteKit → `.svelte-kit/`
- Adapter: `@sveltejs/adapter-vercel`
- Output: Serverless functions + static assets
- Environment: Auto-detects Vercel vs local

### Vercel Deployment
- Push to main → auto-deploy to production
- Preview: Push to any branch → preview deployment
- Environment variables: Set in Vercel dashboard
- Required: `BLOB_READ_WRITE_TOKEN` for storage

## Common Mistakes to Avoid

### Don't Mix Storage Types
❌ Don't: `new JsonItineraryStorage()` directly
✅ Do: `createItineraryStorage()` (auto-selects)

### Don't Throw Errors from Services
❌ Don't: `throw new Error('Not found')`
✅ Do: `return err(new Error('Not found'))`

### Don't Use Svelte 4 Patterns
❌ Don't: `writable()`, `derived()`, `createEventDispatcher()`
✅ Do: `$state()`, `$derived()`, callback props

### Don't Skip Schema Validation
❌ Don't: Accept raw JSON without validation
✅ Do: `schema.safeParse(data)` and handle errors

### Don't Access Storage Directly in Routes
❌ Don't: Import storage in API routes
✅ Do: Use services from `locals`

## Recent Changes (Last 30 Days)

### Trip Designer Tool Calling
- Added explicit flight booking workflow with tool patterns
- Implemented few-shot examples for better tool usage
- Fixed segment creation with proper auth handling
- Improved session management and state persistence

### Testing Infrastructure
- Added traveler persona agents for E2E testing
- Implemented model evaluation suite with metrics
- Added promptfoo integration for analysis
- Created three persona types: solo, couple, family

### Agent Deployment
- Optimized from 44 → 12 actual agent files
- Improved memory system with 5 memory files
- Better configuration tracking in git
