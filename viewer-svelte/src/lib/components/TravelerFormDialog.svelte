<script lang="ts">
  import type { Traveler } from '../types';
  import { formatPhoneNumber } from '$lib/utils/phone-format';

  let {
    open = $bindable(false),
    traveler,
    onSave,
    onCancel
  }: {
    open: boolean;
    traveler?: Traveler;
    onSave: (data: Partial<Traveler>) => Promise<void>;
    onCancel: () => void;
  } = $props();

  // Form state
  let firstName = $state(traveler?.firstName || '');
  let lastName = $state(traveler?.lastName || '');
  let type = $state(traveler?.type || 'ADULT');
  let email = $state(traveler?.email || '');
  let phone = $state(traveler?.phone || '');
  let saving = $state(false);
  let error = $state<string | null>(null);

  // Validation
  let isValid = $derived(firstName.trim().length > 0 && lastName.trim().length > 0);

  // Phone formatting handler
  function handlePhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const cursorPosition = input.selectionStart || 0;
    const previousLength = input.value.length;

    // Format the phone number
    const formatted = formatPhoneNumber(input.value);
    phone = formatted;

    // Preserve cursor position relative to digits
    // This prevents cursor from jumping when formatting adds characters
    const lengthDiff = formatted.length - previousLength;
    const newPosition = cursorPosition + lengthDiff;

    // Apply the formatted value and restore cursor position
    setTimeout(() => {
      input.value = formatted;
      input.setSelectionRange(newPosition, newPosition);
    }, 0);
  }

  async function handleSubmit() {
    if (!isValid) return;

    saving = true;
    error = null;

    try {
      await onSave({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        type,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined
      });
      open = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save traveler';
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    open = false;
    onCancel();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }

  // Reset form when dialog opens/closes
  $effect(() => {
    if (open) {
      firstName = traveler?.firstName || '';
      lastName = traveler?.lastName || '';
      type = traveler?.type || 'ADULT';
      email = traveler?.email || '';
      phone = traveler?.phone || '';
      error = null;
    }
  });
</script>

{#if open}
  <div class="dialog-overlay" onclick={handleBackdropClick}>
    <div class="dialog">
      <h2 class="dialog-title">{traveler ? 'Edit Traveler' : 'Add Traveler'}</h2>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div class="form-row">
          <div class="form-field">
            <label for="firstName">First Name *</label>
            <input
              id="firstName"
              type="text"
              bind:value={firstName}
              placeholder="John"
              required
            />
          </div>

          <div class="form-field">
            <label for="lastName">Last Name *</label>
            <input
              id="lastName"
              type="text"
              bind:value={lastName}
              placeholder="Doe"
              required
            />
          </div>
        </div>

        <div class="form-field">
          <label for="type">Type</label>
          <select id="type" bind:value={type}>
            <option value="ADULT">Adult</option>
            <option value="CHILD">Child</option>
            <option value="INFANT">Infant</option>
          </select>
        </div>

        <div class="form-field">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="john@example.com"
          />
        </div>

        <div class="form-field">
          <label for="phone">Phone</label>
          <input
            id="phone"
            type="tel"
            bind:value={phone}
            oninput={handlePhoneInput}
            placeholder="(555) 123-4567"
          />
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn-cancel" onclick={handleCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" class="btn-save" disabled={!isValid || saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .dialog {
    background-color: #ffffff;
    border-radius: 0.5rem;
    padding: 1.5rem;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    max-height: 90vh;
    overflow-y: auto;
  }

  .dialog-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1.5rem 0;
  }

  .error-message {
    background-color: #fef2f2;
    color: #991b1b;
    padding: 0.75rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-field {
    margin-bottom: 1rem;
  }

  .form-field label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-field input,
  .form-field select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 1rem;
    color: #1f2937;
  }

  .form-field input:focus,
  .form-field select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .dialog-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .btn-cancel,
  .btn-save {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-cancel {
    background-color: #ffffff;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-cancel:hover:not(:disabled) {
    background-color: #f9fafb;
  }

  .btn-save {
    background-color: #3b82f6;
    color: #ffffff;
    border: 1px solid #3b82f6;
  }

  .btn-save:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .btn-cancel:disabled,
  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
