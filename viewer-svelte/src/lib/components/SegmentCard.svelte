<script lang="ts">
  import type { Segment, SegmentSource } from '$lib/types';

  // Extended segment type for hotel night tracking
  type ExpandedSegment = Segment & {
    _hotelNightInfo?: {
      nightNumber: number;
      totalNights: number;
      isCheckout: boolean;
    };
  };

  let {
    segment,
    editMode = false,
    onEdit,
    onDelete
  }: {
    segment: ExpandedSegment;
    editMode?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
  } = $props();

  // Get segment title based on type
  function getSegmentTitle(segment: ExpandedSegment): string {
    switch (segment.type) {
      case 'FLIGHT':
        return `${segment.origin.code || segment.origin.name} → ${segment.destination.code || segment.destination.name}`;
      case 'HOTEL':
        // Show night number or checkout status
        if (segment._hotelNightInfo) {
          if (segment._hotelNightInfo.isCheckout) {
            return `${segment.property.name} - Check-out`;
          } else {
            return `${segment.property.name} - Night ${segment._hotelNightInfo.nightNumber} of ${segment._hotelNightInfo.totalNights}`;
          }
        }
        return segment.property.name;
      case 'ACTIVITY':
        return segment.name;
      case 'TRANSFER':
        return `${segment.pickupLocation.name} → ${segment.dropoffLocation.name}`;
      case 'CUSTOM':
        return segment.title;
      default:
        return 'Unknown';
    }
  }

  // Get segment subtitle
  function getSegmentSubtitle(segment: Segment): string {
    switch (segment.type) {
      case 'FLIGHT':
        return `${segment.airline.name} ${segment.flightNumber}`;
      case 'HOTEL':
        return segment.location.city || segment.location.name || '';
      case 'ACTIVITY':
        return segment.location.city || segment.location.name || '';
      case 'TRANSFER':
        return segment.transferType;
      default:
        return '';
    }
  }

  // Format time only (for day-grouped view)
  function formatTime(dateTime: string, isCheckout: boolean = false): string {
    const date = new Date(dateTime);
    // For checkout entries, show the time (11:00 AM)
    // For night entries, don't show a time (or show "All day")
    if (isCheckout) {
      return date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // Get emoji icon for segment type
  function getSegmentIcon(type: string): string {
    switch (type) {
      case 'FLIGHT': return '✈️';
      case 'HOTEL': return '🏨';
      case 'ACTIVITY': return '🎯';
      case 'TRANSFER': return '🚗';
      case 'CUSTOM': return '📝';
      default: return '📌';
    }
  }

  // Get source label and icon
  function getSourceLabel(source: SegmentSource): { icon: string; text: string } {
    switch (source) {
      case 'import':
        return { icon: '📄', text: 'Imported' };
      case 'agent':
        return { icon: '🤖', text: 'Auto-generated' };
      case 'manual':
        return { icon: '✏️', text: 'User added' };
      default:
        return { icon: '📌', text: source };
    }
  }

  // Get border color for source (using inline style for reliability)
  function getSourceBorderColor(source: SegmentSource): string {
    switch (source) {
      case 'import':
        return '#60a5fa'; // blue-400
      case 'agent':
        return '#c084fc'; // purple-400
      case 'manual':
        return '#4ade80'; // green-400
      default:
        return '#d1d5db'; // gray-300
    }
  }
</script>

<div class="minimal-card p-4 space-y-2 border-l-4" style="border-left-color: {getSourceBorderColor(segment.source)}">
  <!-- Title with icon and edit controls -->
  <div class="flex items-start gap-3">
    <span class="text-2xl">{getSegmentIcon(segment.type)}</span>
    <div class="flex-1 min-w-0">
      <h4 class="font-medium text-minimal-text">
        {getSegmentTitle(segment)}
      </h4>
      {#if getSegmentSubtitle(segment)}
        <p class="text-sm text-minimal-text-muted mt-0.5">
          {getSegmentSubtitle(segment)}
        </p>
      {/if}
    </div>
    {#if editMode}
      <div class="flex gap-1">
        {#if onEdit}
          <button
            class="edit-icon-button"
            onclick={onEdit}
            type="button"
            title="Edit segment"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        {/if}
        {#if onDelete}
          <button
            class="delete-icon-button"
            onclick={onDelete}
            type="button"
            title="Delete segment"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Time and Source -->
  <div class="flex items-center gap-2 text-sm text-minimal-text-muted ml-11">
    {#if segment.type === 'HOTEL' && segment._hotelNightInfo && !segment._hotelNightInfo.isCheckout}
      <!-- For hotel night entries, show "All day" instead of time -->
      <span>All day</span>
    {:else}
      <span>{formatTime(segment.startDatetime, segment._hotelNightInfo?.isCheckout ?? false)}</span>
    {/if}
    <span class="text-gray-300">·</span>
    <span class="inline-flex items-center gap-1 text-xs">
      <span>{getSourceLabel(segment.source).icon}</span>
      <span>{getSourceLabel(segment.source).text}</span>
    </span>
  </div>

  <!-- Source details (for agent-generated segments) -->
  {#if segment.source === 'agent' && segment.sourceDetails}
    <div class="text-xs text-minimal-text-muted ml-11 flex items-center gap-2">
      {#if segment.sourceDetails.model}
        <span class="inline-flex items-center gap-1">
          <span class="font-mono">{segment.sourceDetails.model}</span>
        </span>
      {/if}
      {#if segment.sourceDetails.confidence}
        <span>·</span>
        <span>Confidence: {Math.round(segment.sourceDetails.confidence * 100)}%</span>
      {/if}
    </div>
  {/if}

  <!-- Notes -->
  {#if segment.notes}
    <p class="text-xs text-minimal-text-muted italic ml-11">
      {segment.notes}
    </p>
  {/if}

  <!-- Inferred indicator -->
  {#if segment.inferred}
    <div class="text-xs text-minimal-accent ml-11">
      Inferred: {segment.inferredReason || 'gap filling'}
    </div>
  {/if}
</div>

<style>
  .edit-icon-button,
  .delete-icon-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    color: #6b7280;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .edit-icon-button:hover {
    background-color: #f3f4f6;
    color: #3b82f6;
  }

  .delete-icon-button:hover {
    background-color: #fef2f2;
    color: #dc2626;
  }
</style>
