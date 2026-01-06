/**
 * API route for validating and fixing segment times
 * GET: Returns validation issues for all segments
 * POST: Applies suggested fixes to segments with issues
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateItineraryTimes, getTimeValidationSummary, applyTimeFix } from '$lib/utils/time-validator';
import type { Segment } from '$lib/types';

/**
 * GET /api/v1/itineraries/[id]/validate-times
 * Validate all segment times in an itinerary
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const { itineraryService } = locals.services;
    const result = await itineraryService.getItinerary(params.id);

    if (result.err) {
      return json({ error: result.err.message }, { status: 404 });
    }

    const itinerary = result.ok;
    const issues = validateItineraryTimes(itinerary.segments);
    const summary = getTimeValidationSummary(issues);

    return json({
      issues: issues.map((issue) => ({
        segmentId: issue.segment.id,
        segmentType: issue.segment.type,
        segmentName: getSegmentName(issue.segment),
        currentTime: issue.segment.startDatetime,
        validation: issue.validation
      })),
      summary
    });
  } catch (error) {
    console.error('Error validating itinerary times:', error);
    return json(
      { error: 'Failed to validate itinerary times' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/v1/itineraries/[id]/validate-times
 * Apply suggested time fixes to segments
 * Body: { segmentIds?: string[], applyAll?: boolean }
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const { itineraryService } = locals.services;
    const result = await itineraryService.getItinerary(params.id);

    if (result.err) {
      return json({ error: result.err.message }, { status: 404 });
    }

    const itinerary = result.ok;
    const body = await request.json();
    const { segmentIds, applyAll = false } = body as { segmentIds?: string[], applyAll?: boolean };

    // Validate times
    const issues = validateItineraryTimes(itinerary.segments);

    if (issues.length === 0) {
      return json({ message: 'No time issues found', fixed: 0 });
    }

    // Determine which issues to fix
    const issuesToFix = applyAll
      ? issues
      : issues.filter(issue => segmentIds?.includes(issue.segment.id));

    if (issuesToFix.length === 0) {
      return json({ message: 'No matching segments to fix', fixed: 0 });
    }

    // Apply fixes
    let fixedCount = 0;
    for (const issue of issuesToFix) {
      if (issue.validation.suggestedTime) {
        const fixedSegment = applyTimeFix(issue.segment, issue.validation.suggestedTime);
        const updateResult = await itineraryService.updateSegment(
          params.id,
          issue.segment.id,
          fixedSegment
        );

        if (updateResult.ok) {
          fixedCount++;
        }
      }
    }

    return json({
      message: `Fixed ${fixedCount} segment${fixedCount === 1 ? '' : 's'}`,
      fixed: fixedCount,
      total: issuesToFix.length
    });
  } catch (error) {
    console.error('Error fixing segment times:', error);
    return json(
      { error: 'Failed to fix segment times' },
      { status: 500 }
    );
  }
};

/**
 * Helper to get segment name for display
 */
function getSegmentName(segment: Segment): string {
  switch (segment.type) {
    case 'FLIGHT':
      return `${segment.origin?.code || segment.origin?.name || 'Unknown'} → ${segment.destination?.code || segment.destination?.name || 'Unknown'}`;
    case 'HOTEL':
      return segment.property?.name || 'Hotel';
    case 'ACTIVITY':
      return segment.name || 'Activity';
    case 'TRANSFER':
      return `${segment.pickupLocation?.name || 'Pickup'} → ${segment.dropoffLocation?.name || 'Drop-off'}`;
    case 'MEETING':
      return segment.title || 'Meeting';
    case 'CUSTOM':
      return segment.title || 'Custom';
    default:
      return 'Unknown';
  }
}
