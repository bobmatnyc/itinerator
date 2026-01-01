#!/usr/bin/env tsx
/**
 * Model Tool-Calling Evaluation
 *
 * Evaluates which LLMs properly call tools vs. just generating text responses.
 * Tests the Trip Designer's add_activity tool across multiple models.
 *
 * Usage:
 *   npx tsx tests/eval/model-tool-calling.ts
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Models to test for tool-calling capability
 */
const TEST_MODELS = [
  'anthropic/claude-3.5-haiku',
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'google/gemini-flash-1.5',
  'meta-llama/llama-3.1-70b-instruct',
] as const;

/**
 * Test prompt designed to trigger add_activity tool
 */
const TEST_PROMPT = 'Add a dinner reservation at Le Bernardin in New York for January 15th at 7:30 PM';

/**
 * Tool result classification
 */
type ToolCallResult =
  | { type: 'correct'; tool: string }
  | { type: 'wrong_tool'; tool: string }
  | { type: 'text_only'; content: string }
  | { type: 'error'; error: string };

/**
 * Test result for a single model
 */
interface ModelTestResult {
  model: string;
  result: ToolCallResult;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  response: string;
}

/**
 * Add activity tool definition (simplified for testing)
 */
const ADD_ACTIVITY_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'add_activity',
    description: 'Add an activity, dining experience, or attraction to the itinerary. Use this when user mentions restaurants, tours, shows, or activities.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Activity name or restaurant name',
        },
        description: {
          type: 'string',
          description: 'Description of the activity',
        },
        location: {
          type: 'object',
          description: 'Activity location',
          properties: {
            name: { type: 'string', description: 'Venue or location name' },
            city: { type: 'string', description: 'City name' },
            country: { type: 'string', description: 'Country name' },
          },
          required: ['name'],
        },
        startTime: {
          type: 'string',
          format: 'date-time',
          description: 'Activity start date and time in ISO 8601 format',
        },
        endTime: {
          type: 'string',
          format: 'date-time',
          description: 'Activity end date and time in ISO 8601 format (if known)',
        },
        category: {
          type: 'string',
          description: 'Activity category (e.g., "dining", "tour", "museum")',
        },
        notes: {
          type: 'string',
          description: 'Additional notes or requirements',
        },
      },
      required: ['name', 'location', 'startTime'],
    },
  },
};

/**
 * Minimal system prompt for Trip Designer
 */
const SYSTEM_PROMPT = `You are a trip planning assistant. Help users plan their travel itineraries.

CRITICAL INSTRUCTION: When the user mentions adding an activity, restaurant reservation, or any event to their itinerary, you MUST call the add_activity tool. Do NOT just acknowledge with text - you must use the tool to actually add it to the itinerary.

Current itinerary context:
- Destination: New York City
- Dates: January 15-20, 2026
- Travelers: 2 adults

Available tools:
- add_activity: Add any activity, dining, or attraction to the itinerary`;

/**
 * Call a model with the test prompt
 */
async function testModel(
  client: OpenAI,
  model: string
): Promise<ModelTestResult> {
  const startTime = Date.now();

  try {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: TEST_PROMPT },
    ];

    const response = await client.chat.completions.create({
      model,
      messages,
      tools: [ADD_ACTIVITY_TOOL],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const latencyMs = Date.now() - startTime;
    const choice = response.choices[0];
    const message = choice?.message;

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const totalTokens = response.usage?.total_tokens || 0;

    // Classify the result
    let result: ToolCallResult;
    let responseText = '';

    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      // Type guard for function tool calls
      if (toolCall.type === 'function') {
        const toolName = toolCall.function.name;

        if (toolName === 'add_activity') {
          result = { type: 'correct', tool: toolName };
        } else {
          result = { type: 'wrong_tool', tool: toolName };
        }

        responseText = JSON.stringify(toolCall.function.arguments);
      } else {
        result = { type: 'error', error: 'Unknown tool call type' };
        responseText = '';
      }
    } else if (message?.content) {
      result = { type: 'text_only', content: message.content };
      responseText = message.content;
    } else {
      result = { type: 'error', error: 'No message content or tool calls' };
      responseText = '';
    }

    return {
      model,
      result,
      latencyMs,
      inputTokens,
      outputTokens,
      totalTokens,
      response: responseText,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      model,
      result: { type: 'error', error: errorMsg },
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      response: '',
    };
  }
}

