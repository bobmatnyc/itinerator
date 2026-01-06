/**
 * Unit tests for time validator
 */

import { describe, it, expect } from 'vitest';
import {
  validateSegmentTime,
  validateItineraryTimes,
  getTimeValidationSummary,
  applyTimeFix,
  TimeIssueSeverity
} from '../../../src/utils/time-validator.js';
import type { ActivitySegment, FlightSegment, HotelSegment, Segment } from '../../../src/domain/types/segment.js';
import type { SegmentId, TravelerId } from '../../../src/domain/types/branded.js';

// Helper to create test segments
function createActivitySegment(startHour: number, category?: string, name?: string): ActivitySegment {
  const startDate = new Date('2025-04-01T00:00:00Z');
  startDate.setHours(startHour, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setHours(startHour + 2, 0, 0, 0);

  return {
    type: 'ACTIVITY',
    id: 'seg_test123' as SegmentId,
    status: 'CONFIRMED',
    name: name || 'Test Activity',
    description: 'Test description',
    location: {
      name: 'Test Location',
      city: 'Tokyo',
      country: 'Japan'
    },
    category,
    startDatetime: startDate,
    endDatetime: endDate,
    travelerIds: [] as TravelerId[],
    source: 'user',
    metadata: {}
  };
}

function createFlightSegment(startHour: number): FlightSegment {
  const startDate = new Date('2025-04-01T00:00:00Z');
  startDate.setHours(startHour, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setHours(startHour + 3, 0, 0, 0);

  return {
    type: 'FLIGHT',
    id: 'seg_flight123' as SegmentId,
    status: 'CONFIRMED',
    airline: { name: 'Test Airlines', code: 'TA' },
    flightNumber: 'TA123',
    origin: { name: 'Origin Airport', code: 'ORI', city: 'Origin City', country: 'Country' },
    destination: { name: 'Dest Airport', code: 'DST', city: 'Dest City', country: 'Country' },
    startDatetime: startDate,
    endDatetime: endDate,
    travelerIds: [] as TravelerId[],
    source: 'user',
    metadata: {}
  };
}

function createHotelSegment(checkInHour: number): HotelSegment {
  const checkInDate = new Date('2025-04-01T00:00:00Z');
  checkInDate.setHours(checkInHour, 0, 0, 0);
  const checkOutDate = new Date('2025-04-02T11:00:00Z');

  return {
    type: 'HOTEL',
    id: 'seg_hotel123' as SegmentId,
    status: 'CONFIRMED',
    property: { name: 'Test Hotel' },
    location: { name: 'Tokyo', city: 'Tokyo', country: 'Japan' },
    checkInDate: new Date('2025-04-01'),
    checkOutDate: new Date('2025-04-02'),
    checkInTime: '15:00',
    checkOutTime: '11:00',
    roomCount: 1,
    amenities: [],
    startDatetime: checkInDate,
    endDatetime: checkOutDate,
    travelerIds: [] as TravelerId[],
    source: 'user',
    metadata: {}
  };
}

describe('validateSegmentTime', () => {
  describe('Activity segments', () => {
    it('should accept normal activity hours (9 AM)', () => {
      const segment = createActivitySegment(9);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(true);
    });

    it('should accept afternoon activities (2 PM)', () => {
      const segment = createActivitySegment(14);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(true);
    });

    it('should flag very early activities (4 AM)', () => {
      const segment = createActivitySegment(4);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.ERROR);
      expect(result.category).toBe('too_early');
      expect(result.suggestedTime).toBeDefined();
    });

    it('should flag early morning activities (6 AM)', () => {
      const segment = createActivitySegment(6);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.WARNING);
      expect(result.category).toBe('business_hours');
    });

    it('should flag late evening activities (11 PM)', () => {
      const segment = createActivitySegment(23);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.WARNING);
      expect(result.category).toBe('too_late');
    });

    it('should accept normal breakfast time (8 AM)', () => {
      const segment = createActivitySegment(8, 'dining');
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(true);
    });

    it('should flag very early breakfast (6 AM)', () => {
      const segment = createActivitySegment(6, 'dining');
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.WARNING);
      expect(result.category).toBe('meal_timing');
    });

    it('should accept lunch time (12 PM)', () => {
      const segment = createActivitySegment(12, 'restaurant');
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(true);
    });

    it('should accept dinner time (7 PM)', () => {
      const segment = createActivitySegment(19, 'food');
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(true);
    });

    it('should flag overnight dining (2 AM)', () => {
      const segment = createActivitySegment(2, 'dining');
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.ERROR);
      expect(result.category).toBe('too_early');
    });
  });

  describe('Flight segments', () => {
    it('should accept normal flight times (10 AM)', () => {
      const segment = createFlightSegment(10);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(true);
    });

    it('should flag red-eye flights (2 AM) as info', () => {
      const segment = createFlightSegment(2);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.INFO);
      expect(result.category).toBe('unusual');
    });

    it('should accept evening flights (8 PM)', () => {
      const segment = createFlightSegment(20);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Hotel segments', () => {
    it('should accept standard check-in time (3 PM)', () => {
      const segment = createHotelSegment(15);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(true);
    });

    it('should flag early check-in (10 AM)', () => {
      const segment = createHotelSegment(10);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.WARNING);
      expect(result.category).toBe('business_hours');
    });

    it('should flag very late check-in (11 PM)', () => {
      const segment = createHotelSegment(23);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.WARNING);
      expect(result.category).toBe('unusual');
    });

    it('should accept evening check-in (7 PM)', () => {
      const segment = createHotelSegment(19);
      const result = validateSegmentTime(segment);
      expect(result.isValid).toBe(true);
    });
  });
});

