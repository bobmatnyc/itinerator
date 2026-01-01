/**
 * Segment list command
 * @module cli/commands/segment/list
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { WorkingContextService } from '../../../services/working-context.service.js';
import { ConfigStorage } from '../../../storage/config-storage.js';
import { JsonItineraryStorage } from '../../../storage/json-storage.js';
import { colors, printError } from '../../output/colors.js';
import { formatSegment } from '../../output/formatters.js';

export function listCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List segments in working itinerary')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const storage = new JsonItineraryStorage();
      const configStorage = new ConfigStorage();
      await configStorage.initialize();
      const workingService = new WorkingContextService(configStorage, storage);

      // Get working itinerary
      const workingResult = await workingService.getWorkingItinerary();
      if (!workingResult.success || !workingResult.value) {
        printError('No working itinerary set. Use "itinerator itinerary use <id>" first.');
        process.exit(1);
      }

      const itinerary = workingResult.value;

      if (itinerary.segments.length === 0) {
        p.note('No segments yet. Add one with "itinerator segment add"');
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(itinerary.segments, null, 2));
        return;
      }

      console.log(colors.heading('\nSegments\n'));
      for (let i = 0; i < itinerary.segments.length; i++) {
        const segment = itinerary.segments[i];
        if (segment) {
          console.log(formatSegment(segment, i + 1));
          if (i < itinerary.segments.length - 1) {
            console.log();
          }
        }
      }
      console.log();
    });
}
