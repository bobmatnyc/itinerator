/**
 * Migration helper for adding permissions to existing itineraries
 * @module storage/migrations/permissions-migration
 */

import type { Itinerary, ItineraryPermissions } from '../../domain/types/itinerary.js';

/**
 * Initialize permissions for an itinerary without permissions
 * - createdBy becomes the first owner
 * - Initialize empty arrays for editors and viewers
 * @param itinerary - Itinerary to initialize permissions for
 * @returns Itinerary with permissions initialized
 */
export function initializePermissions(itinerary: Itinerary): Itinerary {
  // If permissions already exist and have at least one owner, return as-is
  if (itinerary.permissions && itinerary.permissions.owners.length > 0) {
    return itinerary;
  }

  // Normalize createdBy email to lowercase for consistency
  const createdByNormalized = itinerary.createdBy?.toLowerCase() || '';

  // Initialize permissions with creator as owner
  const permissions: ItineraryPermissions = {
    owners: createdByNormalized ? [createdByNormalized] : [],
    editors: [],
    viewers: [],
  };

  return {
    ...itinerary,
    permissions,
  };
}

/**
 * Migrate a batch of itineraries to include permissions
 * @param itineraries - Array of itineraries to migrate
 * @returns Array of itineraries with permissions initialized
 */
export function migrateItineraries(itineraries: Itinerary[]): Itinerary[] {
  return itineraries.map(initializePermissions);
}

/**
 * Check if an itinerary needs permissions migration
 * @param itinerary - Itinerary to check
 * @returns True if migration is needed
 */
export function needsPermissionsMigration(itinerary: Itinerary): boolean {
  return !itinerary.permissions || itinerary.permissions.owners.length === 0;
}
