/**
 * Unit tests for PermissionService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionService } from '../../../src/services/permission.service.js';
import type { Itinerary } from '../../../src/domain/types/itinerary.js';
import { generateItineraryId } from '../../../src/domain/types/branded.js';

describe('PermissionService', () => {
  let service: PermissionService;
  let baseItinerary: Itinerary;

  beforeEach(() => {
    service = new PermissionService();
    baseItinerary = {
      id: generateItineraryId(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      title: 'Test Trip',
      status: 'DRAFT',
      destinations: [],
      travelers: [],
      segments: [],
      tags: [],
      metadata: {},
      createdBy: 'creator@example.com',
      permissions: {
        owners: ['creator@example.com'],
        editors: [],
        viewers: [],
      },
    };
  });

  describe('getRole', () => {
    it('should return owner for user in owners list', () => {
      const role = service.getRole(baseItinerary, 'creator@example.com');
      expect(role).toBe('owner');
    });

    it('should return editor for user in editors list', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: ['editor@example.com'],
          viewers: [],
        },
      };
      const role = service.getRole(itinerary, 'editor@example.com');
      expect(role).toBe('editor');
    });

    it('should return viewer for user in viewers list', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: [],
          viewers: ['viewer@example.com'],
        },
      };
      const role = service.getRole(itinerary, 'viewer@example.com');
      expect(role).toBe('viewer');
    });

    it('should return none for user not in any list', () => {
      const role = service.getRole(baseItinerary, 'stranger@example.com');
      expect(role).toBe('none');
    });

    it('should normalize email case', () => {
      const role = service.getRole(baseItinerary, 'CREATOR@EXAMPLE.COM');
      expect(role).toBe('owner');
    });

    it('should return none if permissions are undefined', () => {
      const itinerary = { ...baseItinerary, permissions: undefined };
      const role = service.getRole(itinerary, 'creator@example.com');
      expect(role).toBe('none');
    });
  });

  describe('canView', () => {
    it('should return true for owner', () => {
      expect(service.canView(baseItinerary, 'creator@example.com')).toBe(true);
    });

    it('should return true for editor', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: ['editor@example.com'],
          viewers: [],
        },
      };
      expect(service.canView(itinerary, 'editor@example.com')).toBe(true);
    });

    it('should return true for viewer', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: [],
          viewers: ['viewer@example.com'],
        },
      };
      expect(service.canView(itinerary, 'viewer@example.com')).toBe(true);
    });

    it('should return false for non-member', () => {
      expect(service.canView(baseItinerary, 'stranger@example.com')).toBe(false);
    });
  });

  describe('canEdit', () => {
    it('should return true for owner', () => {
      expect(service.canEdit(baseItinerary, 'creator@example.com')).toBe(true);
    });

    it('should return true for editor', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: ['editor@example.com'],
          viewers: [],
        },
      };
      expect(service.canEdit(itinerary, 'editor@example.com')).toBe(true);
    });

    it('should return false for viewer', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: [],
          viewers: ['viewer@example.com'],
        },
      };
      expect(service.canEdit(itinerary, 'viewer@example.com')).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('should return true for owner', () => {
      expect(service.canDelete(baseItinerary, 'creator@example.com')).toBe(true);
    });

    it('should return false for editor', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: ['editor@example.com'],
          viewers: [],
        },
      };
      expect(service.canDelete(itinerary, 'editor@example.com')).toBe(false);
    });

    it('should return false for viewer', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: [],
          viewers: ['viewer@example.com'],
        },
      };
      expect(service.canDelete(itinerary, 'viewer@example.com')).toBe(false);
    });
  });

  describe('canManagePermissions', () => {
    it('should return true for owner', () => {
      expect(service.canManagePermissions(baseItinerary, 'creator@example.com')).toBe(true);
    });

    it('should return false for editor', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: ['editor@example.com'],
          viewers: [],
        },
      };
      expect(service.canManagePermissions(itinerary, 'editor@example.com')).toBe(false);
    });
  });

  describe('addPermission', () => {
    it('should add user to specified role', () => {
      const updated = service.addPermission(baseItinerary, 'editor@example.com', 'editor');
      expect(updated.permissions?.editors).toContain('editor@example.com');
    });

    it('should normalize email to lowercase', () => {
      const updated = service.addPermission(baseItinerary, 'EDITOR@EXAMPLE.COM', 'editor');
      expect(updated.permissions?.editors).toContain('editor@example.com');
    });

    it('should move user from old role to new role', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: ['editor@example.com'],
          viewers: [],
        },
      };
      const updated = service.addPermission(itinerary, 'editor@example.com', 'viewer');
      expect(updated.permissions?.editors).not.toContain('editor@example.com');
      expect(updated.permissions?.viewers).toContain('editor@example.com');
    });

    it('should throw error if adding to none role', () => {
      expect(() => service.addPermission(baseItinerary, 'test@example.com', 'none')).toThrow();
    });

    it('should initialize permissions if not present', () => {
      const itinerary = { ...baseItinerary, permissions: undefined };
      const updated = service.addPermission(itinerary, 'editor@example.com', 'editor');
      expect(updated.permissions).toBeDefined();
      expect(updated.permissions?.editors).toContain('editor@example.com');
    });
  });

  describe('removePermission', () => {
    it('should remove user from all roles', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com', 'owner2@example.com'],
          editors: ['editor@example.com'],
          viewers: [],
        },
      };
      const updated = service.removePermission(itinerary, 'editor@example.com');
      expect(updated.permissions?.editors).not.toContain('editor@example.com');
    });

    it('should throw error when removing last owner', () => {
      expect(() => service.removePermission(baseItinerary, 'creator@example.com')).toThrow(
        'Cannot remove the last owner'
      );
    });

    it('should allow removing owner if multiple owners exist', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com', 'owner2@example.com'],
          editors: [],
          viewers: [],
        },
      };
      const updated = service.removePermission(itinerary, 'creator@example.com');
      expect(updated.permissions?.owners).not.toContain('creator@example.com');
      expect(updated.permissions?.owners).toContain('owner2@example.com');
    });
  });

  describe('changeRole', () => {
    it('should change user role', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com'],
          editors: ['editor@example.com'],
          viewers: [],
        },
      };
      const updated = service.changeRole(itinerary, 'editor@example.com', 'viewer');
      expect(updated.permissions?.editors).not.toContain('editor@example.com');
      expect(updated.permissions?.viewers).toContain('editor@example.com');
    });

    it('should throw error if user has no role', () => {
      expect(() => service.changeRole(baseItinerary, 'stranger@example.com', 'editor')).toThrow(
        'User does not have any permission'
      );
    });

    it('should throw error when demoting last owner', () => {
      expect(() => service.changeRole(baseItinerary, 'creator@example.com', 'editor')).toThrow(
        'Cannot demote the last owner'
      );
    });

    it('should remove user if changing to none', () => {
      const itinerary = {
        ...baseItinerary,
        permissions: {
          owners: ['creator@example.com', 'owner2@example.com'],
          editors: [],
          viewers: [],
        },
      };
      const updated = service.changeRole(itinerary, 'owner2@example.com', 'none');
      expect(updated.permissions?.owners).not.toContain('owner2@example.com');
    });
  });

  describe('initializePermissions', () => {
    it('should create permissions from createdBy', () => {
      const itinerary = { ...baseItinerary, permissions: undefined };
      const updated = service.initializePermissions(itinerary);
      expect(updated.permissions).toBeDefined();
      expect(updated.permissions?.owners).toContain('creator@example.com');
    });

    it('should not overwrite existing permissions', () => {
      const updated = service.initializePermissions(baseItinerary);
      expect(updated.permissions).toEqual(baseItinerary.permissions);
    });

    it('should handle missing createdBy', () => {
      const itinerary = { ...baseItinerary, createdBy: undefined, permissions: undefined };
      const updated = service.initializePermissions(itinerary);
      expect(updated.permissions?.owners).toEqual([]);
    });
  });

  describe('ensureCreatorIsOwner', () => {
    it('should add creator to owners if not present', () => {
      const itinerary = {
        ...baseItinerary,
        createdBy: 'creator@example.com',
        permissions: {
          owners: ['other@example.com'],
          editors: [],
          viewers: [],
        },
      };
      const updated = service.ensureCreatorIsOwner(itinerary);
      expect(updated.permissions?.owners).toContain('creator@example.com');
      expect(updated.permissions?.owners).toContain('other@example.com');
    });

    it('should not duplicate creator if already owner', () => {
      const updated = service.ensureCreatorIsOwner(baseItinerary);
      expect(updated.permissions?.owners.filter((e) => e === 'creator@example.com')).toHaveLength(
        1
      );
    });

    it('should handle missing createdBy', () => {
      const itinerary = { ...baseItinerary, createdBy: undefined };
      const updated = service.ensureCreatorIsOwner(itinerary);
      expect(updated).toEqual(itinerary);
    });
  });
});
