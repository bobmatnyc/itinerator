# Vercel Deployment Guide

## Monorepo SvelteKit Setup

This project uses a monorepo structure with the SvelteKit viewer app in the `viewer-svelte/` subdirectory.

### Configuration

The `vercel.json` configuration handles the monorepo setup by:

1. **Building in subdirectory**: Changes to `viewer-svelte/` and runs `npm ci && npm run build`
2. **Copying output**: The `@sveltejs/adapter-vercel` creates `.vercel/output/` in the subdirectory, which is then copied to the project root
3. **Vercel detection**: Vercel automatically detects the `.vercel/output/` directory at the root

### Build Process

```bash
cd viewer-svelte        # Navigate to SvelteKit app
npm ci                  # Install dependencies
npm run build           # Build with adapter-vercel (creates .vercel/output/)
cp -r .vercel/output ../ # Copy to project root for Vercel
```

### Deployment Commands

#### Production Deployment
```bash
vercel --prod
```

#### Preview Deployment
```bash
vercel
```

#### Local Testing
```bash
cd viewer-svelte
npm run dev
```

### Troubleshooting

#### 404 on all routes
This typically means the output directory is incorrect. Verify:
- `@sveltejs/adapter-vercel` is installed in `viewer-svelte/package.json`
- Build creates `viewer-svelte/.vercel/output/`
- Copy command successfully moves output to project root

#### Build failures
Check:
- All dependencies are installed in `viewer-svelte/`
- TypeScript config is valid
- Svelte components have no syntax errors

#### Environment variables
For environment-specific configuration:
```bash
# Development
vercel env pull .env.local --environment=development

# Preview
vercel env pull .env.local --environment=preview

# Production
vercel env pull .env.local --environment=production
```

### Adapter Configuration

The SvelteKit app uses `@sveltejs/adapter-vercel` with Node.js 20.x runtime:

```javascript
// viewer-svelte/svelte.config.js
adapter: adapter({
  runtime: 'nodejs20.x'
})
```

### Project Structure

```
Itinerator/              # Project root
├── vercel.json            # Vercel configuration
├── viewer-svelte/         # SvelteKit app
│   ├── src/
│   ├── static/
│   ├── package.json
│   ├── svelte.config.js
│   └── .vercel/           # Build output (gitignored)
│       └── output/        # Adapter output
└── .vercel/               # Copied to root during build
    └── output/            # Vercel deployment format
```

### Important Notes

1. **Never commit `.vercel/` directory** - It's in `.gitignore`
2. **Adapter creates the output structure** - No manual configuration needed
3. **Copy command is essential** - Vercel expects `.vercel/output/` at project root
4. **Monorepo support** - This approach works for any subdirectory SvelteKit app
