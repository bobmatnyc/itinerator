# Express Server Documentation Audit - SvelteKit Migration

**Research Date:** 2025-12-22
**Purpose:** Identify all documentation that references the Express API server (port 5177) and dual-server architecture for migration to SvelteKit-only (port 5176)

---

## Executive Summary

The Itinerator project has migrated from a dual-server architecture (Express on 5177 + SvelteKit on 5176) to a **SvelteKit-only architecture** (single server on port 5176). However, extensive documentation still references the old Express server and dual deployment model.

**Key Findings:**
- ✅ API routes successfully migrated to SvelteKit (`SVELTEKIT_API_MIGRATION.md` confirms)
- ❌ Core project documentation still describes dual-server architecture
- ❌ Example scripts and READMEs reference Express server commands
- ❌ Agent memory files contain outdated deployment procedures
- ⚠️ Some documentation correctly describes Vercel deployment but incorrectly references local development

---

## Files Requiring Updates

### 🔴 CRITICAL - Core Project Documentation

#### 1. `/CLAUDE.md` (Project Instructions)
**Current Status:** Describes dual deployment model
**Line References:**
- Line 9: `├── src/server/             # Express API (local development)`
- Line 19-28: Dual Deployment Model table with Express/SvelteKit split
- Lines 42-44: Quick Start Commands reference `npm run server` on port 5177
- Line 58: Lists "Express 5" as key technology
- Line 71: `VITE_API_URL` described as "Local dev only"
- Line 99: "API Routes: Duplicate changes in both Express and SvelteKit routes"

