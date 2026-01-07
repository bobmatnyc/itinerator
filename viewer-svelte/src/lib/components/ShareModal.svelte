<script lang="ts">
  import { Crown, PencilSimple, Eye, X, Trash } from 'phosphor-svelte';
  import { fade, scale } from 'svelte/transition';
  import { toast } from '$lib/stores/toast.svelte';

  let {
    itineraryId,
    isOpen = $bindable(false),
    onClose,
    currentUserEmail
  }: {
    itineraryId: string;
    isOpen: boolean;
    onClose: () => void;
    currentUserEmail: string;
  } = $props();

  // State
  let email = $state('');
  let role = $state<'editor' | 'viewer' | 'owner'>('viewer');
  let collaborators = $state<Array<{ email: string; role: string }>>([]);
  let loading = $state(false);
  let error = $state('');
  let addingUser = $state(false);

  // Fetch collaborators when modal opens
  $effect(() => {
    if (isOpen && itineraryId) {
      fetchCollaborators();
    }
  });

  async function fetchCollaborators() {
    loading = true;
    error = '';
    try {
      const response = await fetch(`/api/v1/itineraries/${itineraryId}/share`);
      if (!response.ok) {
        throw new Error('Failed to fetch collaborators');
      }
      const data = await response.json();
      collaborators = data.collaborators || [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load collaborators';
      toast.error(error);
    } finally {
      loading = false;
    }
  }

  async function handleAddUser() {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    addingUser = true;
    error = '';

    try {
      const response = await fetch(`/api/v1/itineraries/${itineraryId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add user');
      }

      toast.success(`Added ${email} as ${role}`);
      email = '';
      role = 'viewer';
      await fetchCollaborators();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add user';
      error = message;
      toast.error(message);
    } finally {
      addingUser = false;
    }
  }

  async function handleChangeRole(userEmail: string, newRole: string) {
    try {
      const response = await fetch(`/api/v1/itineraries/${itineraryId}/share/${encodeURIComponent(userEmail)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to change role');
      }

      toast.success(`Changed ${userEmail} to ${newRole}`);
      await fetchCollaborators();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change role';
      toast.error(message);
    }
  }

  async function handleRemoveUser(userEmail: string) {
    if (!confirm(`Remove ${userEmail}'s access to this itinerary?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/itineraries/${itineraryId}/share/${encodeURIComponent(userEmail)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove user');
      }

      toast.success(`Removed ${userEmail}`);
      await fetchCollaborators();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove user';
      toast.error(message);
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  function getRoleIcon(roleStr: string) {
    switch (roleStr) {
      case 'owner':
        return Crown;
      case 'editor':
        return PencilSimple;
      case 'viewer':
        return Eye;
      default:
        return Eye;
    }
  }

  function getRoleBadgeClass(roleStr: string) {
    switch (roleStr) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'editor':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  function isCurrentUser(userEmail: string): boolean {
    return userEmail === currentUserEmail;
  }
</script>

{#if isOpen}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleEscape}
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="share-modal-title"
    tabindex="-1"
  >
    <div class="modal-card" transition:scale={{ duration: 200, start: 0.95 }}>
      <!-- Header -->
      <div class="modal-header">
        <h2 id="share-modal-title" class="modal-title">Share Itinerary</h2>
        <button
          class="close-btn"
          onclick={onClose}
          type="button"
          aria-label="Close"
        >
          <X size={20} weight="bold" />
        </button>
      </div>

      <!-- Add user section -->
      <div class="add-user-section">
        <label for="email-input" class="label">Invite someone</label>
        <div class="input-row">
          <input
            id="email-input"
            type="email"
            placeholder="friend@example.com"
            bind:value={email}
            class="email-input"
            disabled={addingUser}
          />
          <select
            bind:value={role}
            class="role-select"
            disabled={addingUser}
            aria-label="Permission role"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </select>
          <button
            class="add-btn"
            onclick={handleAddUser}
            disabled={addingUser || !email.trim()}
            type="button"
          >
            {addingUser ? 'Adding...' : 'Add'}
          </button>
        </div>
        <div class="role-descriptions">
          <p class="role-desc"><strong>Owner:</strong> Can delete and manage permissions</p>
          <p class="role-desc"><strong>Editor:</strong> Can modify itinerary content</p>
          <p class="role-desc"><strong>Viewer:</strong> Read-only access</p>
        </div>
      </div>

      <!-- Collaborators list -->
      <div class="collaborators-section">
        <h3 class="section-title">Collaborators ({collaborators.length})</h3>

        {#if loading}
          <div class="loading">Loading collaborators...</div>
        {:else if collaborators.length === 0}
          <div class="empty-state">No collaborators yet. Add someone above to share this itinerary.</div>
        {:else}
          <ul class="collaborators-list">
            {#each collaborators as collaborator (collaborator.email)}
              <li class="collaborator-item">
                <div class="collaborator-info">
                  <div class="collaborator-email">
                    {collaborator.email}
                    {#if isCurrentUser(collaborator.email)}
                      <span class="you-badge">(you)</span>
                    {/if}
                  </div>
                  <div class="role-badge {getRoleBadgeClass(collaborator.role)}">
                    <svelte:component this={getRoleIcon(collaborator.role)} size={14} weight="bold" />
                    <span>{collaborator.role}</span>
                  </div>
                </div>

                {#if !isCurrentUser(collaborator.email)}
                  <div class="collaborator-actions">
                    <select
                      value={collaborator.role}
                      onchange={(e) => handleChangeRole(collaborator.email, e.currentTarget.value)}
                      class="role-select-small"
                      aria-label="Change role for {collaborator.email}"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button
                      class="remove-btn"
                      onclick={() => handleRemoveUser(collaborator.email)}
                      type="button"
                      aria-label="Remove {collaborator.email}"
                      title="Remove access"
                    >
                      <Trash size={16} weight="bold" />
                    </button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      {#if error}
        <div class="error-message" role="alert">{error}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
  }

  .modal-card {
    background: white;
    border-radius: 0.75rem;
    max-width: 42rem;
    width: 100%;
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .close-btn {
    padding: 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #6b7280;
    transition: color 0.2s;
    border-radius: 0.375rem;
  }

  .close-btn:hover {
    color: #1f2937;
    background-color: #f3f4f6;
  }

  .add-user-section {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .input-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .email-input {
    flex: 1;
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.9375rem;
    transition: border-color 0.2s;
  }

  .email-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .email-input:disabled {
    background-color: #f9fafb;
    cursor: not-allowed;
  }

  .role-select,
  .role-select-small {
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.9375rem;
    background-color: white;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .role-select {
    min-width: 110px;
  }

  .role-select-small {
    font-size: 0.875rem;
    padding: 0.375rem 0.625rem;
    min-width: 90px;
  }

  .role-select:focus,
  .role-select-small:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .add-btn {
    padding: 0.625rem 1.25rem;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    white-space: nowrap;
  }

  .add-btn:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .add-btn:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }

  .role-descriptions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .role-desc {
    font-size: 0.8125rem;
    color: #6b7280;
    margin: 0;
  }

  .collaborators-section {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1rem 0;
  }

  .loading,
  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
    font-size: 0.9375rem;
  }

  .collaborators-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .collaborator-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.875rem;
    background-color: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .collaborator-info {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    flex: 1;
    min-width: 0;
  }

  .collaborator-email {
    font-size: 0.9375rem;
    color: #1f2937;
    font-weight: 500;
    word-break: break-all;
  }

  .you-badge {
    font-size: 0.8125rem;
    color: #6b7280;
    font-weight: 400;
    margin-left: 0.375rem;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid;
    width: fit-content;
  }

  .collaborator-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .remove-btn {
    padding: 0.5rem;
    background-color: transparent;
    border: 1px solid #fca5a5;
    color: #ef4444;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    background-color: #fef2f2;
    border-color: #f87171;
  }

  .error-message {
    padding: 1rem 1.5rem;
    background-color: #fef2f2;
    color: #991b1b;
    border-top: 1px solid #fecaca;
    font-size: 0.875rem;
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .input-row {
      flex-direction: column;
    }

    .role-select {
      width: 100%;
    }

    .add-btn {
      width: 100%;
    }

    .collaborator-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .collaborator-actions {
      width: 100%;
      justify-content: space-between;
    }

    .role-select-small {
      flex: 1;
    }
  }
</style>
