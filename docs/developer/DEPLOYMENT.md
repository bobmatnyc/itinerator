# Vercel Deployment Guide - Itinerator

## Overview

This project deploys a SvelteKit application (`viewer-svelte/`) that requires access to parent directory files (`src/services/`, `src/domain/`). The deployment is configured to build from the project root while targeting the SvelteKit subdirectory.

## Quick Start

### Preview Deployment
```bash
# From project root
./deploy.sh

# Or directly with Vercel CLI
vercel
```

### Production Deployment
```bash
# From project root
./deploy.sh --prod

# Or directly with Vercel CLI
vercel --prod
```

## Configuration Files

### `/vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd viewer-svelte && npm ci && npm run build",
  "outputDirectory": "viewer-svelte/.vercel/output",
  "devCommand": "cd viewer-svelte && npm run dev"
}
```

**Key Points:**
- `buildCommand`: Changes to `viewer-svelte/` subdirectory, installs dependencies, and builds
- `outputDirectory`: Points to where `@sveltejs/adapter-vercel` generates its output
- Build runs from project root, allowing access to `../src/` directories

### `/.vercelignore`
```
# Ignore CLI and test files
/tests
/dist
*.test.ts
*.spec.ts

# Keep necessary directories for viewer-svelte
!/src
!/viewer-svelte
!/data

# Ignore node_modules (will be installed during build)
/node_modules
/viewer-svelte/node_modules

# Ignore development files
.env
.env.local
*.log
```

**Key Points:**
- Excludes test files and build artifacts
- Explicitly includes `/src`, `/viewer-svelte`, and `/data` directories
- Node modules are reinstalled during deployment

### `/viewer-svelte/svelte.config.js`
```javascript
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      runtime: 'nodejs20.x'
    }),
    alias: {
      $services: '../src/services',
      $domain: '../src/domain'
    }
  }
};

export default config;
```

**Key Points:**
- Uses `@sveltejs/adapter-vercel` for Vercel-specific build output
- Defines aliases for importing parent directory modules
- Runtime set to Node.js 20.x

### `/viewer-svelte/vite.config.ts`
```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      $services: path.resolve(__dirname, '../src/services'),
      $domain: path.resolve(__dirname, '../src/domain')
    }
  },
  assetsInclude: ['**/*.md'],
  server: {
    port: 5176,
    fs: {
      allow: ['..']
    }
  },
  preview: {
    port: 5176
  }
});
```

**Key Points:**
- Resolves aliases to absolute paths
- Allows Vite to serve files from parent directory (`allow: ['..']`)
- Includes markdown files as assets for `?raw` imports

## Project Structure

```
/Users/masa/Projects/itinerator/
├── src/
│   ├── services/          # Shared services (imported by SvelteKit)
│   ├── domain/            # Domain types and schemas (imported by SvelteKit)
│   └── ...
├── viewer-svelte/         # SvelteKit application
│   ├── src/
│   │   ├── routes/        # SvelteKit routes and API endpoints
│   │   └── lib/           # SvelteKit components
│   ├── .vercel/
│   │   └── output/        # Build output (used by Vercel)
│   ├── svelte.config.js   # SvelteKit configuration
│   ├── vite.config.ts     # Vite configuration with aliases
│   └── package.json
├── vercel.json            # Vercel deployment configuration
├── .vercelignore          # Files to exclude from deployment
├── deploy.sh              # Deployment helper script
└── DEPLOYMENT.md          # This file
```

## How It Works

### Build Process

1. **Vercel Upload**: Vercel uploads files from project root (excluding `.vercelignore` patterns)
   
2. **Build Execution**: Runs `cd viewer-svelte && npm ci && npm run build`
   - Changes to `viewer-svelte/` subdirectory
   - Installs dependencies with `npm ci`
   - Executes `vite build`

3. **Vite Build**: 
   - Resolves `$services` alias to `../src/services`
   - Resolves `$domain` alias to `../src/domain`
   - Bundles application code and dependencies
   - Generates SvelteKit build in `.svelte-kit/output/`

4. **Adapter-Vercel**:
   - Transforms SvelteKit build into Vercel format
   - Generates serverless functions for API routes
   - Creates static assets
   - Outputs to `viewer-svelte/.vercel/output/`

5. **Vercel Deployment**:
   - Reads `outputDirectory` from `vercel.json`
   - Uses `viewer-svelte/.vercel/output/` as deployment source
   - Deploys functions and static assets

### Import Resolution

SvelteKit code can import from parent directories using aliases:

```typescript
// In viewer-svelte/src/routes/api/v1/itineraries/+server.ts
import { ItineraryService } from '$services/itinerary.service';
import type { Itinerary } from '$domain/types';
```

These are resolved by:
1. SvelteKit alias configuration in `svelte.config.js`
2. Vite alias resolution in `vite.config.ts`
3. Vite server allowing parent directory access

## Deployment Verification

### Pre-Deployment Checklist

- [ ] Verify `vercel.json` configuration
- [ ] Ensure `.vercelignore` includes necessary directories
- [ ] Test local build: `cd viewer-svelte && npm run build`
- [ ] Verify adapter output exists: `ls viewer-svelte/.vercel/output/`
- [ ] Check environment variables in Vercel dashboard

### Post-Deployment Testing

```bash
# Get deployment URL
DEPLOY_URL=$(vercel inspect --wait | grep -o 'https://[^[:space:]]*')

