# Vercel Deployment Configuration

## Configuration Summary

### Project Structure
- **Project Root:** `/Users/masa/Projects/itinerator`
- **SvelteKit App:** `viewer-svelte/`
- **Shared Services:** `src/services/` and `src/domain/`

### Vercel Configuration (`vercel.json`)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd viewer-svelte && npm ci && npm run build",
  "outputDirectory": "viewer-svelte/.vercel/output",
  "devCommand": "cd viewer-svelte && npm run dev"
}
```

### Key Configuration Points

1. **Build Command:** Runs from project root, then enters `viewer-svelte/` subdirectory
   - This allows the build to access parent directory files (`src/services/`, `src/domain/`)
   
2. **Output Directory:** Points to `viewer-svelte/.vercel/output`
   - This is where `@sveltejs/adapter-vercel` generates the Vercel build output
   - NOT `.svelte-kit/output/` (that's the SvelteKit build, not Vercel format)

3. **File Access via Aliases:** 
   - `svelte.config.js` defines aliases: `$services` → `../src/services`
   - `vite.config.ts` resolves aliases with absolute paths
   - Vite server allows serving files from parent directory

### Vercel Ignore Configuration (`.vercelignore`)

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

## Deployment Process

### From Project Root (Recommended)

```bash
# Preview deployment
cd /Users/masa/Projects/itinerator
vercel

# Production deployment
cd /Users/masa/Projects/itinerator
vercel --prod
```

### What Happens During Deployment

1. Vercel uploads files from project root (excluding `.vercelignore` patterns)
2. Executes: `cd viewer-svelte && npm ci && npm run build`
3. SvelteKit build resolves aliases to `../src/services/` and `../src/domain/`
4. `@sveltejs/adapter-vercel` generates output in `viewer-svelte/.vercel/output/`
5. Vercel uses `outputDirectory` setting to find the build output

## Testing Endpoints

After deployment, test these endpoints:

```bash
# Get deployment URL
DEPLOY_URL=$(vercel inspect --wait | grep -o 'https://[^[:space:]]*')

# Test API endpoints
curl "$DEPLOY_URL/api/health"
curl "$DEPLOY_URL/api/itineraries"
```

## Troubleshooting

### Build fails with "Cannot find module '../src/services'"
- **Cause:** Building from wrong directory or aliases not configured
- **Solution:** Ensure `buildCommand` starts with `cd viewer-svelte`

### Output directory not found
- **Cause:** Wrong `outputDirectory` path
- **Solution:** Use `viewer-svelte/.vercel/output` (adapter-vercel output location)

### Files not accessible during build
- **Cause:** Missing from Vercel upload (`.vercelignore` too aggressive)
- **Solution:** Check `.vercelignore` includes `!/src` and `!/viewer-svelte`

## Project Links

- **Project:** Itinerator
- **Project ID:** prj_Sja5XyHLjbtozgEKU93OfI1KUrE4
- **Organization:** team_ErcARK9OcmFb8zc77Khd4i2z
- **User:** bobmatnyc
