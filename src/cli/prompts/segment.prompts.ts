/**
 * Segment-specific prompts
 * @module cli/prompts/segment.prompts
 */

import * as p from '@clack/prompts';
import type { SegmentId } from '../../domain/types/branded.js';
import type { SegmentStatus, SegmentType } from '../../domain/types/common.js';
import type { Segment } from '../../domain/types/segment.js';
import { handleCancel } from './common.prompts.js';

/**
 * Prompt for segment type selection
 * @returns Selected segment type
 */
export async function promptSegmentType(): Promise<SegmentType> {
  const type = await p.select({
    message: 'Select segment type:',
    options: [
      { value: 'FLIGHT', label: 'Flight' },
      { value: 'HOTEL', label: 'Hotel' },
      { value: 'MEETING', label: 'Meeting' },
      { value: 'ACTIVITY', label: 'Activity' },
      { value: 'TRANSFER', label: 'Transfer' },
      { value: 'CUSTOM', label: 'Custom' },
    ],
  });

  handleCancel(type);

  return type as SegmentType;
}

/**
 * Prompt for segment status
 * @returns Selected segment status
 */
export async function promptSegmentStatus(): Promise<SegmentStatus> {
  const status = await p.select({
    message: 'Segment status:',
    options: [
      { value: 'TENTATIVE', label: 'Tentative' },
      { value: 'CONFIRMED', label: 'Confirmed' },
      { value: 'WAITLISTED', label: 'Waitlisted' },
      { value: 'CANCELLED', label: 'Cancelled' },
      { value: 'COMPLETED', label: 'Completed' },
    ],
    initialValue: 'CONFIRMED',
  });

  handleCancel(status);

  return status as SegmentStatus;
}

/**
 * Select from a list of segments
 * @param segments - List of segments
 * @param message - Optional custom message
 * @returns Selected segment ID
 */
export async function promptSelectSegment(
  segments: Segment[],
  message?: string
): Promise<SegmentId> {
  const options = segments.map((segment, index) => ({
    value: segment.id,
    label: `${index + 1}. ${segment.type} - ${segment.startDatetime.toLocaleDateString()}`,
    hint: segment.id.slice(0, 8),
  }));

  const selected = await p.select({
    message: message || 'Select a segment:',
    options,
  });

  handleCancel(selected);

  return selected as SegmentId;
}
