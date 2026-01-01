/**
 * Import test-models command - compare multiple LLM models
 * @module cli/commands/import/test-models
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { DocumentImportService } from '../../../services/document-import.service.js';
import { YamlConfigStorage } from '../../../storage/yaml-config.js';
import { colors, printError, printSuccess, printWarning } from '../../output/colors.js';
import type { ModelTestResult } from '../../../domain/types/import.js';

/**
 * Create the import test-models command
 */
export function importTestModelsCommand(): Command {
  return new Command('test-models')
    .argument('<path>', 'Path to PDF file')
    .description('Test multiple LLM models on the same PDF')
    .option('-m, --models <models...>', 'Specific models to test')
    .option('--json', 'Output as JSON', false)
    .action(async (path, options) => {
      p.intro(colors.heading('Test Models'));

      // Load configuration
      const configStorage = new YamlConfigStorage();
      await configStorage.initialize();

      const configResult = await configStorage.getImportConfig();
      if (!configResult.success) {
        printError('Import not configured. Run: itinerator import config --set-key <key>');
        printError(configResult.error.message);
        process.exit(1);
      }

      const config = configResult.value;
      const importService = new DocumentImportService(config);
      await importService.initialize();

      // Determine models to test
      const availableModels = importService.getAvailableModels();
      const modelsToTest = options.models ?? availableModels;

      console.log();
      console.log(colors.heading('Testing Models'));
      console.log(`  File: ${colors.cyan(path)}`);
      console.log(`  Models: ${colors.yellow(modelsToTest.length.toString())}`);
      console.log();

      // Test models
      const spinner = p.spinner();
      spinner.start(`Testing ${modelsToTest.length} models...`);

      const result = await importService.testModels(path, modelsToTest);

      if (!result.success) {
        spinner.stop('Test failed');
        printError(result.error.message);
        process.exit(1);
      }

      spinner.stop('Testing complete');

      const results = result.value;

      if (options.json) {
        // JSON output
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Display results
      console.log();
      console.log(colors.heading('Results'));
      console.log();

      // Sort by cost
      const sortedResults = [...results].sort((a, b) => {
        // Success first, then by cost
        if (a.success && !b.success) return -1;
        if (!a.success && b.success) return 1;
        return a.usage.costUSD - b.usage.costUSD;
      });

      // Display table
      console.log(
        colors.dim(
          '  Model                               Status    Time     Cost      Segments'
        )
      );
      console.log(colors.dim('  ' + '─'.repeat(80)));

      for (const r of sortedResults) {
        const modelName = r.model.padEnd(35);
        const status = r.success ? colors.green('✓') : colors.red('✗');
        const time = `${r.durationMs}ms`.padEnd(8);
        const cost = `$${r.usage.costUSD.toFixed(4)}`.padEnd(10);
        const segments = r.success
          ? colors.yellow((r.itinerary?.segments.length ?? 0).toString())
          : colors.dim('-');

        console.log(`  ${modelName} ${status}        ${time} ${cost} ${segments}`);

        if (!r.success && r.error) {
          console.log(`    ${colors.dim(r.error.substring(0, 70))}`);
        }
      }

      console.log();

      // Summary
      const successCount = results.filter((r) => r.success).length;
      const totalCost = results.reduce((sum, r) => sum + r.usage.costUSD, 0);

      console.log(colors.heading('Summary'));
      console.log(
        `  Success Rate: ${colors.yellow(successCount.toString())}/${colors.yellow(
          results.length.toString()
        )}`
      );
      console.log(`  Total Cost: ${colors.green('$' + totalCost.toFixed(4))}`);

      if (successCount > 0) {
        const cheapestSuccess = sortedResults.find((r) => r.success);
        if (cheapestSuccess) {
          console.log();
          printSuccess(`Best value: ${cheapestSuccess.model}`);
          console.log(
            `  Cost: ${colors.green('$' + cheapestSuccess.usage.costUSD.toFixed(4))} | ` +
              `Segments: ${cheapestSuccess.itinerary?.segments.length ?? 0}`
          );
        }
      } else {
        printWarning('No models succeeded');
      }

      p.outro(`Tested ${results.length} models`);
    });
}
