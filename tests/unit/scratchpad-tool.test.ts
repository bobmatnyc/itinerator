/**
 * Unit tests for add_to_scratchpad tool
 */

import { describe, it, expect } from 'vitest';
import { addToScratchpadArgsSchema } from '../../src/domain/schemas/tool-args.schema.js';

describe('add_to_scratchpad schema validation', () => {
  it('should validate valid scratchpad arguments', () => {
    const validArgs = {
      segment: {
        type: 'ACTIVITY',
        name: 'Narisawa Restaurant',
        description: '2-Michelin star innovative cuisine',
        location: {
          name: 'Minato',
          city: 'Tokyo',
          country: 'Japan',
        },
        startTime: '2025-03-20T19:30:00',
        price: {
          amount: 250,
          currency: 'USD',
        },
      },
      notes: 'Alternative if Kozue is fully booked - equally romantic, different vibe',
      priority: 'high' as const,
      tags: ['backup', 'romantic', 'michelin'],
    };

    const result = addToScratchpadArgsSchema.safeParse(validArgs);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segment.name).toBe('Narisawa Restaurant');
      expect(result.data.priority).toBe('high');
      expect(result.data.tags).toContain('romantic');
    }
  });

  it('should validate minimal scratchpad arguments', () => {
    const minimalArgs = {
      segment: {
        type: 'ACTIVITY',
        name: 'Ichiran Ramen',
      },
      notes: 'Budget-friendly option',
      priority: 'low' as const,
    };

    const result = addToScratchpadArgsSchema.safeParse(minimalArgs);
    expect(result.success).toBe(true);
  });

  it('should reject invalid priority', () => {
    const invalidArgs = {
      segment: {
        type: 'ACTIVITY',
        name: 'Some Restaurant',
      },
      notes: 'Some notes',
      priority: 'super-high', // Invalid priority
    };

    const result = addToScratchpadArgsSchema.safeParse(invalidArgs);
    expect(result.success).toBe(false);
  });

  it('should reject missing notes', () => {
    const invalidArgs = {
      segment: {
        type: 'ACTIVITY',
        name: 'Some Restaurant',
      },
      priority: 'high',
      // Missing notes
    };

    const result = addToScratchpadArgsSchema.safeParse(invalidArgs);
    expect(result.success).toBe(false);
  });

  it('should reject empty notes string', () => {
    const invalidArgs = {
      segment: {
        type: 'ACTIVITY',
        name: 'Some Restaurant',
      },
      notes: '',
      priority: 'high',
    };

    const result = addToScratchpadArgsSchema.safeParse(invalidArgs);
    expect(result.success).toBe(false);
  });

  it('should validate HOTEL segment type', () => {
    const hotelArgs = {
      segment: {
        type: 'HOTEL',
        name: 'Alternative Hotel',
        description: 'Budget-friendly option',
        location: {
          city: 'Tokyo',
        },
        price: {
          amount: 150,
          currency: 'USD',
        },
      },
      notes: 'Cheaper alternative if primary hotel is over budget',
      priority: 'medium' as const,
      tags: ['budget-friendly', 'backup'],
    };

    const result = addToScratchpadArgsSchema.safeParse(hotelArgs);
    expect(result.success).toBe(true);
  });

  it('should reject invalid segment type', () => {
    const invalidArgs = {
      segment: {
        type: 'INVALID_TYPE',
        name: 'Some Item',
      },
      notes: 'Some notes',
      priority: 'high',
    };

    const result = addToScratchpadArgsSchema.safeParse(invalidArgs);
    expect(result.success).toBe(false);
  });

  it('should handle optional tags array', () => {
    const argsWithTags = {
      segment: {
        type: 'ACTIVITY',
        name: 'Museum Visit',
      },
      notes: 'Rainy day backup activity',
      priority: 'medium' as const,
      tags: ['indoor', 'rainy-day', 'cultural'],
    };

    const argsWithoutTags = {
      segment: {
        type: 'ACTIVITY',
        name: 'Museum Visit',
      },
      notes: 'Rainy day backup activity',
      priority: 'medium' as const,
    };

    const resultWithTags = addToScratchpadArgsSchema.safeParse(argsWithTags);
    const resultWithoutTags = addToScratchpadArgsSchema.safeParse(argsWithoutTags);

    expect(resultWithTags.success).toBe(true);
    expect(resultWithoutTags.success).toBe(true);
  });
});
