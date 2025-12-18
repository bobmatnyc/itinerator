/**
 * Segment command router
 * @module cli/commands/segment
 */

import { Command } from 'commander';
import { addCommand } from './segment/add.js';
import { deleteCommand } from './segment/delete.js';
import { listCommand } from './segment/list.js';
import { moveCommand } from './segment/move.js';

/**
 * Create the segment command with all subcommands
 * @returns Configured segment command
 */
export function segmentCommand(): Command {
  const cmd = new Command('segment')
    .alias('seg')
    .description('Manage segments in working itinerary');

  cmd.addCommand(addCommand());
  cmd.addCommand(listCommand());
  cmd.addCommand(moveCommand());
  cmd.addCommand(deleteCommand());

  return cmd;
}
