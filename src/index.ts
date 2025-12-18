import { Command } from 'commander';
import { demoCommand } from './cli/commands/demo.command.js';
import { doctorCommand } from './cli/commands/doctor.command.js';
import { setupCommand } from './cli/commands/setup.command.js';
import { VERSION } from './utils/version.js';

/**
 * Itinerizer - A modern CLI tool for managing travel itineraries
 */
const program = new Command();

program
  .name('itinerizer')
  .description('A modern CLI tool for managing travel itineraries')
  .version(VERSION, '-v, --version', 'Display version information');

/**
 * Register top-level commands
 */
program.addCommand(setupCommand());
program.addCommand(doctorCommand());
program.addCommand(demoCommand());

/**
 * Itinerary command - Manage travel itineraries
 */
const itineraryCmd = program
  .command('itinerary')
  .alias('itin')
  .description('Manage travel itineraries');

itineraryCmd
  .command('create')
  .description('Create a new itinerary')
  .action(() => {
    console.log('Creating new itinerary...');
    console.log('TODO: Implement itinerary create command');
  });

itineraryCmd
  .command('list')
  .description('List all itineraries')
  .action(() => {
    console.log('Listing itineraries...');
    console.log('TODO: Implement itinerary list command');
  });

itineraryCmd
  .command('show <id>')
  .description('Show itinerary details')
  .action((id: string) => {
    console.log(`Showing itinerary: ${id}`);
    console.log('TODO: Implement itinerary show command');
  });

/**
 * Parse command line arguments and execute
 */
program.parse();
