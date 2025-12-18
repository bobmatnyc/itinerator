/**
 * Segment delete command
 * @module cli/commands/segment/delete
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { type SegmentId, createSegmentId } from '../../../domain/types/branded.js';
import { SegmentService } from '../../../services/segment.service.js';
import { WorkingContextService } from '../../../services/working-context.service.js';
import { ConfigStorage } from '../../../storage/config-storage.js';
import { JsonItineraryStorage } from '../../../storage/json-storage.js';
import { printError, printSuccess } from '../../output/colors.js';
import { handleCancel, promptSelectSegment } from '../../prompts/index.js';

export function deleteCommand(): Command {
  return new Command('delete')
    .alias('rm')
    .description('Delete a segment from working itinerary')
    .argument('[id]', 'Segment ID (interactive selection if not provided)')
    .option('-f, --force', 'Skip confirmation', false)
    .action(async (id, options) => {
      const storage = new JsonItineraryStorage();
      const configStorage = new ConfigStorage();
      await configStorage.initialize();
      const workingService = new WorkingContextService(configStorage, storage);
      const segmentService = new SegmentService(storage);

      // Get working itinerary
      const workingResult = await workingService.getWorkingItinerary();
      if (!workingResult.success || !workingResult.value) {
        printError('No working itinerary set');
        process.exit(1);
      }

      const itinerary = workingResult.value;

      if (itinerary.segments.length === 0) {
        p.note('No segments to delete');
        return;
      }

      // Get segment ID
      let segmentId: string | undefined;
      if (id) {
        // Find by partial match
        const match = itinerary.segments.find((s) => s.id.startsWith(id));
        if (match) {
          segmentId = match.id;
        } else {
          try {
            segmentId = createSegmentId(id);
          } catch (_error) {
            printError(`Invalid segment ID: ${id}`);
            process.exit(1);
          }
        }
      } else {
        // Interactive selection
        segmentId = await promptSelectSegment(itinerary.segments, 'Select segment to delete:');
      }

      // Confirm deletion
      if (!options.force) {
        const confirm = await p.confirm({
          message: 'Delete this segment?',
        });
        handleCancel(confirm);
        if (!confirm) {
          p.cancel('Deletion cancelled');
          return;
        }
      }

      const result = await segmentService.delete(itinerary.id, segmentId as SegmentId);

      if (!result.success) {
        printError(result.error.message);
        process.exit(1);
      }

      printSuccess('Segment deleted');
    });
}
