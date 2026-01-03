# Directory Consolidation Analysis: itinerizer-ts → itinerator

**Research Date:** 2026-01-02
**Source Directory:** /Users/masa/Projects/itinerizer-ts (4.9GB)
**Target Directory:** /Users/masa/Projects/itinerator (188KB)
**Status:** Target directory is nearly empty, ready for consolidation

## Executive Summary

The `itinerator` directory is essentially empty (only test data), while `itinerizer-ts` contains the complete, production-ready application with 138 TypeScript source files, comprehensive documentation, tests, and configuration. This is a straightforward consolidation where **all content from itinerizer-ts should be moved to itinerator**.

## Directory Comparison

### itinerator (Target - Current State)
```
/Users/masa/Projects/itinerator/
├── data/
│   └── itineraries/          # 16 JSON files (test data)
└── tests/
    └── e2e/
        └── results/          # 6 persona test results
```

**Status:** Minimal directory with only test data. No source code, no package.json, no git history.

### itinerizer-ts (Source - Complete Application)
```
/Users/masa/Projects/itinerizer-ts/
├── .git/                     # Git repository with history
├── src/                      # 138 TypeScript source files
│   ├── cli/                  # CLI commands and prompts
│   ├── core/                 # Core utilities (errors, ID generation)
│   ├── domain/               # Domain models
│   ├── prompts/              # AI prompts
│   ├── server/               # Express API server
│   ├── services/             # Business logic services
│   ├── storage/              # Data persistence layer
│   └── utils/                # Utility functions
├── tests/                    # Comprehensive test suite
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── eval/                 # Model evaluation
│   └── fixtures/
├── viewer-svelte/            # Svelte frontend application
├── docs/                     # Documentation
│   ├── architecture/
│   ├── research/             # 20+ research documents
│   ├── fixes/
│   ├── developer/
│   └── user/
├── examples/                 # 10+ demo/example files
├── scripts/                  # Utility scripts
├── data/                     # 240+ itinerary JSON files
├── evals/                    # Evaluation configs
├── .claude-mpm/              # MPM agent configurations
├── .mcp-vector-search/       # Vector search index
├── kuzu-memories/            # Knowledge graph database
└── [Config Files]            # See below
```

## Technology Stack Analysis

### Package.json Comparison

**itinerizer-ts (Complete)**
- **Name:** "itinerator" (already renamed in package.json)
- **Version:** 0.2.4
- **Type:** ESM module
- **Node:** >=20.0.0

**Key Dependencies:**
- OpenAI SDK (6.14.0) - AI/LLM integration
- Express (5.2.1) - API server
- Weaviate Client (3.10.0) - Vector database
- Vectra (0.11.1) - Vector search
- Zod (3.24.1) - Schema validation
- Commander (12.1.0) - CLI framework
- PDF Parse, node-ical - Import capabilities

**Key DevDependencies:**
- TypeScript (5.7.2)
- Vitest (2.1.8) - Testing framework
- Biome (1.9.4) - Linting/formatting
- Playwright (1.57.0) - E2E testing
- Promptfoo (0.120.8) - LLM evaluation
- tsx, tsup - Build tools

**itinerator (Missing)**
- No package.json exists in target directory

## Configuration Files Analysis

### Critical Config Files in itinerizer-ts

**TypeScript Configuration:**
- `tsconfig.json` - Strict TypeScript config with ES2022, NodeNext modules
- `tsup.config.ts` - Build configuration

**Code Quality:**
- `biome.json` - Linting and formatting rules
- `.pre-commit-config.yaml` - Pre-commit hooks
- `.secrets.baseline` - Secrets scanning baseline

**Testing:**
- `vitest.config.ts` - Unit/integration tests
- `vitest.config.e2e.ts` - E2E tests
- `vitest.config.eval.ts` - LLM evaluation tests

