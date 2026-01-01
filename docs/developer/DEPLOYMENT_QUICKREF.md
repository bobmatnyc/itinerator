# Vercel Deployment Quick Reference

## TL;DR

```bash
# Preview deployment
cd /Users/masa/Projects/itinerator
vercel

# Production deployment
cd /Users/masa/Projects/itinerator
vercel --prod
```

## The Fix

**Problem**: SvelteKit app in subdirectory needs access to parent directory files.

**Solution**: Updated `vercel.json` with correct `outputDirectory`:

```json
{
  "buildCommand": "cd viewer-svelte && npm ci && npm run build",
  "outputDirectory": "viewer-svelte/.vercel/output"
}
```

**Key Point**: Must deploy from project root, NOT from `viewer-svelte/` subdirectory.

## Configuration Summary

| Setting | Value | Why |
|---------|-------|-----|
| `buildCommand` | `cd viewer-svelte && npm ci && npm run build` | Build from root, access parent files |
| `outputDirectory` | `viewer-svelte/.vercel/output` | Where adapter-vercel puts output |
| Deploy from | `/Users/masa/Projects/itinerator` | Project root |
| Adapter | `@sveltejs/adapter-vercel` | Generates Vercel-compatible output |

## How It Works

1. **Build runs from project root** → Can access `src/services/` and `src/domain/`
2. **Vite aliases resolve parent imports** → `$services` → `../src/services`
3. **adapter-vercel generates output** → `viewer-svelte/.vercel/output/`
4. **Vercel finds output** → Uses `outputDirectory` setting

## Common Mistakes to Avoid

- **Don't deploy from `viewer-svelte/` subdirectory** → Parent files won't be accessible
- **Don't use `.svelte-kit/output/`** → That's SvelteKit output, not Vercel format
- **Don't use `cp -r .vercel/output ../`** → Not needed, use `outputDirectory` instead
- **Don't forget to deploy from root** → Build needs access to `../src/`

## Testing

```bash
# Local build test
cd viewer-svelte && npm run build

# Verify output exists
ls viewer-svelte/.vercel/output/

# Test deployment
vercel

# Test API
curl <deployment-url>/api/v1/itineraries
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot find module '../src/services'" | Deploy from root, not viewer-svelte/ |
| "Output directory not found" | Use `viewer-svelte/.vercel/output` |
| Build works locally but fails on Vercel | Check `.vercelignore` includes `!/src` |

## Files Changed

- `/vercel.json` - Added `outputDirectory` setting
- `/DEPLOYMENT.md` - Comprehensive guide
- `/deploy.sh` - Deployment helper script
- `/DEPLOYMENT_QUICKREF.md` - This file

## Next Steps

1. Test preview deployment: `vercel`
2. Verify API endpoints work
3. Deploy to production: `vercel --prod`
4. Set environment variables in Vercel dashboard
