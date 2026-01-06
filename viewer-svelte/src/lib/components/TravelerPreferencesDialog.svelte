<script lang="ts">
  import type { TravelPreferences } from '../types';
  import type { CurrencyCode } from '$lib/types/currency';

  let {
    open = $bindable(false),
    preferences,
    onSave,
    onCancel
  }: {
    open: boolean;
    preferences?: TravelPreferences;
    onSave: (data: TravelPreferences) => Promise<void>;
    onCancel: () => void;
  } = $props();

  // Form state
  let homeCountry = $state(preferences?.homeCountry || '');
  let homeCurrency = $state<CurrencyCode>(preferences?.homeCurrency as CurrencyCode || 'USD');

  // Travel style state
  let budget = $state<'budget' | 'moderate' | 'luxury' | 'ultra-luxury'>(
    preferences?.travelStyle?.budget || 'moderate'
  );
  let pace = $state<'relaxed' | 'moderate' | 'packed'>(
    preferences?.travelStyle?.pace || 'moderate'
  );

  // Multi-select state
  let selectedInterests = $state<Set<string>>(
    new Set(preferences?.travelStyle?.interests || [])
  );
  let selectedDining = $state<Set<string>>(
    new Set(preferences?.travelStyle?.diningPreferences || [])
  );
  let selectedAccommodation = $state<Set<string>>(
    new Set(preferences?.travelStyle?.accommodationPreferences || [])
  );

  let saving = $state(false);
  let error = $state<string | null>(null);

  // Common countries for dropdown
  const COMMON_COUNTRIES = [
    'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany',
    'France', 'Spain', 'Italy', 'Japan', 'China', 'South Korea',
    'Singapore', 'Thailand', 'India', 'Brazil', 'Mexico'
  ];

  // Currency options with display names
  const CURRENCIES: Array<{ code: CurrencyCode; name: string }> = [
    { code: 'USD', name: 'USD - US Dollar' },
    { code: 'EUR', name: 'EUR - Euro' },
    { code: 'GBP', name: 'GBP - British Pound' },
    { code: 'JPY', name: 'JPY - Japanese Yen' },
    { code: 'CNY', name: 'CNY - Chinese Yuan' },
    { code: 'KRW', name: 'KRW - South Korean Won' },
    { code: 'AUD', name: 'AUD - Australian Dollar' },
    { code: 'CAD', name: 'CAD - Canadian Dollar' },
    { code: 'SGD', name: 'SGD - Singapore Dollar' },
    { code: 'THB', name: 'THB - Thai Baht' },
    { code: 'INR', name: 'INR - Indian Rupee' },
    { code: 'BRL', name: 'BRL - Brazilian Real' },
    { code: 'MXN', name: 'MXN - Mexican Peso' },
    { code: 'CHF', name: 'CHF - Swiss Franc' },
    { code: 'SEK', name: 'SEK - Swedish Krona' },
  ];

  // Interest options
  const INTERESTS = [
    'Food', 'History', 'Adventure', 'Art', 'Nature',
    'Shopping', 'Nightlife', 'Architecture', 'Photography',
    'Museums', 'Beaches', 'Hiking', 'Sports', 'Wellness'
  ];

  // Dining preference options
  const DINING_PREFERENCES = [
    'Local Cuisine', 'Fine Dining', 'Street Food', 'Vegetarian',
    'Vegan', 'Halal', 'Kosher', 'Seafood', 'Casual Dining'
  ];

  // Accommodation preference options
  const ACCOMMODATION_PREFERENCES = [
    'Boutique Hotels', 'Luxury Hotels', 'Hostels', 'Ryokans',
    'Airbnb', 'Resorts', 'Budget Hotels', 'Eco-Lodges'
  ];

  function toggleInterest(interest: string) {
    if (selectedInterests.has(interest)) {
      selectedInterests.delete(interest);
    } else {
      selectedInterests.add(interest);
    }
    selectedInterests = new Set(selectedInterests); // Trigger reactivity
  }

  function toggleDining(preference: string) {
    if (selectedDining.has(preference)) {
      selectedDining.delete(preference);
    } else {
      selectedDining.add(preference);
    }
    selectedDining = new Set(selectedDining);
  }

  function toggleAccommodation(preference: string) {
    if (selectedAccommodation.has(preference)) {
      selectedAccommodation.delete(preference);
    } else {
      selectedAccommodation.add(preference);
    }
    selectedAccommodation = new Set(selectedAccommodation);
  }

  async function handleSubmit() {
    saving = true;
    error = null;

    try {
      const updatedPreferences: TravelPreferences = {
        homeCountry: homeCountry.trim() || undefined,
        homeCurrency,
        travelStyle: {
          budget,
          pace,
          interests: Array.from(selectedInterests),
          diningPreferences: Array.from(selectedDining),
          accommodationPreferences: Array.from(selectedAccommodation)
        }
      };

      await onSave(updatedPreferences);
      open = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save preferences';
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
      homeCountry = preferences?.homeCountry || '';
      homeCurrency = preferences?.homeCurrency as CurrencyCode || 'USD';
      budget = preferences?.travelStyle?.budget || 'moderate';
      pace = preferences?.travelStyle?.pace || 'moderate';
      selectedInterests = new Set(preferences?.travelStyle?.interests || []);
      selectedDining = new Set(preferences?.travelStyle?.diningPreferences || []);
      selectedAccommodation = new Set(preferences?.travelStyle?.accommodationPreferences || []);
      error = null;
    }
  });
