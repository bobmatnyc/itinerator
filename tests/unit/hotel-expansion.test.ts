import { describe, it, expect } from 'vitest';
import type { Segment, HotelSegment } from '../../viewer-svelte/src/lib/types.js';

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
        const checkoutDatetime = checkOut.toISOString().split('T')[0] + 'T11:00:00.000Z';
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

describe('Hotel Expansion', () => {
  it('should expand 7-night hotel stay into 7 nights + checkout', () => {
    const hotelSegment: HotelSegment = {
      id: 'test-hotel',
      type: 'HOTEL',
      status: 'CONFIRMED',
      startDatetime: '2025-01-08T15:00:00.000Z',
      endDatetime: '2025-01-15T11:00:00.000Z',
      checkInDate: '2025-01-08T00:00:00.000Z',
      checkOutDate: '2025-01-15T00:00:00.000Z',
      property: { name: "Hotel L'Esplanade" },
      location: {
        name: 'Grand Case',
        city: 'Grand Case',
        country: 'Saint Martin',
      },
      travelerIds: [],
      source: 'import',
    };

    const expanded = expandHotelSegments([hotelSegment]);

    // Should have 7 night entries + 1 checkout entry = 8 total
    expect(expanded).toHaveLength(8);

    // Check night entries (Jan 8-14)
    for (let i = 0; i < 7; i++) {
      const nightEntry = expanded[i];
      expect(nightEntry._hotelNightInfo).toBeDefined();
      expect(nightEntry._hotelNightInfo?.nightNumber).toBe(i + 1);
      expect(nightEntry._hotelNightInfo?.totalNights).toBe(7);
      expect(nightEntry._hotelNightInfo?.isCheckout).toBe(false);

      // Verify the date is correct
      const expectedDate = new Date('2025-01-08T00:00:00.000Z');
      expectedDate.setDate(expectedDate.getDate() + i);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];
      expect(nightEntry.startDatetime).toContain(expectedDateStr);
    }

    // Check checkout entry (Jan 15)
    const checkoutEntry = expanded[7];
    expect(checkoutEntry._hotelNightInfo).toBeDefined();
    expect(checkoutEntry._hotelNightInfo?.isCheckout).toBe(true);
    expect(checkoutEntry._hotelNightInfo?.totalNights).toBe(7);
    expect(checkoutEntry.startDatetime).toContain('2025-01-15');
  });

  it('should expand 1-night hotel stay into 1 night + checkout', () => {
    const hotelSegment: HotelSegment = {
      id: 'test-hotel-1night',
      type: 'HOTEL',
      status: 'CONFIRMED',
      startDatetime: '2025-01-08T15:00:00.000Z',
      endDatetime: '2025-01-09T11:00:00.000Z',
      checkInDate: '2025-01-08T00:00:00.000Z',
      checkOutDate: '2025-01-09T00:00:00.000Z',
      property: { name: 'Quick Stay Hotel' },
      location: { name: 'Test City' },
      travelerIds: [],
      source: 'import',
    };

    const expanded = expandHotelSegments([hotelSegment]);

    // Should have 1 night + 1 checkout = 2 entries
    expect(expanded).toHaveLength(2);

    // Night 1
    expect(expanded[0]._hotelNightInfo?.nightNumber).toBe(1);
    expect(expanded[0]._hotelNightInfo?.totalNights).toBe(1);
    expect(expanded[0]._hotelNightInfo?.isCheckout).toBe(false);

    // Checkout
    expect(expanded[1]._hotelNightInfo?.isCheckout).toBe(true);
  });

  it('should not expand non-hotel segments', () => {
    const flightSegment: Segment = {
      id: 'test-flight',
      type: 'FLIGHT',
      status: 'CONFIRMED',
      startDatetime: '2025-01-08T10:00:00.000Z',
      endDatetime: '2025-01-08T14:00:00.000Z',
      airline: { name: 'Test Airlines', code: 'TA' },
      flightNumber: 'TA123',
      origin: { name: 'JFK', code: 'JFK' },
      destination: { name: 'SXM', code: 'SXM' },
      travelerIds: [],
      source: 'import',
    };

    const expanded = expandHotelSegments([flightSegment]);

    // Should remain as 1 entry
    expect(expanded).toHaveLength(1);
    expect(expanded[0]).toEqual(flightSegment);
  });

  it('should handle hotel without checkInDate/checkOutDate', () => {
    const hotelSegment = {
      id: 'test-hotel-no-dates',
      type: 'HOTEL' as const,
      status: 'CONFIRMED' as const,
      startDatetime: '2025-01-08T15:00:00.000Z',
      endDatetime: '2025-01-15T11:00:00.000Z',
      property: { name: 'Hotel No Dates' },
      location: { name: 'Test City' },
      travelerIds: [],
      source: 'import' as const,
      // No checkInDate/checkOutDate
    };

    const expanded = expandHotelSegments([hotelSegment]);

    // Should remain as 1 entry (not expanded)
    expect(expanded).toHaveLength(1);
    expect(expanded[0]._hotelNightInfo).toBeUndefined();
  });
});
