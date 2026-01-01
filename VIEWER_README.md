# Itinerator Web Viewer

This document describes the new features added to Itinerator: Dynamic Model Selection and Web Viewer.

## Feature 1: Dynamic Model Selection

The `ModelSelectorService` automatically selects the most cost-effective model based on PDF file size.

### How It Works

- **Small files (<500KB)**: Uses `claude-3-haiku` (8,192 tokens, $0.25/M input)
- **Medium files (<2MB)**: Uses `claude-3.5-sonnet` (16,384 tokens, $3.00/M input)
- **Large files (<10MB)**: Uses `claude-3-opus` (32,768 tokens, $15.00/M input)

### Usage

```typescript
import { ModelSelectorService } from './services/model-selector.service.js';

const selector = new ModelSelectorService();

// Auto-select model based on file size
const result = await selector.selectModelForFile('path/to/file.pdf');
if (result.success) {
  console.log(`Selected model: ${result.value.name}`);
  console.log(`Max tokens: ${result.value.maxTokens}`);
}

// Estimate cost
const costResult = await selector.estimateCost('path/to/file.pdf');
if (costResult.success) {
  console.log(`Estimated cost: $${costResult.value.estimatedCost.toFixed(4)}`);
}
```

### Integration

The `DocumentImportService` now automatically uses `ModelSelectorService` when no model is specified:

```bash
# Auto-selects best model based on file size
itinerator import my-itinerary.pdf

# Or specify a model explicitly
itinerator import my-itinerary.pdf --model anthropic/claude-3.5-sonnet
```

## Feature 2: Web Viewer

A modern SvelteKit-based web interface for viewing and managing itineraries.

### Architecture

**SvelteKit (Frontend + API)**
- `/api/v1/itineraries` - List all itineraries
- `/api/v1/itineraries/:id` - Get itinerary details
- `/api/v1/designer/sessions` - Create chat sessions
- `/api/v1/agent/import/pdf` - Import PDF (multipart form)
- Frontend routes for UI

**Features:**
- List view with all itineraries
- Detail view with segment timeline
- Visual indicators for segment source (📄 import, 🤖 agent, ✍️ manual)
- Color-coded segment types
- PDF import with model selection
- Interactive chat designer

### Running the Viewer

1. Set up environment variables:

```bash
cd viewer-svelte

# Copy example env file
cp .env.example .env

# Edit .env and add your OpenRouter API key (optional)
OPENROUTER_API_KEY=your_key_here
```

2. Start the SvelteKit server:

```bash
cd viewer-svelte && npm run dev
```

This will start:
- SvelteKit server (frontend + API) on http://localhost:5176

3. Open http://localhost:5176 in your browser

### Building for Production

```bash
# Build SvelteKit app for production
cd viewer-svelte
npm run build

# Preview production build
npm run preview
```

### Features

**Itinerary List**
- Shows all imported itineraries
- Date ranges and trip metadata
- Tag-based filtering
- Click to view details

**Itinerary Detail**
- Complete segment timeline
- Source indicators (import/agent/manual)
- Status badges (confirmed, tentative, cancelled)
- Type-specific details (flight numbers, hotel names, etc.)
- Inferred segment highlighting

**PDF Import**
- Drag-and-drop or file select
- Model selection dropdown (or auto-select)
- Real-time import progress
- Continuity validation results

**Visual Design**
- Dark mode support
- Color-coded segments:
  - 🔵 Flights (blue)
  - 🟣 Hotels (purple)
  - 🟠 Transfers (orange)
  - 🟢 Activities (green)
  - 🔴 Meetings (indigo)
  - ⚪ Custom (gray)

## API Examples

### Import a PDF via API

```bash
curl -X POST http://localhost:5176/api/v1/agent/import/pdf \
  -F "file=@my-itinerary.pdf" \
  -F "model=anthropic/claude-3.5-sonnet"
```

### Get All Itineraries

```bash
curl http://localhost:5176/api/v1/itineraries
```

### Create a Chat Session

```bash
curl -X POST http://localhost:5176/api/v1/designer/sessions \
  -H "Content-Type: application/json" \
  -d '{"itineraryId":"your-id-here"}'
```

## Development

### Project Structure

```
itinerator/
├── src/
│   ├── services/             # Business logic services
│   └── domain/               # Types and schemas
├── viewer-svelte/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── api/v1/       # SvelteKit API routes
│   │   │   └── +page.svelte  # Frontend pages
│   │   ├── lib/
│   │   │   ├── components/   # Svelte components
│   │   │   ├── stores/       # Svelte stores
│   │   │   └── api.ts        # API client
│   │   └── app.d.ts
│   ├── svelte.config.js
│   └── vite.config.ts
└── package.json
```

### Scripts

- `cd viewer-svelte && npm run dev` - Start SvelteKit server (frontend + API)
- `cd viewer-svelte && npm run build` - Build for production
- `cd viewer-svelte && npm run preview` - Preview production build

## LOC Summary

**Feature 1: Model Selector Service**
- Added: ~200 lines (model-selector.service.ts)
- Modified: ~50 lines (document-import.service.ts, llm.service.ts)

**Feature 2: Web Viewer**
- Added: ~1,200 lines (server, viewer components, hooks, types)
- Modified: ~20 lines (package.json scripts)

**Total Net Change**: +1,470 lines

Both features integrate seamlessly with the existing codebase and maintain type safety throughout.
