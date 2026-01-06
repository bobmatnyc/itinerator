<script lang="ts">
  import type { Segment, SegmentSource } from '$lib/types';
  import { generateSegmentLinks } from '$lib/utils/segment-links';
  import type { SegmentLink } from '$lib/utils/segment-links';
  import PriceDisplay from './PriceDisplay.svelte';
  import TimeValidationBadge from './TimeValidationBadge.svelte';
  import type { CurrencyCode } from '$lib/types/currency';
  import { validateSegmentTime, applyTimeFix } from '$lib/types/time-validator';
  import type { TimeValidationResult } from '$lib/types/time-validator';

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
    onDelete,
    onTimeFix,
    targetCurrency = 'USD'
  }: {
    segment: ExpandedSegment;
    editMode?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    onTimeFix?: (segment: Segment) => void;
    targetCurrency?: CurrencyCode;
  } = $props();

  // Validate segment time
  const timeValidation = $derived(validateSegmentTime(segment));

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
    const icons: Record<string, string> = {
      'RESTAURANT': '🍽️',
      'DINING': '🍽️',
      'ACTIVITY': '🎯',
      'ATTRACTION': '🏛️',
      'TOUR': '🎫',
      'HOTEL': '🏨',
      'ACCOMMODATION': '🏨',
      'FLIGHT': '✈️',
      'TRANSFER': '🚗',
      'CAR_RENTAL': '🚙',
      'MEETING': '📅',
      'CUSTOM': '📌'
    };
    return icons[type] || '📍';
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

  // Get review/booking links for this segment
  const links = $derived(generateSegmentLinks(segment));

  // Get background image URL based on segment content
  function getSegmentImageUrl(segment: ExpandedSegment): string | null {
    // Extract query from segment name/title
    let query = '';
    switch (segment.type) {
      case 'HOTEL':
        query = segment.property?.name || '';
        break;
      case 'ACTIVITY':
        query = segment.name || '';
        break;
      case 'RESTAURANT':
      case 'DINING':
        query = segment.name || '';
        break;
      case 'ATTRACTION':
      case 'TOUR':
        query = segment.name || '';
        break;
      case 'FLIGHT':
        query = `${segment.destination?.city || segment.destination?.name || ''} airport`;
        break;
      case 'TRANSFER':
        query = segment.dropoffLocation?.city || segment.dropoffLocation?.name || '';
        break;
      default:
        query = segment.title || segment.name || '';
    }

    // Add location context if available
    const location = segment.location?.city || segment.location?.name || '';
    if (location && query) {
      query = `${query} ${location}`;
    }

    if (!query) {
      // Fallback to deterministic image based on segment ID
      const seed = segment.id || 'default';
      return `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/200`;
    }

    // Use Unsplash Source for relevant images
    return `https://source.unsplash.com/400x200/?${encodeURIComponent(query)}`;
  }

  let imageUrl = $derived(getSegmentImageUrl(segment));
  let imageLoaded = $state(false);
  let imageError = $state(false);

  // Helper to get price info from segment
  function getSegmentPrice(segment: Segment): { amount: number; currency: string } | null {
    // Check for totalPrice first (most comprehensive)
    if ('totalPrice' in segment && segment.totalPrice && typeof segment.totalPrice === 'object') {
      const price = segment.totalPrice as { amount: number; currency: string };
      if (price.amount && price.currency) {
        return price;
      }
    }

    // Fallback to base price
    if ('price' in segment && segment.price && typeof segment.price === 'object') {
      const price = segment.price as { amount: number; currency: string };
      if (price.amount && price.currency) {
        return price;
      }
    }

    return null;
  }

  let priceInfo = $derived(getSegmentPrice(segment));
</script>

<div
  class="minimal-card segment-card p-4 space-y-2 border-l-4"
  style="border-left-color: {getSourceBorderColor(segment.source)}; {imageUrl && imageLoaded && !imageError ? `background-image: linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.95)), url(${imageUrl})` : ''}"
>
  {#if imageUrl}
    <img
      src={imageUrl}
      alt=""
      class="hidden"
      onload={() => imageLoaded = true}
      onerror={() => imageError = true}
    />
  {/if}
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
      {#if (segment.type === 'ACTIVITY' || segment.type === 'CUSTOM') && segment.description}
        <p class="text-sm text-minimal-text mt-1 line-clamp-3">
          {segment.description}
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

    <!-- Time validation badge -->
    {#if !timeValidation.isValid}
      <span class="text-gray-300">·</span>
      <TimeValidationBadge
        validation={timeValidation}
        onFix={(suggestedTime) => {
          if (onTimeFix) {
            const fixedSegment = applyTimeFix(segment, suggestedTime);
            onTimeFix(fixedSegment);
          }
        }}
      />
    {/if}
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

  <!-- Price with currency conversion -->
  {#if priceInfo}
    <div class="text-sm ml-11 flex items-center gap-2">
      <span class="text-minimal-text-muted">Price:</span>
      <PriceDisplay
        amount={priceInfo.amount}
        currency={priceInfo.currency}
        {targetCurrency}
        showConversion={priceInfo.currency !== targetCurrency}
      />
    </div>
  {/if}

  <!-- Review/Booking links (for all segment types) -->
  {#if links.length > 0}
    <div class="segment-links ml-11">
      {#each links as link}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          class="segment-link"
        >
          {link.provider}
        </a>
      {/each}
    </div>
  {/if}

  <!-- Legacy booking link for activities (fallback if stored) -->
  {#if segment.type === 'ACTIVITY' && segment.bookingUrl && !links.length}
    <div class="ml-11 mt-2">
      <a
        href={segment.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="booking-link"
      >
        Book on {segment.bookingProvider || 'Provider'} →
      </a>
    </div>
  {/if}

  <!-- Inferred indicator -->
  {#if segment.inferred}
    <div class="text-xs text-minimal-accent ml-11">
      Inferred: {segment.inferredReason || 'gap filling'}
    </div>
  {/if}
</div>

<style>
  .segment-card {
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .hidden {
    display: none;
  }

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

  /* Review/booking links container */
  .segment-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  /* Individual link pill */
  .segment-link {
    display: inline-flex;
    align-items: center;
    font-size: 0.75rem;
    padding: 0.25rem 0.625rem;
    background-color: #f3f4f6;
    color: #4b5563;
    border-radius: 9999px;
    text-decoration: none;
    transition: all 0.2s;
    font-weight: 500;
  }

  .segment-link:hover {
    background-color: #e5e7eb;
    color: #1f2937;
  }

  /* Legacy booking link (fallback) */
  .booking-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #3b82f6;
    background-color: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.375rem;
    text-decoration: none;
    transition: all 0.2s;
  }

  .booking-link:hover {
    background-color: #dbeafe;
    border-color: #93c5fd;
    color: #2563eb;
  }

  .booking-link:active {
    background-color: #bfdbfe;
  }
</style>
