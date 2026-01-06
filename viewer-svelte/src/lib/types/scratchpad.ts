/**
 * Scratchpad types for alternative segment recommendations
 */

import type { Segment } from '../types';

/**
 * Priority level for scratchpad items
 */
export type ScratchpadPriority = 'high' | 'medium' | 'low';

/**
 * Geography type - neighborhood, district, area, or region
 */
export type GeographyType = 'neighborhood' | 'district' | 'area' | 'region';

/**
 * Source of a scratchpad item
 */
export type ScratchpadSource = 'designer' | 'agent' | 'user';

/**
 * A geography recommendation (neighborhood, district, etc.)
 */
export interface GeographyRecommendation {
  /** Unique identifier */
  id: string;
  /** Name of the area (e.g., "Shibuya", "Shinjuku") */
  name: string;
  /** Type of geography */
  type: GeographyType;
  /** Parent city */
  city: string;
  /** Country (optional) */
  country?: string;
  /** Overview description */
  description: string;
  /** Key attractions, vibes */
  highlights: string[];
  /** What this area is best for (e.g., "Shopping", "Nightlife", "Food") */
  bestFor: string[];
  /** Source of this recommendation */
  source: ScratchpadSource;
  /** Why this was recommended */
  notes?: string;
  /** Priority level */
  priority: ScratchpadPriority;
  /** When it was added */
  addedAt: Date;
  /** Agent/source that added this */
  addedBy?: string;
}

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
 * Scratchpad containing alternative segment recommendations and geography
 */
export interface Scratchpad {
  /** All scratchpad items (segments) */
  items: ScratchpadItem[];
  /** Geography recommendations */
  geography: GeographyRecommendation[];
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
