/**
 * Example usage tests - demonstrates real-world schema usage
 * @module domain/schemas/example-usage
 */

import { describe, expect, it } from 'vitest';
import {
  hotelSegmentSchema,
  itineraryCreateSchema,
  itinerarySchema,
  moneyInputSchema,
  segmentSchema,
  travelerInputSchema,
} from '../../../src/domain/schemas/index.js';

describe('Real-world Usage Examples', () => {
  it('should create a complete trip itinerary', () => {
    // 1. Create travelers with IDs
    const traveler1 = travelerInputSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440010',
      type: 'ADULT',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      loyaltyPrograms: [
        {
          carrier: 'UA',
          number: 'UA123456789',
          tier: 'Gold',
        },
      ],
    });

    const traveler2 = travelerInputSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440011',
      type: 'ADULT',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });

    expect(traveler1.firstName).toBe('John');
    expect(traveler2.firstName).toBe('Jane');

    // 2. Create segments
    const outboundFlight = segmentSchema.parse({
      type: 'FLIGHT',
      id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'CONFIRMED',
      startDatetime: '2025-06-01T08:00:00Z',
      endDatetime: '2025-06-01T12:00:00Z',
      travelerIds: [traveler1.id, traveler2.id],
      airline: { name: 'United Airlines', code: 'UA' },
      flightNumber: 'UA123',
      origin: { name: 'San Francisco International', code: 'SFO' },
      destination: { name: 'London Heathrow', code: 'LHR' },
      cabinClass: 'BUSINESS',
    });

    const hotel = segmentSchema.parse({
      type: 'HOTEL',
      id: '550e8400-e29b-41d4-a716-446655440002',
      status: 'CONFIRMED',
      startDatetime: '2025-06-01T15:00:00Z',
      endDatetime: '2025-06-05T11:00:00Z',
      travelerIds: [traveler1.id, traveler2.id],
      property: { name: 'The Savoy', code: 'SAV' },
      location: { name: 'The Savoy Hotel, London' },
      checkInDate: '2025-06-01',
      checkOutDate: '2025-06-05',
      roomType: 'Deluxe Suite',
      boardBasis: 'BED_BREAKFAST',
    });

    const returnFlight = segmentSchema.parse({
      type: 'FLIGHT',
      id: '550e8400-e29b-41d4-a716-446655440003',
      status: 'CONFIRMED',
      startDatetime: '2025-06-05T18:00:00Z',
      endDatetime: '2025-06-05T21:00:00Z',
      travelerIds: [traveler1.id, traveler2.id],
      airline: { name: 'United Airlines', code: 'UA' },
      flightNumber: 'UA456',
      origin: { name: 'London Heathrow', code: 'LHR' },
      destination: { name: 'San Francisco International', code: 'SFO' },
      cabinClass: 'BUSINESS',
    });

    expect(outboundFlight.type).toBe('FLIGHT');
    expect(hotel.type).toBe('HOTEL');
    expect(returnFlight.type).toBe('FLIGHT');

    // 3. Create itinerary (simplified version)
    const itinerary = itineraryCreateSchema.parse({
      title: 'London Business Trip',
      description: 'Q2 business meetings in London',
      startDate: '2025-06-01',
      endDate: '2025-06-05',
      tripType: 'BUSINESS',
      origin: { name: 'San Francisco', code: 'SFO' },
      destinations: [{ name: 'London', code: 'LHR' }],
      tags: ['business', 'europe', 'q2-2025'],
    });

    expect(itinerary.title).toBe('London Business Trip');
    expect(itinerary.tags).toHaveLength(3);
  });

  it('should handle money conversions', () => {
    // Input from user (decimal dollars)
    const userInput = moneyInputSchema.parse({
      amount: 1250.5, // $1,250.50
      currency: 'usd', // Lowercase will be uppercased
    });

    expect(userInput.amount).toBe(125050); // Converted to cents
    expect(userInput.currency).toBe('USD'); // Uppercased
  });

  it('should validate business rules', () => {
    // Valid: Check-out after check-in
    const validHotel = segmentSchema.parse({
      type: 'HOTEL',
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'CONFIRMED',
      startDatetime: '2025-06-01T15:00:00Z',
      endDatetime: '2025-06-03T11:00:00Z',
      travelerIds: ['550e8400-e29b-41d4-a716-446655440001'],
      property: { name: 'Hotel' },
      location: { name: 'Location' },
      checkInDate: '2025-06-01',
      checkOutDate: '2025-06-03', // After check-in ✓
    });

    expect(validHotel.type).toBe('HOTEL');

    // Invalid: Check-out before check-in
    expect(() =>
      hotelSegmentSchema.parse({
        type: 'HOTEL',
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'CONFIRMED',
        startDatetime: '2025-06-01T15:00:00Z',
        endDatetime: '2025-06-03T11:00:00Z',
        travelerIds: ['550e8400-e29b-41d4-a716-446655440001'],
        property: { name: 'Hotel' },
        location: { name: 'Location' },
        checkInDate: '2025-06-03',
        checkOutDate: '2025-06-01', // Before check-in ✗
      })
    ).toThrow();
  });

  it('should provide detailed validation errors', () => {
    const result = itineraryCreateSchema.safeParse({
      title: '', // Empty title
      startDate: '2025-06-15',
      endDate: '2025-06-01', // End before start
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors).toHaveLength(2);
      expect(result.error.errors[0].message).toContain('required');
      expect(result.error.errors[1].message).toContain('after');
    }
  });
});
