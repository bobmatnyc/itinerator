/**
 * Report generation for model evaluation results
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { EvalResult, EvalMetrics } from './types';
import { MODEL_PRICING } from './metrics/cost-calculator';

/**
 * Generate console output with comparison tables
 */
export function generateConsoleReport(results: EvalResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('MODEL EVALUATION REPORT');
  console.log('='.repeat(80) + '\n');

  // Group by agent
  const byAgent = groupByAgent(results);

  for (const [agent, agentResults] of Object.entries(byAgent)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`AGENT: ${agent.toUpperCase()}`);
    console.log('='.repeat(80));

    // Sort by overall score
    const sorted = agentResults.sort(
      (a, b) => b.metrics.overall - a.metrics.overall
    );

    // Table header
    console.log('\n' + formatTableRow([
      'Model',
      'Overall',
      'Format',
      '1Q Rule',
      'Quality',
      'Latency',
      'Cost/1k',
    ]));
    console.log('-'.repeat(100));

    // Table rows
    for (const result of sorted) {
      console.log(formatTableRow([
        truncate(result.model, 30),
        result.metrics.overall.toFixed(3),
        result.metrics.formatCompliance.toFixed(2),
        result.metrics.oneQuestionCompliance.toFixed(2),
        result.metrics.responseQuality.toFixed(2),
        `${result.metrics.avgLatency.toFixed(0)}ms`,
        `$${result.metrics.estimatedCost.toFixed(2)}`,
      ]));
    }

    // Recommendations
    console.log('\n' + '─'.repeat(80));
    const recommendation = generateRecommendation(sorted);
    console.log(`\nRECOMMENDATION: ${recommendation.model}`);
    console.log(`Reason: ${recommendation.reason}\n`);
  }
}

/**
 * Generate markdown report file
 */
