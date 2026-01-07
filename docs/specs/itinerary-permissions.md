# Feature Specification: Itinerary Permissions & Sharing

**Status**: Draft
**Priority**: 🟡 Important
**Created**: 2026-01-07
**Epic**: Collaborative Trip Planning

---

## Overview

### Problem Statement
Currently, itineraries only have a `createdBy` field for ownership. This means only the creator can access and modify an itinerary. This prevents collaborative trip planning where multiple users need to work together on the same trip.

### Solution
Implement a role-based permissions system that allows itinerary creators to share their trips with others, granting different levels of access (owner, editor, viewer) while separately tracking who is actually traveling.

### Goals
- Enable collaborative trip planning with multiple users
- Provide granular access control (read, edit, manage permissions, delete)
- Separate "who has access" from "who is traveling"
- Maintain backward compatibility with existing itineraries

---

## Permission Roles

### Owner
**Description**: Full administrative control over the itinerary.

**Capabilities**:
- All editor capabilities (see below)
- Delete the itinerary
- Transfer ownership to another user
- Manage all permissions (add/remove owners, editors, viewers)
- Remove travelers from the trip

**Notes**:
- An itinerary must have at least one owner
- The `createdBy` user becomes the initial owner
- Multiple owners are supported for redundancy

---

### Editor
**Description**: Can modify the itinerary content but cannot manage permissions or delete.

**Capabilities**:
- Add/edit/remove segments
- Add/edit/remove travelers
- Modify trip preferences (dates, destinations, tags)
- Add notes and attachments
- Update itinerary metadata (title, description)

**Restrictions**:
- Cannot delete the itinerary
- Cannot manage permissions (add/remove users)
- Cannot transfer ownership

**Notes**:
- Ideal for trip co-planners who are actively working on the itinerary
- Can be promoted to owner by existing owner

---

### Viewer
**Description**: Read-only access to the itinerary.

**Capabilities**:
- View all itinerary details
- View segments, travelers, preferences
- Export itinerary data
- View notes and attachments

**Restrictions**:
- Cannot modify any content
- Cannot add or remove anything
- Cannot share with others

**Notes**:
- Ideal for family members who want to see the plan but not edit
- Can be promoted to editor or owner by existing owner

---

### Traveler
**Description**: People who are on the trip (separate from access permissions).

**Capabilities**:
- Listed as a participant in the trip
- Their information is part of the itinerary data
- May or may not have access to view/edit the itinerary

**Restrictions**:
- Being a traveler does NOT automatically grant access
- Travelers need to be explicitly granted viewer/editor/owner permissions

**Notes**:
- A user can be a traveler without having any access permissions
- Example: Parent plans trip, adds children as travelers, but children don't have accounts
- **Design Decision**: Should travelers automatically get viewer access? → No, keep separate

---

## Data Model Changes

### Itinerary Schema Updates

**Current Schema**:
```typescript
interface Itinerary {
  id: ItineraryId;
  title: string;
  createdBy: string; // email or user ID
  createdAt: Date;
  updatedAt: Date;
  // ... other fields
}
```

**New Schema**:
```typescript
interface Itinerary {
  id: ItineraryId;
  title: string;
  createdBy: string; // email or user ID (kept for backward compatibility)
  permissions: ItineraryPermissions; // 🔴 NEW
  createdAt: Date;
  updatedAt: Date;
  // ... other fields
}

interface ItineraryPermissions {
  owners: string[];    // User IDs or emails with full control
  editors: string[];   // User IDs or emails who can modify
  viewers: string[];   // User IDs or emails with read-only access
  travelers: string[]; // People on the trip (separate from access)
}
```

**Migration Strategy**:
```typescript
// For existing itineraries without permissions field:
function migrateItinerary(itinerary: Itinerary): Itinerary {
  if (!itinerary.permissions) {
    return {
      ...itinerary,
      permissions: {
        owners: [itinerary.createdBy], // Creator becomes owner
        editors: [],
        viewers: [],
        travelers: itinerary.travelers || [], // Migrate existing travelers
      },
    };
  }
  return itinerary;
}
```

**Validation Rules**:
- At least one owner required
- Owners, editors, and viewers must be unique (no duplicates across roles)
- User cannot be in multiple permission roles (highest role wins)
- Emails must be valid format
- Permission arrays cannot be null (default to empty arrays)

---

## API Changes

### Modified Endpoints

#### `GET /api/v1/itineraries`
**Current Behavior**: Returns all itineraries created by the user.

**New Behavior**: Returns all itineraries where the user has any permission level.

