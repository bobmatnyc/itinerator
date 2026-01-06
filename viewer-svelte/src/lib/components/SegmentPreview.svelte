<script lang="ts">
  import type { ExtractedSegment } from '$lib/types';
  import { Airplane, House, Target, Car, Note } from 'phosphor-svelte';

  let { segments }: { segments: ExtractedSegment[] } = $props();

  function formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getSegmentIcon(type: string): typeof Airplane {
    const icons: Record<string, typeof Airplane> = {
      FLIGHT: Airplane,
      HOTEL: House,
      ACTIVITY: Target,
      TRANSFER: Car,
      CUSTOM: Note
    };
    return icons[type] || Note;
  }

  function getSegmentTitle(segment: ExtractedSegment): string {
    switch (segment.type) {
      case 'FLIGHT':
        const flight = segment as any;
        return `${flight.airline?.name || 'Flight'} ${flight.flightNumber || ''}`.trim();
      case 'HOTEL':
        const hotel = segment as any;
        return hotel.property?.name || 'Hotel';
      case 'ACTIVITY':
        const activity = segment as any;
        return activity.name || 'Activity';
      case 'TRANSFER':
        const transfer = segment as any;
        return `${transfer.transferType || 'Transfer'}`;
      case 'CUSTOM':
        return segment.notes || 'Custom Segment';
      default:
        return 'Segment';
    }
  }

  function getSegmentDetails(segment: ExtractedSegment): string {
    switch (segment.type) {
      case 'FLIGHT':
        const flight = segment as any;
        const origin = flight.origin?.code || flight.origin?.city || '';
        const dest = flight.destination?.code || flight.destination?.city || '';
        return origin && dest ? `${origin} → ${dest}` : '';
      case 'HOTEL':
        const hotel = segment as any;
        return hotel.location?.city || hotel.location?.name || '';
      case 'ACTIVITY':
        const activity = segment as any;
        return activity.location?.city || activity.location?.name || '';
      case 'TRANSFER':
        const transfer = segment as any;
        return transfer.pickupLocation?.city || transfer.pickupLocation?.name || '';
      default:
        return '';
    }
  }

  function getConfidenceBadge(confidence: number): { text: string; class: string } {
    if (confidence >= 0.8) return { text: 'High', class: 'confidence-high' };
    if (confidence >= 0.5) return { text: 'Medium', class: 'confidence-medium' };
    return { text: 'Low', class: 'confidence-low' };
  }
</script>

<div class="segment-preview">
  <h3 class="preview-title">Extracted Segments ({segments.length})</h3>

  {#if segments.length === 0}
    <p class="no-segments">No segments found in the uploaded file.</p>
  {:else}
    <div class="segment-list">
      {#each segments as segment, i (i)}
        {@const badge = getConfidenceBadge(segment.confidence)}
        {@const IconComponent = getSegmentIcon(segment.type)}
        <div class="segment-item">
          <div class="segment-header">
            <span class="segment-icon">
              <svelte:component this={IconComponent} size={24} weight="duotone" class="text-blue-600" />
            </span>
            <div class="segment-info">
              <div class="segment-title-row">
                <h4 class="segment-title">{getSegmentTitle(segment)}</h4>
                <span class="confidence-badge {badge.class}">{badge.text}</span>
              </div>
              {#if getSegmentDetails(segment)}
                <p class="segment-details">{getSegmentDetails(segment)}</p>
              {/if}
            </div>
          </div>
          <div class="segment-dates">
            <span class="date-label">Start:</span>
            <span class="date-value">{formatDateTime(segment.startDatetime)}</span>
            <span class="date-separator">→</span>
            <span class="date-label">End:</span>
            <span class="date-value">{formatDateTime(segment.endDatetime)}</span>
          </div>
          {#if segment.confirmationNumber}
            <div class="confirmation-number">
              Confirmation: <strong>{segment.confirmationNumber}</strong>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .segment-preview {
    margin-bottom: 1.5rem;
  }

  .preview-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1rem 0;
  }

  .no-segments {
    text-align: center;
    color: #6b7280;
    padding: 2rem;
    background-color: #f9fafb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .segment-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 300px;
    overflow-y: auto;
  }

  .segment-item {
    padding: 1rem;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .segment-item:hover {
    background-color: #f3f4f6;
    border-color: #d1d5db;
  }

  .segment-header {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .segment-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .segment-info {
    flex: 1;
    min-width: 0;
  }

  .segment-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .segment-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .segment-details {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .confidence-badge {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    flex-shrink: 0;
  }

  .confidence-high {
    background-color: #dcfce7;
    color: #166534;
  }

  .confidence-medium {
    background-color: #fef3c7;
    color: #92400e;
  }

  .confidence-low {
    background-color: #fee2e2;
    color: #991b1b;
  }

  .segment-dates {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
    flex-wrap: wrap;
  }

  .date-label {
    font-weight: 500;
  }

  .date-value {
    color: #1f2937;
  }

  .date-separator {
    color: #9ca3af;
  }

  .confirmation-number {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .confirmation-number strong {
    color: #1f2937;
    font-family: monospace;
  }

  /* Scrollbar styling */
  .segment-list::-webkit-scrollbar {
    width: 6px;
  }

  .segment-list::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  .segment-list::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }

  .segment-list::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .segment-dates {
      font-size: 0.7rem;
    }

    .segment-title {
      font-size: 0.8125rem;
    }
  }
</style>
