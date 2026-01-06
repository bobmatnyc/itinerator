/**
 * Utility functions for scratchpad operations
 * @module utils/scratchpad
 */

import { generateId } from '../core/id-generator.js';
import type { ItineraryId, SegmentId } from '../domain/types/branded.js';
import type { SegmentType } from '../domain/types/common.js';
import type { Itinerary } from '../domain/types/itinerary.js';
import type { Segment } from '../domain/types/segment.js';
import type {
  Scratchpad,
  ScratchpadByType,
  ScratchpadItem,
  ScratchpadItemId,
  ScratchpadPriority,
  ScratchpadSource,
  SwapResult,
} from '../domain/types/scratchpad.js';
import { SegmentType as SegmentTypeEnum } from '../domain/types/common.js';

/**
 * Options for adding an item to the scratchpad
 */
export interface AddToScratchpadOptions {
  /** Source of the recommendation */
  source: ScratchpadSource;
  /** Optional notes explaining the recommendation */
  notes?: string;
  /** Priority level */
  priority?: ScratchpadPriority;
  /** Tags for organization */
  tags?: string[];
  /** Related segment ID this could replace */
  relatedSegmentId?: SegmentId;
}

/**
 * Creates an empty scratchpad for an itinerary
 * @param itineraryId - The itinerary ID
 * @returns An empty scratchpad
 */
export function createEmptyScratchpad(itineraryId: ItineraryId): Scratchpad {
  return {
    itineraryId,
    items: [],
    byType: {
      [SegmentTypeEnum.FLIGHT]: [],
      [SegmentTypeEnum.HOTEL]: [],
      [SegmentTypeEnum.ACTIVITY]: [],
      [SegmentTypeEnum.TRANSFER]: [],
      [SegmentTypeEnum.MEETING]: [],
      [SegmentTypeEnum.CUSTOM]: [],
    },
  };
}

/**
 * Adds a segment to the scratchpad
 * @param itinerary - The itinerary to update
 * @param segment - The segment to add to scratchpad
 * @param options - Options for the scratchpad item
 * @returns Updated itinerary with the item added to scratchpad
 */
export function addToScratchpad(
  itinerary: Itinerary,
  segment: Segment,
  options: AddToScratchpadOptions
): Itinerary {
  // Initialize scratchpad if it doesn't exist
  const scratchpad = itinerary.scratchpad ?? createEmptyScratchpad(itinerary.id);

  // Create new scratchpad item
  const item: ScratchpadItem = {
    id: generateId() as ScratchpadItemId,
    itineraryId: itinerary.id,
    segment,
    addedAt: new Date(),
    source: options.source,
    ...(options.notes && { notes: options.notes }),
    ...(options.priority && { priority: options.priority }),
    tags: options.tags ?? [],
    ...(options.relatedSegmentId && { relatedSegmentId: options.relatedSegmentId }),
  };

  // Add to items list
  const updatedItems = [...scratchpad.items, item];

  // Update byType organization
  const updatedByType = { ...scratchpad.byType };
  updatedByType[segment.type] = [...updatedByType[segment.type], item];

  return {
    ...itinerary,
    scratchpad: {
      ...scratchpad,
      items: updatedItems,
      byType: updatedByType,
    },
    updatedAt: new Date(),
  };
}

/**
 * Removes an item from the scratchpad
 * @param itinerary - The itinerary to update
 * @param itemId - The scratchpad item ID to remove
 * @returns Updated itinerary with the item removed
 * @throws Error if scratchpad doesn't exist or item not found
 */
export function removeFromScratchpad(
  itinerary: Itinerary,
  itemId: ScratchpadItemId
): Itinerary {
  if (!itinerary.scratchpad) {
    throw new Error('Scratchpad does not exist on this itinerary');
  }

  const item = itinerary.scratchpad.items.find((i) => i.id === itemId);
  if (!item) {
    throw new Error(`Scratchpad item ${itemId} not found`);
  }

  // Remove from items list
  const updatedItems = itinerary.scratchpad.items.filter((i) => i.id !== itemId);

  // Remove from byType organization
  const updatedByType = { ...itinerary.scratchpad.byType };
  updatedByType[item.segment.type] = updatedByType[item.segment.type].filter(
    (i) => i.id !== itemId
  );

  return {
    ...itinerary,
    scratchpad: {
      ...itinerary.scratchpad,
      items: updatedItems,
      byType: updatedByType,
    },
    updatedAt: new Date(),
  };
}

/**
 * Gets scratchpad items by segment type
 * @param scratchpad - The scratchpad to query
 * @param type - The segment type to filter by
 * @returns Array of scratchpad items for that type
 */
export function getByType(
  scratchpad: Scratchpad | undefined,
  type: SegmentType
): ScratchpadItem[] {
  if (!scratchpad) {
    return [];
  }
  return scratchpad.byType[type] ?? [];
}

/**
 * Gets all scratchpad items for a specific tag
 * @param scratchpad - The scratchpad to query
 * @param tag - The tag to filter by
 * @returns Array of scratchpad items with that tag
 */
export function getByTag(
  scratchpad: Scratchpad | undefined,
  tag: string
): ScratchpadItem[] {
  if (!scratchpad) {
    return [];
  }
  return scratchpad.items.filter((item) => item.tags.includes(tag));
}

/**
 * Gets all scratchpad items for a specific priority
 * @param scratchpad - The scratchpad to query
 * @param priority - The priority level to filter by
 * @returns Array of scratchpad items with that priority
 */
