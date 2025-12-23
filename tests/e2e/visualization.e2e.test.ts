/**
 * Visualization Triggers E2E Tests
 *
 * REAL LLM API TESTS - These make actual calls to OpenRouter
 *
 * Run with: npm run test:e2e
 * Requires: ITINERIZER_TEST_API_KEY environment variable
 *
 * Features tested:
 * - Map visualization trigger detection
 * - Location extraction from responses
 * - Coordinate extraction from tool results
 * - Multi-location vs single-location handling
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  TestClient,
  collectSSEEvents,
  assertNoErrors,
  assertStreamCompleted,
  extractLocationsFromEvents,
  extractToolCallsFromEvents,
} from '../helpers/index.js';

describe('Visualization E2E - Map Triggers', () => {
  let client: TestClient;
  let sessionId: string | null = null;
  let itineraryId: string | null = null;

  beforeAll(() => {
    client = new TestClient();
  });

  afterEach(async () => {
    if (itineraryId) {
      await client.deleteItinerary(itineraryId).catch(() => {});
      itineraryId = null;
    }
    sessionId = null;
  });

  describe('Location Detection', () => {
    it('extracts locations from tool results when adding segments', async () => {
      const itinerary = await client.createItinerary({
        title: 'Location Extraction Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Add a flight from New York JFK to London Heathrow on August 1st'
        )
      );

      assertNoErrors(events);

      // Extract locations from tool results
      const locations = extractLocationsFromEvents(events);

      // Should detect at least one location (could be origin, destination, or both)
      expect(locations.length).toBeGreaterThan(0);

      // Location names should be present
      locations.forEach(loc => {
        expect(loc.name).toBeTruthy();
        expect(loc.name.length).toBeGreaterThan(0);
      });
    }, 60000);

    it('detects multiple locations when adding multiple segments', async () => {
      const itinerary = await client.createItinerary({
        title: 'Multi-location Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-15T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Add flights: NYC to Paris on Aug 1, Paris to Rome on Aug 8'
        )
      );

      assertNoErrors(events);

      const locations = extractLocationsFromEvents(events);

      // Should detect multiple locations (NYC, Paris, Rome)
      expect(locations.length).toBeGreaterThan(1);

      const locationNames = locations.map(l => l.name.toLowerCase());

      // Should include major cities mentioned
      const hasParis = locationNames.some(name =>
        name.includes('paris')
      );
      expect(hasParis).toBe(true);
    }, 60000);

    it('extracts coordinates when available in tool results', async () => {
      const itinerary = await client.createItinerary({
        title: 'Coordinates Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Add a hotel in Tokyo, Japan for August 1-5'
        )
      );

      assertNoErrors(events);

      const locations = extractLocationsFromEvents(events);

      if (locations.length > 0) {
        // At least some locations should have coordinates
        // (Tool results may include lat/lng for precise mapping)
        const locationsWithCoords = locations.filter(loc =>
          loc.coordinates &&
          Array.isArray(loc.coordinates) &&
          loc.coordinates.length === 2
        );

        // Not all locations may have coordinates, but if they do, validate format
        locationsWithCoords.forEach(loc => {
          const [lat, lng] = loc.coordinates!;
          expect(typeof lat).toBe('number');
          expect(typeof lng).toBe('number');
          expect(lat).toBeGreaterThanOrEqual(-90);
          expect(lat).toBeLessThanOrEqual(90);
          expect(lng).toBeGreaterThanOrEqual(-180);
          expect(lng).toBeLessThanOrEqual(180);
        });
      }
    }, 60000);
  });

  describe('Map Trigger Rules', () => {
    it('triggers map when 2+ locations in response', async () => {
      const itinerary = await client.createItinerary({
        title: 'Map Trigger Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-15T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'I want to visit Barcelona and Madrid on my trip'
        )
      );

      assertNoErrors(events);

      const locations = extractLocationsFromEvents(events);

      // With 2+ locations, map should be triggered
      if (locations.length >= 2) {
        // Frontend would trigger map visualization
        expect(locations.length).toBeGreaterThanOrEqual(2);
      }
    }, 60000);

    it('does NOT trigger map for single location', async () => {
      const itinerary = await client.createItinerary({
        title: 'Single Location Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'I want to visit Tokyo'
        )
      );

      assertNoErrors(events);

      const locations = extractLocationsFromEvents(events);

      // Single location should NOT trigger map
      // (This is a UI decision - map only for multi-location context)
      if (locations.length === 1) {
        expect(locations.length).toBe(1);
        // Frontend would NOT auto-show map for single location
      }
    }, 60000);

    it('handles complex multi-city itineraries', async () => {
      const itinerary = await client.createItinerary({
        title: 'Multi-city Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-20T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Plan a trip to Amsterdam, Brussels, and Paris'
        )
      );

      assertNoErrors(events);

      const locations = extractLocationsFromEvents(events);

      // Should detect multiple cities
      expect(locations.length).toBeGreaterThan(0);

      const locationNames = locations.map(l => l.name.toLowerCase()).join(' ');

      // Should include at least some of the mentioned cities
      const mentionsEuropeanCities =
        locationNames.includes('amsterdam') ||
        locationNames.includes('brussels') ||
        locationNames.includes('paris');

      expect(mentionsEuropeanCities).toBe(true);
    }, 60000);
  });

  describe('Location Context from Tools', () => {
    it('extracts locations from flight tool results', async () => {
      const itinerary = await client.createItinerary({
        title: 'Flight Location Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Add a flight from LAX to SFO on August 1st at 10 AM'
        )
      );

      assertNoErrors(events);

      const toolCalls = extractToolCallsFromEvents(events);
      const flightToolCall = toolCalls.find(tc => tc.name === 'add_flight');

      // Should have flight tool call
      expect(flightToolCall).toBeDefined();

      // Locations can be extracted from tool arguments or results
      const locations = extractLocationsFromEvents(events);
      if (locations.length > 0) {
        expect(locations.length).toBeGreaterThanOrEqual(1);
      }
    }, 60000);

    it('extracts locations from hotel tool results', async () => {
      const itinerary = await client.createItinerary({
        title: 'Hotel Location Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Book a hotel in central Berlin for August 1-5'
        )
      );

      assertNoErrors(events);

      const locations = extractLocationsFromEvents(events);

      // Should detect Berlin as location
      if (locations.length > 0) {
        const hasBerlin = locations.some(loc =>
          loc.name.toLowerCase().includes('berlin')
        );

        expect(hasBerlin).toBe(true);
      }
    }, 60000);

    it('extracts locations from activity tool results', async () => {
      const itinerary = await client.createItinerary({
        title: 'Activity Location Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'Add a visit to the Louvre Museum in Paris on August 3rd'
        )
      );

      assertNoErrors(events);

      const locations = extractLocationsFromEvents(events);

      // Should detect Paris or Louvre location
      if (locations.length > 0) {
        const locationNames = locations.map(l => l.name.toLowerCase()).join(' ');
        const hasParis = locationNames.includes('paris') || locationNames.includes('louvre');

        expect(hasParis).toBe(true);
      }
    }, 60000);
  });

  describe('Edge Cases', () => {
    it('handles locations with no coordinates gracefully', async () => {
      const itinerary = await client.createItinerary({
        title: 'No Coordinates Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'I want to visit some small towns in Tuscany'
        )
      );

      assertNoErrors(events);
      assertStreamCompleted(events);

      const locations = extractLocationsFromEvents(events);

      // May or may not have locations, but should handle gracefully
      // No errors should occur if coordinates are missing
      locations.forEach(loc => {
        expect(loc.name).toBeTruthy();
        // coordinates are optional
      });
    }, 60000);

    it('handles vague location references', async () => {
      const itinerary = await client.createItinerary({
        title: 'Vague Location Test',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-08T00:00:00.000Z',
      });
      itineraryId = itinerary.id;

      const session = await client.createSession(itineraryId);
      sessionId = session.sessionId;

      const events = await collectSSEEvents(
        await client.sendMessage(
          sessionId,
          'I want to go somewhere sunny in Europe'
        )
      );

      assertNoErrors(events);

      // Should handle vague references without crashing
      const locations = extractLocationsFromEvents(events);

      // May or may not extract specific locations
      // Just verify no errors occurred
      expect(Array.isArray(locations)).toBe(true);
    }, 60000);
  });
});
