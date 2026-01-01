#!/usr/bin/env tsx
/**
 * Model evaluation framework for comparing LLM models across agents
 *
 * Usage:
 *   npx tsx tests/eval/model-comparison.ts
 *   npx tsx tests/eval/model-comparison.ts --agent trip-designer
 *   npx tsx tests/eval/model-comparison.ts --models claude-sonnet-4,gpt-4o
 *   npx tsx tests/eval/model-comparison.ts --no-judge (skip LLM quality eval)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { EVAL_MODELS } from '../config/models';
import type { EvalResult, EvalSample, EvalConfig } from './types';
import { TEST_SUITES, getTestPromptsForAgent } from './test-prompts';
import {
  evaluateFormatCompliance,
  evaluateOneQuestionRule,
} from './metrics/format-compliance';
import {
  evaluateResponseQuality,
  aggregateQualityScores,
} from './metrics/quality-judge';
import {
  calculateCostPer1k,
  calculateCost,
} from './metrics/cost-calculator';
import {
  generateConsoleReport,
  generateMarkdownReport,
  generateRecommendationsFile,
} from './report-generator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESULTS_DIR = path.join(__dirname, 'results');
const DEFAULT_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Parse command line arguments
 */
function parseArgs(): EvalConfig {
  const args = process.argv.slice(2);

  let agents: string[] = TEST_SUITES.map((s) => s.agent);
  let models: string[] = [...EVAL_MODELS];
  let enableQualityJudge = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--agent' && args[i + 1]) {
      agents = [args[i + 1]];
      i++;
    } else if (arg === '--models' && args[i + 1]) {
      models = args[i + 1].split(',');
      i++;
    } else if (arg === '--no-judge') {
      enableQualityJudge = false;
    } else if (arg === '--help') {
      console.log(`
Model Evaluation Framework

Usage:
  npx tsx tests/eval/model-comparison.ts [options]

Options:
  --agent <name>       Run evaluation for specific agent (trip-designer, help, travel-agent)
  --models <list>      Comma-separated list of models to evaluate
  --no-judge           Skip LLM-as-judge quality evaluation (faster, cheaper)
  --help               Show this help message

Examples:
  npx tsx tests/eval/model-comparison.ts
  npx tsx tests/eval/model-comparison.ts --agent trip-designer
  npx tsx tests/eval/model-comparison.ts --models claude-sonnet-4,gpt-4o
  npx tsx tests/eval/model-comparison.ts --no-judge
      `);
      process.exit(0);
    }
  }

  return {
    agents,
    models,
    samplesPerAgent: 10,
    delayBetweenRequests: 1000,
    enableQualityJudge,
    outputDir: RESULTS_DIR,
  };
}

/**
 * Call OpenRouter API with specific model
 */
