<script lang="ts">
  import type { Itinerary, Segment } from '$lib/types';

  let { itinerary }: { itinerary: Itinerary } = $props();

  type ViewMode = 'day' | 'week' | 'month';
  let viewMode = $state<ViewMode>('week');

  // Extended segment type for hotel night tracking
  type ExpandedSegment = Segment & {
    _hotelNightInfo?: {
      nightNumber: number;
      totalNights: number;
      isCheckout: boolean;
    };
  };

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

  // Get all dates with segments
  let segmentsByDate = $derived.by(() => {
    const grouped = new Map<string, ExpandedSegment[]>();

    // Expand hotel segments across all nights
    const expandedSegments = expandHotelSegments(itinerary.segments);

    expandedSegments.forEach((segment) => {
      const date = new Date(segment.startDatetime);
      const dateKey = date.toISOString().split('T')[0];

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(segment);
    });

    return grouped;
  });

  // Get calendar weeks for month view
  let calendarWeeks = $derived.by(() => {
    if (!itinerary.startDate) return [];

    const start = new Date(itinerary.startDate);
    const end = itinerary.endDate ? new Date(itinerary.endDate) : new Date(start);

    // Get first day of month
    const firstDay = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0);

    // Adjust to start on Sunday
    const calStart = new Date(firstDay);
    calStart.setDate(calStart.getDate() - calStart.getDay());

    // Build weeks
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    const current = new Date(calStart);

    while (current <= lastDay || currentWeek.length > 0) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      if (current <= lastDay || weeks.length === 0) {
        currentWeek.push(new Date(current));
        current.setDate(current.getDate() + 1);
      } else {
        break;
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(currentWeek);
    }

    return weeks;
  });

  function formatTime(datetime: string): string {
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function isInItineraryRange(date: Date): boolean {
    if (!itinerary.startDate) return false;
    const start = new Date(itinerary.startDate);
    const end = itinerary.endDate ? new Date(itinerary.endDate) : start;
    return date >= start && date <= end;
  }

  // Helper function to get segment title
  function getSegmentTitle(segment: ExpandedSegment): string {
    switch (segment.type) {
      case 'FLIGHT':
        return `${segment.airline.name} ${segment.flightNumber}`;
      case 'HOTEL':
        // Show night number or checkout status
        if (segment._hotelNightInfo) {
          if (segment._hotelNightInfo.isCheckout) {
            return `${segment.property.name} - Check-out`;
          } else {
            return `${segment.property.name} - Night ${segment._hotelNightInfo.nightNumber}/${segment._hotelNightInfo.totalNights}`;
          }
        }
        return segment.property.name;
      case 'ACTIVITY':
        return segment.name;
      case 'TRANSFER':
        return `Transfer: ${segment.transferType}`;
      case 'CUSTOM':
        return segment.title;
      default:
        return 'Unknown';
    }
  }

  // Helper function to get segment description
  function getSegmentDescription(segment: Segment): string | undefined {
    if (segment.type === 'ACTIVITY' || segment.type === 'CUSTOM') {
      return segment.description;
    }
    return undefined;
  }

  // Helper function to get segment location name
  function getSegmentLocation(segment: Segment): string | undefined {
    switch (segment.type) {
      case 'FLIGHT':
        return `${segment.origin.name} → ${segment.destination.name}`;
      case 'HOTEL':
      case 'ACTIVITY':
        return segment.location.name;
      case 'TRANSFER':
        return `${segment.pickupLocation.name} → ${segment.dropoffLocation.name}`;
      default:
        return undefined;
    }
  }

  // Sort segments with hotels/accommodations last
  function sortSegments(segments: ExpandedSegment[]): ExpandedSegment[] {
    return [...segments].sort((a, b) => {
      const aIsStay = a.type === 'HOTEL' || a.type === 'ACCOMMODATION';
      const bIsStay = b.type === 'HOTEL' || b.type === 'ACCOMMODATION';
      if (aIsStay && !bIsStay) return 1;
      if (!aIsStay && bIsStay) return -1;
      return new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime();
    });
  }
</script>

<div class="calendar-view">
  <!-- View Mode Selector -->
  <div class="view-selector">
    <button
      class="view-button"
      class:active={viewMode === 'day'}
      onclick={() => viewMode = 'day'}
      type="button"
    >
      Day
    </button>
    <button
      class="view-button"
      class:active={viewMode === 'week'}
      onclick={() => viewMode = 'week'}
      type="button"
    >
      Week
    </button>
    <button
      class="view-button"
      class:active={viewMode === 'month'}
      onclick={() => viewMode = 'month'}
      type="button"
    >
      Month
    </button>
  </div>

  <!-- Calendar Content -->
  <div class="calendar-content">
    {#if viewMode === 'month'}
      <!-- Month View: Grid Calendar -->
      <div class="month-grid">
        <!-- Day headers -->
        <div class="day-header">Sun</div>
        <div class="day-header">Mon</div>
        <div class="day-header">Tue</div>
        <div class="day-header">Wed</div>
        <div class="day-header">Thu</div>
        <div class="day-header">Fri</div>
        <div class="day-header">Sat</div>

        <!-- Calendar cells -->
        {#each calendarWeeks as week}
          {#each week as date}
            {@const dateKey = getDateKey(date)}
            {@const segments = segmentsByDate.get(dateKey) || []}
            {@const inRange = isInItineraryRange(date)}

            <div class="calendar-cell" class:in-range={inRange}>
              <div class="date-number">{date.getDate()}</div>
              {#if segments.length > 0}
                <div class="segment-dots">
                  {#each segments.slice(0, 3) as segment}
                    <div class="segment-dot" title={getSegmentTitle(segment)}></div>
                  {/each}
                  {#if segments.length > 3}
                    <span class="more-segments">+{segments.length - 3}</span>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        {/each}
      </div>
    {:else if viewMode === 'week'}
      <!-- Week View: List by day -->
      <div class="week-view">
        {#each Array.from(segmentsByDate.entries()).sort() as [dateKey, segments]}
          {@const date = new Date(dateKey)}
          <div class="day-section">
            <h3 class="day-title">
              {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
            <div class="segments-list">
              {#each sortSegments(segments) as segment}
                <div class="segment-item">
                  <span class="segment-time">{formatTime(segment.startDatetime)}</span>
                  <span class="segment-title">{getSegmentTitle(segment)}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Day View: Detailed list -->
      <div class="day-view">
        {#each Array.from(segmentsByDate.entries()).sort() as [dateKey, segments]}
          {@const date = new Date(dateKey)}
          <div class="day-section-detailed">
            <h2 class="day-title-large">
              {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
            <div class="segments-list-detailed">
              {#each sortSegments(segments) as segment}
                {@const description = getSegmentDescription(segment)}
                {@const location = getSegmentLocation(segment)}
                <div class="segment-card">
                  <div class="segment-header">
                    <span class="segment-time-large">{formatTime(segment.startDatetime)}</span>
                    <span class="segment-type">{segment.type}</span>
                  </div>
                  <h4 class="segment-title-large">{getSegmentTitle(segment)}</h4>
                  {#if description}
                    <p class="segment-description">{description}</p>
                  {/if}
                  {#if location}
                    <p class="segment-location">📍 {location}</p>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .calendar-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #fafafa;
  }

  .view-selector {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    background-color: #ffffff;
    border-bottom: 1px solid #e5e7eb;
  }

  .view-button {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: #6b7280;
    background-color: #f3f4f6;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-button:hover {
    background-color: #e5e7eb;
  }

  .view-button.active {
    background-color: #3b82f6;
    color: white;
  }

  .calendar-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  /* Month Grid */
  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background-color: #e5e7eb;
    border: 1px solid #e5e7eb;
  }

  .day-header {
    background-color: #f9fafb;
    padding: 0.5rem;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
  }

  .calendar-cell {
    background-color: #ffffff;
    min-height: 100px;
    padding: 0.5rem;
    position: relative;
  }

  .calendar-cell.in-range {
    background-color: #f0f9ff;
  }

  .date-number {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
  }

  .segment-dots {
    margin-top: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
  }

  .segment-dot {
    width: 6px;
    height: 6px;
    background-color: #3b82f6;
    border-radius: 50%;
  }

  .more-segments {
    font-size: 0.625rem;
    color: #6b7280;
  }

  /* Week View */
  .week-view {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .day-section {
    background-color: #ffffff;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .day-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.75rem;
  }

  .segments-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .segment-item {
    display: flex;
    gap: 1rem;
    padding: 0.5rem;
    background-color: #f9fafb;
    border-radius: 0.375rem;
  }

  .segment-time {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    min-width: 80px;
  }

  .segment-title {
    font-size: 0.875rem;
    color: #1f2937;
  }

  /* Day View */
  .day-view {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .day-section-detailed {
    background-color: #ffffff;
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .day-title-large {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1rem;
  }

  .segments-list-detailed {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .segment-card {
    padding: 1rem;
    background-color: #f9fafb;
    border-radius: 0.5rem;
    border-left: 3px solid #3b82f6;
  }

  .segment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .segment-time-large {
    font-size: 0.875rem;
    font-weight: 600;
    color: #3b82f6;
  }

  .segment-type {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background-color: #e5e7eb;
    border-radius: 0.25rem;
    color: #6b7280;
  }

  .segment-title-large {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .segment-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
  }

  .segment-location {
    font-size: 0.875rem;
    color: #6b7280;
  }
</style>