</script>

{#if open}
  <div class="dialog-overlay" onclick={handleBackdropClick}>
    <div class="dialog">
      <div class="dialog-header">
        <h2 class="dialog-title">Travel Preferences</h2>
        <button class="close-button" onclick={handleCancel} type="button">×</button>
      </div>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <!-- Home Location Section -->
        <div class="section">
          <h3 class="section-title">Home Location</h3>

          <div class="form-field">
            <label for="homeCountry">Country</label>
            <select id="homeCountry" bind:value={homeCountry}>
              <option value="">Select a country</option>
              {#each COMMON_COUNTRIES as country}
                <option value={country}>{country}</option>
              {/each}
            </select>
          </div>

          <div class="form-field">
            <label for="homeCurrency">Currency</label>
            <select id="homeCurrency" bind:value={homeCurrency}>
              {#each CURRENCIES as { code, name }}
                <option value={code}>{name}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Travel Style Section -->
        <div class="section">
          <h3 class="section-title">Travel Style</h3>

          <div class="radio-group">
            <label class="radio-label">Budget Level</label>
            <div class="radio-options">
              <label class="radio-option">
                <input type="radio" name="budget" value="budget" bind:group={budget} />
                <span>Budget</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="budget" value="moderate" bind:group={budget} />
                <span>Moderate</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="budget" value="luxury" bind:group={budget} />
                <span>Luxury</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="budget" value="ultra-luxury" bind:group={budget} />
                <span>Ultra-Luxury</span>
              </label>
            </div>
          </div>

          <div class="radio-group">
            <label class="radio-label">Pace</label>
            <div class="radio-options">
              <label class="radio-option">
                <input type="radio" name="pace" value="relaxed" bind:group={pace} />
                <span>Relaxed</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="pace" value="moderate" bind:group={pace} />
                <span>Moderate</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="pace" value="packed" bind:group={pace} />
                <span>Packed</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Interests Section -->
        <div class="section">
          <h3 class="section-title">Interests</h3>
          <div class="chip-group">
            {#each INTERESTS as interest}
              <button
                type="button"
                class="chip"
                class:active={selectedInterests.has(interest)}
                onclick={() => toggleInterest(interest)}
              >
                {interest}
                {#if selectedInterests.has(interest)}✓{/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Dining Preferences Section -->
        <div class="section">
          <h3 class="section-title">Dining Preferences</h3>
          <div class="chip-group">
            {#each DINING_PREFERENCES as preference}
              <button
                type="button"
                class="chip"
                class:active={selectedDining.has(preference)}
                onclick={() => toggleDining(preference)}
              >
                {preference}
                {#if selectedDining.has(preference)}✓{/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Accommodation Preferences Section -->
        <div class="section">
          <h3 class="section-title">Accommodation Preferences</h3>
          <div class="chip-group">
            {#each ACCOMMODATION_PREFERENCES as preference}
              <button
                type="button"
                class="chip"
                class:active={selectedAccommodation.has(preference)}
                onclick={() => toggleAccommodation(preference)}
              >
                {preference}
                {#if selectedAccommodation.has(preference)}✓{/if}
              </button>
            {/each}
          </div>
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn-cancel" onclick={handleCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" class="btn-save" disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
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
    max-width: 600px;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    max-height: 90vh;
    overflow-y: auto;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
    background-color: #ffffff;
    z-index: 1;
  }

  .dialog-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
  }

  .close-button:hover {
    background-color: #f3f4f6;
    color: #1f2937;
  }

  .error-message {
    background-color: #fef2f2;
    color: #991b1b;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
  }

  form {
    padding: 1.5rem;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section:last-of-type {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 1rem 0;
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

  .form-field select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 1rem;
    color: #1f2937;
  }

  .form-field select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .radio-group {
    margin-bottom: 1.5rem;
  }

  .radio-group:last-child {
    margin-bottom: 0;
  }

  .radio-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .radio-options {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .radio-option:hover {
    background-color: #f9fafb;
    border-color: #9ca3af;
  }

  .radio-option input {
    margin: 0;
  }

  .radio-option span {
    font-size: 0.875rem;
    color: #374151;
  }

  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .chip {
    padding: 0.5rem 0.75rem;
    background-color: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 9999px;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;
  }

  .chip:hover {
    background-color: #e5e7eb;
  }

  .chip.active {
    background-color: #dbeafe;
    border-color: #3b82f6;
    color: #1e40af;
  }

  .dialog-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
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
    .dialog {
      margin: 0;
      max-height: 100vh;
      border-radius: 0;
    }

    .radio-options {
      flex-direction: column;
    }
  }
</style>