```typescript
// New query logic
function getUserItineraries(userEmail: string): Itinerary[] {
  return allItineraries.filter(itinerary =>
    itinerary.permissions.owners.includes(userEmail) ||
    itinerary.permissions.editors.includes(userEmail) ||
    itinerary.permissions.viewers.includes(userEmail)
  );
}
```

**Response Changes**:
```json
{
  "itineraries": [
    {
      "id": "itin_123",
      "title": "Tokyo Adventure",
      "userRole": "owner", // 🔴 NEW: User's permission level
      "isShared": true,    // 🔴 NEW: Has other users with access
      "collaborators": 3,  // 🔴 NEW: Total number of users with access
      // ... rest of itinerary
    }
  ]
}
```

---

#### `GET /api/v1/itineraries/:id`
**Current Behavior**: Returns itinerary if `createdBy` matches user.

**New Behavior**: Returns itinerary if user has any permission level.

```typescript
// New authorization check
function canViewItinerary(itinerary: Itinerary, userEmail: string): boolean {
  return itinerary.permissions.owners.includes(userEmail) ||
         itinerary.permissions.editors.includes(userEmail) ||
         itinerary.permissions.viewers.includes(userEmail);
}
```

**Error Responses**:
- `403 Forbidden`: User does not have permission to view this itinerary
- `404 Not Found`: Itinerary does not exist

---

#### `PATCH /api/v1/itineraries/:id`
**Current Behavior**: Allows updates if `createdBy` matches user.

**New Behavior**: Allows updates if user is owner or editor.

```typescript
// New authorization check
function canEditItinerary(itinerary: Itinerary, userEmail: string): boolean {
  return itinerary.permissions.owners.includes(userEmail) ||
         itinerary.permissions.editors.includes(userEmail);
}
```

**Restrictions**:
- Viewers cannot make any updates (403 Forbidden)
- Editors cannot modify permissions (403 Forbidden if trying to update `permissions` field)

---

#### `DELETE /api/v1/itineraries/:id`
**Current Behavior**: Allows deletion if `createdBy` matches user.

**New Behavior**: Allows deletion only if user is owner.

```typescript
// New authorization check
function canDeleteItinerary(itinerary: Itinerary, userEmail: string): boolean {
  return itinerary.permissions.owners.includes(userEmail);
}
```

**Error Responses**:
- `403 Forbidden`: Only owners can delete itineraries

---

### New Endpoints

#### `POST /api/v1/itineraries/:id/share`
**Description**: Add a user to the itinerary with a specific permission role.

**Authorization**: Only owners can share.

**Request Body**:
```json
{
  "email": "friend@example.com",
  "role": "editor" // or "owner", "viewer"
}
```

**Response**:
```json
{
  "success": true,
  "itinerary": {
    "id": "itin_123",
    "permissions": {
      "owners": ["creator@example.com"],
      "editors": ["friend@example.com"],
      "viewers": [],
      "travelers": []
    }
  }
}
```

**Validation**:
- Email must be valid format
- Role must be one of: "owner", "editor", "viewer"
- Cannot add user who already has a permission role (return 409 Conflict)
- User must be owner to perform this action (403 Forbidden)

**Business Logic**:
- If user already has a different role, remove from old role and add to new role
- Send email notification to invited user (optional, future enhancement)

---

#### `DELETE /api/v1/itineraries/:id/share/:email`
**Description**: Remove a user's access to the itinerary.

**Authorization**: Only owners can remove permissions.

**Response**:
```json
{
  "success": true,
  "removedUser": "friend@example.com",
  "removedRole": "editor"
}
```

**Validation**:
- Cannot remove the last owner (return 400 Bad Request)
- User must be owner to perform this action (403 Forbidden)
- Email must exist in permissions (return 404 Not Found)

**Business Logic**:
- Remove user from all permission roles (owners, editors, viewers)
- Optionally send notification to removed user

---

#### `PATCH /api/v1/itineraries/:id/share/:email`
**Description**: Change a user's permission role.

**Authorization**: Only owners can change permissions.

**Request Body**:
```json
{
  "role": "viewer" // or "owner", "editor"
}
```

**Response**:
```json
{
  "success": true,
  "user": "friend@example.com",
  "oldRole": "editor",
  "newRole": "viewer"
}
```

**Validation**:
- Role must be one of: "owner", "editor", "viewer"
- Cannot demote the last owner (return 400 Bad Request)
- User must be owner to perform this action (403 Forbidden)

---

## UI Changes

### Itinerary List Page

