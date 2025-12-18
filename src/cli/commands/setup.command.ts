/**
 * Setup command - Initialize itinerizer configuration
 * @module cli/commands/setup
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { ConfigStorage } from '../../storage/config-storage.js';
import { JsonItineraryStorage } from '../../storage/json-storage.js';
import { colors, printError, printSuccess } from '../output/index.js';

/**
 * Create the setup command
 * @returns Commander command instance
 */
export function setupCommand(): Command {
  return new Command('setup')
    .description('Initialize itinerizer configuration')
    .option('--data-dir <path>', 'Data directory path', './data/itineraries')
    .option('--force', 'Force re-initialization', false)
    .action(async (options: { dataDir: string; force: boolean }) => {
      p.intro(colors.heading('Itinerizer Setup'));

      const spinner = p.spinner();
      spinner.start('Initializing storage...');

      try {
        // Initialize storage
        const storage = new JsonItineraryStorage(options.dataDir);
        const initResult = await storage.initialize();

        if (!initResult.success) {
          spinner.stop('Failed to initialize storage');
          printError(initResult.error.message);
          process.exit(1);
        }

        // Initialize config
        const config = new ConfigStorage();
        const configResult = await config.initialize();

        if (!configResult.success) {
          spinner.stop('Failed to initialize config');
          printError(configResult.error.message);
          process.exit(1);
        }

        spinner.stop('Storage initialized');
        printSuccess('Itinerizer is ready to use!');

        p.note(
          `Data directory: ${options.dataDir}\nConfig: .itinerizer/config.json`,
          'Configuration'
        );

        p.outro('Run "itinerizer itinerary create" to create your first itinerary');
      } catch (error) {
        spinner.stop('Setup failed');
        printError(error instanceof Error ? error.message : 'Unknown error occurred');
        process.exit(1);
      }
    });
}
