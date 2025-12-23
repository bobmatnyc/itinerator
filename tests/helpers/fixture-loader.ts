/**
 * Fixture loader utilities
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { Itinerary } from '../../src/domain/types/index.js';

const FIXTURES_DIR = join(__dirname, '../fixtures');

/**
 * Load an itinerary fixture by name
 */
export function loadItineraryFixture(name: string): Itinerary {
  const filePath = join(FIXTURES_DIR, 'itineraries', `${name}.json`);
  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // Convert ISO date strings to Date objects
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    segments: data.segments.map((segment: any) => ({
      ...segment,
      startDatetime: new Date(segment.startDatetime),
      endDatetime: new Date(segment.endDatetime),
      // Convert date fields in specific segment types
      ...(segment.type === 'HOTEL' && {
        checkInDate: new Date(segment.checkInDate),
        checkOutDate: new Date(segment.checkOutDate),
      }),
    })),
    travelers: data.travelers?.map((traveler: any) => ({
      ...traveler,
      dateOfBirth: traveler.dateOfBirth ? new Date(traveler.dateOfBirth) : undefined,
      passportExpiry: traveler.passportExpiry ? new Date(traveler.passportExpiry) : undefined,
    })) || [],
  };
}

/**
 * Load a persona fixture by name
 */
export function loadPersonaFixture(name: string): any {
  const filePath = join(FIXTURES_DIR, 'personas', `${name}.json`);
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load all itinerary fixtures
 */
export function loadAllItineraryFixtures(): Record<string, Itinerary> {
  return {
    'empty-new': loadItineraryFixture('empty-new'),
    'planning-phase': loadItineraryFixture('planning-phase'),
    'partial-segments': loadItineraryFixture('partial-segments'),
    'complete-trip': loadItineraryFixture('complete-trip'),
    'past-trip': loadItineraryFixture('past-trip'),
  };
}

/**
 * Load all persona fixtures
 */
export function loadAllPersonaFixtures(): Record<string, any> {
  return {
    'solo-traveler': loadPersonaFixture('solo-traveler'),
    'family-vacation': loadPersonaFixture('family-vacation'),
    'business-trip': loadPersonaFixture('business-trip'),
    'group-adventure': loadPersonaFixture('group-adventure'),
  };
}

/**
 * Create a deep clone of a fixture (useful for mutation tests)
 */
export function cloneFixture<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture));
}
