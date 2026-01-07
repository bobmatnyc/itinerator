/**
 * Permission Service - role-based access control for itineraries
 * @module services/permission
 */

import type { Itinerary, ItineraryPermissions } from '../domain/types/itinerary.js';

/**
 * Permission roles for itinerary access
 */
export type PermissionRole = 'owner' | 'editor' | 'viewer' | 'none';

/**
 * Service for managing itinerary permissions and role-based access control
 */
export class PermissionService {
  /**
   * Normalize email to lowercase for consistent comparison
   * @param email - Email to normalize
   * @returns Lowercase email
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase();
  }

  /**
   * Get user's role for an itinerary
   * Returns highest role if user somehow appears in multiple arrays
   * @param itinerary - Itinerary to check permissions for
   * @param userEmail - User's email address
   * @returns User's permission role (owner > editor > viewer > none)
   */
  getRole(itinerary: Itinerary, userEmail: string): PermissionRole {
    if (!itinerary.permissions) {
      return 'none';
    }

    const normalizedEmail = this.normalizeEmail(userEmail);
    const { owners, editors, viewers } = itinerary.permissions;

    // Check roles in priority order: owner > editor > viewer
    if (owners.includes(normalizedEmail)) {
      return 'owner';
    }
    if (editors.includes(normalizedEmail)) {
      return 'editor';
    }
    if (viewers.includes(normalizedEmail)) {
      return 'viewer';
    }

    return 'none';
  }

  /**
   * Check if user can view the itinerary
   * @param itinerary - Itinerary to check
   * @param userEmail - User's email address
   * @returns True if user has any access level
   */
  canView(itinerary: Itinerary, userEmail: string): boolean {
    const role = this.getRole(itinerary, userEmail);
    return role !== 'none';
  }

  /**
   * Check if user can edit the itinerary
   * @param itinerary - Itinerary to check
   * @param userEmail - User's email address
   * @returns True if user is owner or editor
   */
  canEdit(itinerary: Itinerary, userEmail: string): boolean {
    const role = this.getRole(itinerary, userEmail);
    return role === 'owner' || role === 'editor';
  }

  /**
   * Check if user can delete the itinerary
   * @param itinerary - Itinerary to check
   * @param userEmail - User's email address
   * @returns True if user is owner
   */
  canDelete(itinerary: Itinerary, userEmail: string): boolean {
    const role = this.getRole(itinerary, userEmail);
    return role === 'owner';
  }

  /**
   * Check if user can manage permissions (add/remove users, change roles)
   * @param itinerary - Itinerary to check
   * @param userEmail - User's email address
   * @returns True if user is owner
   */
  canManagePermissions(itinerary: Itinerary, userEmail: string): boolean {
    const role = this.getRole(itinerary, userEmail);
    return role === 'owner';
  }

  /**
   * Add a user to the itinerary with a specific permission role
   * If user already has a different role, removes from old role first
   * @param itinerary - Itinerary to modify
   * @param email - Email of user to add
   * @param role - Permission role to grant
   * @returns New itinerary with updated permissions
   * @throws Error if trying to add to 'none' role
   */
  addPermission(itinerary: Itinerary, email: string, role: PermissionRole): Itinerary {
    if (role === 'none') {
      throw new Error('Cannot add user with role "none". Use removePermission instead.');
    }

    const normalizedEmail = this.normalizeEmail(email);

    // Initialize permissions if not present
    const permissions: ItineraryPermissions = itinerary.permissions || {
      owners: [],
      editors: [],
      viewers: [],
    };

    // Remove user from all roles first (to prevent duplicates)
    const cleanPermissions: ItineraryPermissions = {
      owners: permissions.owners.filter((e) => e !== normalizedEmail),
      editors: permissions.editors.filter((e) => e !== normalizedEmail),
      viewers: permissions.viewers.filter((e) => e !== normalizedEmail),
    };

    // Add user to specified role
    const updatedPermissions: ItineraryPermissions = {
      ...cleanPermissions,
      [`${role}s`]: [
        ...cleanPermissions[`${role}s` as keyof ItineraryPermissions],
        normalizedEmail,
      ],
    };

    return {
      ...itinerary,
      permissions: updatedPermissions,
    };
  }

  /**
   * Remove a user's access to the itinerary
   * @param itinerary - Itinerary to modify
   * @param email - Email of user to remove
   * @returns New itinerary with updated permissions
   * @throws Error if trying to remove the last owner
   */
  removePermission(itinerary: Itinerary, email: string): Itinerary {
    if (!itinerary.permissions) {
      return itinerary; // No permissions to remove from
    }

    const normalizedEmail = this.normalizeEmail(email);
    const { owners, editors, viewers } = itinerary.permissions;

    // Check if removing last owner
    if (owners.includes(normalizedEmail) && owners.length === 1) {
      throw new Error('Cannot remove the last owner. Itinerary must have at least one owner.');
    }

    // Remove user from all roles
    const updatedPermissions: ItineraryPermissions = {
      owners: owners.filter((e) => e !== normalizedEmail),
      editors: editors.filter((e) => e !== normalizedEmail),
      viewers: viewers.filter((e) => e !== normalizedEmail),
    };

    return {
      ...itinerary,
      permissions: updatedPermissions,
    };
  }

  /**
   * Change a user's permission role
   * @param itinerary - Itinerary to modify
   * @param email - Email of user to modify
   * @param newRole - New permission role
   * @returns New itinerary with updated permissions
   * @throws Error if user doesn't have any role or if trying to demote last owner
   */
  changeRole(itinerary: Itinerary, email: string, newRole: PermissionRole): Itinerary {
    const currentRole = this.getRole(itinerary, email);

    if (currentRole === 'none') {
      throw new Error('User does not have any permission. Use addPermission instead.');
    }

    if (newRole === 'none') {
      return this.removePermission(itinerary, email);
    }

    const normalizedEmail = this.normalizeEmail(email);

    // Check if demoting last owner
    if (
      currentRole === 'owner' &&
      newRole !== 'owner' &&
      itinerary.permissions?.owners.length === 1
    ) {
      throw new Error('Cannot demote the last owner. Itinerary must have at least one owner.');
    }

    // Use addPermission which handles role changes
    return this.addPermission(itinerary, normalizedEmail, newRole);
  }

  /**
   * Initialize permissions from createdBy field
   * Used for migrating existing itineraries
   * @param itinerary - Itinerary to initialize
   * @returns Itinerary with permissions initialized
   */
  initializePermissions(itinerary: Itinerary): Itinerary {
    // If permissions already exist and have at least one owner, return as-is
    if (itinerary.permissions && itinerary.permissions.owners.length > 0) {
      return itinerary;
    }

    // Normalize createdBy email
    const createdByNormalized = itinerary.createdBy?.toLowerCase() || '';

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
   * Ensure createdBy is always an owner
   * Adds createdBy to owners if not already present
   * @param itinerary - Itinerary to enforce ownership for
   * @returns Itinerary with createdBy as owner
   */
  ensureCreatorIsOwner(itinerary: Itinerary): Itinerary {
    if (!itinerary.createdBy) {
      return itinerary;
    }

    const normalizedCreator = this.normalizeEmail(itinerary.createdBy);

    // If permissions don't exist, initialize them
    if (!itinerary.permissions) {
      return this.initializePermissions(itinerary);
    }

    // If creator is already an owner, return as-is
    if (itinerary.permissions.owners.includes(normalizedCreator)) {
      return itinerary;
    }

    // Add creator to owners
    return this.addPermission(itinerary, normalizedCreator, 'owner');
  }
}
