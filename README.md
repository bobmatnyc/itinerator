# Itinerator

A modern travel itinerary management system with CLI and web interfaces, featuring AI-powered trip planning.

## Features

- 🌐 **Full-Stack Web Application** - SvelteKit with beautiful UI and real-time updates
- 🤖 **AI Trip Designer** - Natural language trip planning powered by LLMs
- 📱 **Interactive Maps** - Leaflet-based visualization of itineraries
- 🚀 **Modern TypeScript** - Strict type checking with branded types
- 💾 **Flexible Storage** - JSON files (local) or Vercel Blob (production)
- 🎨 **Beautiful CLI** - Interactive command-line interface with prompts
- 📦 **Import Wizard** - Extract itineraries from PDFs, emails, and bookings
- ✅ **Comprehensive Testing** - Unit, integration, E2E, and AI evaluation tests
- 🧪 **Traveler Personas** - Realistic testing with simulated user agents

## Quick Start (5 Minutes)

### Prerequisites

- Node.js 20+ and npm
- Git

### Local Development

```bash
# 1. Clone and install
git clone <repo-url>
cd itinerator
make install

# 2. Start the web application (frontend + API)
make dev

# 3. Open browser to http://localhost:5176
```

That's it! The web app is running with API routes at `/api/v1/*`.

### Using the CLI

```bash
# Build the CLI
make build-cli

# Run commands
npx itinerator --version
npx itinerator setup              # Configure API keys
npx itinerator itinerary list     # List itineraries
npx itinerator itinerary create   # Create new itinerary
npx itinerator demo               # Run demo
```

## Architecture

Itinerator has **two interfaces** sharing the same TypeScript core library:

```
itinerator/
├── src/                    # Core TypeScript library (shared)
│   ├── domain/             # Types, schemas, branded types
│   ├── services/           # Business logic services
│   └── storage/            # Storage backends (JSON, Blob)
├── viewer-svelte/          # SvelteKit full-stack application
│   ├── src/routes/         # Frontend pages
│   └── src/routes/api/v1/  # API routes (backend)
├── tests/
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   ├── e2e/                # End-to-end tests
│   └── eval/               # AI model evaluation
└── dist/                   # CLI build output (tsup)
```

### Deployment Model

| Component | Local Development | Production (Vercel) |
|-----------|-------------------|---------------------|
| **Frontend** | SvelteKit on port 5176 | SvelteKit on Vercel |
| **API** | SvelteKit routes `/api/v1/*` | SvelteKit routes `/api/v1/*` |
| **Storage** | JSON files in `./data/` | Vercel Blob |
| **CLI** | Direct library imports | N/A (local only) |

## Key Technologies

- **TypeScript 5.7** - Strict mode, branded types
- **Svelte 5** - Runes-based reactivity (.svelte.ts stores)
- **SvelteKit 2** - Full-stack framework with Vercel adapter
- **Vercel Blob** - Cloud storage for itineraries
- **OpenRouter** - LLM API for AI-powered features
- **Leaflet** - Interactive maps
- **Zod** - Schema validation
- **Vitest** - Testing framework
- **Biome** - Fast linting and formatting

## Make Commands

All common tasks are available through the Makefile:

```bash
# Development
make dev              # Start SvelteKit dev server
make dev-cli          # Build CLI in watch mode
make build            # Build CLI and viewer

# Testing
make test             # Run all tests
make test-unit        # Unit tests only
make test-e2e         # End-to-end tests
make test-persona     # Traveler persona tests
make test-eval        # AI model evaluation
make test-coverage    # Tests with coverage

# Quality
make lint             # Check code quality
make lint-fix         # Auto-fix issues
make format           # Format code
make typecheck        # Type checking
make quality          # All quality checks

# Deployment
make deploy           # Deploy to Vercel (production)
make deploy-preview   # Deploy preview

# Maintenance
make clean            # Remove build artifacts
make install          # Install dependencies
make doctor           # Check system setup
```

Run `make help` to see all available commands.

## AI Features

### Trip Designer

The Trip Designer uses LLMs to create personalized itineraries through natural conversation:

```typescript
// Web: Use the Trip Designer UI at /designer
// CLI: Coming soon
```

Features:
- Natural language trip requests
- Multi-turn conversations for refinement
- Flight booking recommendations
- Hotel suggestions
- Activity planning
- Real-time streaming responses

