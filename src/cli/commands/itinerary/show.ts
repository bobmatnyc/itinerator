/**
 * Itinerary show command
 * @module cli/commands/itinerary/show
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { createItineraryId, type ItineraryId } from '../../../domain/types/branded.js';
import { WorkingContextService } from '../../../services/working-context.service.js';
import { ConfigStorage } from '../../../storage/config-storage.js';
import { JsonItineraryStorage } from '../../../storage/json-storage.js';
import { printError } from '../../output/colors.js';
import { formatItinerary } from '../../output/formatters.js';

export function showCommand(): Command {
  return new Command('show')
    .description('Show itinerary details')
    .argument('[id]', 'Itinerary ID (uses working itinerary if not specified)')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      const storage = new JsonItineraryStorage();
      const configStorage = new ConfigStorage();
      await configStorage.initialize();
      const workingService = new WorkingContextService(configStorage, storage);

      let itineraryId: string | undefined;

      if (id) {
        // Find by partial ID match
        const listResult = await storage.list();
        if (listResult.success) {
          const match = listResult.value.find((s) => s.id.startsWith(id));
          if (match) {
            itineraryId = match.id;
          }
        }
        if (!itineraryId) {
          try {
            itineraryId = createItineraryId(id);
          } catch (_error) {
            printError(`Invalid itinerary ID: ${id}`);
            process.exit(1);
          }
        }
      } else {
        // Use working itinerary
        const workingResult = await workingService.getWorkingItinerary();
        if (!workingResult.success) {
          printError(workingResult.error.message);
          process.exit(1);
        }
        if (!workingResult.value) {
          p.note('No working itinerary set. Provide an ID or use "itinerizer itinerary use <id>"');
          process.exit(1);
        }
        itineraryId = workingResult.value.id;
      }

      const result = await storage.load(itineraryId as ItineraryId);

      if (!result.success) {
        printError(result.error.message);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(result.value, null, 2));
        return;
      }

      console.log(formatItinerary(result.value));
    });
}