**Required Changes:**
```diff
## Architecture Overview

Itinerator/
├── src/                    # Core TypeScript library
│   ├── domain/             # Types, schemas, branded types
│   ├── services/           # Business logic services
-│   ├── storage/            # Storage backends (JSON, Blob)
-│   └── server/             # Express API (local development)
+│   └── storage/            # Storage backends (JSON, Blob)
├── viewer-svelte/          # SvelteKit frontend + API
-│   └── src/routes/api/     # SvelteKit API routes (production)
+│   ├── src/routes/         # SvelteKit routes
+│   └── src/routes/api/     # API routes (local + production)
└── dist/                   # CLI build output (tsup)

-## Dual Deployment Model
+## Deployment Model

-This project has **two deployment targets** with shared business logic:
+This project uses a **SvelteKit-only architecture** for web deployment:

-| Component | Local Development | Production (Vercel) |
-|-----------|-------------------|---------------------|
-| **Frontend** | `viewer-svelte` on port 5176 | SvelteKit on Vercel |
-| **API** | Express on port 5177 | SvelteKit routes `/api/v1/*` |
+| Component | Local Development | Production (Vercel) |
+|-----------|-------------------|---------------------|
+| **Frontend + API** | SvelteKit on port 5176 | SvelteKit on Vercel |
| **Storage** | JSON files in `./data/` | Vercel Blob |
| **Vector DB** | Vectra (filesystem) | Disabled (no filesystem) |

## Quick Start Commands

```bash
-# Local Development (both servers)
-npm run server          # API on :5177
-cd viewer-svelte && npm run dev  # Frontend on :5176
+# Local Development (single server)
+cd viewer-svelte && npm run dev  # SvelteKit on :5176

# Build CLI
npm run build           # Creates dist/index.js

## Key Technologies

- **TypeScript 5.7** - Strict mode, branded types
- **Svelte 5** - Runes-based reactivity (.svelte.ts stores)
- **SvelteKit 2** - Vercel adapter, API routes
-- **Express 5** - Local API server
- **Vercel Blob** - Cloud storage for itineraries

| Variable | Purpose | Required |
|----------|---------|----------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access | Production |
| `OPENROUTER_API_KEY` | LLM API access | For AI features |
| `SERPAPI_KEY` | Travel search | For Travel Agent |
-| `VITE_API_URL` | Frontend API URL | Local dev only |

## Development Guidelines

1. **Svelte 5 Stores**: Use `.svelte.ts` extension for runes compatibility
-2. **API Routes**: Duplicate changes in both Express and SvelteKit routes
-3. **Storage**: All storage operations go through `ItineraryStorage` interface
+2. **Storage**: All storage operations go through `ItineraryStorage` interface
+3. **API Routes**: All API routes in `viewer-svelte/src/routes/api/v1/`
```

---

#### 2. `/.claude-mpm/memories/ops_memories.md` (Agent Operations Memory)
**Current Status:** Comprehensive dual-server deployment guide
**Line References:**
- Lines 4-11: Dual Deployment Architecture table
- Lines 13-29: Local development section with separate servers
- Lines 21-22: Terminal 1/Terminal 2 setup for Express + Svelte
- Line 35: References `VITE_API_URL=http://localhost:5177`
- Line 38: References `src/server/index.ts` as Express API entry point
- Lines 115-121: API Route Mapping table showing Express vs SvelteKit routes
- Line 160: "Check if Express server is running on 5177"

**Required Changes:**
```diff
-## Dual Deployment Architecture
+## SvelteKit Deployment Architecture

-This project has **two parallel deployment targets**:
+This project uses **SvelteKit for both local and production deployment**:

-| Mode | API Server | Frontend | Storage | Vector DB |
-|------|------------|----------|---------|-----------|
-| **Local** | Express (:5177) | Vite (:5176) | JSON files | Vectra |
-| **Vercel** | SvelteKit routes | SvelteKit | Blob | Disabled |
+| Mode | Server | Storage | Vector DB |
+|------|--------|---------|-----------|
+| **Local** | SvelteKit (:5176) | JSON files | Vectra |
+| **Vercel** | SvelteKit | Blob | Disabled |

## Local Development

-### Default Ports
-- **Frontend (Svelte)**: `5176`
-- **API (Express)**: `5177`
+### Default Port
+- **SvelteKit (Frontend + API)**: `5176`

### Start Commands
```bash
-# Terminal 1: API Server
-npx tsx src/server/index.ts
-
-# Terminal 2: Frontend
+# Single server (frontend + API)
cd viewer-svelte && npm run dev

-# Or use concurrently (if configured)
-npm run viewer
```

### Config Files
| File | Purpose |
|------|---------|
| `viewer-svelte/vite.config.ts` | Frontend port (5176) |
-| `viewer-svelte/.env` | `VITE_API_URL=http://localhost:5177` |
-| `viewer-svelte/src/lib/api.ts` | API URL default |
+| `viewer-svelte/src/lib/api.ts` | API client (uses relative URLs) |
| `.itinerator/config.yaml` | API keys (OpenRouter, SerpAPI) |
-| `src/server/index.ts` | Express API entry point |
+| `viewer-svelte/src/hooks.server.ts` | Service initialization |

-### API Route Mapping
-
-| Express (Local) | SvelteKit (Vercel) |
-|-----------------|-------------------|
-| `GET /api/health` | `GET /api/health` |
-| `GET /api/itineraries` | `GET /api/v1/itineraries` |
-| `POST /api/chat/sessions` | `POST /api/v1/designer/sessions` |
-| `POST /api/import` | `POST /api/v1/import` |

## Troubleshooting

-### Local API Returns 404
-- Check if Express server is running on 5177
-- Verify `VITE_API_URL` in `viewer-svelte/.env`
+### Local API Returns 404
+- Check if SvelteKit dev server is running on 5176
+- Verify API routes exist in `viewer-svelte/src/routes/api/v1/`
+- Check browser console for CORS or network errors
```

---

#### 3. `/examples/README.md`
**Current Status:** References Express server and port 5177
**Line References:**
- Line 16: "Start the API server: `npm run server`"
- Line 123-128: Troubleshooting section about "Connection refused" to port 5177

**Required Changes:**
```diff
**Prerequisites:**
-1. Start the API server: `npm run server`
+1. Start the SvelteKit dev server: `cd viewer-svelte && npm run dev`
2. Configure your OpenRouter API key in `.itinerator/config.yaml`:

### "Connection refused"

-Make sure the API server is running:
+Make sure the SvelteKit dev server is running:
```bash
-npm run server
+cd viewer-svelte && npm run dev
```

-The server should start on http://localhost:5177
+The server should start on http://localhost:5176
```

---

#### 4. `/docs/TRIP_DESIGNER_API.md`
**Current Status:** Documents Express API on port 5177
**Line References:**
- Line 15: "Base URL: `http://localhost:5177/api`"
- Lines 228-250: "Next Steps" section with `npm run server` command

**Required Changes:**
```diff
## Base URL

-All endpoints use the base URL: `http://localhost:5177/api`
+**Local Development:** `http://localhost:5176/api/v1`
+**Production:** `https://your-app.vercel.app/api/v1`

## Next Steps

To use the Trip Designer API:

-1. **Start the server:**
+1. **Start the SvelteKit dev server:**
   ```bash
-   npm run server
+   cd viewer-svelte && npm run dev
   ```

2. **Configure API key:**
   ```bash
   # Option 1: YAML config
   npx itinerator config set openrouter.apiKey YOUR_KEY

   # Option 2: Environment variable
   export OPENROUTER_API_KEY=YOUR_KEY
   ```

3. **Test the API:**
   ```bash
   # Run example script
   npx tsx examples/trip-designer-api-demo.ts

   # Or use curl
-   curl -X POST http://localhost:5177/api/chat/sessions \
+   curl -X POST http://localhost:5176/api/v1/designer/sessions \
     -H "Content-Type: application/json" \
     -d '{"itineraryId":"your-itinerary-id"}'
   ```
```

---

#### 5. `/docs/TRIP_DESIGNER_IMPLEMENTATION.md`
**Current Status:** References Express server setup
**Line References:**
- Lines 34-65: API endpoint documentation with `/api/chat/*` paths (should be `/api/v1/designer/*`)
- Lines 229-252: "Next Steps" section with `npm run server`

**Required Changes:**
```diff
### `src/server/index.ts`
-- Added SegmentService and DependencyService initialization
-- Passed services to TripDesignerService
-- Updated server config interface
-- Added chat endpoint to startup logs
+**NOTE:** Express server is deprecated for web deployment.
+Use SvelteKit routes in `viewer-svelte/src/routes/api/v1/designer/` for production.

-1. **POST /api/chat/sessions** - Create chat session
+1. **POST /api/v1/designer/sessions** - Create chat session
-2. **POST /api/chat/sessions/:sessionId/messages** - Send message
+2. **POST /api/v1/designer/sessions/:sessionId/messages** - Send message
(and so on for all endpoints)

1. **Start the server:**
   ```bash
-   npm run server
+   cd viewer-svelte && npm run dev
   ```
```

---

### 🟡 MODERATE - Viewer-Specific Documentation

#### 6. `/viewer-svelte/QUICKSTART.md`
**Current Status:** References backend on port 3001 (outdated)
**Line References:**
- Line 6: "Backend API running on `http://localhost:3001`"
- Lines 27, 39: References to port 3001
- Lines 55-60: Troubleshooting backend on different port

**Required Changes:**
```diff
## Prerequisites

- Node.js 18+ installed
-- Backend API running on `http://localhost:3001`
+- No separate backend needed (SvelteKit includes API routes)

## Environment Configuration

-Create a `.env` file (or use the existing one):
+Create a `.env` file for API keys:

```bash
-VITE_API_URL=http://localhost:3001
+OPENROUTER_API_KEY=your-key-here
+SERPAPI_KEY=your-key-here
```

## First Steps

-1. Make sure the backend API is running on port 3001
-2. Start the dev server: `npm run dev`
-3. Open http://localhost:5173
+1. Start the dev server: `npm run dev`
+2. Open http://localhost:5176
+3. API routes available at `http://localhost:5176/api/v1/*`

### Backend not responding
-Make sure the backend is running:
-```bash
-cd ../backend
-npm run dev
-```
+SvelteKit serves both frontend and API. Check:
+- Port 5176 is not in use
+- `npm run dev` started successfully
+- Browser console for errors
```

---

#### 7. `/viewer-svelte/ROUTES_REFERENCE.md`
**Current Status:** References port 5177
**Line References:**
- Line 76: Default API URL as `http://localhost:5177`

**Required Changes:**
```diff
## Environment Configuration

Set the API base URL via environment variable:

```bash
# .env.local
-VITE_API_URL=http://localhost:5177
+# API uses relative URLs (same origin as frontend)
+# No VITE_API_URL needed for local development
```

-Default: `http://localhost:5177`
+Default: Relative URLs (same origin)
```

---

#### 8. `/VIEWER_README.md`
**Current Status:** Describes dual server setup
**Line References:**
- Lines 54-89: Architecture section describes Express backend on port 3001
- Lines 82-90: "Running the Viewer" with dual servers
- Lines 92-100: Building for production references viewer directory

**Required Changes:**
```diff
### Architecture

-**Backend (Express API Server)**
-- `/api/itineraries` - List all itineraries
-- `/api/itineraries/:id` - Get itinerary details
-...
-
**Frontend (Vite + React + Tailwind)**
+**SvelteKit (Frontend + API)**
+- `/api/v1/itineraries` - List all itineraries
+- `/api/v1/itineraries/:id` - Get itinerary details
+- `/api/v1/designer/sessions` - Trip designer chat
- List view with all itineraries
- Detail view with segment timeline

### Running the Viewer

-1. Set up environment variables:
-
-```bash
-# Copy example env file
-cp .env.example .env
-
-# Edit .env and add your OpenRouter API key
-OPENROUTER_API_KEY=your_key_here
-```
-
-2. Start both API server and viewer:
+Start the SvelteKit dev server:

```bash
-npm run viewer
+cd viewer-svelte && npm run dev
```

-This will start:
-- API server on http://localhost:3001
-- Vite dev server on http://localhost:5173
-
-3. Open http://localhost:5173 in your browser
+This will start SvelteKit on http://localhost:5176
+Open in your browser to access frontend and API.
```

---

#### 9. `/viewer-svelte/DEPLOYMENT_CHECKLIST.md`
**Current Status:** Correctly describes Vercel but references Express
**Line References:**
- Line 175: "Express server in `src/server/` is not deployed (CLI-only)"

**Required Changes:**
```diff
## Notes

-- Express server in `src/server/` is not deployed (CLI-only)
+- Express server (`src/server/`) is deprecated for web deployment
+- For local development, use SvelteKit: `cd viewer-svelte && npm run dev`
- All production traffic goes through SvelteKit routes
```

---

### 🟢 LOW PRIORITY - Historical Documentation

#### 10. `/viewer-svelte/SVELTEKIT_API_MIGRATION.md`
**Current Status:** ✅ Correctly describes migration (historical record)
**Action:** No changes needed - this is a historical migration document

**Note for future readers:**
- Lines 164-176: Express Server Status section correctly notes it's "CLI-only"
- This document serves as evidence that migration occurred

---

## Additional Files Found

### Files with Port 5177 References (Non-Documentation)

These are code/config files that may also need review:

1. **Test Files:**
   - `test-tool-call-streaming.mjs`
   - `viewer-svelte/test-api-key-validation.mjs`
   - `test-service-cache.mjs`
   - `test-session-fix.mjs`

2. **Mock Servers:**
   - `viewer-svelte/mock-server.js` - Mock API server for testing

3. **Example Scripts:**
   - `examples/trip-designer-api-demo.ts` - Uses Express API endpoints

4. **Source Code:**
   - `src/server/index.ts` - Express server implementation
   - `viewer-svelte/src/lib/api.ts` - API client with VITE_API_URL fallback

**Recommendation:** Review these files separately to determine if they should:
- Be updated to use SvelteKit endpoints
- Be marked as deprecated/legacy
- Be removed entirely

---

## Environment Variable Migration

### Old Pattern (Dual Server)
```bash
# viewer-svelte/.env
VITE_API_URL=http://localhost:5177
```

### New Pattern (SvelteKit Only)
```bash
# viewer-svelte/.env
OPENROUTER_API_KEY=your-key-here
SERPAPI_KEY=your-key-here
# VITE_API_URL not needed (uses relative URLs)
```

**Impact:**
- `VITE_API_URL` environment variable is **no longer needed** for local development
- API client in `viewer-svelte/src/lib/api.ts` uses relative URLs by default
- Only set `VITE_API_URL` if testing against external API server

---

## Package.json Scripts Audit

### Root `package.json`

**Current Scripts:**
```json
{
  "server": "tsx src/server/index.ts",
  "viewer": "concurrently \"npm run server\" \"npm run viewer:dev\"",
  "viewer:dev": "cd viewer && npm run dev",
  "viewer:build": "cd viewer && npm run build"
}
```

**Issues:**
- ❌ `npm run server` - Starts deprecated Express server
- ❌ `npm run viewer` - Runs Express + old viewer directory (not viewer-svelte)
- ❌ `viewer:dev` and `viewer:build` reference wrong directory

**Recommended Changes:**
```json
{
  "server": "tsx src/server/index.ts",  // Keep for CLI/testing
  "dev": "cd viewer-svelte && npm run dev",
  "build": "cd viewer-svelte && npm run build",
  "preview": "cd viewer-svelte && npm run preview"
}
```

---

## Migration Checklist

### Documentation Updates Required

- [ ] **CLAUDE.md** - Update architecture, remove dual deployment model
- [ ] **ops_memories.md** - Rewrite deployment procedures for SvelteKit
- [ ] **examples/README.md** - Update prerequisites and troubleshooting
- [ ] **TRIP_DESIGNER_API.md** - Update base URLs and endpoints
- [ ] **TRIP_DESIGNER_IMPLEMENTATION.md** - Update API endpoint paths
- [ ] **QUICKSTART.md** - Remove backend references, update ports
- [ ] **ROUTES_REFERENCE.md** - Update API URL configuration
- [ ] **VIEWER_README.md** - Rewrite architecture section
- [ ] **DEPLOYMENT_CHECKLIST.md** - Update Express server notes

### Optional Updates

- [ ] **package.json** - Update npm scripts to reference viewer-svelte
- [ ] **example scripts** - Update to use SvelteKit endpoints
- [ ] **test files** - Migrate to SvelteKit API URLs
- [ ] **src/server/index.ts** - Add deprecation notice in comments

### Verification Steps

After documentation updates:

1. Search for remaining references:
   ```bash
   grep -r "5177" --exclude-dir=node_modules --exclude-dir=.git
   grep -r "npm run server" --exclude-dir=node_modules
   grep -r "Express.*server" --exclude-dir=node_modules
   grep -r "dual.*server" --exclude-dir=node_modules -i
   ```

2. Test documentation accuracy:
   - Follow CLAUDE.md quick start commands
   - Verify ports match actual configuration
   - Ensure API endpoints are correct

3. Update .env.example files:
   - Remove `VITE_API_URL` from examples
   - Add comments explaining SvelteKit's relative URL behavior

---

## Recommended Communication

When communicating the change to users/developers:

### Migration Notice Template

```markdown
## Architecture Change: SvelteKit-Only Deployment

**Effective:** 2025-12-22

The Itinerator project has migrated from a dual-server architecture to SvelteKit-only:

**Before (Old):**
- Frontend: SvelteKit on port 5176
- API: Express on port 5177
- Command: `npm run server` + `npm run viewer:dev`

**After (New):**
- Combined: SvelteKit on port 5176
- API Routes: `/api/v1/*` served by SvelteKit
- Command: `cd viewer-svelte && npm run dev`

**What Changed:**
- ✅ All Express API routes migrated to SvelteKit
- ✅ Single dev server instead of two
- ✅ Simpler deployment (SvelteKit handles both)
- ✅ Same-origin requests (no CORS needed)

**What Stayed the Same:**
- API endpoints still available at `/api/v1/*`
- All functionality preserved
- Environment variables same (OPENROUTER_API_KEY, etc.)

**Action Required:**
1. Update local dev workflow to use `cd viewer-svelte && npm run dev`
2. Remove `VITE_API_URL` from `.env` (no longer needed)
3. Update any scripts referencing port 5177 to use 5176

**Questions?** See updated documentation in CLAUDE.md
```

---

## Summary Statistics

**Files Requiring Updates:** 9 critical documentation files
**Files for Review:** 6 code/test files
**Environment Variables:** 1 obsolete (VITE_API_URL)
**Port Changes:** 5177 → 5176
**Architecture Change:** Dual server → Single SvelteKit server

**Estimated Effort:**
- Documentation updates: 2-3 hours
- Code/script review: 1-2 hours
- Testing verification: 1 hour
- **Total:** 4-6 hours

---

## Appendix: Search Commands Used

```bash
# Find all references to port 5177
grep -r "5177" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.mcp-browser

# Find references to "npm run server"
grep -r "npm run server" --exclude-dir=node_modules --exclude-dir=.git

# Find Express server references
grep -ri "Express.*server" --exclude-dir=node_modules --exclude-dir=.git

# Find dual server references
grep -ri "dual.*server\|two.*server" --exclude-dir=node_modules --exclude-dir=.git

# Find dual deployment references
grep -ri "dual.*deployment" --exclude-dir=node_modules --exclude-dir=.git

# Find VITE_API_URL references
grep -r "VITE_API_URL" --exclude-dir=node_modules --exclude-dir=.git

# List all markdown files
find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*"
```

---

**End of Research Document**