### Import Wizard

Extract itineraries from various sources:

```bash
# CLI
npx itinerator import pdf booking-confirmation.pdf
npx itinerator import email confirmation.eml
npx itinerator import calendar events.ics

# Web: Use the Import UI
```

Supports:
- Flight confirmations (PDF, email)
- Hotel bookings
- Calendar events (ICS)
- Multi-document import

## Testing Framework

### E2E Testing with Traveler Personas

Realistic testing using simulated traveler agents:

```bash
# Test all personas
make test-persona

# Test specific persona
npm run test:persona:solo        # Solo backpacker
npm run test:persona:couple      # Romantic couple
npm run test:persona:family      # Family with kids
```

Each persona has:
- Unique travel preferences
- Realistic conversation patterns
- Validation expectations
- Budget and pace requirements

### Model Evaluation

Compare LLM performance across providers:

```bash
# Run evaluation suite
make test-eval

# Compare specific models
npm run eval:compare

# View results
npm run eval:promptfoo:view
```

Metrics tracked:
- Response quality scores
- Latency (p50, p95, p99)
- Cost per request
- Success rates
- Tool calling accuracy

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage | Production |
| `OPENROUTER_API_KEY` | LLM API access | For AI features |
| `SERPAPI_KEY` | Travel search | For Travel Agent |
| `VITE_API_URL` | Frontend API URL | Local dev only |

### Local Development Setup

```bash
# Create viewer-svelte/.env
OPENROUTER_API_KEY=your_key_here
SERPAPI_KEY=your_key_here

# Or use CLI config
npx itinerator setup
```

## Project Structure

See [STRUCTURE.md](./STRUCTURE.md) for detailed architecture documentation.

## Development Guidelines

See [CODE.md](./CODE.md) for coding standards and best practices.

## Deployment

See [DEPLOY.md](./DEPLOY.md) for deployment procedures and Vercel configuration.

## CLI Reference

```bash
# Setup
itinerator setup                  # Configure API keys
itinerator doctor                 # Check installation

# Itinerary Management
itinerator itinerary list         # List all itineraries
itinerator itinerary create       # Create new itinerary
itinerator itinerary show <id>    # Show itinerary details
itinerator itinerary delete <id>  # Delete itinerary

# Import
itinerator import pdf <file>      # Import from PDF
itinerator import email <file>    # Import from email
itinerator import calendar <file> # Import from calendar

# Utilities
itinerator demo                   # Run demo
itinerator --version              # Show version
itinerator --help                 # Show help
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run quality checks: `make quality`
5. Run tests: `make test`
6. Commit changes: `git commit -m 'feat: add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Development Workflow

```bash
# 1. Make changes
# 2. Run quality checks
make quality

# 3. Run tests
make test

# 4. Format code
make format

# 5. Commit with conventional commits
git commit -m "feat: add new feature"
```

## Troubleshooting

### Web App Not Loading

```bash
# Check if dev server is running
cd viewer-svelte && npm run dev

# Should see: VITE ready at http://localhost:5176
```

### API Routes Return 404

- Ensure SvelteKit dev server is running on port 5176
- Check browser console for errors
- Verify API routes exist in `viewer-svelte/src/routes/api/v1/`

### CLI Commands Fail

```bash
# Rebuild CLI
make build-cli

# Check configuration
npx itinerator doctor
```

### Import/Trip Designer Disabled

- Set `OPENROUTER_API_KEY` in `viewer-svelte/.env` (web)
- Or run `npx itinerator setup` (CLI)
- Or set environment variable: `export OPENROUTER_API_KEY=your_key`

### Vercel Deployment Issues

- Verify `BLOB_READ_WRITE_TOKEN` is set in Vercel dashboard
- Check Vercel logs for initialization errors
- Ensure all required environment variables are configured

## Documentation

- [CLAUDE.md](./CLAUDE.md) - AI agent instructions and architecture
- [CODE.md](./CODE.md) - Coding standards (coming soon)
- [DEVELOPER.md](./DEVELOPER.md) - Developer guide (coming soon)
- [DEPLOY.md](./DEPLOY.md) - Deployment procedures (coming soon)
- [STRUCTURE.md](./STRUCTURE.md) - Project structure details (coming soon)

## License

MIT

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Run `make doctor` for system diagnostics
