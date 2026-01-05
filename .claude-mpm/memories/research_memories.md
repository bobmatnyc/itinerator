# Agent Memory: research
<!-- Last Updated: 2026-01-04 -->

## Architecture Decisions

### Unified SvelteKit Architecture (Dec 2025)
**Decision**: Use SvelteKit for both frontend and API routes instead of separate Express server

**Rationale**:
- Single deployment unit (no separate API server)
- Shared TypeScript types between frontend and backend
- Better DX with SvelteKit's file-based routing
- Automatic API route generation and hot reloading
- Easier deployment to Vercel (serverless functions)

**Trade-offs**:
- ✅ Simpler deployment (one service vs two)
- ✅ Better type safety across client/server boundary
- ✅ No CORS configuration needed
- ❌ Tightly couples frontend and API (not RESTful microservice)
- ❌ CLI still needs core library (but that's expected)

**Outcome**: Significant improvement in DX and deployment simplicity. CLI uses core library directly, web uses SvelteKit API routes.

### Storage Abstraction (Nov 2025)
**Decision**: Abstract storage behind `ItineraryStorage` interface with auto-selection

**Rationale**:
- Support both local development (JSON files) and production (Vercel Blob)
- No code changes needed when switching environments
- Easy to add new storage backends (S3, PostgreSQL, etc.)

**Implementation**:
```typescript
export function createItineraryStorage(): ItineraryStorage {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return new BlobItineraryStorage();
  }
  return new JsonItineraryStorage();
}
```

**Outcome**: Seamless local-to-production workflow. Developers don't think about storage.

### Svelte 5 Runes Migration (Dec 2025)
**Decision**: Migrate from Svelte 4 stores to Svelte 5 runes

**Rationale**:
- Better reactivity model (fine-grained vs coarse-grained)
- Simpler mental model (direct value updates vs store methods)
- Better TypeScript inference
- Future-proof (Svelte 5 is the future)

**Migration Path**:
- Use `.svelte.ts` extension for store files
- Replace `writable()` with `$state()`
- Replace `derived()` with `$derived()`
- Replace `createEventDispatcher()` with callback props

**Outcome**: Cleaner code, better DX. Small learning curve but worth it.

### Branded Types for IDs (Oct 2025)
**Decision**: Use TypeScript branded types for all IDs

**Rationale**:
- Prevent mixing different ID types (ItineraryId vs SegmentId)
- Compile-time safety (not runtime)
- Zero runtime cost
- Self-documenting code

**Implementation**:
```typescript
export type ItineraryId = string & { readonly __brand: 'ItineraryId' };
export function createItineraryId(id?: string): ItineraryId {
  return (id ?? crypto.randomUUID()) as ItineraryId;
}
```

**Outcome**: Caught several bugs during migration. Strong recommendation for all projects.

## LLM Integration Research

### Tool Calling Patterns (Dec 2025)
**Finding**: Explicit tool patterns with few-shot examples significantly improve tool usage accuracy

**Research**:
- Tested OpenAI, Anthropic, Google, Meta models
- Measured tool calling accuracy before/after few-shot examples
- Results: 45% → 82% accuracy with examples

**Best Practices**:
1. Provide explicit tool schemas with descriptions
2. Include 2-3 few-shot examples per tool
3. Use structured output when possible
4. Validate tool arguments before execution

**Implementation**: Added to Trip Designer system prompt and tool definitions

### Model Evaluation Framework (Dec 2025)
**Finding**: Need multi-dimensional evaluation beyond just "quality"

**Metrics Developed**:
1. **Quality Score (0-100)**:
   - Completeness: All required fields
   - Accuracy: Data matches request
   - Structure: Proper types and ordering
   - Relevance: Activities match interests

2. **Performance**:
   - Latency: p50, p95, p99
   - Cost: Tokens × model pricing
   - Success rate: % successful responses

3. **Tool Calling**:
   - Accuracy: % correct tool usage
   - Coverage: % of required tools used
   - Validity: % valid tool arguments

**Tool**: Promptfoo integration for comparison dashboard

**Outcome**: Data-driven model selection. Currently using Claude Sonnet 3.5 for best quality/cost balance.

### Streaming Response Strategy (Nov 2025)
**Finding**: Server-Sent Events (SSE) better than WebSockets for LLM streaming

**Rationale**:
- Simpler protocol (HTTP vs WebSocket handshake)
- Better compatibility (no proxy issues)
- Automatic reconnection in browsers
- One-way communication sufficient for streaming

**Implementation**:
```typescript
// SvelteKit endpoint
export async function GET({ params }) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

**Outcome**: Reliable streaming with good UX. No WebSocket complexity.

## Testing Research

### Traveler Persona Testing (Dec 2025)
**Finding**: AI-driven persona tests provide better coverage than scripted E2E tests

**Approach**:
- Define persona profiles (solo, couple, family)
- Use LLM to generate natural conversation
- Validate itinerary structure and quality
- Track quality metrics over time

**Benefits**:
- Tests realistic user behavior (not scripted paths)
- Uncovers edge cases we didn't think of
- Validates LLM output quality automatically
- Regression detection for AI features

**Challenges**:
- Non-deterministic (LLM variance)
- Slower than unit tests
- Requires API keys and costs money

**Mitigation**:
- Use temperature=0 for consistency
- Cache responses during development
- Run persona tests in CI but not on every commit

**Outcome**: Found several quality issues that scripted tests missed. Keeping in test suite.

### Model Evaluation Automation (Dec 2025)
**Finding**: Manual model comparison is time-consuming and subjective

**Solution**: Automated evaluation suite with:
- Standard test cases (15 trip scenarios)
- Objective quality scoring (0-100)
- Performance metrics (latency, cost)
- Comparison dashboard (Promptfoo)

**Results**:
- Claude Sonnet 3.5: Best quality (avg 87/100)
- GPT-4o: Best latency (avg 1.2s)
- Llama 3.1 70B: Best cost (avg $0.002/req)
- Gemini Pro: Good balance (quality 81, cost $0.004)

**Decision**: Use Claude Sonnet 3.5 as default for Trip Designer

## Performance Optimizations

### Vercel Blob Update Strategy (Nov 2025)
**Finding**: Vercel Blob requires delete-before-update pattern

**Issue**: Direct `put()` on existing key creates duplicate with random suffix

**Solution**:
```typescript
// 1. Check if exists
const existing = await head(key);
if (existing) {
  await del(existing.url);
}
// 2. Put new content
await put(key, data, { addRandomSuffix: false });
```

**Outcome**: Correct update behavior, no orphaned blobs

### Service Initialization (Nov 2025)
**Finding**: Conditional service loading reduces cold start time on Vercel

**Approach**:
- Only load services when required env vars present
- Use dynamic imports to avoid bundling unused code
- Initialize once in hooks.server.ts, not per request

**Results**:
- Cold start: 1.2s → 0.8s (33% faster)
- Bundle size: 2.1MB → 1.4MB (33% smaller)

**Trade-off**: More complex initialization logic, but worth it

## Documentation Insights

### Makefile vs npm Scripts (Jan 2026)
**Finding**: Developers prefer `make` commands over `npm run`

**Rationale**:
- Shorter commands: `make test` vs `npm run test`
- Consistent across projects (not just Node.js)
- Better discoverability: `make help`
- Easier to compose: `make quality` = `lint && typecheck`

**Implementation**: Added Makefile with all common tasks

**Outcome**: Better DX, especially for new contributors

### Priority Markers (Jan 2026)
**Finding**: Priority markers (🔴🟡🟢⚪) improve documentation scannability

**Benefits**:
- Quick visual scan of what's critical
- Helps prioritize work
- Clear communication of importance
- Works well in markdown

**Usage**:
- 🔴 Critical - Core functionality, blocking issues
- 🟡 Important - Significant features, quality
- 🟢 Nice-to-have - Enhancements, optimizations
- ⚪ Backlog - Future considerations

**Outcome**: Faster onboarding, better prioritization

## Open Questions / Future Research

### Vector Database for Production
**Question**: Should we enable Vectra in production (Vercel)?

**Current State**: Disabled (requires filesystem)

**Options**:
1. Use Vercel Edge Config for vector storage (limited size)
2. Migrate to Pinecone/Weaviate (managed service)
3. Stay with Vectra locally only

**Research Needed**:
- Cost comparison (managed vs self-hosted)
- Performance benchmarks
- Migration complexity

### GraphQL vs REST for API
**Question**: Should we migrate to GraphQL?

**Current State**: REST with SvelteKit routes

**Pros of GraphQL**:
- Better for complex queries (nested data)
- Client-side query flexibility
- Type safety with codegen

**Cons of GraphQL**:
- More complex setup
- Caching is harder
- Learning curve for team

**Decision**: Defer until we have clear need for GraphQL features

### Multi-Tenancy Strategy
**Question**: How to handle multiple users in production?

**Current State**: Simple user ID filtering

**Options**:
1. User ID in every query (current)
2. Row-level security (if we add database)
3. Separate storage per user (complex)

**Research Needed**:
- Scalability testing
- Security audit
- Cost implications

## Lessons Learned

### Start Simple, Add Complexity When Needed
- Started with JSON files, added Blob storage later
- Works well for MVP, easy to migrate

### Type Safety Pays Off
- Branded types caught bugs during refactoring
- Zod validation prevented bad data early
- TypeScript strict mode is worth the friction

### Test What Matters
- Unit tests for business logic
- E2E tests for user flows
- Persona tests for AI quality
- Don't over-test implementation details

### Documentation is Code
- Keep docs close to code (markdown in repo)
- Update docs with code changes
- Use examples liberally
- Link related docs together

### Optimize for DX First
- Make commands memorable (`make dev`)
- Provide helpful error messages
- Fast feedback loops (hot reload)
- Good defaults (auto-select storage)
