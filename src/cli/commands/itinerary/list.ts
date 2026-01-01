/**
 * Itinerary list command
 * @module cli/commands/itinerary/list
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { JsonItineraryStorage } from '../../../storage/json-storage.js';
import { colors, printError } from '../../output/colors.js';
import { formatItinerarySummary } from '../../output/formatters.js';

export function listCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List all itineraries')
    .option('--status <status>', 'Filter by status')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const storage = new JsonItineraryStorage();
      const result = await storage.list();

      if (!result.success) {
        printError(result.error.message);
        process.exit(1);
      }

      let summaries = result.value;

      // Filter by status if provided
      if (options.status) {
        summaries = summaries.filter((s) => s.status === options.status.toUpperCase());
      }

      if (summaries.length === 0) {
        p.note('No itineraries found. Create one with "itinerator itinerary create"');
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(summaries, null, 2));
        return;
      }

      console.log(colors.heading('\nItineraries\n'));
      for (let i = 0; i < summaries.length; i++) {
        const summary = summaries[i];
        if (summary) {
          console.log(formatItinerarySummary(summary, i + 1));
        }
      }
      console.log();
    });
}