async function callModel(
  model: string,
  prompt: string,
  systemPrompt: string,
  apiKey: string
): Promise<{
  response: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
}> {
  const startTime = Date.now();

  const response = await fetch(DEFAULT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/yourusername/itinerator',
      'X-Title': 'Itinerizer Model Eval',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    throw new Error(
      `API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  return {
    response: data.choices[0]?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    totalTokens: data.usage?.total_tokens || 0,
    latencyMs,
  };
}

/**
 * Get system prompt for agent from file
 */
async function getSystemPromptForAgent(agent: string): Promise<string> {
  // Map agent names to their system prompt files
  const promptFiles: Record<string, string> = {
    'trip-designer': path.join(
      __dirname,
      '../../src/prompts/trip-designer/system.md'
    ),
    help: path.join(__dirname, '../../src/prompts/help/system.md'),
    'travel-agent': path.join(
      __dirname,
      '../../src/prompts/travel-agent/system.md'
    ),
  };

  const promptFile = promptFiles[agent];
  if (!promptFile) {
    throw new Error(`No system prompt file configured for agent: ${agent}`);
  }

  try {
    const content = await fs.readFile(promptFile, 'utf-8');
    return content;
  } catch (error) {
    console.warn(
      `Warning: Could not read system prompt from ${promptFile}, using fallback`
    );
    // Fallback prompts
    const fallbacks: Record<string, string> = {
      'trip-designer': `You are a trip planning assistant. Help users plan their travel itineraries.
CRITICAL: Ask exactly ONE question at a time using structured JSON format.`,
      help: `You are a helpful assistant that explains how to use the Itinerizer app.`,
      'travel-agent': `You are a travel search assistant. Help users find flights, hotels, restaurants, and activities.`,
    };
    return fallbacks[agent] || fallbacks.help;
  }
}

/**
 * Run evaluation for one agent + model combination
 */
async function runAgentEval(
  agent: string,
  model: string,
  config: EvalConfig,
  apiKey: string
): Promise<EvalSample[]> {
  console.log(`  Running ${model} for ${agent}...`);

  const prompts = getTestPromptsForAgent(agent);
  const systemPrompt = await getSystemPromptForAgent(agent);
  const samples: EvalSample[] = [];

  for (const testPrompt of prompts.slice(0, config.samplesPerAgent)) {
    try {
      // Call model
      const result = await callModel(
        model,
        testPrompt.prompt,
        systemPrompt,
        apiKey
      );

      // Evaluate format compliance
      const formatEval = evaluateFormatCompliance(result.response);

      // Create sample
      const sample: EvalSample = {
        prompt: testPrompt.prompt,
        response: result.response,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.totalTokens,
        latencyMs: result.latencyMs,
        hasValidJson: formatEval.details.hasValidJson,
        questionCount: formatEval.details.questionCount,
        toolsCalled: [], // TODO: Extract from response
        formatCompliance: formatEval.overall,
        oneQuestionCompliance: formatEval.oneQuestionCompliance,
      };

      // Optionally evaluate quality with LLM-as-judge
      if (config.enableQualityJudge) {
        const qualityScore = await evaluateResponseQuality(
          testPrompt.prompt,
          result.response,
          testPrompt.expectedBehavior,
          apiKey
        );
        sample.qualityScore = qualityScore;
      }

      samples.push(sample);

      // Rate limiting
      await new Promise((resolve) =>
        setTimeout(resolve, config.delayBetweenRequests)
      );
    } catch (error) {
      console.error(
        `  Error evaluating prompt "${testPrompt.prompt}":`,
        error
      );
    }
  }

  return samples;
}

/**
 * Calculate aggregate metrics from samples
 */
function calculateMetrics(samples: EvalSample[], model: string) {
  if (samples.length === 0) {
    return {
      formatCompliance: 0,
      oneQuestionCompliance: 0,
      toolUseAccuracy: 0,
      responseQuality: 0,
      avgLatency: 0,
      avgTokens: 0,
      estimatedCost: 0,
      overall: 0,
    };
  }

  const formatCompliance =
    samples.reduce((sum, s) => sum + s.formatCompliance, 0) /
    samples.length;

  const oneQuestionCompliance =
    samples.reduce((sum, s) => sum + s.oneQuestionCompliance, 0) /
    samples.length;

  const toolUseAccuracy = 0; // TODO: Implement tool use evaluation

  const qualityScores = samples
    .map((s) => s.qualityScore)
    .filter((q): q is NonNullable<typeof q> => q !== undefined);

  const responseQuality =
    qualityScores.length > 0
      ? aggregateQualityScores(qualityScores).avgOverall
      : 0.5; // Neutral if no quality eval

  const avgLatency =
    samples.reduce((sum, s) => sum + s.latencyMs, 0) / samples.length;

  const avgTokens =
    samples.reduce((sum, s) => sum + s.totalTokens, 0) / samples.length;

  const avgInputTokens =
    samples.reduce((sum, s) => sum + s.inputTokens, 0) / samples.length;

  const avgOutputTokens =
    samples.reduce((sum, s) => sum + s.outputTokens, 0) / samples.length;

  const estimatedCost = calculateCostPer1k(
    model,
    avgInputTokens,
    avgOutputTokens
  );

  // Overall score: weighted average
  // Format: 20%, OneQuestion: 30%, Quality: 30%, Cost: 10%, Latency: 10%
  const normalizedCost = Math.max(0, 1 - estimatedCost / 2); // $2/1k = 0
  const normalizedLatency = Math.max(0, 1 - avgLatency / 5000); // 5s = 0

  const overall =
    formatCompliance * 0.2 +
    oneQuestionCompliance * 0.3 +
    responseQuality * 0.3 +
    normalizedCost * 0.1 +
    normalizedLatency * 0.1;

  return {
    formatCompliance,
    oneQuestionCompliance,
    toolUseAccuracy,
    responseQuality,
    avgLatency,
    avgTokens,
    estimatedCost,
    overall,
  };
}

/**
 * Main evaluation function
 */
async function runEvaluation() {
  const config = parseArgs();

  // Check for API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      'Error: OPENROUTER_API_KEY environment variable not set'
    );
    process.exit(1);
  }

  console.log('Starting Model Evaluation');
  console.log('='.repeat(80));
  console.log(`Agents: ${config.agents.join(', ')}`);
  console.log(`Models: ${config.models.join(', ')}`);
  console.log(
    `Quality Judge: ${config.enableQualityJudge ? 'Enabled' : 'Disabled'}`
  );
  console.log('='.repeat(80) + '\n');

  const results: EvalResult[] = [];
  const timestamp = new Date().toISOString();

  // Ensure output directory exists
  await fs.mkdir(config.outputDir, { recursive: true });

  // Run evaluations
  for (const agent of config.agents) {
    console.log(`\nEvaluating agent: ${agent}`);
    console.log('-'.repeat(80));

    for (const model of config.models) {
      const samples = await runAgentEval(agent, model, config, apiKey);
      const metrics = calculateMetrics(samples, model);

      results.push({
        model,
        agent,
        metrics,
        samples,
        timestamp,
      });

      console.log(
        `  ✓ ${model}: Overall=${metrics.overall.toFixed(3)}, ` +
          `Format=${metrics.formatCompliance.toFixed(2)}, ` +
          `1Q=${metrics.oneQuestionCompliance.toFixed(2)}, ` +
          `Quality=${metrics.responseQuality.toFixed(2)}`
      );
    }
  }

  // Generate reports
  console.log('\n' + '='.repeat(80));
  console.log('Generating Reports');
  console.log('='.repeat(80));

  // Console report
  generateConsoleReport(results);

  // Save raw results
  const resultsFile = path.join(
    config.outputDir,
    `eval-${timestamp.replace(/[:.]/g, '-')}.json`
  );
  await fs.writeFile(
    resultsFile,
    JSON.stringify(results, null, 2),
    'utf-8'
  );
  console.log(`\n✓ Raw results saved to: ${resultsFile}`);

  // Generate markdown report
  const markdown = await generateMarkdownReport(results, timestamp);
  const markdownFile = path.join(
    config.outputDir,
    `eval-${timestamp.replace(/[:.]/g, '-')}.md`
  );
  await fs.writeFile(markdownFile, markdown, 'utf-8');
  console.log(`✓ Markdown report saved to: ${markdownFile}`);

  // Generate recommendations
  const recommendationsFile = path.join(
    config.outputDir,
    'recommendations.md'
  );
  await generateRecommendationsFile(results, recommendationsFile);
  console.log(`✓ Recommendations saved to: ${recommendationsFile}`);

  console.log('\nEvaluation complete! 🎉\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEvaluation().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runEvaluation, runAgentEval, calculateMetrics };