**Deployment:**
- `vercel.json` - Vercel deployment config
- `ecosystem.config.cjs` - PM2 process manager
- `.vercelignore` - Vercel ignore patterns
- `deploy.sh` - Deployment script

**Environment:**
- `.env.example` - Environment variable template
- `.env.test.example` - Test environment template
- `.gitignore` - Git ignore patterns (comprehensive)

**MCP/AI Tools:**
- `.mcp.json` - MCP server configurations (mcp-skillset, kuzu-memory, mcp-vector-search)

**Frontend (viewer-svelte/):**
- `package.json` - Svelte app dependencies
- `svelte.config.js` - SvelteKit configuration
- `vite.config.ts` - Vite build config
- `tailwind.config.js` - Tailwind CSS config
- `components.json` - shadcn/ui components

## Content Categories and Consolidation Plan

### 1. Source Code (MOVE ALL)
**Priority:** CRITICAL
**Action:** Move entire `/src` directory

```bash
# 138 TypeScript files organized by domain
src/
├── cli/          # 3 subdirectories, 9+ files
├── core/         # 4 files (id-generator, errors, result, index)
├── domain/       # Domain models
├── prompts/      # AI prompt templates
├── server/       # API routers and server
├── services/     # 33+ service files
├── storage/      # Storage interfaces and implementations
└── utils/        # Utility functions
```

**Rationale:** This is the complete application codebase.

### 2. Configuration Files (MOVE ALL)
**Priority:** CRITICAL
**Action:** Move all config files to root

**Files to Move:**
- `package.json`, `package-lock.json` (CRITICAL)
- `tsconfig.json`, `tsup.config.ts`
- `biome.json`
- `.gitignore` (merge if target has one)
- `.pre-commit-config.yaml`
- `.secrets.baseline`
- `vitest.config.*.ts` (3 files)
- `vercel.json`, `.vercelignore`
- `ecosystem.config.cjs`
- `.mcp.json`
- Environment templates: `.env.example`, `.env.test.example`

**Rationale:** Application won't run without these.

### 3. Tests (MOVE ALL)
**Priority:** HIGH
**Action:** Move entire `/tests` directory

```bash
tests/
├── unit/          # Unit tests
├── integration/   # Integration tests
├── e2e/           # End-to-end tests
├── eval/          # Model evaluation suite
├── fixtures/      # Test fixtures
├── helpers/       # Test utilities
├── config/        # Test configurations
└── examples/      # Test examples
```

**Rationale:** Comprehensive test coverage for CI/CD and development.

### 4. Documentation (MOVE ALL)
**Priority:** HIGH
**Action:** Move entire `/docs` directory

```bash
docs/
├── architecture/  # System design docs
├── research/      # 20+ research documents
├── fixes/         # Bug fix documentation
├── developer/     # Developer guides
└── user/          # User guides
```

**Plus Root-Level Markdown:**
- `README.md` (comprehensive project README)
- 40+ markdown files documenting features, fixes, implementations
  - AUTH_FIX_BEFORE_AFTER.md
  - BOOKING_PRIORITY_DIAGRAM.md
  - CLAUDE.md
  - ITINERARY_RULES_SUMMARY.md
  - MANUAL_TEST_PLAN.md
  - TEST_*.md (multiple test plans)
  - TOOL_CHAINING_*.md
  - TRAVELER_PERSONA_*.md
  - etc.

**Rationale:** Critical knowledge base and development history.

### 5. Frontend Application (MOVE ALL)
**Priority:** HIGH
**Action:** Move entire `/viewer-svelte` directory

**viewer-svelte/ (SvelteKit Application):**
- Full SvelteKit app with 87+ config/doc files
- Comprehensive UI implementation
- API documentation
- Deployment configs
- Testing guides

**Legacy viewer/ (Optional):**
- May be deprecated, check with team
- If unused, can skip or archive

**Rationale:** Complete frontend application for the itinerator system.

