<script lang="ts">
  import type { SegmentType, Segment } from '$lib/types';
  import SegmentEditor from './SegmentEditor.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { Airplane, Buildings, MapPin, Car, Note } from 'phosphor-svelte';

  let {
    open = $bindable(false),
    itineraryId,
    onSegmentAdded
  }: {
    open?: boolean;
    itineraryId: string;
    onSegmentAdded: (segment: Partial<Segment>) => Promise<void>;
  } = $props();

  let selectedType = $state<SegmentType | null>(null);
  let saving = $state(false);

  function handleClose() {
    if (!saving) {
      open = false;
      selectedType = null;
    }
  }

  async function handleSave(segmentData: Partial<Segment>) {
    saving = true;
    try {
      await onSegmentAdded(segmentData);
      open = false;
      selectedType = null;
      toast.success('Segment added');
    } catch (error) {
      console.error('Failed to add segment:', error);
      toast.error('Failed to add segment. Please try again.');
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    if (selectedType) {
      selectedType = null;
    } else {
      handleClose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function selectType(type: SegmentType) {
    selectedType = type;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onclick={handleBackdropClick}>
    <div class="modal-content">
      {#if !selectedType}
        <!-- Type selection view -->
        <div class="modal-header">
          <h2 class="modal-title">Add Segment</h2>
          <button
            class="close-button"
            onclick={handleClose}
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div class="modal-body">
          <p class="text-minimal-text-muted mb-4">Select the type of segment to add:</p>

          <div class="segment-types">
            <button
              class="segment-type-button"
              onclick={() => selectType('FLIGHT')}
              type="button"
            >
              <span class="segment-type-icon"><Airplane size={40} weight="regular" /></span>
              <span class="segment-type-label">Flight</span>
            </button>

            <button
              class="segment-type-button"
              onclick={() => selectType('HOTEL')}
              type="button"
            >
              <span class="segment-type-icon"><Buildings size={40} weight="regular" /></span>
              <span class="segment-type-label">Hotel</span>
            </button>

            <button
              class="segment-type-button"
              onclick={() => selectType('ACTIVITY')}
              type="button"
            >
              <span class="segment-type-icon"><MapPin size={40} weight="regular" /></span>
              <span class="segment-type-label">Activity</span>
            </button>

            <button
              class="segment-type-button"
              onclick={() => selectType('TRANSFER')}
              type="button"
            >
              <span class="segment-type-icon"><Car size={40} weight="regular" /></span>
              <span class="segment-type-label">Transfer</span>
            </button>

            <button
              class="segment-type-button"
              onclick={() => selectType('CUSTOM')}
              type="button"
            >
              <span class="segment-type-icon"><Note size={40} weight="regular" /></span>
              <span class="segment-type-label">Custom</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- Editor view -->
        <SegmentEditor
          segment={null}
          onSave={handleSave}
          onCancel={handleCancel}
        />
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
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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

  .close-button {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    color: #6b7280;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .close-button:hover {
    background-color: #f3f4f6;
    color: #1f2937;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .segment-types {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
  }

  .segment-type-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem 1rem;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .segment-type-button:hover {
    border-color: #3b82f6;
    background-color: #f0f9ff;
  }

  .segment-type-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
  }

  .segment-type-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
  }

  .text-minimal-text-muted {
    color: #6b7280;
  }

  .mb-4 {
    margin-bottom: 1rem;
  }
</style>
