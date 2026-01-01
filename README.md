# Itinerator

A modern TypeScript CLI tool for managing travel itineraries.

## Features

- 🚀 Modern TypeScript with strict type checking
- 📦 ESM-first architecture
- 🎨 Interactive CLI with beautiful prompts
- ✅ Comprehensive testing with Vitest
- 🔍 Fast linting and formatting with Biome
- 📝 Type-safe validation with Zod

## Installation

```bash
npm install
npm run build
```

## Development

```bash
# Build the project
npm run build

# Watch mode for development
npm run dev

# Run the CLI
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## Usage

```bash
# Show version
itinerator --version

# Initialize configuration
itinerator setup

# Create a new itinerary
itinerator itinerary create

# List all itineraries
itinerator itinerary list

# Show itinerary details
itinerator itinerary show <id>

# Run demo
itinerator demo

# Check installation
itinerator doctor
```

## Project Structure

```
itinerator/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── core/                 # Core business logic
│   ├── domain/               # Domain models
│   │   ├── types/            # TypeScript type definitions
│   │   └── schemas/          # Zod validation schemas
│   ├── services/             # Business services
│   ├── storage/              # Data persistence
│   ├── cli/                  # CLI interface
│   │   ├── commands/         # Command implementations
│   │   ├── prompts/          # Interactive prompts
│   │   └── output/           # Output formatting
│   └── utils/                # Utility functions
├── tests/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── fixtures/             # Test fixtures
├── data/
│   └── itineraries/          # Stored itineraries
└── scripts/                  # Build and utility scripts
```

## License

MIT