### 6. Data Files (SELECTIVE MOVE)
**Priority:** MEDIUM
**Action:** Merge data directories

**itinerizer-ts/data/:**
- `itineraries/` - 240+ itinerary JSON files (PRODUCTION DATA)
- `imports/` - Import data
- `uploads/` - Uploaded files
- `vectors/` - Vector embeddings
- `test-*/` - Test data directories

**itinerator/data/:**
- `itineraries/` - 16 test itinerary files (TEST DATA)

**Recommendation:**
```bash
# Option 1: Merge and keep all (if disk space allows)
cp -R itinerizer-ts/data/* itinerator/data/

# Option 2: Move production data, archive test data
mv itinerator/data/itineraries itinerator/data/itineraries-original-test
cp -R itinerizer-ts/data/* itinerator/data/
```

**Rationale:** Production data is valuable; test data can be archived.

### 7. Examples and Demos (MOVE ALL)
**Priority:** MEDIUM
**Action:** Move entire `/examples` directory

**Files:**
- 10+ demo files (.ts)
- README.md
- Examples for:
  - Trip designer API
  - Travel agent
  - Metadata enhancement
  - Knowledge graph
  - Geocoding
  - Streaming chat
  - Confidence thresholds

**Rationale:** Developer onboarding and API usage examples.

### 8. Scripts (MOVE ALL)
**Priority:** MEDIUM
**Action:** Move entire `/scripts` directory + root scripts

**Directories:**
- `/scripts/` - 5+ utility scripts

**Root Scripts:**
- `check-test-status.sh`
- `deploy.sh`
- `extract-test-results.sh`
- `start-dev.sh`
- `debug-validate.mjs`
- `debug-viewer.js`
- `test-*.mjs`, `test-*.js`, `test-*.sh` (20+ test scripts)

**Rationale:** Automation and development utilities.

### 9. Evaluation Configs (MOVE ALL)
**Priority:** MEDIUM
**Action:** Move `/evals` directory

**evals/:**
- `promptfoo.yaml` - Evaluation configuration
- `results/` - Evaluation results

**Rationale:** LLM evaluation infrastructure.

### 10. AI/MCP Tools (SELECTIVE MOVE)
**Priority:** MEDIUM
**Action:** Move relevant configs, regenerate indices

**Move:**
- `.claude-mpm/` - MPM agent configurations
- `.mcp.json` - Already has correct paths for itinerator

