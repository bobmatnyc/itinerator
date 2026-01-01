/**
 * Segment move command
 * @module cli/commands/segment/move
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { type SegmentId, createSegmentId } from '../../../domain/types/branded.js';
import {
  isActivitySegment,
  isCustomSegment,
  isFlightSegment,
  isHotelSegment,
  isMeetingSegment,
} from '../../../domain/types/segment.js';
import { DependencyService } from '../../../services/dependency.service.js';
import { WorkingContextService } from '../../../services/working-context.service.js';
import { ConfigStorage } from '../../../storage/config-storage.js';
import { JsonItineraryStorage } from '../../../storage/json-storage.js';
import { colors, printError, printSuccess, printWarning } from '../../output/colors.js';
import { formatDateRange, formatSegment } from '../../output/formatters.js';
import { handleCancel, promptConfirm } from '../../prompts/common.prompts.js';
import { promptSelectSegment } from '../../prompts/segment.prompts.js';

export function moveCommand(): Command {
  return new Command('move')
    .description('Move a segment (adjusts dependent segments)')
    .argument('[segment-id]', 'Segment ID to move')
    .option('--by <minutes>', 'Time shift in minutes (positive=later, negative=earlier)')
    .option('--to <datetime>', 'New start datetime (YYYY-MM-DD HH:mm)')
    .option('--preview', 'Preview changes without applying', false)
    .action(async (segmentIdArg, options) => {
      p.intro(colors.heading('Move Segment'));

      // Get working itinerary
      const storage = new JsonItineraryStorage();
      const configStorage = new ConfigStorage();
      await configStorage.initialize();
      const dependencyService = new DependencyService();
      const workingService = new WorkingContextService(configStorage, storage);

      const workingResult = await workingService.getWorkingItinerary();
      if (!workingResult.success || !workingResult.value) {
        printError('No working itinerary set. Use "itinerator itinerary use <id>" first.');
        process.exit(1);
      }

      const itinerary = workingResult.value;

      if (itinerary.segments.length === 0) {
        p.note('No segments in this itinerary');
        return;
      }

      // Get segment to move
      let segmentId: SegmentId;
      if (segmentIdArg) {
        // Find by partial match
        const match = itinerary.segments.find((s) => s.id.startsWith(segmentIdArg));
        segmentId = match ? match.id : createSegmentId(segmentIdArg);
      } else {
        segmentId = await promptSelectSegment(itinerary.segments, 'Select segment to move:');
      }

      const segment = itinerary.segments.find((s) => s.id === segmentId);
      if (!segment) {
        printError(`Segment not found: ${segmentId}`);
        process.exit(1);
      }

      console.log('\nCurrent segment:');
      console.log(formatSegment(segment, 1));

      // Calculate time delta
      let timeDeltaMs: number;

      if (options.by) {
        timeDeltaMs = Number.parseInt(options.by, 10) * 60 * 1000;
      } else if (options.to) {
        const newStart = new Date(options.to);
        if (Number.isNaN(newStart.getTime())) {
          printError('Invalid datetime format. Use YYYY-MM-DD HH:mm');
          process.exit(1);
        }
        timeDeltaMs = newStart.getTime() - segment.startDatetime.getTime();
      } else {
        // Interactive: ask for shift
        const shiftType = await p.select({
          message: 'How would you like to move it?',
          options: [
            { value: 'later', label: 'Later (delay)' },
            { value: 'earlier', label: 'Earlier (advance)' },
            { value: 'specific', label: 'To specific time' },
          ],
        });
        handleCancel(shiftType);

        if (shiftType === 'specific') {
          const newStartStr = await p.text({
            message: 'New start time (YYYY-MM-DD HH:mm):',
            placeholder: segment.startDatetime.toISOString().slice(0, 16).replace('T', ' '),
          });
          handleCancel(newStartStr);
          const newStart = new Date(newStartStr as string);
          timeDeltaMs = newStart.getTime() - segment.startDatetime.getTime();
        } else {
          const minutesStr = await p.text({
            message: 'By how many minutes?',
            placeholder: '60',
            validate: (v) => {
              const n = Number.parseInt(v, 10);
              return Number.isNaN(n) || n <= 0 ? 'Enter a positive number' : undefined;
            },
          });
          handleCancel(minutesStr);
          const minutes = Number.parseInt(minutesStr as string, 10);
          timeDeltaMs = shiftType === 'earlier' ? -minutes * 60 * 1000 : minutes * 60 * 1000;
        }
      }

      // Calculate affected segments
      const adjustResult = dependencyService.adjustDependentSegments(
        itinerary.segments,
        segmentId,
        timeDeltaMs
      );

      if (!adjustResult.success) {
        printError(adjustResult.error.message);
        process.exit(1);
      }

      // Find which segments changed
      const changedSegments = adjustResult.value.filter((newSeg) => {
        const oldSeg = itinerary.segments.find((s) => s.id === newSeg.id);
        return oldSeg && oldSeg.startDatetime.getTime() !== newSeg.startDatetime.getTime();
      });

      // Show preview
      if (changedSegments.length > 0) {
        console.log(colors.heading('\nAffected segments:'));
        for (const seg of changedSegments) {
          const oldSeg = itinerary.segments.find((s) => s.id === seg.id);
          if (!oldSeg) continue;

          const shiftMin = Math.round(
            (seg.startDatetime.getTime() - oldSeg.startDatetime.getTime()) / 60000
          );
          const shiftDir = shiftMin > 0 ? 'later' : 'earlier';

          // Get segment name based on type
          let segmentName: string;
          if (isFlightSegment(seg)) {
            segmentName = seg.flightNumber || 'Flight';
          } else if (isHotelSegment(seg)) {
            segmentName = seg.property?.name || 'Hotel';
          } else if (isMeetingSegment(seg)) {
            segmentName = seg.title || 'Meeting';
          } else if (isActivitySegment(seg)) {
            segmentName = seg.name || 'Activity';
          } else if (isCustomSegment(seg)) {
            segmentName = seg.title || 'Custom';
          } else {
            segmentName = 'Transfer';
          }

          console.log(`  ${colors.info('→')} ${segmentName}`);
          console.log(
            `    ${colors.dim(formatDateRange(oldSeg.startDatetime, oldSeg.endDatetime))} → ${formatDateRange(seg.startDatetime, seg.endDatetime)}`
          );
          console.log(`    ${colors.dim(`(${Math.abs(shiftMin)} min ${shiftDir})`)}`);
        }
      } else {
        p.note('No dependent segments will be affected');
      }

      // Validate no conflicts
      const conflictResult = dependencyService.validateNoConflicts(adjustResult.value);
      if (!conflictResult.success) {
        printWarning(`Warning: ${conflictResult.error.message}`);
      }

      if (options.preview) {
        p.outro('Preview complete (no changes applied)');
        return;
      }

      // Confirm
      const proceed = await promptConfirm(`Apply changes to ${changedSegments.length} segment(s)?`);
      if (!proceed) {
        p.cancel('Move cancelled');
        return;
      }

      // Apply changes
      const spinner = p.spinner();
      spinner.start('Moving segments...');

      // Save the adjusted itinerary
      const updatedItinerary = {
        ...itinerary,
        segments: adjustResult.value,
        updatedAt: new Date(),
      };

      const saveResult = await storage.save(updatedItinerary);

      if (!saveResult.success) {
        spinner.stop('Failed to save changes');
        printError(saveResult.error.message);
        process.exit(1);
      }

      spinner.stop('Segments moved!');
      printSuccess(`Moved ${changedSegments.length} segment(s)`);

      p.outro('Done');
    });
}
