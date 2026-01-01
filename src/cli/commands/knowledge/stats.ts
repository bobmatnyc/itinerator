/**
 * Knowledge stats command
 * @module cli/commands/knowledge/stats
 */

import { Command } from 'commander';
import { WeaviateKnowledgeService } from '../../../services/weaviate-knowledge.service.js';
import { WeaviateStorage } from '../../../storage/weaviate-storage.js';
import { colors, printError, printInfo } from '../../output/colors.js';

/**
 * Format stats for display
 */
function formatStats(stats: any, detailed: boolean): string {
  const lines: string[] = [];

  lines.push(colors.heading('Knowledge Base Statistics'));
  lines.push('');

  // Overall counts
  lines.push(colors.bold('Overall:'));
  lines.push(`  Total Knowledge Items: ${colors.cyan(stats.totalKnowledge.toString())}`);
  lines.push(`  Total Destinations: ${colors.cyan(stats.totalDestinations.toString())}`);
  lines.push(`  Total Itineraries: ${colors.cyan(stats.totalItineraries.toString())}`);
  lines.push('');

  // Knowledge by category
  if (stats.knowledgeByCategory && Object.keys(stats.knowledgeByCategory).length > 0) {
    lines.push(colors.bold('By Category:'));
    for (const [category, count] of Object.entries(stats.knowledgeByCategory)) {
      const categoryColor =
        category === 'destination'
          ? colors.blue
          : category === 'activity'
            ? colors.green
            : category === 'tip'
              ? colors.yellow
              : colors.dim;
      lines.push(`  ${categoryColor(category.padEnd(15))}: ${count}`);
    }
    lines.push('');
  }

  if (detailed) {
    // Knowledge by source
    if (stats.knowledgeBySource && Object.keys(stats.knowledgeBySource).length > 0) {
      lines.push(colors.bold('By Source:'));
      for (const [source, count] of Object.entries(stats.knowledgeBySource)) {
        lines.push(`  ${source.padEnd(15)}: ${count}`);
      }
      lines.push('');
    }

    // Knowledge by temporal type
    if (
      stats.knowledgeByTemporalType &&
      Object.keys(stats.knowledgeByTemporalType).length > 0
    ) {
      lines.push(colors.bold('By Temporal Type:'));
      for (const [type, count] of Object.entries(stats.knowledgeByTemporalType)) {
        lines.push(`  ${type.padEnd(15)}: ${count}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Stats command implementation
 */
export function statsCommand(): Command {
  return new Command('stats')
    .description('View knowledge base statistics')
    .option('--detailed', 'Show detailed statistics')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      // Check for Weaviate configuration
      if (!process.env.WEAVIATE_URL || !process.env.WEAVIATE_API_KEY) {
        printError('Weaviate not configured. Set WEAVIATE_URL and WEAVIATE_API_KEY');
        printInfo('Run "itinerator setup" to configure Weaviate');
        process.exit(1);
      }

      const weaviateStorage = new WeaviateStorage({
        url: process.env.WEAVIATE_URL,
        apiKey: process.env.WEAVIATE_API_KEY,
        openaiKey: process.env.OPENAI_API_KEY,
      });

      const knowledgeService = new WeaviateKnowledgeService(weaviateStorage);

      // Initialize service
      const initResult = await knowledgeService.initialize();
      if (!initResult.success) {
        printError(`Failed to initialize knowledge service: ${initResult.error.message}`);
        process.exit(1);
      }

      // Get stats
      const statsResult = await knowledgeService.getStats();

      if (!statsResult.success) {
        printError(`Failed to get statistics: ${statsResult.error.message}`);
        process.exit(1);
      }

      const stats = statsResult.value;

      // Output stats
      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log();
        console.log(formatStats(stats, options.detailed));
      }
    });
}