export async function generateMarkdownReport(
  results: EvalResult[],
  timestamp: string
): Promise<string> {
  const lines: string[] = [];

  lines.push('# Model Evaluation Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date(timestamp).toISOString()}`);
  lines.push('');

  const byAgent = groupByAgent(results);

  for (const [agent, agentResults] of Object.entries(byAgent)) {
    lines.push('');
    lines.push(`## Agent: ${agent}`);
    lines.push('');

    const sorted = agentResults.sort(
      (a, b) => b.metrics.overall - a.metrics.overall
    );

    // Metrics table
    lines.push('### Performance Metrics');
    lines.push('');
    lines.push(
      '| Model | Overall | Format | 1Q Rule | Quality | Latency | Tokens | Cost/1k |'
    );
    lines.push(
      '|-------|---------|--------|---------|---------|---------|--------|---------|'
    );

    for (const result of sorted) {
      lines.push(
        `| ${result.model} | ` +
          `${result.metrics.overall.toFixed(3)} | ` +
          `${result.metrics.formatCompliance.toFixed(2)} | ` +
          `${result.metrics.oneQuestionCompliance.toFixed(2)} | ` +
          `${result.metrics.responseQuality.toFixed(2)} | ` +
          `${result.metrics.avgLatency.toFixed(0)}ms | ` +
          `${result.metrics.avgTokens.toFixed(0)} | ` +
          `$${result.metrics.estimatedCost.toFixed(2)} |`
      );
    }

    // Recommendation
    lines.push('');
    lines.push('### Recommendation');
    lines.push('');
    const recommendation = generateRecommendation(sorted);
    lines.push(`**Model:** ${recommendation.model}`);
    lines.push('');
    lines.push(`**Reason:** ${recommendation.reason}`);
    lines.push('');

    // Detailed breakdown
    lines.push('### Detailed Analysis');
    lines.push('');

    for (const result of sorted.slice(0, 3)) {
      // Top 3
      lines.push(`#### ${result.model}`);
      lines.push('');
      lines.push('**Strengths:**');
      const strengths = analyzeStrengths(result.metrics);
      strengths.forEach((s) => lines.push(`- ${s}`));
      lines.push('');
      lines.push('**Weaknesses:**');
      const weaknesses = analyzeWeaknesses(result.metrics);
      weaknesses.forEach((w) => lines.push(`- ${w}`));
      lines.push('');
    }
  }

  // Cost comparison
  lines.push('');
  lines.push('## Cost Analysis');
  lines.push('');
  lines.push(
    '| Model | Input (per 1M) | Output (per 1M) | Example Cost/1k |'
  );
  lines.push('|-------|----------------|-----------------|-----------------|');

  for (const model of Object.keys(MODEL_PRICING)) {
    const pricing = MODEL_PRICING[model];
    const exampleCost = ((500 / 1_000_000) * pricing.input +
      (500 / 1_000_000) * pricing.output) * 1000;
    lines.push(
      `| ${model} | $${pricing.input} | $${pricing.output} | $${exampleCost.toFixed(2)} |`
    );
  }

  return lines.join('\n');
}

/**
 * Generate recommendations summary
 */
export async function generateRecommendationsFile(
  results: EvalResult[],
  outputPath: string
): Promise<void> {
  const lines: string[] = [];

  lines.push('# Model Recommendations by Agent');
  lines.push('');
  lines.push('This file contains the recommended models for each agent type based on evaluation results.');
  lines.push('');

  const byAgent = groupByAgent(results);

  for (const [agent, agentResults] of Object.entries(byAgent)) {
    const sorted = agentResults.sort(
      (a, b) => b.metrics.overall - a.metrics.overall
    );
    const recommendation = generateRecommendation(sorted);

    lines.push(`## ${agent}`);
    lines.push('');
    lines.push(`**Recommended Model:** \`${recommendation.model}\``);
    lines.push('');
    lines.push(`**Rationale:** ${recommendation.reason}`);
    lines.push('');
    lines.push('**Key Metrics:**');
    const topResult = sorted[0];
    lines.push(`- Overall Score: ${topResult.metrics.overall.toFixed(3)}`);
    lines.push(`- Format Compliance: ${topResult.metrics.formatCompliance.toFixed(2)}`);
    lines.push(`- One Question Compliance: ${topResult.metrics.oneQuestionCompliance.toFixed(2)}`);
    lines.push(`- Quality Score: ${topResult.metrics.responseQuality.toFixed(2)}`);
    lines.push(`- Average Latency: ${topResult.metrics.avgLatency.toFixed(0)}ms`);
    lines.push(`- Estimated Cost per 1k interactions: $${topResult.metrics.estimatedCost.toFixed(2)}`);
    lines.push('');

    // Alternative options
    if (sorted.length > 1) {
      lines.push('**Alternative Options:**');
      lines.push('');
      for (let i = 1; i < Math.min(3, sorted.length); i++) {
        const alt = sorted[i];
        lines.push(`${i}. **${alt.model}** (Score: ${alt.metrics.overall.toFixed(3)})`);
        lines.push(`   - Cost: $${alt.metrics.estimatedCost.toFixed(2)}/1k`);
        lines.push(`   - Latency: ${alt.metrics.avgLatency.toFixed(0)}ms`);
        lines.push('');
      }
    }
  }

  await fs.writeFile(outputPath, lines.join('\n'), 'utf-8');
}

// Helper functions

function groupByAgent(
  results: EvalResult[]
): Record<string, EvalResult[]> {
  const grouped: Record<string, EvalResult[]> = {};

  for (const result of results) {
    if (!grouped[result.agent]) {
      grouped[result.agent] = [];
    }
    grouped[result.agent].push(result);
  }

  return grouped;
}

function formatTableRow(cells: string[]): string {
  return cells.map((cell, i) => {
    const width = i === 0 ? 30 : 10;
    return cell.padEnd(width);
  }).join(' | ');
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

function generateRecommendation(
  sortedResults: EvalResult[]
): { model: string; reason: string } {
  if (sortedResults.length === 0) {
    return { model: 'None', reason: 'No results available' };
  }

  const top = sortedResults[0];
  const reasons: string[] = [];

  // Analyze why this model is best
  if (top.metrics.overall >= 0.8) {
    reasons.push('excellent overall performance');
  }

  if (top.metrics.formatCompliance >= 0.9) {
    reasons.push('strong format compliance');
  }

  if (top.metrics.oneQuestionCompliance >= 0.9) {
    reasons.push('excellent ONE question rule adherence');
  }

  if (top.metrics.responseQuality >= 0.8) {
    reasons.push('high quality responses');
  }

  if (top.metrics.avgLatency < 2000) {
    reasons.push('fast response times');
  }

  if (top.metrics.estimatedCost < 0.5) {
    reasons.push('cost-effective');
  }

  const reason =
    reasons.length > 0
      ? `Best ${reasons.join(', ')}`
      : 'Highest overall score among tested models';

  return { model: top.model, reason };
}

function analyzeStrengths(metrics: EvalMetrics): string[] {
  const strengths: string[] = [];

  if (metrics.formatCompliance >= 0.9) {
    strengths.push('Excellent format compliance');
  }
  if (metrics.oneQuestionCompliance >= 0.9) {
    strengths.push('Consistently follows ONE question rule');
  }
  if (metrics.responseQuality >= 0.8) {
    strengths.push('High quality, helpful responses');
  }
  if (metrics.avgLatency < 1500) {
    strengths.push('Very fast response times');
  }
  if (metrics.estimatedCost < 0.3) {
    strengths.push('Very cost-effective');
  }

  return strengths.length > 0 ? strengths : ['No notable strengths'];
}

function analyzeWeaknesses(metrics: EvalMetrics): string[] {
  const weaknesses: string[] = [];

  if (metrics.formatCompliance < 0.7) {
    weaknesses.push('Poor format compliance');
  }
  if (metrics.oneQuestionCompliance < 0.7) {
    weaknesses.push('Frequently violates ONE question rule');
  }
  if (metrics.responseQuality < 0.6) {
    weaknesses.push('Lower quality responses');
  }
  if (metrics.avgLatency > 3000) {
    weaknesses.push('Slow response times');
  }
  if (metrics.estimatedCost > 1.0) {
    weaknesses.push('Expensive for high volume');
  }

  return weaknesses.length > 0 ? weaknesses : ['No notable weaknesses'];
}
