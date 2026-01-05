# Itinerator Makefile
# Unified command interface for development, testing, and deployment

.PHONY: help dev build test lint clean deploy

# Default target
help:
	@echo "Itinerator - Make Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev              Start SvelteKit dev server (frontend + API)"
	@echo "  make dev-cli          Build CLI in watch mode"
	@echo "  make build            Build CLI and viewer"
	@echo "  make build-cli        Build CLI only"
	@echo "  make build-viewer     Build viewer only"
	@echo ""
	@echo "Testing:"
	@echo "  make test             Run all tests"
	@echo "  make test-unit        Run unit tests only"
	@echo "  make test-integration Run integration tests only"
	@echo "  make test-e2e         Run E2E tests"
	@echo "  make test-eval        Run model evaluation tests"
	@echo "  make test-persona     Run traveler persona tests"
	@echo "  make test-coverage    Run tests with coverage report"
	@echo ""
	@echo "Quality:"
	@echo "  make lint             Run linter (check only)"
	@echo "  make lint-fix         Run linter with auto-fix"
	@echo "  make format           Format code with Biome"
	@echo "  make typecheck        Run TypeScript type checking"
	@echo "  make quality          Run all quality checks (lint + typecheck)"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy           Deploy to Vercel (production)"
	@echo "  make deploy-preview   Deploy preview to Vercel"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean            Remove build artifacts"
	@echo "  make install          Install all dependencies"
	@echo "  make doctor           Check system setup"

# Development
dev:
	@echo "Starting SvelteKit dev server (frontend + API)..."
	cd viewer-svelte && npm run dev

dev-cli:
	@echo "Building CLI in watch mode..."
	npm run dev

# Build
build: build-cli build-viewer

build-cli:
	@echo "Building CLI..."
	npm run build

build-viewer:
	@echo "Building viewer..."
	cd viewer-svelte && npm run build

# Testing
test:
	@echo "Running all tests..."
	npm test

test-unit:
	@echo "Running unit tests..."
	npm run test:unit

test-integration:
	@echo "Running integration tests..."
	npm run test:integration

test-e2e:
	@echo "Running E2E tests..."
	npm run test:e2e

test-eval:
	@echo "Running model evaluation tests..."
	npm run test:eval

test-persona:
	@echo "Running traveler persona tests..."
	npm run test:persona

test-coverage:
	@echo "Running tests with coverage..."
	npm run test:coverage

# Quality
lint:
	@echo "Running linter..."
	npm run lint

lint-fix:
	@echo "Running linter with auto-fix..."
	npm run lint:fix

format:
	@echo "Formatting code..."
	npm run format

typecheck:
	@echo "Running TypeScript type checking..."
	npm run typecheck

quality: lint typecheck
	@echo "All quality checks passed!"

# Deployment
deploy:
	@echo "Deploying to Vercel (production)..."
	cd viewer-svelte && vercel --prod

deploy-preview:
	@echo "Deploying preview to Vercel..."
	cd viewer-svelte && vercel

# Maintenance
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf viewer-svelte/.svelte-kit/
	rm -rf viewer-svelte/build/
	@echo "Clean complete!"

install:
	@echo "Installing dependencies..."
	npm install
	cd viewer-svelte && npm install
	@echo "Dependencies installed!"

doctor:
	@echo "Checking system setup..."
	@node --version
	@npm --version
	@echo "Node and npm are installed!"
	@if [ -f .itinerator/config.yaml ]; then echo "CLI config found"; else echo "No CLI config (run: npx itinerator setup)"; fi
	@if [ -d data/itineraries ]; then echo "Data directory exists"; else echo "Creating data directory..."; mkdir -p data/itineraries; fi
	@echo "System check complete!"
