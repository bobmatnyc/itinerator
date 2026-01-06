/**
 * Scratchpad types for alternative segment recommendations
 */

import type { Segment } from '../types';

/**
 * Priority level for scratchpad items
 */
export type ScratchpadPriority = 'high' | 'medium' | 'low';

/**
 * A scratchpad item containing a segment recommendation
 */
export interface ScratchpadItem {
  /** Unique identifier for this scratchpad item */
  id: string;
  /** The recommended segment */
  segment: Segment;
  /** Why this was recommended */
  reason?: string;
  /** Priority level */
  priority: ScratchpadPriority;
  /** When it was added to scratchpad */
  addedAt: Date;
  /** Agent/source that added this */
  addedBy?: string;
}

/**
 * Scratchpad containing alternative segment recommendations
 */
export interface Scratchpad {
  /** All scratchpad items */
  items: ScratchpadItem[];
  /** When scratchpad was created */
  createdAt: Date;
  /** When scratchpad was last updated */
  updatedAt: Date;
}

/**
 * Get items by segment type
 */
export function getItemsByType(scratchpad: Scratchpad, type: Segment['type']): ScratchpadItem[] {
  return scratchpad.items.filter((item) => item.segment.type === type);
}

/**
 * Get count of items by type
 */
export function getCountByType(scratchpad: Scratchpad, type: Segment['type']): number {
  return getItemsByType(scratchpad, type).length;
}