**New Indicators**:
```
┌─────────────────────────────────────────┐
│ Tokyo Adventure                   👥 3  │ ← Shared indicator + count
│ Owner • 7 days • May 2026               │ ← User's role
├─────────────────────────────────────────┤
│ Paris Getaway                      👤   │ ← Solo (not shared)
│ Owner • 5 days • June 2026              │
├─────────────────────────────────────────┤
│ Family Vacation                    👥 5 │
│ Editor • 10 days • July 2026            │ ← Shared, user is editor
└─────────────────────────────────────────┘
```

**Filtering**:
- Add filter: "Owned by me" / "Shared with me" / "All"

---

### Itinerary Detail Page

#### Header Changes
```
┌─────────────────────────────────────────────┐
│ Tokyo Adventure                             │
│ May 15-22, 2026 • 7 days                    │
│                                             │
│ Collaborators (3):                          │
│ • Alice (Owner) 👑                          │
│ • Bob (Editor) ✏️                           │
│ • Carol (Viewer) 👁️                         │
│                                             │
│ [Share] [Edit Permissions]                  │ ← Only for owners
└─────────────────────────────────────────────┘
```

---

#### Share Modal
```
┌─────────────────────────────────────────────┐
│ Share "Tokyo Adventure"                     │
├─────────────────────────────────────────────┤
│ Invite someone:                             │
│ ┌─────────────────────────────────────────┐ │
│ │ friend@example.com                      │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Give permission as:                         │
│ ○ Owner - Can delete and manage permissions │
│ ● Editor - Can modify itinerary            │
│ ○ Viewer - Read-only access                │
│                                             │
│ [Cancel] [Send Invite]                      │
├─────────────────────────────────────────────┤
│ Current collaborators:                      │
│                                             │
│ Alice (Owner) 👑                            │
│ [Change Role ▾] [Remove]                    │
│                                             │
│ Bob (Editor) ✏️                             │
│ [Change Role ▾] [Remove]                    │
│                                             │
│ Carol (Viewer) 👁️                           │
│ [Change Role ▾] [Remove]                    │
└─────────────────────────────────────────────┘
```

---

#### Permission Indicators

**Editor View**:
- Hide "Delete Itinerary" button
- Hide "Share" button
- Show banner: "You have edit access to this itinerary"

**Viewer View**:
- Disable all edit buttons
- Show banner: "You have read-only access to this itinerary"
- Show "Request Edit Access" button (optional future feature)

---

### Travelers vs Permissions

**Travelers Section**:
```
┌─────────────────────────────────────────────┐
│ Travelers (4):                              │
│ • Alice Chen (has access: Owner) 👑         │
│ • Bob Smith (has access: Editor) ✏️         │
│ • Carol Lee (has access: Viewer) 👁️         │
│ • David Chen (no access) ⚠️                 │ ← Warning
└─────────────────────────────────────────────┘
```

**Grant Access Prompt**:
- If traveler has no access, show: "Grant access to this itinerary?"
- Quick action buttons: [Grant Viewer Access] [Grant Editor Access]

---

## Acceptance Criteria

### Permissions Management
- [ ] Owner can add users with owner, editor, or viewer roles
- [ ] Owner can remove users from any role
- [ ] Owner can change user roles
- [ ] Cannot remove the last owner (validation error)
- [ ] Editors can modify itinerary content but not permissions
- [ ] Viewers can only read itinerary data
- [ ] Non-owners cannot delete itineraries

