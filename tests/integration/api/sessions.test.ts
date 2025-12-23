/**
 * Integration tests for Trip Designer Sessions API
 * Tests: /api/v1/designer/sessions (CRUD operations)
 *
 * These tests interact with the actual SvelteKit API endpoints
 * but may mock the underlying LLM service layer.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestClient } from '../../helpers/test-client.js';
import type { TripDesignerSession } from '../../../src/domain/types/trip-designer.js';

describe('Sessions API Integration Tests', () => {
  let client: TestClient;
  let createdSessionId: string | null = null;
  let testItineraryId: string | null = null;

  beforeEach(async () => {
    client = new TestClient();

    // Create a test itinerary for sessions that require one
    const itinerary = await client.createItinerary({
      title: 'Test Session Itinerary',
      description: 'Created for session API tests',
      startDate: '2025-08-01T00:00:00.000Z',
      endDate: '2025-08-15T00:00:00.000Z',
    });
    testItineraryId = itinerary.id;
  });

  afterEach(async () => {
    // Cleanup created resources
    if (createdSessionId) {
      try {
        await client.deleteSession(createdSessionId);
      } catch (error) {
        // Session might not exist or already deleted
        console.warn('Failed to cleanup session:', error);
      }
      createdSessionId = null;
    }

    if (testItineraryId) {
      try {
        await client.deleteItinerary(testItineraryId);
      } catch (error) {
        console.warn('Failed to cleanup itinerary:', error);
      }
      testItineraryId = null;
    }
  });

  describe('POST /api/v1/designer/sessions', () => {
    it('creates new help mode session without itinerary', async () => {
      const response = await client.createSession(undefined, 'help');

      expect(response).toBeDefined();
      expect(response.sessionId).toBeDefined();
      expect(response.sessionId).toMatch(/^session_/);

      createdSessionId = response.sessionId;

      // Verify session exists and has correct mode
      const session = await client.getSession(response.sessionId);
      expect(session.mode).toBe('help');
      expect(session.itineraryId).toBeUndefined();
    });

    it('creates new trip-designer session with itinerary context', async () => {
      expect(testItineraryId).toBeDefined();

      const response = await client.createSession(testItineraryId!, 'trip-designer');

      expect(response).toBeDefined();
      expect(response.sessionId).toBeDefined();
      expect(response.sessionId).toMatch(/^session_/);

      createdSessionId = response.sessionId;

      // Verify session exists and has itinerary reference
      const session = await client.getSession(response.sessionId);
      expect(session.mode).toBe('trip-designer');
      expect(session.itineraryId).toBe(testItineraryId);
    });

    it('returns valid session ID in expected format', async () => {
      const response = await client.createSession(testItineraryId!, 'trip-designer');
      createdSessionId = response.sessionId;

      // Session ID format validation
      expect(response.sessionId).toMatch(/^session_[a-z0-9-]+$/);
      expect(response.sessionId.length).toBeGreaterThan(10);
    });

    it('rejects request with missing API key', async () => {
      // Create client without API key
      const clientWithoutKey = new TestClient({ apiKey: '' });

      await expect(async () => {
        await clientWithoutKey.createSession(testItineraryId!, 'trip-designer');
      }).rejects.toThrow();
    });

    it('rejects request with empty/whitespace API key', async () => {
      // Create client with whitespace-only API key
      const clientWithInvalidKey = new TestClient({ apiKey: '   ' });

      await expect(async () => {
        await clientWithInvalidKey.createSession(testItineraryId!, 'trip-designer');
      }).rejects.toThrow(/Invalid API key/);
    });

    it('requires itineraryId for trip-designer mode', async () => {
      await expect(async () => {
        await client.createSession(undefined, 'trip-designer');
      }).rejects.toThrow(/itineraryId is required for trip-designer mode/);
    });

    it('rejects session creation with non-existent itinerary', async () => {
      const fakeItineraryId = 'non-existent-itinerary-id';

      await expect(async () => {
        await client.createSession(fakeItineraryId, 'trip-designer');
      }).rejects.toThrow(/Itinerary not found/);
    });

    it('returns 201 status code on successful creation', async () => {
      const response = await fetch(`${client['baseUrl']}/api/v1/designer/sessions`, {
        method: 'POST',
        headers: client['getHeaders'](true),
        body: JSON.stringify({ itineraryId: testItineraryId, mode: 'trip-designer' }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      createdSessionId = data.sessionId;
    });
  });

  describe('GET /api/v1/designer/sessions/:sessionId', () => {
    beforeEach(async () => {
      // Create a session for GET tests
      const response = await client.createSession(testItineraryId!, 'trip-designer');
      createdSessionId = response.sessionId;
    });

    it('returns session details for valid session', async () => {
      expect(createdSessionId).toBeDefined();

      const session = await client.getSession(createdSessionId!);

      expect(session).toBeDefined();
      expect(session.sessionId).toBe(createdSessionId);
      expect(session.mode).toBe('trip-designer');
      expect(session.itineraryId).toBe(testItineraryId);
    });

    it('includes message history in session', async () => {
      const session = await client.getSession(createdSessionId!);

      expect(session.messages).toBeDefined();
      expect(Array.isArray(session.messages)).toBe(true);
      // New session should have empty or system-only messages
      expect(session.messages.length).toBeGreaterThanOrEqual(0);
    });

    it('includes metadata fields in session', async () => {
      const session = await client.getSession(createdSessionId!);

      // Verify expected session structure
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('mode');
      expect(session).toHaveProperty('messages');
      expect(session).toHaveProperty('itineraryId');
    });

    it('returns 404 for invalid session ID', async () => {
      const invalidSessionId = 'session_does_not_exist';

      await expect(async () => {
        await client.getSession(invalidSessionId);
      }).rejects.toThrow(/Session not found/);
    });

    it('returns 404 for malformed session ID', async () => {
      const malformedSessionId = 'not-a-session-id';

      await expect(async () => {
        await client.getSession(malformedSessionId);
      }).rejects.toThrow();
    });

    it('requires API key in header', async () => {
      const clientWithoutKey = new TestClient({ apiKey: '' });

      await expect(async () => {
        await clientWithoutKey.getSession(createdSessionId!);
      }).rejects.toThrow();
    });
  });

  describe('DELETE /api/v1/designer/sessions/:sessionId', () => {
    beforeEach(async () => {
      // Create a session for DELETE tests
      const response = await client.createSession(testItineraryId!, 'trip-designer');
      createdSessionId = response.sessionId;
    });

    it('deletes session successfully', async () => {
      expect(createdSessionId).toBeDefined();

      // Delete the session
      await client.deleteSession(createdSessionId!);

      // Verify session no longer exists
      await expect(async () => {
        await client.getSession(createdSessionId!);
      }).rejects.toThrow(/Session not found/);

      createdSessionId = null; // Prevent double-cleanup
    });

    it('returns 204 No Content on successful deletion', async () => {
      const response = await fetch(
        `${client['baseUrl']}/api/v1/designer/sessions/${createdSessionId}`,
        {
          method: 'DELETE',
          headers: client['getHeaders'](true),
        }
      );

      expect(response.status).toBe(204);
      expect(response.headers.get('content-length')).toBe('0');

      createdSessionId = null;
    });

    it('returns 404 for non-existent session', async () => {
      const nonExistentSessionId = 'session_does_not_exist';

      await expect(async () => {
        await client.deleteSession(nonExistentSessionId);
      }).rejects.toThrow(/Session not found/);
    });

    it('handles double deletion gracefully', async () => {
      // First deletion should succeed
      await client.deleteSession(createdSessionId!);

      // Second deletion should fail with 404
      await expect(async () => {
        await client.deleteSession(createdSessionId!);
      }).rejects.toThrow(/Session not found/);

      createdSessionId = null;
    });
  });

  describe('Session Lifecycle', () => {
    it('supports full CRUD lifecycle', async () => {
      // CREATE
      const createResponse = await client.createSession(testItineraryId!, 'trip-designer');
      expect(createResponse.sessionId).toBeDefined();
      createdSessionId = createResponse.sessionId;

      // READ
      const session = await client.getSession(createdSessionId);
      expect(session.sessionId).toBe(createdSessionId);
      expect(session.itineraryId).toBe(testItineraryId);

      // UPDATE (via message sending - tested in streaming.test.ts)
      // Sessions are updated by sending messages

      // DELETE
      await client.deleteSession(createdSessionId);

      // Verify deletion
      await expect(async () => {
        await client.getSession(createdSessionId!);
      }).rejects.toThrow(/Session not found/);

      createdSessionId = null;
    });

    it('creates multiple independent sessions', async () => {
      // Create first session
      const session1 = await client.createSession(testItineraryId!, 'trip-designer');
      expect(session1.sessionId).toBeDefined();

      // Create second session
      const session2 = await client.createSession(testItineraryId!, 'trip-designer');
      expect(session2.sessionId).toBeDefined();

      // Session IDs should be different
      expect(session1.sessionId).not.toBe(session2.sessionId);

      // Both should be retrievable
      const retrieved1 = await client.getSession(session1.sessionId);
      const retrieved2 = await client.getSession(session2.sessionId);

      expect(retrieved1.sessionId).toBe(session1.sessionId);
      expect(retrieved2.sessionId).toBe(session2.sessionId);

      // Cleanup both
      await client.deleteSession(session1.sessionId);
      await client.deleteSession(session2.sessionId);
    });
  });
});
