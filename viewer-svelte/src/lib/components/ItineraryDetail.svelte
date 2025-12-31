<script lang="ts">
  import type { Itinerary, Segment } from '$lib/types';
  import SegmentCard from './SegmentCard.svelte';
  import SegmentEditor from './SegmentEditor.svelte';
  import AddSegmentModal from './AddSegmentModal.svelte';
  import DestinationBackgroundSlideshow from './DestinationBackgroundSlideshow.svelte';
  import ImportDialog from './ImportDialog.svelte';
  import { updateSegment, deleteSegment, addSegment, updateItinerary } from '$lib/stores/itineraries.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  let {
    itinerary,
    editMode = 'ai',
    onEditManually,
    onEditWithPrompt,
    onDelete
  }: {
    itinerary: Itinerary;
    editMode?: 'ai' | 'manual';
    onEditManually?: (itinerary: Itinerary) => void;
    onEditWithPrompt?: (itinerary: Itinerary) => void;
    onDelete?: (itinerary: Itinerary) => void;
  } = $props();

  let showDeleteConfirm = $state(false);
  let editingSegmentId = $state<string | null>(null);
  let showAddSegmentModal = $state(false);
  let showImportDialog = $state(false);

  // Manual edit mode state
  let isEditingMetadata = $state(false);
  let editedTitle = $state(itinerary.title);
  let editedDescription = $state(itinerary.description || '');
  let editedStartDate = $state(itinerary.startDate ? itinerary.startDate.split('T')[0] : '');
  let editedEndDate = $state(itinerary.endDate ? itinerary.endDate.split('T')[0] : '');

  // Auto-enable editing when in manual mode
  let inManualEditMode = $derived(editMode === 'manual');

  function handleEditManually() {
    if (onEditManually) {
      onEditManually(itinerary);
    }
  }

  function handleEditWithPrompt() {
    onEditWithPrompt?.(itinerary);
  }

  function startEditingMetadata() {
    isEditingMetadata = true;
    editedTitle = itinerary.title;
    editedDescription = itinerary.description || '';
    editedStartDate = itinerary.startDate ? itinerary.startDate.split('T')[0] : '';
    editedEndDate = itinerary.endDate ? itinerary.endDate.split('T')[0] : '';
  }

  async function saveMetadata() {
    try {
      await updateItinerary(itinerary.id, {
        title: editedTitle,
        description: editedDescription || undefined,
        startDate: editedStartDate || undefined,
        endDate: editedEndDate || undefined,
      });
      isEditingMetadata = false;
      toast.success('Itinerary updated');
    } catch (error) {
      console.error('Failed to update itinerary:', error);
      toast.error('Failed to update itinerary. Please try again.');
    }
  }

  function cancelEditingMetadata() {
    isEditingMetadata = false;
  }

  function handleEditSegment(segmentId: string) {
    editingSegmentId = segmentId;
  }

  async function handleSaveSegment(segmentData: Partial<Segment>) {
    try {
      await updateSegment(itinerary.id, segmentData.id!, segmentData);
      editingSegmentId = null;
      toast.success('Segment saved');
    } catch (error) {
      console.error('Failed to save segment:', error);
      toast.error('Failed to save segment. Please try again.');
    }
  }

  function handleCancelEdit() {
    editingSegmentId = null;
  }

  async function handleDeleteSegment(segmentId: string) {
    try {
      await deleteSegment(itinerary.id, segmentId);
      toast.success('Segment deleted');
    } catch (error) {
      console.error('Failed to delete segment:', error);
      toast.error('Failed to delete segment. Please try again.');
    }
  }

  async function handleAddSegment(segmentData: Partial<Segment>) {
    await addSegment(itinerary.id, segmentData);
  }

  function handleDeleteClick() {
    showDeleteConfirm = true;
  }

  function handleImportComplete(itineraryId: string, itineraryName: string) {
    showImportDialog = false;
    toast.success(`Segments imported to ${itineraryName}`);
  }

  function handleConfirmDelete() {
    onDelete?.(itinerary);
    showDeleteConfirm = false;
  }

  function handleCancelDelete() {
    showDeleteConfirm = false;
  }

  // Format date range - use UTC to avoid timezone issues
  function formatDateRange(): string {
    if (!itinerary.startDate) return '';
    const start = new Date(itinerary.startDate);
    const end = itinerary.endDate ? new Date(itinerary.endDate) : null;
    const options: Intl.DateTimeFormatOptions = { timeZone: 'UTC' };

    if (end) {
      return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
    }
    return start.toLocaleDateString('en-US', options);
  }

  // Get destinations string
  function getDestinationsString(): string {
    if (!itinerary.destinations || itinerary.destinations.length === 0) {
      return '';
    }
    return itinerary.destinations.map((d) => d.city || d.name).join(', ');
  }

  // Check if trip dates are in the past
  let hasPastDates = $derived.by(() => {
    if (!itinerary.endDate) return false;
    const endDate = new Date(itinerary.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate < today;
  });

  // Extract destination from title (e.g., "Croatia Business Trip" → "Croatia")
  function inferDestinationFromTitle(title: string | undefined): string | null {
    if (!title || title === 'New Itinerary') return null;

    const patterns = [
      /^(.+?)\s+(business\s+)?trip$/i,           // "Croatia Business Trip" → "Croatia"
      /^(.+?)\s+vacation$/i,                      // "Hawaii Vacation" → "Hawaii"
      /^(.+?)\s+adventure$/i,                     // "Japan Adventure" → "Japan"
      /^trip\s+to\s+(.+)$/i,                      // "Trip to Paris" → "Paris"
      /^visit(?:ing)?\s+(.+)$/i,                  // "Visiting London" → "London"
      /^(.+?)\s+getaway$/i,                       // "Paris Getaway" → "Paris"
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        const dest = match[1].trim();
        if (!['new', 'my', 'our', 'the', 'a', 'an', 'weekend'].includes(dest.toLowerCase())) {
          return dest;
        }
      }
    }
    return null;
  }

  // Get first destination for background - prefer explicit, then infer from title
  let destinationName = $derived(
    itinerary?.destinations?.[0]?.name ||
    itinerary?.destinations?.[0]?.city ||
    inferDestinationFromTitle(itinerary?.title)
  );

  // Extended segment type for hotel night tracking
  type ExpandedSegment = Segment & {
    _hotelNightInfo?: {
      nightNumber: number;
      totalNights: number;
      isCheckout: boolean;
    };
  };

  // Group segments by date
  interface SegmentsByDay {
    date: string;
    dateDisplay: string;
    segments: ExpandedSegment[];
  }

  // Helper function to expand hotel segments across all nights
  function expandHotelSegments(segments: Segment[]): ExpandedSegment[] {
    const expanded: ExpandedSegment[] = [];

    segments.forEach((segment) => {
      if (segment.type === 'HOTEL' && segment.checkInDate && segment.checkOutDate) {
        const checkIn = new Date(segment.checkInDate);
        const checkOut = new Date(segment.checkOutDate);

        // Calculate number of nights (not including checkout day)
        const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

        if (nights > 0) {
          // Create an entry for each night of the stay
          for (let i = 0; i < nights; i++) {
            const nightDate = new Date(checkIn);
            nightDate.setDate(nightDate.getDate() + i);

            // Use the night's date at midnight for grouping
            const nightDatetime = nightDate.toISOString().split('T')[0] + 'T00:00:00.000Z';

            expanded.push({
              ...segment,
              startDatetime: nightDatetime,
              _hotelNightInfo: {
                nightNumber: i + 1,
                totalNights: nights,
                isCheckout: false,
              },
            });
          }

          // Add checkout entry on the checkout date
          const checkoutDatetime = checkOut.toISOString().split('T')[0] + 'T11:00:00.000Z'; // Assume 11 AM checkout
          expanded.push({
            ...segment,
            startDatetime: checkoutDatetime,
            _hotelNightInfo: {
              nightNumber: 0,
              totalNights: nights,
              isCheckout: true,
            },
          });
        } else {
          // Same-day check-in/check-out or invalid dates
          expanded.push(segment);
        }
      } else {
        // Non-hotel segment or hotel without date range
        expanded.push(segment);
      }
    });

    return expanded;
  }

  let segmentsByDay = $derived.by(() => {
    const grouped = new Map<string, ExpandedSegment[]>();

    // Guard against missing segments
    if (!itinerary?.segments) {
      return [];
    }

    // Expand hotel segments across all nights
    const expandedSegments = expandHotelSegments(itinerary.segments);

    // Group segments by date (YYYY-MM-DD)
    expandedSegments.forEach((segment) => {
      const date = new Date(segment.startDatetime);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(segment);
    });

    // Convert to array and sort by date
    const result: SegmentsByDay[] = Array.from(grouped.entries())
      .map(([dateKey, segments]) => {
        const date = new Date(dateKey);
        // Use UTC timezone to avoid off-by-one-day issues when dateKey is "YYYY-MM-DD"
        const dateDisplay = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });

        return {
          date: dateKey,
          dateDisplay,
          segments: segments.sort(
            (a, b) =>
              new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime()
          ),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  });
</script>

<div class="itinerary-detail" class:has-background={destinationName}>
  {#if destinationName}
    <DestinationBackgroundSlideshow
      destination={destinationName}
      imageCount={5}
      interval={8000}
      opacity={0.15}
    />
  {/if}

  <div class="detail-content h-full overflow-y-auto">
    <!-- Itinerary Metadata -->
    <div class="bg-minimal-card p-6">
    {#if inManualEditMode && !isEditingMetadata}
      <!-- Manual mode: Show edit button -->
      <div class="metadata-header">
        <button
          class="minimal-button"
          onclick={startEditingMetadata}
          type="button"
        >
          ✏️ Edit Details
        </button>
        <button
          class="minimal-button"
          onclick={() => showImportDialog = true}
          type="button"
        >
          📥 Import
        </button>
      </div>
    {/if}

    {#if isEditingMetadata}
      <!-- Editing mode: Show input fields -->
      <div class="metadata-editor">
        <div class="form-group">
          <label for="title">Title</label>
          <input
            id="title"
            type="text"
            bind:value={editedTitle}
            placeholder="Itinerary title"
          />
        </div>

        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            bind:value={editedDescription}
            placeholder="Optional description..."
            rows="3"
          ></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="startDate">Start Date</label>
            <input
              id="startDate"
              type="date"
              bind:value={editedStartDate}
            />
          </div>
          <div class="form-group">
            <label for="endDate">End Date</label>
            <input
              id="endDate"
              type="date"
              bind:value={editedEndDate}
            />
          </div>
        </div>

        <div class="metadata-actions">
          <button
            class="minimal-button"
            onclick={cancelEditingMetadata}
            type="button"
          >
            Cancel
          </button>
          <button
            class="minimal-button primary"
            onclick={saveMetadata}
            type="button"
          >
            Save Changes
          </button>
        </div>
      </div>
    {:else}
      <!-- Display mode -->
      {#if formatDateRange()}
        <p class="text-minimal-text-muted text-sm mb-4">
          {formatDateRange()}
        </p>
      {/if}

      {#if hasPastDates}
        <div class="past-dates-warning">
          <span class="warning-icon">⚠️</span>
          <div class="warning-content">
            <p class="warning-title">Trip dates are in the past</p>
            <p class="warning-message">
              This itinerary is scheduled for {formatDateRange()}, which has already passed.
              Would you like to update the dates?
            </p>
          </div>
        </div>
      {/if}

      {#if itinerary.description}
        <p class="text-minimal-text-muted text-sm mb-4">
          {itinerary.description}
        </p>
      {/if}

      <div class="flex items-center gap-3 text-sm text-minimal-text-muted">
        {#if getDestinationsString()}
          <span>{getDestinationsString()}</span>
        {/if}

        {#if itinerary.tripType}
          <span class="minimal-badge">
            {itinerary.tripType.toLowerCase()}
          </span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Segments grouped by day -->
  <div class="p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-semibold text-minimal-text-muted">
        {itinerary.segments?.length ?? 0} SEGMENT{(itinerary.segments?.length ?? 0) !== 1 ? 'S' : ''}
      </h3>
      {#if inManualEditMode}
        <button
          class="minimal-button"
          onclick={() => showAddSegmentModal = true}
          type="button"
        >
          ➕ Add Segment
        </button>
      {/if}
    </div>

    <div class="space-y-6">
      {#each segmentsByDay as day (day.date)}
        <div>
          <!-- Day header -->
          <div class="flex items-center gap-2 mb-3">
            <span class="text-lg">📅</span>
            <h4 class="text-sm font-semibold text-minimal-text">
              {day.dateDisplay}
            </h4>
          </div>

          <!-- Segments for this day -->
          <div class="space-y-3 pl-7">
            {#each day.segments as segment (segment.id)}
              {#if inManualEditMode && editingSegmentId === segment.id}
                <!-- Editing mode -->
                <SegmentEditor
                  {segment}
                  onSave={handleSaveSegment}
                  onCancel={handleCancelEdit}
                  onDelete={() => handleDeleteSegment(segment.id)}
                />
              {:else}
                <!-- Display mode -->
                <SegmentCard
                  {segment}
                  editMode={inManualEditMode}
                  onEdit={inManualEditMode ? () => handleEditSegment(segment.id) : undefined}
                  onDelete={inManualEditMode ? () => handleDeleteSegment(segment.id) : undefined}
                />
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <div class="modal-overlay" onclick={handleCancelDelete}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <h3 class="modal-title">Delete Itinerary</h3>
      <p class="modal-message">
        Are you sure you want to delete this itinerary? This cannot be undone.
      </p>
      <div class="modal-buttons">
        <button
          class="minimal-button"
          onclick={handleCancelDelete}
          type="button"
        >
          Cancel
        </button>
        <button
          class="minimal-button delete-button-confirm"
          onclick={handleConfirmDelete}
          type="button"
        >
          Confirm Delete
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .itinerary-detail {
    position: relative;
    height: 100%;
  }

  /* Content appears above background slideshow */
  .detail-content {
    position: relative;
    z-index: 2;
  }

  /* Enhance text contrast when background is present */
  .has-background .bg-minimal-card {
    background-color: rgba(255, 255, 255, 0.95);
  }

  .past-dates-warning {
    display: flex;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .warning-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .warning-content {
    flex: 1;
  }

  .warning-title {
    font-weight: 600;
    color: #92400e;
    font-size: 0.875rem;
    margin: 0 0 0.25rem 0;
  }

  .warning-message {
    color: #92400e;
    font-size: 0.8125rem;
    margin: 0;
    line-height: 1.4;
  }

  .button-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .delete-button {
    color: #dc2626;
    border-color: #fecaca;
  }

  .delete-button:hover:not(:disabled) {
    background-color: #fef2f2;
    border-color: #fca5a5;
  }

  .modal-overlay {
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
  }

  .modal-content {
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .modal-message {
    color: #6b7280;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .modal-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .delete-button-confirm {
    background-color: #dc2626;
    color: white;
    border-color: #dc2626;
  }

  .delete-button-confirm:hover:not(:disabled) {
    background-color: #b91c1c;
    border-color: #b91c1c;
  }

  .minimal-button.primary {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .minimal-button.primary:hover:not(:disabled) {
    background-color: #2563eb;
    border-color: #2563eb;
  }

  /* Metadata editor styles */
  .metadata-header {
    margin-bottom: 1rem;
  }

  .metadata-editor {
    background: #f9fafb;
    padding: 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #1f2937;
    transition: all 0.2s;
    background: white;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group textarea {
    resize: vertical;
    font-family: inherit;
  }

  .metadata-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>

<!-- Add Segment Modal -->
<AddSegmentModal
  bind:open={showAddSegmentModal}
  itineraryId={itinerary.id}
  onSegmentAdded={handleAddSegment}
/>

<!-- Import Dialog -->
{#if showImportDialog}
  <ImportDialog
    bind:open={showImportDialog}
    preselectedItineraryId={itinerary.id}
    onComplete={handleImportComplete}
  />
{/if}
