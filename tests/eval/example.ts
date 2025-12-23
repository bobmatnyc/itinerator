#!/usr/bin/env tsx
/**
 * Example/test script for the model evaluation framework
 * Demonstrates how to use individual metrics
 */

import { evaluateFormatCompliance } from './metrics/format-compliance';
import { calculateCost, compareCosts } from './metrics/cost-calculator';

console.log('Model Evaluation Framework - Example\n');
console.log('='.repeat(80));

// Example 1: Format Compliance
console.log('\n1. Format Compliance Evaluation\n');

const exampleResponse = `
I'd be happy to help you plan your trip to Japan!

To get started, I have a question for you:

\`\`\`json
{
  "discovery": [
    "When are you planning to travel to Japan?"
  ]
}
\`\`\`

This will help me understand your timeframe and provide better recommendations.
`;

const formatResult = evaluateFormatCompliance(exampleResponse);

console.log('Response:', exampleResponse.trim());
console.log('\nFormat Compliance Results:');
console.log('  JSON Compliance:', formatResult.jsonCompliance.toFixed(2));
console.log(
  '  One Question Compliance:',
  formatResult.oneQuestionCompliance.toFixed(2)
);
console.log('  Markdown Quality:', formatResult.markdownQuality.toFixed(2));
console.log('  Overall Score:', formatResult.overall.toFixed(2));
console.log('\nDetails:');
console.log('  Has Valid JSON:', formatResult.details.hasValidJson);
console.log('  Question Count:', formatResult.details.questionCount);
console.log('  Questions:', formatResult.details.questionDetails);

// Example 2: Cost Calculation
console.log('\n\n2. Cost Calculation\n');
console.log('-'.repeat(80));

const model = 'anthropic/claude-sonnet-4';
const inputTokens = 500;
const outputTokens = 300;

const cost = calculateCost(model, inputTokens, outputTokens);
console.log(`Cost for ${model}:`);
console.log(`  Input: ${inputTokens} tokens`);
console.log(`  Output: ${outputTokens} tokens`);
console.log(`  Total Cost: $${cost.toFixed(4)}`);

// Example 3: Cost Comparison
console.log('\n\n3. Model Cost Comparison\n');
console.log('-'.repeat(80));

const comparison = compareCosts(
  'anthropic/claude-sonnet-4',
  'anthropic/claude-3-haiku',
  500,
  500
);

console.log('Comparing models with 500 input + 500 output tokens:\n');
console.log(`${comparison.model1}:`);
console.log(`  Cost per 1k interactions: $${comparison.model1CostPer1k.toFixed(2)}`);
console.log(`\n${comparison.model2}:`);
console.log(`  Cost per 1k interactions: $${comparison.model2CostPer1k.toFixed(2)}`);
console.log(`\nCheaper model: ${comparison.cheaper}`);
console.log(`Cost difference: $${comparison.costDifference.toFixed(2)} (${comparison.percentDifference.toFixed(1)}%)`);

// Example 4: Multiple Questions (Violation)
console.log('\n\n4. One Question Rule Violation Example\n');
console.log('-'.repeat(80));

const violationResponse = `
\`\`\`json
{
  "discovery": [
    "When are you planning to travel?",
    "How many people will be traveling?",
    "What is your budget?"
  ]
}
\`\`\`
`;

const violationResult = evaluateFormatCompliance(violationResponse);

console.log('Response:', violationResponse.trim());
console.log('\nOne Question Compliance:', violationResult.oneQuestionCompliance.toFixed(2));
console.log('Question Count:', violationResult.details.questionCount);
console.log(
  'Status:',
  violationResult.oneQuestionCompliance === 0 ? '❌ VIOLATION' : '✅ COMPLIANT'
);

console.log('\n' + '='.repeat(80));
console.log('Example complete!\n');
