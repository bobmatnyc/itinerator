/**
 * Itinerary command router
 * @module cli/commands/itinerary
 */

import { Command } from 'commander';
import { createCommand } from './itinerary/create.js';
import { deleteCommand } from './itinerary/delete.js';
import { editCommand } from './itinerary/edit.js';
import { listCommand } from './itinerary/list.js';
import { showCommand } from './itinerary/show.js';
import { useCommand } from './itinerary/use.js';
import { segmentCommand } from './segment.command.js';

/**
 * Create the itinerary command with all subcommands
 * @returns Configured itinerary command
 */
export function itineraryCommand(): Command {
  const cmd = new Command('itinerary').alias('it').description('Manage travel itineraries');

  cmd.addCommand(createCommand());
  cmd.addCommand(listCommand());
  cmd.addCommand(showCommand());
  cmd.addCommand(useCommand());
  cmd.addCommand(editCommand());
  cmd.addCommand(deleteCommand());
  cmd.addCommand(segmentCommand());

  return cmd;
}
