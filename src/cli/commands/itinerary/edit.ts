/**
 * Itinerary edit command
 * @module cli/commands/itinerary/edit
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { createItineraryId, type ItineraryId } from '../../../domain/types/branded.js';
import type { Itinerary } from '../../../domain/types/itinerary.js';
import { ItineraryService } from '../../../services/itinerary.service.js';
import { WorkingContextService } from '../../../services/working-context.service.js';
import { ConfigStorage } from '../../../storage/config-storage.js';
import { JsonItineraryStorage } from '../../../storage/json-storage.js';
import { colors, printError, printSuccess } from '../../output/colors.js';
import { formatDateRange, formatItinerary } from '../../output/formatters.js';
import { handleCancel, promptDate, promptOptionalText, promptText } from '../../prompts/index.js';

export function editCommand(): Command {
  return new Command('edit')
    .description('Edit itinerary properties')
    .argument('[id]', 'Itinerary ID (uses working if not specified)')
    .action(async (id) => {
      p.intro(colors.heading('Edit Itinerary'));

      const storage = new JsonItineraryStorage();
      const configStorage = new ConfigStorage();
      await configStorage.initialize();
      const service = new ItineraryService(storage);
      const workingService = new WorkingContextService(configStorage, storage);

      // Get itinerary
      let itinerary: Itinerary | undefined;
      if (id) {
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

        const result = await service.get(itineraryId as ItineraryId);
        if (!result.success) {
          printError(result.error.message);
          process.exit(1);
        }
        itinerary = result.value;
      } else {
        const result = await workingService.getWorkingItinerary();
        if (!result.success || !result.value) {
          printError('No working itinerary set');
          process.exit(1);
        }
        itinerary = result.value;
      }

      // Show current values and prompt for changes
      const field = await p.select({
        message: 'What would you like to edit?',
        options: [
          { value: 'title', label: `Title (${itinerary.title})` },
          {
            value: 'description',
            label: `Description (${itinerary.description || 'none'})`,
          },
          { value: 'status', label: `Status (${itinerary.status})` },
          {
            value: 'dates',
            label: `Dates (${formatDateRange(itinerary.startDate, itinerary.endDate)})`,
          },
          {
            value: 'tripType',
            label: `Trip Type (${itinerary.tripType || 'none'})`,
          },
        ],
      });
      handleCancel(field);

      // Prompt for new value based on field
      let updates = {};
      switch (field) {
        case 'title': {
          const title = await promptText('New title:', undefined, itinerary.title);
          updates = { title };
          break;
        }
        case 'description': {
          const description = await promptOptionalText(
            'New description:',
            undefined,
            itinerary.description
          );
          updates = { description };
          break;
        }
        case 'status': {
          const status = await p.select({
            message: 'New status:',
            options: [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PLANNED', label: 'Planned' },
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ],
          });
          handleCancel(status);
          updates = { status };
          break;
        }
        case 'dates': {
          const startDate = await promptDate('New start date:');
          const endDate = await promptDate('New end date:');

          if (endDate <= startDate) {
            p.cancel('End date must be after start date');
            process.exit(1);
          }

          updates = { startDate, endDate };
          break;
        }
        case 'tripType': {
          const tripType = await p.select({
            message: 'New trip type:',
            options: [
              { value: undefined, label: 'None' },
              { value: 'LEISURE', label: 'Leisure' },
              { value: 'BUSINESS', label: 'Business' },
              { value: 'MIXED', label: 'Mixed' },
            ],
          });
          handleCancel(tripType);
          updates = { tripType };
          break;
        }
      }

      const result = await service.update(itinerary.id, updates);

      if (!result.success) {
        printError(result.error.message);
        process.exit(1);
      }

      printSuccess('Itinerary updated!');
      console.log(formatItinerary(result.value));
    });
}