describe('validateItineraryTimes', () => {
  it('should return empty array for valid segments', () => {
    const segments: Segment[] = [
      createActivitySegment(10),
      createActivitySegment(14),
      createFlightSegment(12)
    ];

    const issues = validateItineraryTimes(segments);
    expect(issues).toHaveLength(0);
  });

  it('should find all segments with time issues', () => {
    const segments: Segment[] = [
      createActivitySegment(4), // Too early
      createActivitySegment(10), // Valid
      createActivitySegment(23), // Too late
      createHotelSegment(8) // Early check-in
    ];

    const issues = validateItineraryTimes(segments);
    expect(issues).toHaveLength(3);
  });

  it('should include segment and validation details', () => {
    const segment = createActivitySegment(4);
    const issues = validateItineraryTimes([segment]);

    expect(issues).toHaveLength(1);
    expect(issues[0].segment).toBe(segment);
    expect(issues[0].validation.isValid).toBe(false);
    expect(issues[0].validation.suggestedTime).toBeDefined();
  });
});

describe('getTimeValidationSummary', () => {
  it('should return correct counts', () => {
    const segments: Segment[] = [
      createActivitySegment(4), // ERROR
      createActivitySegment(6), // WARNING
      createFlightSegment(2) // INFO
    ];

    const issues = validateItineraryTimes(segments);
    const summary = getTimeValidationSummary(issues);

    expect(summary.total).toBe(3);
    expect(summary.bySeverity[TimeIssueSeverity.ERROR]).toBe(1);
    expect(summary.bySeverity[TimeIssueSeverity.WARNING]).toBe(1);
    expect(summary.bySeverity[TimeIssueSeverity.INFO]).toBe(1);
  });

  it('should group by category', () => {
    const segments: Segment[] = [
      createActivitySegment(4), // too_early
      createActivitySegment(23), // too_late
      createHotelSegment(8) // business_hours
    ];

    const issues = validateItineraryTimes(segments);
    const summary = getTimeValidationSummary(issues);

    expect(summary.byCategory.too_early).toBe(1);
    expect(summary.byCategory.too_late).toBe(1);
    expect(summary.byCategory.business_hours).toBe(1);
  });
});

