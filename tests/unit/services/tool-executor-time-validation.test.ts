/**
 * Integration tests for time validation feedback in ToolExecutor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolExecutor } from '../../../src/services/trip-designer/tool-executor.js';
import { ItineraryService } from '../../../src/services/itinerary.service.js';
import { SegmentService } from '../../../src/services/segment.service.js';
import { JsonItineraryStorage } from '../../../src/storage/json-storage.js';
import { generateItineraryId } from '../../../src/domain/types/branded.js';
import type { Itinerary } from '../../../src/domain/types/itinerary.js';
import type { ToolExecutionContext } from '../../../src/domain/types/trip-designer.js';

describe('ToolExecutor Time Validation', () => {
  let toolExecutor: ToolExecutor;
  let itineraryService: ItineraryService;
  let segmentService: SegmentService;
  let testItinerary: Itinerary;

  beforeEach(async () => {
    // Create in-memory storage
    const storage = new JsonItineraryStorage('./data/test');
    itineraryService = new ItineraryService(storage);
    segmentService = new SegmentService(storage);

    toolExecutor = new ToolExecutor({
      itineraryService,
      segmentService
    });

    // Create a test itinerary
    const itineraryId = generateItineraryId();
    testItinerary = {
      id: itineraryId,
      title: 'Test Trip',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-07'),
      destinations: [{ name: 'Tokyo', city: 'Tokyo', country: 'Japan' }],
      segments: [],
      travelers: [],
      status: 'PLANNED',
      source: 'user',
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      tags: [],
      metadata: {}
    };

    await storage.save(testItinerary);
  });

  describe('Activity Time Validation', () => {
    it('should return validation error for "Late Night Ramen" scheduled at 5 PM', async () => {
      const context: ToolExecutionContext = {
        toolCall: {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'add_activity',
            arguments: JSON.stringify({
              name: 'Late Night Ramen at Ichiran',
              startTime: '2025-06-02T17:00:00',
              location: { name: 'Shinjuku', city: 'Tokyo', country: 'Japan' },
              category: 'dining'
            })
          }
        },
        itineraryId: testItinerary.id,
        sessionId: 'session_test' as any
      };

      const result = await toolExecutor.execute(context);

      expect(result.success).toBe(true); // Execute succeeded
      expect(result.result).toBeDefined();
      if (result.success && result.result && typeof result.result === 'object') {
        const toolResult = result.result as any;
        expect(toolResult.success).toBe(false); // But tool validation failed
        expect(toolResult.requiresCorrection).toBe(true);
        expect(toolResult.issue).toContain('late night');
        expect(toolResult.suggestedTime).toBe('22:00');
        expect(toolResult.severity).toBe('warning');
        expect(toolResult.category).toBe('semantic_mismatch');
      }
    });

    it('should accept "Late Night Ramen" scheduled at 10 PM', async () => {
      const context: ToolExecutionContext = {
        toolCall: {
          id: 'call_124',
          type: 'function',
          function: {
            name: 'add_activity',
            arguments: JSON.stringify({
              name: 'Late Night Ramen at Ichiran',
              startTime: '2025-06-02T22:00:00',
              location: { name: 'Shinjuku', city: 'Tokyo', country: 'Japan' },
              category: 'dining'
            })
          }
        },
        itineraryId: testItinerary.id,
        sessionId: 'session_test' as any
      };

      const result = await toolExecutor.execute(context);

      expect(result.success).toBe(true);
      if (result.success && result.result && typeof result.result === 'object') {
        const successResult = result.result as any;
        expect(successResult.success).toBe(true);
        expect(successResult.segmentId).toBeDefined();
      }
    });

    it('should return validation error for "Morning Temple Visit" scheduled at 4 PM', async () => {
      const context: ToolExecutionContext = {
        toolCall: {
          id: 'call_125',
          type: 'function',
          function: {
            name: 'add_activity',
            arguments: JSON.stringify({
              name: 'Morning Temple Visit',
              startTime: '2025-06-02T16:00:00',
              location: { name: 'Asakusa', city: 'Tokyo', country: 'Japan' },
              category: 'sightseeing'
            })
          }
        },
        itineraryId: testItinerary.id,
        sessionId: 'session_test' as any
      };

      const result = await toolExecutor.execute(context);

      expect(result.success).toBe(true); // Execute succeeded
      expect(result.result).toBeDefined();
      if (result.success && result.result && typeof result.result === 'object') {
        const toolResult = result.result as any;
        expect(toolResult.success).toBe(false); // But tool validation failed
        expect(toolResult.requiresCorrection).toBe(true);
        expect(toolResult.issue).toContain('morning');
        expect(toolResult.suggestedTime).toBe('09:00');
      }
    });

    it('should accept activity without time keywords at any reasonable hour', async () => {
      const context: ToolExecutionContext = {
        toolCall: {
          id: 'call_126',
          type: 'function',
          function: {
            name: 'add_activity',
            arguments: JSON.stringify({
              name: 'Visit Sensoji Temple',
              startTime: '2025-06-02T14:00:00',
              location: { name: 'Asakusa', city: 'Tokyo', country: 'Japan' },
              category: 'sightseeing'
            })
          }
        },
        itineraryId: testItinerary.id,
        sessionId: 'session_test' as any
      };

      const result = await toolExecutor.execute(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Hotel Time Validation', () => {
    it('should return validation warning for early check-in (10 AM)', async () => {
      const context: ToolExecutionContext = {
        toolCall: {
          id: 'call_127',
          type: 'function',
          function: {
            name: 'add_hotel',
            arguments: JSON.stringify({
              property: { name: 'Test Hotel' },
              location: { name: 'Tokyo', city: 'Tokyo', country: 'Japan' },
              checkInDate: '2025-06-02',
              checkOutDate: '2025-06-05',
              checkInTime: '10:00',
              checkOutTime: '11:00'
            })
          }
        },
        itineraryId: testItinerary.id,
        sessionId: 'session_test' as any
      };

      const result = await toolExecutor.execute(context);

      expect(result.success).toBe(true); // Execute succeeded
      expect(result.result).toBeDefined();
      if (result.success && result.result && typeof result.result === 'object') {
        const toolResult = result.result as any;
        expect(toolResult.success).toBe(false); // But tool validation failed
        expect(toolResult.requiresCorrection).toBe(true);
        expect(toolResult.issue).toContain('Early check-in');
        expect(toolResult.suggestedTime).toBe('15:00');
      }
    });

    it('should accept standard check-in time (3 PM)', async () => {
      const context: ToolExecutionContext = {
        toolCall: {
          id: 'call_128',
          type: 'function',
          function: {
            name: 'add_hotel',
            arguments: JSON.stringify({
              property: { name: 'Test Hotel' },
              location: { name: 'Tokyo', city: 'Tokyo', country: 'Japan' },
              checkInDate: '2025-06-02',
              checkOutDate: '2025-06-05',
              checkInTime: '15:00',
              checkOutTime: '11:00'
            })
          }
        },
        itineraryId: testItinerary.id,
        sessionId: 'session_test' as any
      };

      const result = await toolExecutor.execute(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Validation Response Format', () => {
    it('should include all required fields in validation error response', async () => {
      const context: ToolExecutionContext = {
        toolCall: {
          id: 'call_129',
          type: 'function',
          function: {
            name: 'add_activity',
            arguments: JSON.stringify({
              name: 'Breakfast at Hotel',
              startTime: '2025-06-02T15:00:00', // Invalid: breakfast at 3 PM
              location: { name: 'Tokyo', city: 'Tokyo', country: 'Japan' },
              category: 'dining'
            })
          }
        },
        itineraryId: testItinerary.id,
        sessionId: 'session_test' as any
      };

      const result = await toolExecutor.execute(context);

      expect(result.success).toBe(true); // Execute succeeded
      expect(result.result).toBeDefined();
      if (result.success && result.result && typeof result.result === 'object') {
        const toolResult = result.result as any;

        // Check all required fields are present
        expect(toolResult).toHaveProperty('success', false);
        expect(toolResult).toHaveProperty('requiresCorrection', true);
        expect(toolResult).toHaveProperty('segmentId');
        expect(toolResult).toHaveProperty('issue');
        expect(toolResult).toHaveProperty('details');
        expect(toolResult).toHaveProperty('currentTime');
        expect(toolResult).toHaveProperty('suggestedTime');
        expect(toolResult).toHaveProperty('severity');
        expect(toolResult).toHaveProperty('category');
        expect(toolResult).toHaveProperty('message');

        // Verify format
        expect(toolResult.currentTime).toMatch(/^\d{2}:\d{2}$/);
        expect(toolResult.suggestedTime).toMatch(/^\d{2}:\d{2}$/);
        expect(['info', 'warning', 'error']).toContain(toolResult.severity);
      }
    });
  });
});
