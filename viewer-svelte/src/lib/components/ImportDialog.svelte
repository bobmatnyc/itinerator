<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { authStore } from '$lib/stores/auth.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import SegmentPreview from './SegmentPreview.svelte';
  import TripMatchCard from './TripMatchCard.svelte';
  import type { ExtractedSegment, TripMatch } from '$lib/types';

  let {
    open = $bindable(false),
    preselectedItineraryId,
    onComplete
  }: {
    open: boolean;
    preselectedItineraryId?: string;
    onComplete?: (itineraryId: string, itineraryName: string) => void;
  } = $props();

  // UI state
  type Step = 'upload' | 'processing' | 'matching' | 'confirm';
  let step = $state<Step>('upload');
  let file = $state<File | null>(null);
  let isDragging = $state(false);

  // Import data
  let segments = $state<ExtractedSegment[]>([]);
  let tripMatches = $state<TripMatch[]>([]);
  let confidence = $state(0);
  let summary = $state('');

  // Selection state
  let selectedTripId = $state<string | null>(preselectedItineraryId || null);
  let createNew = $state(false);
  let newTripName = $state('');

  // Processing state
  let importing = $state(false);

  // Computed
  let canProceed = $derived(
    step === 'matching' && (selectedTripId || (createNew && newTripName.trim()))
  );

  let selectedMatch = $derived(
    selectedTripId ? tripMatches.find((m) => m.itineraryId === selectedTripId) : null
  );

  // Infer trip name from segments (Destination MonDD-DD or MonDD-MonDD)
  let suggestedTripName = $derived(() => {
    if (segments.length === 0) return '';

    // Find destination from segments
    let destination = '';
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    for (const seg of segments) {
      // Get dates
      const start = new Date(seg.startDatetime);
      const end = new Date(seg.endDatetime);
      if (!earliestDate || start < earliestDate) earliestDate = start;
      if (!latestDate || end > latestDate) latestDate = end;

      // Get destination from flights or hotels
      if (seg.type === 'FLIGHT' && (seg as any).destination) {
        const dest = (seg as any).destination;
        destination = dest.address?.city || dest.name || dest.code || '';
      } else if (seg.type === 'HOTEL' && (seg as any).location) {
        const loc = (seg as any).location;
        if (!destination) {
          destination = loc.address?.city || loc.name || '';
        }
      }
    }

    if (!destination || !earliestDate || !latestDate) {
      return destination || 'New Trip';
    }

    // Format dates
    const startMonth = earliestDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = earliestDate.getDate();
    const endMonth = latestDate.toLocaleDateString('en-US', { month: 'short' });
    const endDay = latestDate.getDate();

    // Same month: "Boston Jan 15-20"
    // Different months: "Boston Jan 15 - Feb 2"
    if (startMonth === endMonth) {
      return `${destination} ${startMonth} ${startDay}-${endDay}`;
    } else {
      return `${destination} ${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
  });

  function resetState() {
    step = 'upload';
    file = null;
    isDragging = false;
    segments = [];
    tripMatches = [];
    confidence = 0;
    summary = '';
    selectedTripId = preselectedItineraryId || null;
    createNew = false;
    newTripName = '';
    importing = false;
  }

  function handleClose() {
    if (!importing) {
      open = false;
      resetState();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  // File handling
  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const selectedFile = target.files?.[0];
    if (selectedFile) {
      file = selectedFile;
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const droppedFile = e.dataTransfer?.files[0];
    if (droppedFile) {
      file = droppedFile;
    }
  }

  // Import flow
  async function handleUpload() {
    if (!file || !authStore.userEmail) return;

    importing = true;
    step = 'processing';

    try {
      const formData = new FormData();
      formData.append('file', file);

      const userId = authStore.userEmail;
      const autoMatch = !preselectedItineraryId;
      const url = `/api/v1/import/upload?userId=${encodeURIComponent(userId)}&autoMatch=${autoMatch}`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const result = await response.json();

      // Store extracted data
      segments = result.segments || [];
      tripMatches = result.tripMatches || [];
      confidence = result.confidence || 0;
      summary = result.summary || '';

      // Move to matching step
      step = 'matching';

      // Auto-select if preselected
      if (preselectedItineraryId) {
        selectedTripId = preselectedItineraryId;
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
      step = 'upload';
    } finally {
      importing = false;
    }
  }

  async function handleConfirm() {
    if (!canProceed || !authStore.userEmail) return;

    importing = true;

    try {
      const url = '/api/v1/import/confirm';
      const body = createNew
        ? {
            segments,
            createNew: true,
            name: newTripName.trim(),
            userId: authStore.userEmail
          }
        : {
            segments,
            itineraryId: selectedTripId,
            userId: authStore.userEmail
          };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import confirmation failed');
      }

      const result = await response.json();

      // Success!
      step = 'confirm';
      toast.success(
        `Successfully imported ${segments.length} segment${segments.length === 1 ? '' : 's'}`
      );

      // Call completion callback
      if (onComplete) {
        // Use selectedItinerary for new trips, itineraryId for existing
        const itinId = result.selectedItinerary?.id || result.itineraryId || selectedTripId!;
        const itinName = result.selectedItinerary?.name || result.itineraryName || selectedMatch?.itineraryName || newTripName;
        onComplete(itinId, itinName);
      }

      // Close after a short delay
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Import confirmation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Import confirmation failed');
    } finally {
      importing = false;
    }
  }

  function handleSelectTrip(tripId: string) {
    selectedTripId = tripId;
    createNew = false;
  }

  function handleCreateNew() {
    createNew = true;
    selectedTripId = null;
    // Pre-fill with suggested name based on segments
    newTripName = suggestedTripName();
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleEscape}
    transition:fade={{ duration: 200 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="import-dialog-title"
    tabindex="-1"
  >
    <div class="modal-card" transition:scale={{ duration: 200, start: 0.95 }}>
      <!-- Header -->
      <div class="modal-header">
        <h2 id="import-dialog-title" class="modal-title">
          {#if step === 'upload'}
            Import Travel Documents
          {:else if step === 'processing'}
            Processing...
          {:else if step === 'matching'}
            Select Destination Trip
          {:else}
            Import Complete
          {/if}
        </h2>
        <button
          class="close-button"
          onclick={handleClose}
          disabled={importing}
          type="button"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        {#if step === 'upload'}
          <!-- File Upload Step -->
          {#if !file}
            <div
              class="drop-zone"
              class:dragging={isDragging}
              ondragover={handleDragOver}
              ondragleave={handleDragLeave}
              ondrop={handleDrop}
            >
              <svg class="drop-zone-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p class="drop-zone-text">
                Drop PDF, ICS, or image files here or
              </p>
              <label class="file-input-label">
                <input
                  type="file"
                  accept=".pdf,.ics,.png,.jpg,.jpeg"
                  onchange={handleFileSelect}
                  class="file-input"
                />
                <span class="file-input-button">Browse files</span>
              </label>
              <p class="help-text">
                Supported: PDF confirmations, ICS calendar files, confirmation screenshots
              </p>
            </div>
          {:else}
            <!-- File Selected -->
            <div class="file-selected">
              <div class="file-info">
                <svg class="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div class="file-details">
                  <p class="file-name">{file.name}</p>
                  <p class="file-size">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                type="button"
                class="file-remove"
                onclick={() => (file = null)}
                aria-label="Remove file"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          {/if}
        {:else if step === 'processing'}
          <!-- Processing Step -->
          <div class="processing-state">
            <div class="spinner"></div>
            <p class="processing-text">Extracting booking details...</p>
            <p class="processing-subtext">This may take a moment</p>
          </div>
        {:else if step === 'matching'}
          <!-- Matching Step -->
          <div class="matching-step">
            <!-- Extracted Segments Preview -->
            <SegmentPreview {segments} />

            {#if summary}
              <div class="summary-box">
                <strong>Summary:</strong> {summary}
              </div>
            {/if}

            <!-- Trip Matches or Create New -->
            <div class="trip-selection">
              <h3 class="selection-title">Add to Trip</h3>

              {#if tripMatches.length > 0}
                <!-- Matched Trips (score > 0) -->
                {@const matchedTrips = tripMatches.filter(m => m.matchScore > 0)}
                {@const unmatchedTrips = tripMatches.filter(m => m.matchScore === 0)}

                {#if matchedTrips.length > 0}
                  <p class="subsection-label">Suggested Matches</p>
                  <div class="trip-matches">
                    {#each matchedTrips as match (match.itineraryId)}
                      <TripMatchCard
                        {match}
                        selected={selectedTripId === match.itineraryId}
                        onSelect={() => handleSelectTrip(match.itineraryId)}
                      />
                    {/each}
                  </div>
                {/if}

                <!-- All Other Trips -->
                {#if unmatchedTrips.length > 0}
                  {#if matchedTrips.length > 0}
                    <p class="subsection-label mt-4">Other Trips</p>
                  {/if}
                  <div class="trip-matches">
                    {#each unmatchedTrips as match (match.itineraryId)}
                      <TripMatchCard
                        {match}
                        selected={selectedTripId === match.itineraryId}
                        onSelect={() => handleSelectTrip(match.itineraryId)}
                      />
                    {/each}
                  </div>
                {/if}

                <div class="divider">
                  <span class="divider-text">or</span>
                </div>
              {/if}

              <!-- Create New Trip Option -->
              <button
                type="button"
                class="create-new-button"
                class:selected={createNew}
                onclick={handleCreateNew}
              >
                <div class="radio-wrapper">
                  <input
                    type="radio"
                    name="trip-match"
                    checked={createNew}
                    onchange={handleCreateNew}
                    class="radio-input"
                  />
                </div>
                <div class="create-new-content">
                  <span class="create-new-label">Create New Trip</span>
                  {#if createNew}
                    <input
                      type="text"
                      placeholder="Enter trip name..."
                      bind:value={newTripName}
                      class="new-trip-input"
                      autofocus
                      onclick={(e) => e.stopPropagation()}
                    />
                  {/if}
                </div>
              </button>
            </div>
          </div>
        {:else if step === 'confirm'}
          <!-- Success Step -->
          <div class="success-state">
            <svg class="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p class="success-text">Import successful!</p>
            <p class="success-subtext">
              {segments.length} segment{segments.length === 1 ? '' : 's'} added to your trip
            </p>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      {#if step !== 'confirm'}
        <div class="modal-footer">
          <button
            type="button"
            class="modal-button modal-button-cancel"
            onclick={handleClose}
            disabled={importing}
          >
            Cancel
          </button>
          {#if step === 'upload'}
            <button
              type="button"
              class="modal-button modal-button-confirm"
              onclick={handleUpload}
              disabled={!file || importing}
            >
              Upload & Process
            </button>
          {:else if step === 'matching'}
            <button
              type="button"
              class="modal-button modal-button-confirm"
              onclick={handleConfirm}
              disabled={!canProceed || importing}
            >
              {importing ? 'Importing...' : 'Import Segments'}
            </button>
          {/if}
        </div>
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
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
    backdrop-filter: blur(4px);
  }

  .modal-card {
    background: white;
    border-radius: 0.75rem;
    max-width: 48rem;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .close-button {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #6b7280;
    font-size: 1.5rem;
    cursor: pointer;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .close-button:hover:not(:disabled) {
    background-color: #f3f4f6;
    color: #1f2937;
  }

  .close-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  /* Upload Step */
  .drop-zone {
    border: 2px dashed #e5e7eb;
    border-radius: 0.5rem;
    padding: 3rem 2rem;
    text-align: center;
    transition: all 0.2s;
    background-color: #fafafa;
  }

  .drop-zone.dragging {
    border-color: #3b82f6;
    background-color: #eff6ff;
  }

  .drop-zone-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 1rem;
    color: #9ca3af;
  }

  .drop-zone-text {
    color: #6b7280;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
  }

  .file-input {
    display: none;
  }

  .file-input-label {
    display: inline-block;
  }

  .file-input-button {
    display: inline-block;
    padding: 0.5rem 1rem;
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #3b82f6;
    cursor: pointer;
    transition: all 0.2s;
  }

  .file-input-button:hover {
    background-color: #f9fafb;
    border-color: #3b82f6;
  }

  .help-text {
    margin-top: 1rem;
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .file-selected {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .file-icon {
    width: 40px;
    height: 40px;
    color: #3b82f6;
    flex-shrink: 0;
  }

  .file-details {
    text-align: left;
  }

  .file-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
  }

  .file-size {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
  }

  .file-remove {
    padding: 0.5rem;
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 0.25rem;
  }

  .file-remove:hover {
    color: #ef4444;
    background-color: #fee2e2;
  }

  /* Processing Step */
  .processing-state {
    text-align: center;
    padding: 3rem 2rem;
  }

  .spinner {
    width: 48px;
    height: 48px;
    margin: 0 auto 1.5rem;
    border: 4px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .processing-text {
    font-size: 1rem;
    font-weight: 500;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .processing-subtext {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  /* Matching Step */
  .matching-step {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .summary-box {
    padding: 1rem;
    background-color: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #1e40af;
  }

  .trip-selection {
    margin-top: 0.5rem;
  }

  .selection-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1rem 0;
  }

  .subsection-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .subsection-label.mt-4 {
    margin-top: 1.5rem;
  }

  .trip-matches {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .divider {
    position: relative;
    text-align: center;
    margin: 1.5rem 0;
  }

  .divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background-color: #e5e7eb;
  }

  .divider-text {
    position: relative;
    display: inline-block;
    padding: 0 1rem;
    background-color: white;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .create-new-button {
    width: 100%;;
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 1rem;
    background-color: white;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .create-new-button:hover {
    border-color: #3b82f6;
    background-color: #f9fafb;
  }

  .create-new-button.selected {
    border-color: #3b82f6;
    background-color: #eff6ff;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .radio-wrapper {
    padding-top: 0.125rem;
    flex-shrink: 0;
  }

  .radio-input {
    width: 1.125rem;
    height: 1.125rem;
    cursor: pointer;
    accent-color: #3b82f6;
  }

  .create-new-content {
    flex: 1;
  }

  .create-new-label {
    display: block;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .new-trip-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .new-trip-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  /* Success Step */
  .success-state {
    text-align: center;
    padding: 3rem 2rem;
  }

  .success-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 1.5rem;
    color: #10b981;
  }

  .success-text {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .success-subtext {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  /* Modal Buttons */
  .modal-button {
    padding: 0.625rem 1.25rem;
    border-radius: 0.375rem;
    font-size: 0.9375rem;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .modal-button-cancel {
    background-color: #f3f4f6;
    color: #374151;
  }

  .modal-button-cancel:hover:not(:disabled) {
    background-color: #e5e7eb;
  }

  .modal-button-confirm {
    background-color: #3b82f6;
    color: white;
  }

  .modal-button-confirm:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .modal-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-button:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  /* Scrollbar */
  .modal-body::-webkit-scrollbar {
    width: 8px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .modal-body::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .modal-card {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }

    .modal-header,
    .modal-body,
    .modal-footer {
      padding: 1.25rem;
    }

    .drop-zone {
      padding: 2rem 1rem;
    }

    .modal-footer {
      flex-direction: column-reverse;
    }

    .modal-button {
      width: 100%;
    }
  }
</style>
