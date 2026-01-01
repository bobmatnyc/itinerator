/**
 * Knowledge ingest command
 * @module cli/commands/knowledge/ingest
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { createItineraryStorage } from '../../../storage/index.js';
import { WeaviateKnowledgeService } from '../../../services/weaviate-knowledge.service.js';
import { WeaviateStorage } from '../../../storage/weaviate-storage.js';
import { colors, printError, printSuccess, printWarning, printInfo } from '../../output/colors.js';
import type { Itinerary } from '../../../domain/types/itinerary.js';
import type { ItineraryId } from '../../../domain/types/branded.js';
import type { RawKnowledge } from '../../../services/weaviate-knowledge.service.js';
import {
  isHotelSegment,
  isActivitySegment,
  isFlightSegment,
  isMeetingSegment,
} from '../../../domain/types/segment.js';

/**
 * Extract knowledge items from an itinerary
 */
function extractKnowledgeFromItinerary(itinerary: Itinerary): RawKnowledge[] {
  const items: RawKnowledge[] = [];

  // Extract destination knowledge
  for (const dest of itinerary.destinations) {
    items.push({
      content: `Travel destination: ${dest.name}${dest.address ? `, ${dest.address}` : ''}`,
      category: 'destination',
      country: dest.country,
    });
  }

  // Extract segment knowledge
  for (const segment of itinerary.segments) {
    // Skip inferred segments (auto-generated gaps)
    if (segment.inferred) {
      continue;
    }

    if (isHotelSegment(segment)) {
      const hotelInfo = [
        `Hotel: ${segment.property.name}`,
        segment.location.name,
        segment.roomType,
        segment.boardBasis,
        segment.notes,
      ]
        .filter(Boolean)
        .join(' | ');

      items.push({
        content: hotelInfo,
        category: 'tip',
        subcategory: 'accommodation',
        country: segment.location.country,
      });
    } else if (isActivitySegment(segment)) {
      const activityInfo = [
        `Activity: ${segment.name}`,
        segment.location.name,
        segment.category,
        segment.description,
        segment.notes,
      ]
        .filter(Boolean)
        .join(' | ');

      items.push({
        content: activityInfo,
        category: 'activity',
        subcategory: segment.category,
        country: segment.location.country,
      });
    } else if (isFlightSegment(segment)) {
      // Extract flight notes if they contain useful travel tips
      if (segment.notes && segment.notes.length > 20) {
        items.push({
          content: `Flight tip (${segment.origin.code} → ${segment.destination.code}): ${segment.notes}`,
          category: 'tip',
          subcategory: 'flight',
          country: segment.destination.country,
        });
      }
    } else if (isMeetingSegment(segment)) {
      // Extract meeting location and context (useful for business travel)
      const meetingInfo = [
        `Meeting venue: ${segment.title}`,
        segment.location.name,
        segment.notes,
      ]
        .filter(Boolean)
        .join(' | ');

      items.push({
        content: meetingInfo,
        category: 'tip',
        subcategory: 'venue',
        country: segment.location.country,
      });
    }
  }

  return items;
}

/**
 * Ingest command implementation
 */
export function ingestCommand(): Command {
  return new Command('ingest')
    .description('Bulk ingest itineraries into the knowledge base')
    .option('--all', 'Ingest all itineraries')
    .option('--id <id>', 'Ingest specific itinerary by ID')
    .option('--dry-run', 'Preview what would be ingested without storing')
    .option('--verbose', 'Show detailed output')
    .action(async (options) => {
      // Validate options
      if (!options.all && !options.id) {
        printError('Must specify either --all or --id <id>');
        process.exit(1);
      }

      // Check for Weaviate configuration
      if (!process.env.WEAVIATE_URL || !process.env.WEAVIATE_API_KEY) {
        printError('Weaviate not configured. Set WEAVIATE_URL and WEAVIATE_API_KEY');
        printInfo('Run "itinerator setup" to configure Weaviate');
        process.exit(1);
      }

      const storage = createItineraryStorage();
      const weaviateStorage = new WeaviateStorage({
        url: process.env.WEAVIATE_URL,
        apiKey: process.env.WEAVIATE_API_KEY,
        openaiKey: process.env.OPENAI_API_KEY,
      });

      const knowledgeService = new WeaviateKnowledgeService(weaviateStorage);

      // Initialize services
      const initResult = await knowledgeService.initialize();
      if (!initResult.success) {
        printError(`Failed to initialize knowledge service: ${initResult.error.message}`);
        process.exit(1);
      }

      // Determine which itineraries to process
      let itineraryIds: ItineraryId[] = [];

      if (options.all) {
        const listResult = await storage.list();
        if (!listResult.success) {
          printError(`Failed to list itineraries: ${listResult.error.message}`);
          process.exit(1);
        }
        itineraryIds = listResult.value.map((s) => s.id);
        printInfo(`Found ${itineraryIds.length} itineraries`);
      } else if (options.id) {
        itineraryIds = [options.id as ItineraryId];
      }

      if (itineraryIds.length === 0) {
        printWarning('No itineraries to ingest');
        return;
      }

      // Process each itinerary
      let totalProcessed = 0;
      let totalKnowledgeItems = 0;
      let totalErrors = 0;

      const spinner = p.spinner();
      spinner.start('Ingesting itineraries...');

      for (const id of itineraryIds) {
        try {
          // Load itinerary
          const loadResult = await storage.load(id);
          if (!loadResult.success) {
            if (options.verbose) {
              printWarning(`Skipping ${id}: ${loadResult.error.message}`);
            }
            totalErrors++;
            continue;
          }

          const itinerary = loadResult.value;

          // Extract knowledge
          const knowledgeItems = extractKnowledgeFromItinerary(itinerary);

          if (options.dryRun) {
            // Preview mode
            console.log(`\n${colors.heading(itinerary.title)} (${id.slice(0, 8)})`);
            console.log(`  Would extract ${knowledgeItems.length} knowledge items:`);
            for (const item of knowledgeItems.slice(0, 5)) {
              console.log(`    • ${colors.dim(item.category)}: ${item.content.slice(0, 80)}`);
            }
            if (knowledgeItems.length > 5) {
              console.log(`    ... and ${knowledgeItems.length - 5} more`);
            }
          } else {
            // Store knowledge
            for (const item of knowledgeItems) {
              const storeResult = await knowledgeService.storeKnowledge(item, {
                itinerary,
                destinationName: itinerary.destinations[0]?.name,
                travelers: itinerary.travelers.length,
                travelDate: itinerary.startDate,
              });

              if (!storeResult.success) {
                if (options.verbose) {
                  printWarning(
                    `Failed to store knowledge for ${id}: ${storeResult.error.message}`
                  );
                }
                totalErrors++;
              } else {
                totalKnowledgeItems++;
              }
            }

            if (options.verbose) {
              printSuccess(`${itinerary.title}: ${knowledgeItems.length} items`);
            }
          }

          totalProcessed++;
        } catch (error) {
          if (options.verbose) {
            printError(`Error processing ${id}: ${error instanceof Error ? error.message : String(error)}`);
          }
          totalErrors++;
        }
      }

      spinner.stop('Ingestion complete');

      // Print summary
      console.log();
      if (options.dryRun) {
        printInfo(
          `Dry run: Would ingest ${totalKnowledgeItems} knowledge items from ${totalProcessed} itineraries`
        );
      } else {
        printSuccess(
          `Ingested ${totalKnowledgeItems} knowledge items from ${totalProcessed} itineraries`
        );
      }

      if (totalErrors > 0) {
        printWarning(`Encountered ${totalErrors} errors`);
      }
    });
}
