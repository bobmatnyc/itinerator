import { Command } from 'commander';
import { demoCommand } from './cli/commands/demo.command.js';
import { doctorCommand } from './cli/commands/doctor.command.js';
import { itineraryCommand } from './cli/commands/itinerary.command.js';
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
program.addCommand(itineraryCommand());

/**
 * Parse command line arguments and execute
 */
program.parse();
