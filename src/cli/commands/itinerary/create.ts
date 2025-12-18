/**
 * Itinerary create command
 * @module cli/commands/itinerary/create
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { ItineraryService } from '../../../services/itinerary.service.js';
import { WorkingContextService } from '../../../services/working-context.service.js';
import { ConfigStorage } from '../../../storage/config-storage.js';
import { JsonItineraryStorage } from '../../../storage/json-storage.js';
import { colors, printError, printSuccess } from '../../output/colors.js';
import { formatItinerary } from '../../output/formatters.js';
import { promptAddTraveler, promptConfirm, promptCreateItinerary } from '../../prompts/index.js';

export function createCommand(): Command {
  return new Command('create')
    .description('Create a new itinerary')
    .option('-t, --title <title>', 'Itinerary title')
    .option('--start <date>', 'Start date (YYYY-MM-DD)')
    .option('--end <date>', 'End date (YYYY-MM-DD)')
    .option('--type <type>', 'Trip type (LEISURE, BUSINESS, MIXED)')
    .option('--set-working', 'Set as working itinerary', false)
    .action(async (options) => {
      p.intro(colors.heading('Create Itinerary'));

      // Use options or prompt interactively
      let input: {
        title: string;
        startDate: Date;
        endDate: Date;
        description?: string;
        tripType?: string;
      };
      if (options.title && options.start && options.end) {
        input = {
          title: options.title,
          startDate: new Date(options.start),
          endDate: new Date(options.end),
          tripType: options.type,
        };
      } else {
        input = await promptCreateItinerary();
      }

      // Add at least one traveler
      const travelers = [];
      const addTraveler = await promptConfirm('Add a traveler now?');
      if (addTraveler) {
        travelers.push(await promptAddTraveler());
      }

      // Create itinerary
      const storage = new JsonItineraryStorage();
      await storage.initialize();
      const service = new ItineraryService(storage);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await service.create({ ...input, travelers } as any);

      if (!result.success) {
        printError(result.error.message);
        process.exit(1);
      }

      printSuccess('Itinerary created!');
      console.log(formatItinerary(result.value));

      // Set as working if requested
      if (options.setWorking) {
        const configStorage = new ConfigStorage();
        await configStorage.initialize();
        const workingService = new WorkingContextService(configStorage, storage);
        await workingService.setWorkingItinerary(result.value.id);
        printSuccess('Set as working itinerary');
      }

      p.outro(`ID: ${result.value.id}`);
    });
}
