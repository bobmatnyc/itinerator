/**
 * Prompt loader utility for agent prompts
 * Uses Vite's ?raw imports for build-time bundling instead of runtime file system access
 * This ensures prompts are bundled in production builds (SvelteKit, etc.)
 * @module prompts
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load prompts from filesystem for Node.js runtime
// In production builds (Vite), these would use ?raw imports instead
const tripDesignerSystem = readFileSync(path.join(__dirname, 'trip-designer/system.md'), 'utf-8');
const tripDesignerCompaction = readFileSync(path.join(__dirname, 'trip-designer/compaction.md'), 'utf-8');
const tripDesignerProfileExtraction = readFileSync(path.join(__dirname, 'trip-designer/profile-extraction.md'), 'utf-8');

/**
 * Pre-loaded prompts for Trip Designer Agent
 * Prompts are imported as strings at build time for production compatibility
 */
export const PROMPTS = {
  tripDesigner: {
    /**
     * Main system prompt for Trip Designer Agent
     * Defines personality, rules, capabilities, and conversation flow
     */
    system: tripDesignerSystem,

    /**
     * Context compaction prompt
     * Used when conversation history needs to be condensed to save tokens
     */
    compaction: tripDesignerCompaction,

    /**
     * Profile extraction prompt
     * Extracts structured trip profile from conversation history
     */
    profileExtraction: tripDesignerProfileExtraction,
  },
};

/**
 * Direct access to Trip Designer prompts (backwards compatibility)
 * These are the constants previously exported from services/trip-designer/prompts.ts
 */
export const TRIP_DESIGNER_SYSTEM_PROMPT = PROMPTS.tripDesigner.system;
export const COMPACTION_SYSTEM_PROMPT = PROMPTS.tripDesigner.compaction;
export const PROFILE_EXTRACTION_PROMPT = PROMPTS.tripDesigner.profileExtraction;