describe('applyTimeFix', () => {
  it('should update start time to suggested time', () => {
    const segment = createActivitySegment(4);
    const fixed = applyTimeFix(segment, '09:00');

    expect(fixed.startDatetime.getHours()).toBe(9);
    expect(fixed.startDatetime.getMinutes()).toBe(0);
  });

  it('should maintain segment duration', () => {
    const segment = createActivitySegment(4); // 4 AM - 6 AM (2 hours)
    const originalDuration = segment.endDatetime.getTime() - segment.startDatetime.getTime();

    const fixed = applyTimeFix(segment, '09:00');
    const newDuration = fixed.endDatetime.getTime() - fixed.startDatetime.getTime();

    expect(newDuration).toBe(originalDuration);
    expect(fixed.endDatetime.getHours()).toBe(11); // 9 AM + 2 hours = 11 AM
  });

  it('should preserve other segment properties', () => {
    const segment = createActivitySegment(4);
    const fixed = applyTimeFix(segment, '09:00');

    expect(fixed.id).toBe(segment.id);
    expect(fixed.type).toBe(segment.type);
    expect(fixed.status).toBe(segment.status);
    if (fixed.type === 'ACTIVITY' && segment.type === 'ACTIVITY') {
      expect(fixed.name).toBe(segment.name);
      expect(fixed.category).toBe(segment.category);
    }
  });
});

