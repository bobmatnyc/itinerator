/**
 * Itinerary delete command
 * @module cli/commands/itinerary/delete
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { createItineraryId, type ItineraryId } from '../../../domain/types/branded.js';
import { JsonItineraryStorage } from '../../../storage/json-storage.js';
import { printError, printSuccess } from '../../output/colors.js';
import { handleCancel } from '../../prompts/index.js';

export function deleteCommand(): Command {
  return new Command('delete')
    .description('Delete an itinerary')
    .argument('<id>', 'Itinerary ID')
    .option('-f, --force', 'Skip confirmation', false)
    .action(async (id, options) => {
      const storage = new JsonItineraryStorage();

      // Find by partial match
      const listResult = await storage.list();
      let itineraryId: string | undefined;
      let itineraryTitle = 'Unknown';

      if (listResult.success) {
        const match = listResult.value.find((s) => s.id.startsWith(id));
        if (match) {
          itineraryId = match.id;
          itineraryTitle = match.title;
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

      // Confirm deletion
      if (!options.force) {
        const confirm = await p.confirm({
          message: `Delete "${itineraryTitle}" (${itineraryId})?`,
        });
        handleCancel(confirm);
        if (!confirm) {
          p.cancel('Deletion cancelled');
          return;
        }
      }

      const result = await storage.delete(itineraryId as ItineraryId);

      if (!result.success) {
        printError(result.error.message);
        process.exit(1);
      }

      printSuccess(`Deleted: ${itineraryTitle}`);
    });
}
