/**
 * Itinerary use command (set working itinerary)
 * @module cli/commands/itinerary/use
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { type ItineraryId, createItineraryId } from '../../../domain/types/branded.js';
import { WorkingContextService } from '../../../services/working-context.service.js';
import { ConfigStorage } from '../../../storage/config-storage.js';
import { JsonItineraryStorage } from '../../../storage/json-storage.js';
import { printError, printSuccess } from '../../output/colors.js';

export function useCommand(): Command {
  return new Command('use')
    .description('Set working itinerary')
    .argument('<id>', 'Itinerary ID (can be partial)')
    .action(async (id) => {
      const storage = new JsonItineraryStorage();
      const configStorage = new ConfigStorage();
      await configStorage.initialize();
      const workingService = new WorkingContextService(configStorage, storage);

      // Find by partial ID match
      const listResult = await storage.list();
      let itineraryId: string | undefined;

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

      const result = await workingService.setWorkingItinerary(itineraryId as ItineraryId);

      if (!result.success) {
        printError(result.error.message);
        process.exit(1);
      }

      printSuccess(`Working itinerary set to: ${result.value.title}`);
      p.note(`ID: ${itineraryId}`, 'Working Itinerary');
    });
}