export function getByPriority(
  scratchpad: Scratchpad | undefined,
  priority: ScratchpadPriority
): ScratchpadItem[] {
  if (!scratchpad) {
    return [];
  }
  return scratchpad.items.filter((item) => item.priority === priority);
}

/**
 * Gets scratchpad items related to a specific segment
 * @param scratchpad - The scratchpad to query
 * @param segmentId - The segment ID to find related items for
 * @returns Array of scratchpad items related to that segment
 */
export function getRelatedItems(
  scratchpad: Scratchpad | undefined,
  segmentId: SegmentId
): ScratchpadItem[] {
  if (!scratchpad) {
    return [];
  }
  return scratchpad.items.filter((item) => item.relatedSegmentId === segmentId);
}

/**
 * Swaps a scratchpad item with an existing segment in the itinerary
 * Removes the existing segment, adds the scratchpad segment, and removes the scratchpad item
 * @param itinerary - The itinerary to update
 * @param scratchpadItemId - The scratchpad item ID to swap in
 * @param existingSegmentId - The existing segment ID to replace
 * @returns Updated itinerary and swap result details
 * @throws Error if scratchpad doesn't exist, item not found, or segment not found
 */
export function swapSegment(
  itinerary: Itinerary,
  scratchpadItemId: ScratchpadItemId,
  existingSegmentId: SegmentId
): { itinerary: Itinerary; result: SwapResult } {
  if (!itinerary.scratchpad) {
    throw new Error('Scratchpad does not exist on this itinerary');
  }

  // Find scratchpad item
  const scratchpadItem = itinerary.scratchpad.items.find((i) => i.id === scratchpadItemId);
  if (!scratchpadItem) {
    throw new Error(`Scratchpad item ${scratchpadItemId} not found`);
  }

  // Find existing segment
  const existingSegmentIndex = itinerary.segments.findIndex(
    (s) => s.id === existingSegmentId
  );
  if (existingSegmentIndex === -1) {
    throw new Error(`Segment ${existingSegmentId} not found in itinerary`);
  }

  const removedSegment = itinerary.segments[existingSegmentIndex];

  // Create new segments array with the swap
  const updatedSegments = [...itinerary.segments];
  updatedSegments[existingSegmentIndex] = scratchpadItem.segment;

  // Remove item from scratchpad
  const updatedScratchpadItems = itinerary.scratchpad.items.filter(
    (i) => i.id !== scratchpadItemId
  );

  // Update byType organization
  const updatedByType = { ...itinerary.scratchpad.byType };
  updatedByType[scratchpadItem.segment.type] = updatedByType[
    scratchpadItem.segment.type
  ].filter((i) => i.id !== scratchpadItemId);

  const result: SwapResult = {
    removedSegment,
    addedSegment: scratchpadItem.segment,
    scratchpadItem,
  };

  const updatedItinerary: Itinerary = {
    ...itinerary,
    segments: updatedSegments,
    scratchpad: {
      ...itinerary.scratchpad,
      items: updatedScratchpadItems,
      byType: updatedByType,
    },
    updatedAt: new Date(),
  };

  return { itinerary: updatedItinerary, result };
}

/**
 * Rebuilds the byType index from the items array
 * Useful for fixing inconsistencies or after bulk operations
 * @param scratchpad - The scratchpad to rebuild
 * @returns Scratchpad with rebuilt byType index
 */
export function rebuildByTypeIndex(scratchpad: Scratchpad): Scratchpad {
  const byType: ScratchpadByType = {
    [SegmentTypeEnum.FLIGHT]: [],
    [SegmentTypeEnum.HOTEL]: [],
    [SegmentTypeEnum.ACTIVITY]: [],
    [SegmentTypeEnum.TRANSFER]: [],
    [SegmentTypeEnum.MEETING]: [],
    [SegmentTypeEnum.CUSTOM]: [],
  };

  for (const item of scratchpad.items) {
    byType[item.segment.type].push(item);
  }

  return {
    ...scratchpad,
    byType,
  };
}

/**
 * Counts scratchpad items by type
 * @param scratchpad - The scratchpad to analyze
 * @returns Object with counts for each type
 */
export function countByType(
  scratchpad: Scratchpad | undefined
): Record<SegmentType, number> {
  if (!scratchpad) {
    return {
      [SegmentTypeEnum.FLIGHT]: 0,
      [SegmentTypeEnum.HOTEL]: 0,
      [SegmentTypeEnum.ACTIVITY]: 0,
      [SegmentTypeEnum.TRANSFER]: 0,
      [SegmentTypeEnum.MEETING]: 0,
      [SegmentTypeEnum.CUSTOM]: 0,
    };
  }

  return {
    [SegmentTypeEnum.FLIGHT]: scratchpad.byType[SegmentTypeEnum.FLIGHT].length,
    [SegmentTypeEnum.HOTEL]: scratchpad.byType[SegmentTypeEnum.HOTEL].length,
    [SegmentTypeEnum.ACTIVITY]: scratchpad.byType[SegmentTypeEnum.ACTIVITY].length,
    [SegmentTypeEnum.TRANSFER]: scratchpad.byType[SegmentTypeEnum.TRANSFER].length,
    [SegmentTypeEnum.MEETING]: scratchpad.byType[SegmentTypeEnum.MEETING].length,
    [SegmentTypeEnum.CUSTOM]: scratchpad.byType[SegmentTypeEnum.CUSTOM].length,
  };
}
