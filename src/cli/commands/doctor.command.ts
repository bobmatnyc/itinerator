/**
 * Doctor command - Health check for itinerator installation
 * @module cli/commands/doctor
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { ConfigStorage } from '../../storage/config-storage.js';
import { JsonItineraryStorage } from '../../storage/json-storage.js';
import { colors } from '../output/index.js';

/**
 * Check result structure
 */
interface Check {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

/**
 * Create the doctor command
 * @returns Commander command instance
 */
export function doctorCommand(): Command {
  return new Command('doctor')
    .description('Check itinerator installation and configuration')
    .action(async () => {
      p.intro(colors.heading('Itinerator Doctor'));

      const checks: Check[] = [];

      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = Number.parseInt(nodeVersion.slice(1), 10);
      checks.push({
        name: 'Node.js version',
        status: majorVersion >= 20 ? 'pass' : 'warn',
        message: `${nodeVersion} ${majorVersion >= 20 ? '(OK)' : '(recommend 20+)'}`,
      });

      // Check data directory
      const storage = new JsonItineraryStorage();
      const storageInit = await storage.initialize();
      checks.push({
        name: 'Data directory',
        status: storageInit.success ? 'pass' : 'fail',
        message: storageInit.success ? 'Writable' : storageInit.error.message,
      });

      // Check config
      const config = new ConfigStorage();
      const configLoad = await config.load();
      checks.push({
        name: 'Configuration',
        status: configLoad.success ? 'pass' : 'warn',
        message: configLoad.success ? 'Found' : 'Not initialized (run setup)',
      });

      // Check itinerary count
      if (storageInit.success) {
        const listResult = await storage.list();
        if (listResult.success) {
          checks.push({
            name: 'Itineraries',
            status: 'pass',
            message: `${listResult.value.length} found`,
          });
        }
      }

      // Display results
      console.log('');
      for (const check of checks) {
        const icon = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '!';
        const color =
          check.status === 'pass'
            ? colors.success
            : check.status === 'fail'
              ? colors.error
              : colors.warning;
        console.log(`  ${color(icon)} ${check.name}: ${check.message}`);
      }
      console.log('');

      const hasFailures = checks.some((c) => c.status === 'fail');
      p.outro(
        hasFailures ? colors.error('Some checks failed') : colors.success('All checks passed')
      );

      if (hasFailures) {
        process.exit(1);
      }
    });
}