### Access Control
- [ ] User can only view itineraries they have permission for
- [ ] User can only edit itineraries where they are owner or editor
- [ ] User can only delete itineraries where they are owner
- [ ] API returns 403 Forbidden for unauthorized actions
- [ ] API returns 404 Not Found if user has no access (don't leak existence)

### Travelers
- [ ] Travelers are tracked separately from access permissions
- [ ] Adding a traveler does NOT automatically grant access
- [ ] Removing a traveler does NOT remove their access permissions
- [ ] UI shows warning if traveler has no access
- [ ] Quick action to grant access to travelers

### Shared Itineraries
- [ ] Shared itineraries appear in user's itinerary list
- [ ] User's role is displayed clearly (owner/editor/viewer)
- [ ] Collaborator count is visible on itinerary cards
- [ ] Share modal shows current collaborators with roles
- [ ] Removing all permissions removes itinerary from user's list

### Migration
- [ ] Existing itineraries automatically get permissions object
- [ ] Creator becomes the initial owner
- [ ] Existing travelers are migrated to permissions.travelers
- [ ] Migration is backward compatible (old clients still work)

### Storage
- [ ] JsonItineraryStorage supports new permissions schema
- [ ] BlobItineraryStorage supports new permissions schema
- [ ] Both storage backends handle migration automatically

---

## Technical Implementation Notes

### Design Decisions

#### 1. Should travelers automatically get viewer access?
**Decision**: No, keep separate.

**Rationale**:
- Use case: Parent plans trip, adds children as travelers, but children don't have accounts
- Use case: Planning surprise trip, don't want travelers to see it yet
- Use case: Group trip where organizer wants to finalize before sharing

**Implementation**: Show warning in UI if traveler has no access, with quick action to grant.

---

#### 2. Should we use user IDs or emails for permissions?
**Decision**: Start with emails, migrate to user IDs when auth system is added.

**Rationale**:
- Current system uses `createdBy` as email
- No user authentication system yet
- Emails are human-readable and easier to share
- When auth system is added, migrate to user IDs with email mapping

---

#### 3. Can a user have multiple roles?
**Decision**: No, users have one role (highest level).

**Rationale**:
- Simplifies permission checks
- Prevents confusing states
- If user is added to multiple roles, highest role wins: owner > editor > viewer

**Implementation**:
```typescript
function getUserRole(itinerary: Itinerary, email: string): Role | null {
  if (itinerary.permissions.owners.includes(email)) return 'owner';
  if (itinerary.permissions.editors.includes(email)) return 'editor';
  if (itinerary.permissions.viewers.includes(email)) return 'viewer';
  return null;
}
```

---

#### 4. What happens when the last owner is removed?
**Decision**: Prevent removal, return 400 Bad Request.

**Rationale**:
- Itinerary must have at least one owner
- Prevents orphaned itineraries
- Owner can transfer ownership before removing themselves

**Implementation**: Validate before removal, require at least 1 owner to remain.

---

### Migration Strategy

**Step 1: Schema Migration**
```typescript
// Add permissions field to Itinerary type
// Update Zod schema with default values
const ItinerarySchema = z.object({
  // ... existing fields
  permissions: z.object({
    owners: z.array(z.string().email()).default([]),
    editors: z.array(z.string().email()).default([]),
    viewers: z.array(z.string().email()).default([]),
    travelers: z.array(z.string()).default([]),
  }).default({
    owners: [],
    editors: [],
    viewers: [],
    travelers: [],
  }),
});
```

**Step 2: Runtime Migration**
```typescript
// In ItineraryService.getItinerary()
function migratePermissions(itinerary: Itinerary): Itinerary {
  if (!itinerary.permissions || itinerary.permissions.owners.length === 0) {
    return {
      ...itinerary,
      permissions: {
        owners: [itinerary.createdBy],
        editors: [],
        viewers: [],
        travelers: itinerary.travelers || [],
      },
    };
  }
  return itinerary;
}
```

**Step 3: Storage Update**
- JsonItineraryStorage: Add migration on load
- BlobItineraryStorage: Add migration on load
- Both: Save migrated version back to storage on first access

---

### Storage Backend Changes

#### JsonItineraryStorage
```typescript
class JsonItineraryStorage implements ItineraryStorage {
  async getItinerary(id: ItineraryId): Promise<Result<Itinerary>> {
    const itinerary = await this.loadFromFile(id);
    const migrated = migratePermissions(itinerary);

    // Save migrated version if changed
    if (migrated !== itinerary) {
      await this.saveItinerary(migrated);
    }

    return ok(migrated);
  }

  async listItineraries(userEmail: string): Promise<Result<Itinerary[]>> {
    const allItineraries = await this.loadAllFromFiles();
    const migratedItineraries = allItineraries.map(migratePermissions);

    // Filter by user's permissions
    const userItineraries = migratedItineraries.filter(itin =>
      itin.permissions.owners.includes(userEmail) ||
      itin.permissions.editors.includes(userEmail) ||
      itin.permissions.viewers.includes(userEmail)
    );

    return ok(userItineraries);
  }
}
```

#### BlobItineraryStorage
```typescript
class BlobItineraryStorage implements ItineraryStorage {
  // Same migration logic as JsonItineraryStorage
  // Use Vercel Blob list() to find all itineraries user has access to
}
```

---

### Authorization Middleware

**Create reusable authorization functions**:

```typescript
// src/services/permissions/PermissionService.ts
export class PermissionService {
  canView(itinerary: Itinerary, userEmail: string): boolean {
    return itinerary.permissions.owners.includes(userEmail) ||
           itinerary.permissions.editors.includes(userEmail) ||
           itinerary.permissions.viewers.includes(userEmail);
  }

  canEdit(itinerary: Itinerary, userEmail: string): boolean {
    return itinerary.permissions.owners.includes(userEmail) ||
           itinerary.permissions.editors.includes(userEmail);
  }

  canDelete(itinerary: Itinerary, userEmail: string): boolean {
    return itinerary.permissions.owners.includes(userEmail);
  }

  canManagePermissions(itinerary: Itinerary, userEmail: string): boolean {
    return itinerary.permissions.owners.includes(userEmail);
  }

  getUserRole(itinerary: Itinerary, userEmail: string): Role | null {
    if (itinerary.permissions.owners.includes(userEmail)) return 'owner';
    if (itinerary.permissions.editors.includes(userEmail)) return 'editor';
    if (itinerary.permissions.viewers.includes(userEmail)) return 'viewer';
    return null;
  }
}
```

**Use in API routes**:
```typescript
// viewer-svelte/src/routes/api/v1/itineraries/[id]/+server.ts
import { PermissionService } from '$lib/services/permissions/PermissionService';

export async function GET({ params, locals }) {
  const userEmail = locals.user.email; // From auth session
  const itinerary = await itineraryService.getItinerary(params.id);

  const permissionService = new PermissionService();
  if (!permissionService.canView(itinerary, userEmail)) {
    return new Response('Not Found', { status: 404 }); // Don't leak existence
  }

  return json(itinerary);
}
```

---

## Testing Strategy

### Unit Tests
- [ ] Permission validation logic
- [ ] Migration from old schema to new schema
- [ ] getUserRole() returns correct role
- [ ] canView/canEdit/canDelete authorization checks
- [ ] Edge case: Last owner removal prevented

### Integration Tests
- [ ] JsonItineraryStorage with permissions
- [ ] BlobItineraryStorage with permissions
- [ ] listItineraries() filters by user permissions
- [ ] Migration runs automatically on first load

### E2E Tests
- [ ] Share itinerary with editor
- [ ] Share itinerary with viewer
- [ ] Remove user from itinerary
- [ ] Change user role
- [ ] Editor can modify but not delete
- [ ] Viewer cannot modify
- [ ] Non-owner cannot share
- [ ] Shared itinerary appears in collaborator's list

### Persona Tests
- [ ] Family trip: Parent shares with spouse (editor), kids are travelers
- [ ] Group trip: Organizer shares with friends (editors)
- [ ] View-only: Share itinerary with travel agent (viewer)

---

## Future Enhancements

### Phase 2: Email Notifications
- Send email when user is added to itinerary
- Send email when user's role changes
- Send email when removed from itinerary
- In-app notifications for permission changes

### Phase 3: Invitation System
- Generate shareable links with role
- Invite users who don't have accounts yet
- Pending invitations (accepted/rejected)
- Expiring invitation links

### Phase 4: Advanced Permissions
- Segment-level permissions (editor for specific segments)
- Time-limited access (expires after trip ends)
- Audit log of permission changes
- Permission templates (e.g., "Trip Organizer" preset)

### Phase 5: Real-time Collaboration
- See who is viewing/editing itinerary
- Live updates when collaborators make changes
- Conflict resolution for simultaneous edits
- Comments and discussions on segments

---

## Related Documents

- **CLAUDE.md**: Overall project architecture and guidelines
- **engineer_memories.md**: TypeScript and Svelte coding patterns
- **qa_memories.md**: Testing workflows and persona scenarios
- **ops_memories.md**: Deployment and environment configuration

---

## Open Questions

1. **User Identification**: Should we use emails or user IDs?
   - Current: Use emails (no auth system yet)
   - Future: Migrate to user IDs when auth is added

2. **Default Traveler Access**: Should travelers automatically get viewer access?
   - Decision: No, keep separate (see Design Decisions above)

3. **Public Itineraries**: Should we support public (anyone can view) itineraries?
   - Decision: Defer to Phase 6 (not in initial scope)

4. **Permission Inheritance**: Should editors be able to add other viewers?
   - Decision: No, only owners can manage permissions (keeps it simple)

---

## Success Metrics

**Quantitative**:
- 90%+ test coverage for permission logic
- Zero permission bypass vulnerabilities
- < 100ms added latency for permission checks
- Successful migration of 100% of existing itineraries

**Qualitative**:
- Users can successfully share itineraries with collaborators
- Clear UI indicators for permission levels
- No user confusion about role capabilities
- Smooth migration with no data loss

---

**Next Steps**:
1. Review and approve specification
2. Break down into implementation tasks
3. Create test cases for each acceptance criterion
4. Implement schema and migration
5. Implement API endpoints
6. Implement UI components
7. E2E testing with persona scenarios
8. Deploy and monitor
