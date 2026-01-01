/**
 * Server entry point for CLI-only local development
 *
 * NOTE: This Express server is for CLI/local development only.
 * For production deployments, use the SvelteKit server routes in viewer-svelte/src/routes/api/
 *
 * The SvelteKit routes provide the same API endpoints optimized for Vercel deployment.
 *
 * @module server
 */

import { createApiServer } from './api.js';
import { SegmentService } from '../services/segment.service.js';
import { DependencyService } from '../services/dependency.service.js';
import { JsonItineraryStorage } from '../storage/json-storage.js';
import { YamlConfigStorage } from '../storage/yaml-config.js';
import type { ImportConfig } from '../domain/types/import.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';

async function main() {
  const port = Number(process.env.PORT) || 5177;

  // Ensure directories exist
  const dataDir = path.join(process.cwd(), 'data');
  const uploadsDir = path.join(dataDir, 'uploads');
  const itinerariesDir = path.join(dataDir, 'itineraries');

  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(itinerariesDir, { recursive: true });

  // Initialize services
  const storage = new JsonItineraryStorage(itinerariesDir);
  const initResult = await storage.initialize();

  if (!initResult.success) {
    console.error('Failed to initialize storage:', initResult.error);
    process.exit(1);
  }

  const segmentService = new SegmentService(storage);
  const dependencyService = new DependencyService(storage);

  // Load configuration from YAML, with env var fallback
  const configStorage = new YamlConfigStorage();
  let importConfig: ImportConfig | undefined;

  // Try loading from YAML config first
  const configResult = await configStorage.getImportConfig();

  if (configResult.success) {
    importConfig = configResult.value;
    console.log('✅ Loaded configuration from .itinerator/config.yaml');
  } else {
    // Fall back to environment variable
    const envApiKey = process.env.OPENROUTER_API_KEY;

    if (envApiKey) {
      importConfig = {
        apiKey: envApiKey,
        costTrackingEnabled: true,
        costLogPath: path.join(dataDir, 'imports', 'cost-log.json'),
      };
      console.log('✅ Using API key from OPENROUTER_API_KEY environment variable');
    } else {
      // Neither YAML nor env var has API key
      console.warn('⚠️  No API key configured - import functionality disabled');
      console.warn('   Add your key to .itinerator/config.yaml or set OPENROUTER_API_KEY');
      console.warn('   Run: npx itinerator config set openrouter.apiKey YOUR_KEY');
    }
  }

  // Create and start server
  const app = createApiServer({
    port,
    storage,
    segmentService,
    dependencyService,
    importConfig,
  });

  app.listen(port, () => {
    console.log(`🚀 Itinerator API server running on http://localhost:${port}`);
    console.log(`   - Health: http://localhost:${port}/api/health`);
    console.log(`   - Itineraries: http://localhost:${port}/api/itineraries`);
    console.log(`   - Models: http://localhost:${port}/api/models`);
    if (importConfig?.apiKey) {
      console.log(`   - Chat: http://localhost:${port}/api/chat/sessions`);
    }
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