**Regenerate (Don't Move):**
- `.mcp-vector-search/` - Regenerate index after move
- `kuzu-memories/` - May need to regenerate
- `.kuzu-memory-backups/` - Optional archive

**Skip:**
- `.mcp-browser/` - Browser extension data (can regenerate)
- `:memory:/` - Runtime data (regenerate)

**Rationale:** Configs are portable, but indices should be regenerated for correctness.

### 11. Git History (MOVE)
**Priority:** HIGH
**Action:** Move `.git` directory OR re-initialize with history

**Options:**

**Option A: Move .git directory (Simple)**
```bash
# Preserves all history
mv itinerizer-ts/.git itinerator/.git
cd itinerator
git status  # Verify
```

**Option B: Clone and rename (Clean)**
```bash
# Start fresh with history intact
cd /Users/masa/Projects
git clone itinerizer-ts/.git itinerator-new
mv itinerator-new/.git itinerator/.git
```

**Recent Commits in itinerizer-ts:**
- e96863d - feat: add few-shot examples for tool calling patterns
- fa95589 - fix: add explicit flight booking workflow to system prompt
- ab5888d - fix: add segment tools to ESSENTIAL_TOOLS for first message
- e978dd6 - chore: rename project from itinerizer-ts to itinerator

**Rationale:** Git history is valuable for understanding changes and reverting if needed.

### 12. Build Artifacts (DO NOT MOVE)
**Priority:** N/A
**Action:** Exclude from move, regenerate after

**Directories to Exclude:**
- `node_modules/` - Reinstall with `npm install`
- `dist/` - Rebuild with `npm run build`
- `.vercel/` - Regenerate on deployment
- Coverage reports
- Log files

**Rationale:** These are generated artifacts that should be rebuilt in new location.

## Configuration Differences Requiring Reconciliation

### .mcp.json Path Updates

**Current in itinerizer-ts:**
```json
{
  "mcpServers": {
    "kuzu-memory": {
      "env": {
        "KUZU_MEMORY_PROJECT_ROOT": "/Users/masa/Projects/itinerator",  // Already updated!
        "KUZU_MEMORY_DB": "/Users/masa/Projects/itinerator/kuzu-memories"
      }
    },
    "mcp-vector-search": {
      "env": {
        "PROJECT_ROOT": "/Users/masa/Projects/itinerator",  // Already updated!
        "MCP_PROJECT_ROOT": "/Users/masa/Projects/itinerator"
      }
    }
  }
}
```

**Status:** ✅ Paths already point to `itinerator` - no changes needed!

### Environment Files

**Files to Update After Move:**
- `.env` (create from `.env.example`)
- `.env.local` (if used)
- `.env.test` (create from `.env.test.example`)

**Action:** Do NOT copy actual `.env` files (contain secrets). Instead:
1. Copy `.env.example` → `.env`
2. Add your API keys manually
3. Copy `.env.test.example` → `.env.test`

## Consolidation Procedure

### Phase 1: Preparation (Safety First)
```bash
# 1. Backup current itinerator directory (though it's nearly empty)
cp -R /Users/masa/Projects/itinerator /Users/masa/Projects/itinerator-backup-2026-01-02

# 2. Verify itinerizer-ts is clean (no uncommitted changes)
cd /Users/masa/Projects/itinerizer-ts
git status

# 3. Create final commit if needed
git add .
git commit -m "chore: final commit before consolidation to itinerator directory"
```

### Phase 2: Move Source Code and Configs
```bash
# 4. Move git history first
mv /Users/masa/Projects/itinerizer-ts/.git /Users/masa/Projects/itinerator/.git

# 5. Move source code
mv /Users/masa/Projects/itinerizer-ts/src /Users/masa/Projects/itinerator/src

# 6. Move configuration files
cd /Users/masa/Projects/itinerizer-ts
mv package.json package-lock.json /Users/masa/Projects/itinerator/
mv tsconfig.json tsup.config.ts /Users/masa/Projects/itinerator/
mv biome.json /Users/masa/Projects/itinerator/
mv .gitignore /Users/masa/Projects/itinerator/
mv .pre-commit-config.yaml .secrets.baseline /Users/masa/Projects/itinerator/
mv vitest.config*.ts /Users/masa/Projects/itinerator/
mv vercel.json .vercelignore /Users/masa/Projects/itinerator/
mv ecosystem.config.cjs /Users/masa/Projects/itinerator/
mv .mcp.json /Users/masa/Projects/itinerator/
mv .env.example .env.test.example /Users/masa/Projects/itinerator/

# 7. Move hidden directories (AI tools)
mv .claude .claude-mpm /Users/masa/Projects/itinerator/
```

### Phase 3: Move Tests and Documentation
```bash
# 8. Move tests (merge with existing if needed)
mv /Users/masa/Projects/itinerizer-ts/tests /Users/masa/Projects/itinerator/tests-full
# Then manually merge with existing /Users/masa/Projects/itinerator/tests if needed

# 9. Move documentation
mv /Users/masa/Projects/itinerizer-ts/docs /Users/masa/Projects/itinerator/docs
mv /Users/masa/Projects/itinerizer-ts/*.md /Users/masa/Projects/itinerator/
# Note: This includes README.md and 40+ other .md files
```

### Phase 4: Move Frontend and Support Files
```bash
# 10. Move frontend
mv /Users/masa/Projects/itinerizer-ts/viewer-svelte /Users/masa/Projects/itinerator/viewer-svelte

# 11. Move examples and scripts
mv /Users/masa/Projects/itinerizer-ts/examples /Users/masa/Projects/itinerator/examples
mv /Users/masa/Projects/itinerizer-ts/scripts /Users/masa/Projects/itinerator/scripts

# 12. Move root-level scripts
cd /Users/masa/Projects/itinerizer-ts
mv *.sh *.js *.mjs *.ts /Users/masa/Projects/itinerator/ 2>/dev/null || true

# 13. Move evaluation configs
mv /Users/masa/Projects/itinerizer-ts/evals /Users/masa/Projects/itinerator/evals
```

### Phase 5: Move Data (Selective)
```bash
# 14. Backup existing test data
mv /Users/masa/Projects/itinerator/data /Users/masa/Projects/itinerator/data-original-test

# 15. Move production data
mv /Users/masa/Projects/itinerizer-ts/data /Users/masa/Projects/itinerator/data

# 16. Move knowledge bases (optional - can regenerate)
mv /Users/masa/Projects/itinerizer-ts/kuzu-memories /Users/masa/Projects/itinerator/kuzu-memories
```

### Phase 6: Installation and Verification
```bash
# 17. Install dependencies
cd /Users/masa/Projects/itinerator
npm install

# 18. Build the project
npm run build

# 19. Run tests to verify everything works
npm test

# 20. Verify git status
git status
git log --oneline -5

# 21. Create environment files
cp .env.example .env
# Edit .env and add your API keys

cp .env.test.example .env.test
# Edit .env.test if needed
```

### Phase 7: Regenerate AI Indices
```bash
# 22. Regenerate vector search index (if using mcp-vector-search)
# This happens automatically on first use, or manually:
# (Depends on mcp-vector-search setup)

# 23. Test MCP servers
# Start Claude Code and verify MCP tools are working
```

### Phase 8: Cleanup (After Verification)
```bash
# 24. Only after CONFIRMING everything works in itinerator:
cd /Users/masa/Projects
rm -rf itinerizer-ts  # Remove old directory

# Or archive it:
mv itinerizer-ts itinerizer-ts-archived-2026-01-02
# Then compress or move to archive location
```

## Files/Directories Summary

### MOVE (Complete Transfer)
✅ `/src/` - All source code (138 files)
✅ `/tests/` - All tests
✅ `/docs/` - All documentation
✅ `/examples/` - Demo files
✅ `/scripts/` - Utility scripts
✅ `/evals/` - Evaluation configs
✅ `/viewer-svelte/` - Frontend app
✅ `/data/` - Production data (240+ itineraries)
✅ `/kuzu-memories/` - Knowledge graph
✅ `/.git/` - Git history
✅ `/.claude-mpm/` - MPM configs
✅ `/.claude/` - Claude configs
✅ All config files (package.json, tsconfig.json, etc.)
✅ All markdown files (README.md, 40+ docs)
✅ All root scripts (20+ .sh, .js, .mjs files)

### REGENERATE (Don't Move)
🔄 `node_modules/` - Run `npm install`
🔄 `dist/` - Run `npm run build`
🔄 `.mcp-vector-search/` - Regenerate index
🔄 `.vercel/` - Regenerate on deployment

### SKIP (Not Needed)
❌ `.env`, `.env.local` - Contains secrets, create from examples
❌ `.env.test` - Create from example
❌ `.mcp-browser/` - Runtime data
❌ `:memory:/` - Runtime data
❌ Log files, coverage reports

### MERGE (Handle Conflicts)
🔀 `/data/` - Merge or archive existing test data
🔀 `/tests/` - Merge if target has existing tests

## Risk Assessment

### Low Risk
- Source code move (no dependencies on paths)
- Configuration files (mostly portable)
- Documentation (fully portable)
- Examples and scripts

### Medium Risk
- Data files (large size, 240+ files)
- Git history preservation
- Environment file setup

### High Risk (Requires Regeneration)
- Vector search indices (path-dependent)
- Node modules (needs reinstall)
- Build artifacts (needs rebuild)

## Post-Migration Validation Checklist

### Code Functionality
- [ ] `npm install` succeeds
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

### Application Functionality
- [ ] CLI commands work (`npm start`)
- [ ] Server starts (`npm run server`)
- [ ] Viewer launches (`npm run viewer`)
- [ ] API endpoints respond
- [ ] Import functionality works

### Data Integrity
- [ ] Itinerary files load correctly
- [ ] Vector search works (if enabled)
- [ ] Knowledge graph queries work
- [ ] File uploads work

### Git and Version Control
- [ ] Git history is intact (`git log`)
- [ ] Git status shows expected files
- [ ] Remote origin is set (if applicable)
- [ ] `.gitignore` working correctly

### AI/MCP Tools
- [ ] MCP servers connect (mcp-skillset, kuzu-memory, mcp-vector-search)
- [ ] Vector search returns results
- [ ] Claude MPM agents load
- [ ] Knowledge graph queries work

### Environment and Deployment
- [ ] `.env` file configured with API keys
- [ ] Vercel deployment works (if applicable)
- [ ] PM2 process manager works (if used)

## Estimated Effort

**Preparation:** 30 minutes
**File Movement:** 1 hour
**Installation/Build:** 30 minutes
**Testing/Verification:** 1-2 hours
**Cleanup:** 30 minutes

**Total:** 3.5-4.5 hours (conservative estimate)

**Actual Time:** Could be faster with scripting, but manual verification is recommended.

## Recommendations

### 1. Use Git for the Move (Safest Approach)
Instead of manual `mv` commands, use git to preserve history:

```bash
# Clone with history
cd /Users/masa/Projects
git clone itinerizer-ts itinerator-consolidated

# Move .git to target
mv itinerator-consolidated/.git itinerator/.git

# Copy all files
rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' \
  itinerizer-ts/ itinerator/
```

### 2. Create a Migration Script
Save time with a bash script:

```bash
#!/bin/bash
# consolidate.sh
# ... (include all commands from Phase 1-7)
```

### 3. Test in Parallel First
Before removing `itinerizer-ts`:
1. Complete the move
2. Get everything working in `itinerator`
3. Run both directories in parallel for a day
4. Only then remove `itinerizer-ts`

### 4. Archive vs. Delete
Instead of deleting `itinerizer-ts`:
```bash
# Compress and archive
tar -czf itinerizer-ts-backup-2026-01-02.tar.gz itinerizer-ts/
mv itinerizer-ts-backup-2026-01-02.tar.gz ~/Archives/
```

### 5. Update All References
After the move, search for hardcoded paths:
```bash
cd /Users/masa/Projects/itinerator
grep -r "itinerizer-ts" . --exclude-dir=node_modules
# Update any found references
```

## Conclusion

This is a **complete consolidation** where ALL content from `itinerizer-ts` should be moved to `itinerator`. The target directory is essentially empty, so there are minimal merge conflicts. The biggest considerations are:

1. **Preserving git history** (move `.git` directory)
2. **Regenerating build artifacts** (node_modules, dist)
3. **Setting up environment files** (don't copy .env with secrets)
4. **Verifying MCP tools** after path changes
5. **Testing thoroughly** before removing source directory

The `.mcp.json` file already has correct paths pointing to `itinerator`, suggesting this consolidation was planned. The git log shows a commit "chore: rename project from itinerizer-ts to itinerator" which confirms the intention.

**Next Steps:**
1. Review this analysis
2. Backup current state
3. Execute consolidation procedure
4. Verify all functionality
5. Remove/archive `itinerizer-ts` only after confirmation