describe('Semantic Time Validation', () => {
  describe('Late Night Activities', () => {
    it('should flag "Late Night Ramen" at 5:00 PM as invalid', () => {
      const segment = createActivitySegment(17, undefined, 'Late Night Ramen at Ichiran');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.WARNING);
      expect(result.issue).toContain('late night');
      expect(result.details).toContain('10 PM - 3 AM');
      expect(result.details).toContain('5:00 PM');
      expect(result.category).toBe('semantic_mismatch');
      expect(result.suggestedTime).toBe('22:00');
    });

    it('should pass "Late Night Ramen" at 10:00 PM as valid', () => {
      const segment = createActivitySegment(22, undefined, 'Late Night Ramen at Ichiran');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(true);
    });

    it('should pass "Late Night Ramen" at 1:00 AM as valid', () => {
      const segment = createActivitySegment(1, undefined, 'Late Night Ramen at Ichiran');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(true);
    });

    it('should pass "Late Night Ramen" at 3:00 AM as valid (boundary)', () => {
      const segment = createActivitySegment(3, undefined, 'Late Night Ramen at Ichiran');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Morning Activities', () => {
    it('should pass "Morning Temple Visit" at 9:00 AM as valid', () => {
      const segment = createActivitySegment(9, undefined, 'Morning Temple Visit');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(true);
    });

    it('should flag "Morning Temple Visit" at 4:00 PM as invalid', () => {
      const segment = createActivitySegment(16, undefined, 'Morning Temple Visit');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.WARNING);
      expect(result.issue).toContain('morning');
      expect(result.details).toContain('6 AM - 12 PM');
      expect(result.details).toContain('4:00 PM');
      expect(result.category).toBe('semantic_mismatch');
      expect(result.suggestedTime).toBe('09:00');
    });
  });

  describe('Sunset Activities', () => {
    it('should pass "Sunset Cruise" at 6:00 PM as valid', () => {
      const segment = createActivitySegment(18, undefined, 'Sunset Cruise on Tokyo Bay');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(true);
    });

    it('should flag "Sunset Cruise" at 10:00 AM as invalid', () => {
      const segment = createActivitySegment(10, undefined, 'Sunset Cruise on Tokyo Bay');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(false);
      expect(result.severity).toBe(TimeIssueSeverity.WARNING);
      expect(result.issue).toContain('sunset');
      expect(result.details).toContain('4 PM - 8 PM');
      expect(result.category).toBe('semantic_mismatch');
      expect(result.suggestedTime).toBe('18:00');
    });
  });

  describe('Meal Time Keywords', () => {
    it('should pass "Breakfast at Hotel" at 8:00 AM as valid', () => {
      const segment = createActivitySegment(8, undefined, 'Breakfast at Hotel');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(true);
    });

    it('should flag "Breakfast at Hotel" at 3:00 PM as invalid', () => {
      const segment = createActivitySegment(15, undefined, 'Breakfast at Hotel');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(false);
      expect(result.issue).toContain('breakfast');
      expect(result.category).toBe('semantic_mismatch');
    });

    it('should pass "Lunch at Tsukiji Market" at 12:00 PM as valid', () => {
      const segment = createActivitySegment(12, undefined, 'Lunch at Tsukiji Market');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(true);
    });

    it('should flag "Lunch at Tsukiji Market" at 9:00 PM as invalid', () => {
      const segment = createActivitySegment(21, undefined, 'Lunch at Tsukiji Market');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(false);
      expect(result.issue).toContain('lunch');
      expect(result.category).toBe('semantic_mismatch');
    });

    it('should pass "Dinner at Sushi Restaurant" at 7:00 PM as valid', () => {
      const segment = createActivitySegment(19, undefined, 'Dinner at Sushi Restaurant');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(true);
    });

    it('should flag "Dinner at Sushi Restaurant" at 10:00 AM as invalid', () => {
      const segment = createActivitySegment(10, undefined, 'Dinner at Sushi Restaurant');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(false);
      expect(result.issue).toContain('dinner');
      expect(result.category).toBe('semantic_mismatch');
    });

    it('should pass "Brunch at Cafe" at 11:00 AM as valid', () => {
      const segment = createActivitySegment(11, undefined, 'Brunch at Cafe');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(true);
    });

    it('should flag "Brunch at Cafe" at 5:00 PM as invalid', () => {
      const segment = createActivitySegment(17, undefined, 'Brunch at Cafe');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(false);
      expect(result.issue).toContain('brunch');
      expect(result.category).toBe('semantic_mismatch');
    });
  });

  describe('Overnight Range Validation', () => {
    it('should handle overnight range 22:00 - 3:00 correctly', () => {
      // Valid times: 22:00-23:59, 0:00-3:00
      const validHours = [22, 23, 0, 1, 2, 3];
      for (const hour of validHours) {
        const segment = createActivitySegment(hour, undefined, 'Late Night Ramen');
        const result = validateSegmentTime(segment);
        expect(result.isValid).toBe(true);
      }

      // Invalid times: 4:00-21:59
      const invalidHours = [4, 10, 15, 21];
      for (const hour of invalidHours) {
        const segment = createActivitySegment(hour, undefined, 'Late Night Ramen');
        const result = validateSegmentTime(segment);
        expect(result.isValid).toBe(false);
        expect(result.category).toBe('semantic_mismatch');
      }
    });
  });

  describe('Keyword Prioritization', () => {
    it('should prioritize longer keywords over shorter ones', () => {
      const segment = createActivitySegment(19, undefined, 'Late Night Bar Crawl');
      const result = validateSegmentTime(segment);

      // Should match "late night" (22:00-3:00) not "night" (20:00-3:00)
      // 7 PM is invalid for "late night"
      expect(result.isValid).toBe(false);
      expect(result.issue).toContain('late night');
    });
  });

  describe('Case Insensitivity', () => {
    it('should detect "LATE NIGHT" in uppercase', () => {
      const segment = createActivitySegment(17, undefined, 'LATE NIGHT RAMEN');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(false);
      expect(result.issue).toContain('late night');
    });

    it('should detect "Late Night" in mixed case', () => {
      const segment = createActivitySegment(17, undefined, 'Late Night Ramen');
      const result = validateSegmentTime(segment);

      expect(result.isValid).toBe(false);
      expect(result.issue).toContain('late night');
    });
  });

  describe('No False Positives', () => {
    it('should not flag activities without time keywords', () => {
      const segment = createActivitySegment(17, undefined, 'Visit Sensoji Temple');
      const result = validateSegmentTime(segment);

      // Should fall through to type-specific validation (activity at 5 PM is valid)
      expect(result.isValid).toBe(true);
    });
  });

  describe('Integration with validateItineraryTimes', () => {
    it('should detect semantic issues across multiple segments', () => {
      const segments: Segment[] = [
        createActivitySegment(9, undefined, 'Morning Temple Visit'), // Valid
        createActivitySegment(17, undefined, 'Late Night Ramen'), // Invalid
        createActivitySegment(10, undefined, 'Sunset Cruise'), // Invalid
        createActivitySegment(12, undefined, 'Lunch at Market') // Valid
      ];

      const issues = validateItineraryTimes(segments);

      expect(issues.length).toBeGreaterThanOrEqual(2);
      const semanticIssues = issues.filter(i => i.validation.category === 'semantic_mismatch');
      expect(semanticIssues).toHaveLength(2);
    });
  });
});
