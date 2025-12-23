/**
 * Fixture loader for E2E tests
 * Loads pre-defined test data from JSON files
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { Itinerary } from '../../src/domain/types/index.js';

/**
 * Persona represents a test user profile
 */
export interface Persona {
  name: string;
  description: string;
  email: string;
  preferences: {
    travelStyle?: 'luxury' | 'moderate' | 'budget' | 'backpacker';
    pace?: 'packed' | 'balanced' | 'leisurely';
    interests?: string[];
    budgetFlexibility?: number;
    dietaryRestrictions?: string;
    mobilityRestrictions?: string;
    origin?: string;
    accommodationPreference?: string;
    activityPreferences?: string[];
    avoidances?: string[];
  };
  metadata?: Record<string, unknown>;
}

/**
 * Available itinerary fixture names
 */
export type ItineraryFixtureName =
  | 'empty-new'
  | 'planning-phase'
  | 'partial-segments'
  | 'complete-trip'
  | 'past-trip';

/**
 * Available persona fixture names
 */
export type PersonaFixtureName =
  | 'solo-traveler'
  | 'family-vacation'
  | 'business-trip'
  | 'group-adventure';

/**
 * Fixture cache to avoid repeated disk reads
 */
const fixtureCache = new Map<string, unknown>();

/**
 * Get the fixtures directory path
 */
function getFixturesDir(): string {
  return join(process.cwd(), 'tests', 'fixtures');
}

/**
 * Load JSON fixture from file
 */
function loadJsonFixture<T>(category: string, name: string): T {
  const cacheKey = `${category}:${name}`;

  if (fixtureCache.has(cacheKey)) {
    // Return deep clone to prevent test pollution
    return JSON.parse(JSON.stringify(fixtureCache.get(cacheKey)));
  }

  const filePath = join(getFixturesDir(), category, `${name}.json`);

  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as T;

    // Cache the original
    fixtureCache.set(cacheKey, data);

    // Return deep clone
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    throw new Error(
      `Failed to load fixture: ${category}/${name}.json\n` +
      `Path: ${filePath}\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load an itinerary fixture
 *
 * Available fixtures:
 * - empty-new: Brand new itinerary with no segments
 * - planning-phase: Itinerary in planning with dates set
 * - partial-segments: Has some flights/hotels but incomplete
 * - complete-trip: Fully planned trip with all segments
 * - past-trip: Completed trip in the past
 */
export function loadItinerary(name: ItineraryFixtureName): Itinerary {
  return loadJsonFixture<Itinerary>('itineraries', name);
}

/**
 * Load a persona fixture
 *
 * Available personas:
 * - solo-traveler: Single traveler, flexible budget
 * - family-vacation: Family of 4, moderate budget
 * - business-trip: Business traveler, time-sensitive
 * - group-adventure: Group of friends, adventure-focused
 */
export function loadPersona(name: PersonaFixtureName): Persona {
  return loadJsonFixture<Persona>('personas', name);
}

/**
 * Clear the fixture cache
 * Useful for tests that modify fixtures and need fresh copies
 */
export function clearFixtureCache(): void {
  fixtureCache.clear();
}

/**
 * Create a minimal itinerary for testing
 */
export function createMinimalItinerary(overrides?: Partial<Itinerary>): Itinerary {
  const now = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const nextWeek = new Date(Date.now() + 7 * 86400000);

  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` as any,
    title: 'Test Itinerary',
    status: 'DRAFT',
    segments: [],
    destinations: [],
    tags: ['test'],
    createdAt: now,
    updatedAt: now,
    startDate: tomorrow.toISOString(),
    endDate: nextWeek.toISOString(),
    ...overrides,
  };
}

/**
 * Create a minimal persona for testing
 */
export function createMinimalPersona(overrides?: Partial<Persona>): Persona {
  return {
    name: 'Test User',
    description: 'A test user for E2E testing',
    email: `test-${Date.now()}@example.com`,
    preferences: {},
    ...overrides,
  };
}