# Test API endpoints
curl "$DEPLOY_URL/api/v1/itineraries"
curl "$DEPLOY_URL/api/v1/agent/models"

# Test frontend
open "$DEPLOY_URL"
```

### API Endpoints to Test

- `GET /api/v1/itineraries` - List all itineraries
- `GET /api/v1/itineraries/:id` - Get specific itinerary
- `POST /api/v1/itineraries/:id/segments` - Add segment
- `POST /api/v1/agent/import/pdf` - Import PDF
- `GET /api/v1/agent/models` - List available models
- `POST /api/v1/designer/sessions` - Create design session

## Troubleshooting

### Build Fails: "Cannot find module '../src/services'"

**Cause**: Build is not finding parent directory modules

**Solutions**:
1. Verify `buildCommand` in `vercel.json` starts with `cd viewer-svelte`
2. Check `.vercelignore` includes `!/src` to upload source files
3. Ensure aliases are configured in both `svelte.config.js` and `vite.config.ts`

### Build Fails: "Output directory not found"

**Cause**: Vercel can't find the build output

**Solutions**:
1. Verify `outputDirectory` is set to `viewer-svelte/.vercel/output`
2. NOT `.svelte-kit/output/` (that's SvelteKit output, not Vercel format)
3. Ensure `@sveltejs/adapter-vercel` is installed and configured

### Build Succeeds but Pages Don't Load

**Cause**: Static assets or routing configuration issues

**Solutions**:
1. Check Vercel function logs in dashboard
2. Verify environment variables are set in Vercel
3. Test local preview build: `cd viewer-svelte && npm run preview`
4. Check browser console for errors

### API Routes Return 500 Errors

**Cause**: Runtime errors in serverless functions

**Solutions**:
1. Check Vercel function logs: `vercel logs <deployment-url>`
2. Verify environment variables are configured
3. Test endpoints locally: `npm run preview`
4. Check for missing dependencies in `package.json`

## Environment Variables

### Required Variables

Set these in the Vercel dashboard (Project Settings → Environment Variables):

- `OPENAI_API_KEY` - OpenAI API key for LLM services
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude models
- Additional keys as needed by your services

### Setting Environment Variables

```bash
# Using Vercel CLI
vercel env add OPENAI_API_KEY production
vercel env add ANTHROPIC_API_KEY production

# Or via Vercel Dashboard
# Project Settings → Environment Variables → Add
```

## Deployment Commands Reference

### Preview Deployment
```bash
# Interactive deployment
vercel

# Non-interactive with defaults
vercel --yes

# Specific scope
vercel --scope=your-team
```

### Production Deployment
```bash
# Interactive production deployment
vercel --prod

# Non-interactive production deployment
vercel --prod --yes
```

### Monitoring Deployments
```bash
# List recent deployments
vercel ls

# View deployment logs
vercel logs <deployment-url>

# Inspect deployment
vercel inspect <deployment-url>
```

### Managing Project
```bash
# View current project
vercel project ls

# Link to existing project
vercel link

# Remove deployment
vercel remove <deployment-url>
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Vercel CLI
        run: npm i -g vercel@latest
      
      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=${{ github.ref == 'refs/heads/main' && 'production' || 'preview' }} --token=${{ secrets.VERCEL_TOKEN }}
      
      - name: Deploy to Vercel
        run: vercel deploy ${{ github.ref == 'refs/heads/main' && '--prod' || '' }} --token=${{ secrets.VERCEL_TOKEN }}
```

## Project Information

- **Project Name**: Itinerator
- **Project ID**: prj_Sja5XyHLjbtozgEKU93OfI1KUrE4
- **Organization**: team_ErcARK9OcmFb8zc77Khd4i2z
- **User**: bobmatnyc
- **Framework**: SvelteKit
- **Adapter**: @sveltejs/adapter-vercel
- **Runtime**: Node.js 20.x

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [SvelteKit Documentation](https://kit.svelte.dev/)
- [adapter-vercel Documentation](https://kit.svelte.dev/docs/adapter-vercel)
- [Vercel CLI Reference](https://vercel.com/docs/cli)

## Support

For deployment issues:
1. Check Vercel function logs in dashboard
2. Review build logs for errors
3. Test local build: `cd viewer-svelte && npm run build`
4. Verify configuration files match this guide
