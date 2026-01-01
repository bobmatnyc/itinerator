import { Command } from 'commander';
import { demoCommand } from './cli/commands/demo.command.js';
import { doctorCommand } from './cli/commands/doctor.command.js';
import { importCommand } from './cli/commands/import.command.js';
import { itineraryCommand } from './cli/commands/itinerary.command.js';
import { knowledgeCommand } from './cli/commands/knowledge.command.js';
import { setupCommand } from './cli/commands/setup.command.js';
import { viewCommand, viewersCommand, viewAllCommand } from './cli/commands/view.command.js';
import { VERSION } from './utils/version.js';

/**
 * Itinerator - A modern CLI tool for managing travel itineraries
 */
const program = new Command();

program
  .name('itinerator')
  .description('A modern CLI tool for managing travel itineraries')
  .version(VERSION, '-v, --version', 'Display version information');

/**
 * Register top-level commands
 */
program.addCommand(setupCommand());
program.addCommand(doctorCommand());
program.addCommand(demoCommand());
program.addCommand(itineraryCommand());
program.addCommand(knowledgeCommand());
program.addCommand(importCommand());
program.addCommand(viewCommand());
program.addCommand(viewersCommand());
program.addCommand(viewAllCommand());

/**
 * Parse command line arguments and execute
 */
program.parse();
