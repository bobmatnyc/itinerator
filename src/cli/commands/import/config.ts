/**
 * Import config command - manage import configuration
 * @module cli/commands/import/config
 */

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { DEFAULT_IMPORT_MODEL, MODEL_PRICING } from '../../../domain/types/import.js';
import { YamlConfigStorage } from '../../../storage/yaml-config.js';
import { colors, printError, printSuccess, printWarning } from '../../output/colors.js';

/**
 * Create the import config command
 */
export function importConfigCommand(): Command {
  return new Command('config')
    .description('Manage import configuration')
    .option('--set-key <key>', 'Set OpenRouter API key')
    .option('--set-model <model>', 'Set default model')
    .option('--show', 'Show current configuration', false)
    .option('--models', 'List available models', false)
    .action(async (options) => {
      p.intro(colors.heading('Import Configuration'));

      const configStorage = new YamlConfigStorage();
      await configStorage.initialize();

      // List models
      if (options.models) {
        console.log();
        console.log(colors.heading('Available Models'));
        console.log();
        console.log(
          colors.dim(
            '  Model                                 Input $/M    Output $/M'
          )
        );
        console.log(colors.dim('  ' + '─'.repeat(65)));

        for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
          const modelName = model.padEnd(38);
          const inputPrice = `$${pricing.inputPerMillion.toFixed(2)}`.padEnd(12);
          const outputPrice = `$${pricing.outputPerMillion.toFixed(2)}`;

          const isDefault = model === DEFAULT_IMPORT_MODEL;
          const prefix = isDefault ? colors.green('★ ') : '  ';

          console.log(`${prefix}${modelName} ${inputPrice} ${outputPrice}`);
        }

        console.log();
        console.log(colors.dim(`  ★ = default model`));
        p.outro(`${Object.keys(MODEL_PRICING).length} models available`);
        return;
      }

      // Set API key
      if (options.setKey) {
        const result = await configStorage.setApiKey(options.setKey);
        if (!result.success) {
          printError('Failed to save API key');
          printError(result.error.message);
          process.exit(1);
        }
        printSuccess('API key saved');
        p.outro('Configuration updated');
        return;
      }

      // Set default model
      if (options.setModel) {
        const configResult = await configStorage.getConfig();
        const currentConfig = configResult.success ? configResult.value : {};

        if (!currentConfig.openrouter) {
          currentConfig.openrouter = {};
        }
        currentConfig.openrouter.defaultModel = options.setModel;

        const saveResult = await configStorage.save(currentConfig);
        if (!saveResult.success) {
          printError('Failed to save configuration');
          printError(saveResult.error.message);
          process.exit(1);
        }

        printSuccess(`Default model set to: ${options.setModel}`);
        p.outro('Configuration updated');
        return;
      }

      // Show configuration
      const configResult = await configStorage.getConfig();
      if (!configResult.success) {
        printWarning('No configuration found');
        console.log();
        console.log(colors.dim('  Set your API key with:'));
        console.log(colors.cyan('  itinerator import config --set-key <your-key>'));
        p.outro('Run setup to configure');
        return;
      }

      const config = configResult.value;

      console.log();
      console.log(colors.heading('OpenRouter'));
      if (config.openrouter?.apiKey) {
        const maskedKey = config.openrouter.apiKey.substring(0, 10) + '...' +
          config.openrouter.apiKey.substring(config.openrouter.apiKey.length - 4);
        console.log(`  API Key: ${colors.green(maskedKey)}`);
      } else {
        console.log(`  API Key: ${colors.red('Not set')}`);
      }
      console.log(
        `  Default Model: ${colors.cyan(config.openrouter?.defaultModel ?? DEFAULT_IMPORT_MODEL)}`
      );

      console.log();
      console.log(colors.heading('Import Settings'));
      console.log(`  Max Tokens: ${colors.yellow((config.import?.maxTokens ?? 4096).toString())}`);
      console.log(
        `  Temperature: ${colors.yellow((config.import?.temperature ?? 0.1).toString())}`
      );

      console.log();
      console.log(colors.heading('Cost Tracking'));
      console.log(
        `  Enabled: ${config.costTracking?.enabled !== false ? colors.green('Yes') : colors.red('No')}`
      );
      console.log(
        `  Log Path: ${colors.dim(config.costTracking?.logPath ?? './data/imports/cost-log.json')}`
      );

      p.outro('Configuration loaded');
    });
}
