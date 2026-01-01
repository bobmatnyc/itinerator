/**
 * Knowledge search command
 * @module cli/commands/knowledge/search
 */

import { Command } from 'commander';
import { WeaviateKnowledgeService } from '../../../services/weaviate-knowledge.service.js';
import { WeaviateStorage } from '../../../storage/weaviate-storage.js';
import { colors, printError, printInfo } from '../../output/colors.js';
import { formatDate } from '../../output/formatters.js';
import type { KnowledgeSearchFilter } from '../../../domain/types/weaviate.js';

/**
 * Format a knowledge result for display
 */
function formatKnowledgeResult(
  knowledge: any,
  index: number,
  showScore: boolean = true
): string {
  const lines: string[] = [];

  // Header with index and category
  const categoryColor =
    knowledge.category === 'destination'
      ? colors.blue
      : knowledge.category === 'activity'
        ? colors.green
        : knowledge.category === 'tip'
          ? colors.yellow
          : colors.dim;

  const header = `${colors.dim(`${index}.`)} ${categoryColor(knowledge.category.toUpperCase())}${
    knowledge.subcategory ? ` (${knowledge.subcategory})` : ''
  }`;
  lines.push(header);

  // Content
  lines.push(`   ${knowledge.rawContent || knowledge.content}`);

  // Metadata
  const metadata: string[] = [];

  if (knowledge.destinationName) {
    metadata.push(`${colors.cyan('Destination:')} ${knowledge.destinationName}`);
  }

  if (knowledge.country) {
    metadata.push(`${colors.cyan('Country:')} ${knowledge.country}`);
  }

  if (knowledge.region) {
    metadata.push(`${colors.cyan('Region:')} ${knowledge.region}`);
  }

  if (knowledge.source) {
    metadata.push(`${colors.cyan('Source:')} ${knowledge.source}`);
  }

  if (knowledge.createdAt) {
    metadata.push(`${colors.cyan('Created:')} ${formatDate(knowledge.createdAt)}`);
  }

  if (showScore && knowledge.relevanceScore !== undefined) {
    const scorePercent = (knowledge.relevanceScore * 100).toFixed(1);
    metadata.push(`${colors.cyan('Relevance:')} ${scorePercent}%`);
  }

  if (metadata.length > 0) {
    lines.push(`   ${colors.dim(metadata.join(' | '))}`);
  }

  return lines.join('\n');
}

/**
 * Search command implementation
 */
export function searchCommand(): Command {
  return new Command('search')
    .description('Search the knowledge base')
    .argument('<query>', 'Search query')
    .option('--region <region>', 'Filter by region')
    .option('--country <country>', 'Filter by country')
    .option('--category <category>', 'Filter by category (destination, activity, event, weather, tip, restriction)')
    .option('--season <season>', 'Filter by season (spring, summer, fall, winter)')
    .option('--trip-type <type>', 'Filter by trip type (leisure, business, adventure, cultural, relaxation)')
    .option('--luxury-level <level>', 'Filter by luxury level (budget, moderate, luxury, ultra-luxury)')
    .option('--traveler-type <type>', 'Filter by traveler type (family, couple, solo, friends, group)')
    .option('--limit <number>', 'Maximum number of results', '10')
    .option('--json', 'Output as JSON')
    .action(async (query: string, options) => {
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

      const knowledgeService = new WeaviateKnowledgeService(weaviateStorage, {
        topK: Number.parseInt(options.limit, 10),
      });

      // Initialize service
      const initResult = await knowledgeService.initialize();
      if (!initResult.success) {
        printError(`Failed to initialize knowledge service: ${initResult.error.message}`);
        process.exit(1);
      }

      // Build search filter
      const filter: KnowledgeSearchFilter = {};

      if (options.region) {
        filter.region = options.region;
      }

      if (options.country) {
        filter.country = options.country;
      }

      if (options.category) {
        filter.category = options.category;
      }

      if (options.season) {
        filter.season = options.season;
      }

      if (options.tripType) {
        filter.tripType = options.tripType;
      }

      if (options.luxuryLevel) {
        filter.luxuryLevel = options.luxuryLevel;
      }

      if (options.travelerType) {
        filter.travelerType = options.travelerType;
      }

      // Search
      const searchResult = await knowledgeService.searchKnowledge(query, filter);

      if (!searchResult.success) {
        printError(`Search failed: ${searchResult.error.message}`);
        process.exit(1);
      }

      const { knowledge, scores, relevanceScores } = searchResult.value;

      if (knowledge.length === 0) {
        printInfo('No results found');
        return;
      }

      // Output results
      if (options.json) {
        const results = knowledge.map((k, i) => ({
          ...k,
          score: scores[i],
          relevanceScore: relevanceScores[i],
        }));
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(colors.heading(`\nSearch Results (${knowledge.length})\n`));

        for (let i = 0; i < knowledge.length; i++) {
          const k = knowledge[i];
          if (k) {
            const result = {
              ...k,
              score: scores[i],
              relevanceScore: relevanceScores[i],
            };
            console.log(formatKnowledgeResult(result, i + 1, true));

            if (i < knowledge.length - 1) {
              console.log(); // Blank line between results
            }
          }
        }

        console.log();
      }
    });
}