/**
 * Format result as emoji + description
 */
function formatResult(result: ToolCallResult): { emoji: string; description: string } {
  switch (result.type) {
    case 'correct':
      return { emoji: '✅', description: `Called ${result.tool}` };
    case 'wrong_tool':
      return { emoji: '⚠️', description: `Called wrong tool: ${result.tool}` };
    case 'text_only':
      return { emoji: '❌', description: 'Text response only (no tool call)' };
    case 'error':
      return { emoji: '💥', description: `Error: ${result.error}` };
  }
}

/**
 * Print comparison table
 */
function printComparisonTable(results: ModelTestResult[]): void {
  console.log('\n' + '='.repeat(100));
  console.log('MODEL TOOL-CALLING COMPARISON');
  console.log('='.repeat(100));
  console.log(`Test Prompt: "${TEST_PROMPT}"\n`);

  // Table header
  console.log('┌─────────────────────────────────────┬──────┬─────────────────────────────────────────┬──────────┬────────┐');
  console.log('│ Model                               │ Pass │ Result                                  │ Latency  │ Tokens │');
  console.log('├─────────────────────────────────────┼──────┼─────────────────────────────────────────┼──────────┼────────┤');

  // Results
  for (const testResult of results) {
    const { emoji, description } = formatResult(testResult.result);
    const model = testResult.model.padEnd(35);
    const pass = emoji.padEnd(4);
    const resultDesc = description.padEnd(39);
    const latency = `${testResult.latencyMs}ms`.padStart(8);
    const tokens = testResult.totalTokens.toString().padStart(6);

    console.log(`│ ${model} │ ${pass} │ ${resultDesc} │ ${latency} │ ${tokens} │`);
  }

  console.log('└─────────────────────────────────────┴──────┴─────────────────────────────────────────┴──────────┴────────┘');

  // Summary
  const passed = results.filter((r) => r.result.type === 'correct').length;
  const failed = results.filter((r) => r.result.type === 'text_only').length;
  const errors = results.filter((r) => r.result.type === 'error').length;
  const wrongTool = results.filter((r) => r.result.type === 'wrong_tool').length;

  console.log('\nSummary:');
  console.log(`  ✅ Correct tool calls: ${passed}/${results.length}`);
  console.log(`  ❌ Text-only responses: ${failed}/${results.length}`);
  console.log(`  ⚠️  Wrong tool called: ${wrongTool}/${results.length}`);
  console.log(`  💥 Errors: ${errors}/${results.length}`);

  // Show detailed responses for failed cases
  const failedTests = results.filter((r) => r.result.type !== 'correct');
  if (failedTests.length > 0) {
    console.log('\n' + '='.repeat(100));
    console.log('FAILED TEST DETAILS');
    console.log('='.repeat(100));

    for (const test of failedTests) {
      const { emoji, description } = formatResult(test.result);
      console.log(`\n${emoji} ${test.model}: ${description}`);
      if (test.response) {
        const preview = test.response.substring(0, 200);
        console.log(`Response preview: ${preview}${test.response.length > 200 ? '...' : ''}`);
      }
    }
  }

  console.log('\n' + '='.repeat(100));
}

/**
 * Main evaluation function
 */
async function runEvaluation(): Promise<void> {
  // Check for API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENROUTER_API_KEY environment variable not set');
    process.exit(1);
  }

  // Initialize OpenRouter client
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/itinerizer',
      'X-Title': 'Itinerizer Tool-Calling Eval',
    },
  });

  console.log('Starting Tool-Calling Evaluation');
  console.log('Testing models with prompt:', TEST_PROMPT);
  console.log('Expected: Model should call add_activity tool\n');

  const results: ModelTestResult[] = [];

  // Test each model
  for (const model of TEST_MODELS) {
    console.log(`Testing ${model}...`);
    const result = await testModel(client, model);
    results.push(result);

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Print comparison table
  printComparisonTable(results);

  console.log('\nEvaluation complete! 🎉\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEvaluation().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runEvaluation, testModel, TEST_MODELS, TEST_PROMPT };
