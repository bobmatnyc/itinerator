#!/usr/bin/env tsx
/**
 * Comprehensive Trip Designer Evaluation Suite
 *
 * Tests LLM instruction adherence and tool usage accuracy across multiple scenarios.
 * Evaluates both tool-calling capability and adherence to critical system instructions.
 *
 * Usage:
 *   npx tsx tests/eval/trip-designer-eval.ts
 *   npx tsx tests/eval/trip-designer-eval.ts --models=haiku,sonnet
 *   npx tsx tests/eval/trip-designer-eval.ts --models=gpt-4o-mini,gemini-flash
 *   npx tsx tests/eval/trip-designer-eval.ts --scenarios=tool-usage
 *   npx tsx tests/eval/trip-designer-eval.ts --scenarios=instruction-adherence
 *
 * Model Aliases:
 *   - haiku → anthropic/claude-3.5-haiku
 *   - sonnet → anthropic/claude-3.5-sonnet
 *   - sonnet-4 → anthropic/claude-sonnet-4
 *   - gpt-4o-mini → openai/gpt-4o-mini
 *   - gpt-4o → openai/gpt-4o
 *   - gemini-flash → google/gemini-2.0-flash
 *   - gemini-pro → google/gemini-pro-1.5
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { calculateCost } from './metrics/cost-calculator.js';
import { ALL_TOOLS } from '../../src/services/trip-designer/tools.js';

/**
 * Models to evaluate
 */
const ALL_MODELS = [
  'anthropic/claude-3.5-haiku',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-sonnet-4',
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'google/gemini-2.0-flash',
  'google/gemini-pro-1.5',
] as const;

type ModelId = typeof ALL_MODELS[number];

/**
 * Model aliases for CLI convenience
 * Maps short names to full OpenRouter model IDs
 */
const MODEL_ALIASES: Record<string, string> = {
  // Anthropic Claude
  'haiku': 'anthropic/claude-3.5-haiku',
  'claude-3.5-haiku': 'anthropic/claude-3.5-haiku',
  'sonnet': 'anthropic/claude-3.5-sonnet',
  'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  'sonnet-4': 'anthropic/claude-sonnet-4',
  'claude-sonnet-4': 'anthropic/claude-sonnet-4',
  'opus': 'anthropic/claude-opus-4',
  'claude-opus-4': 'anthropic/claude-opus-4',
  'haiku-4.5': 'anthropic/claude-haiku-4.5',
  'claude-haiku-4.5': 'anthropic/claude-haiku-4.5',
  'sonnet-4.5': 'anthropic/claude-sonnet-4.5',
  'claude-sonnet-4.5': 'anthropic/claude-sonnet-4.5',

  // OpenAI GPT
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4': 'openai/gpt-4',
  'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',

  // Google Gemini
  'gemini-flash': 'google/gemini-2.0-flash',
  'gemini-2.0-flash': 'google/gemini-2.0-flash',
  'gemini-pro': 'google/gemini-pro-1.5',
  'gemini-1.5-pro': 'google/gemini-pro-1.5',
};

/**
 * Evaluation scenario types
 */
type ScenarioType = 'tool-usage' | 'instruction-adherence';

/**
 * Tool usage test scenario
 */
interface ToolUsageScenario {
  type: 'tool-usage';
  prompt: string;
  expectedTool: string;
  requiredParams: string[];
  description: string;
}

/**
 * Instruction adherence test scenario
 */
interface InstructionScenario {
  type: 'instruction-adherence';
  prompt: string;
  criticalRule: string;
  validationFn: (response: any) => boolean;
  description: string;
  context?: { segments?: any[]; title?: string; description?: string };
}

type Scenario = ToolUsageScenario | InstructionScenario;

/**
 * Tool Usage Scenarios
 * Tests if the model calls the CORRECT tool with VALID parameters
 */
const TOOL_USAGE_SCENARIOS: ToolUsageScenario[] = [
  // Segment Creation - Flights
  {
    type: 'tool-usage',
    prompt: 'Add a flight from JFK to LAX on March 1st, departing at 9am on United Airlines flight UA123',
    expectedTool: 'add_flight',
    requiredParams: ['airline', 'flightNumber', 'origin', 'destination', 'departureTime', 'arrivalTime'],
    description: 'Flight with complete details',
  },

  // Segment Creation - Hotels
  {
    type: 'tool-usage',
    prompt: 'Add 3 nights at the Four Seasons Tokyo starting April 5th',
    expectedTool: 'add_hotel',
    requiredParams: ['property', 'location', 'checkInDate', 'checkOutDate'],
    description: 'Hotel booking with duration',
  },

  // Segment Creation - Activities
  {
    type: 'tool-usage',
    prompt: 'Add a dinner reservation at Le Bernardin in NYC for January 15 at 7:30 PM',
    expectedTool: 'add_activity',
    requiredParams: ['name', 'location', 'startTime'],
    description: 'Dining reservation',
  },
  {
    type: 'tool-usage',
    prompt: 'Schedule a meeting with John Smith at 2pm tomorrow at their office in Manhattan',
    expectedTool: 'add_meeting',
    requiredParams: ['title', 'location', 'startTime', 'endTime'],
    description: 'Business meeting',
  },
  {
    type: 'tool-usage',
    prompt: 'Add an airport transfer from LAX to the Marriott downtown on arrival day at 2pm',
    expectedTool: 'add_transfer',
    requiredParams: ['transferType', 'pickupLocation', 'dropoffLocation', 'pickupTime'],
    description: 'Ground transfer',
  },

  // Segment Management
  {
    type: 'tool-usage',
    prompt: 'Delete the dinner reservation at Le Bernardin',
    expectedTool: 'delete_segment',
    requiredParams: ['segmentId'],
    description: 'Delete segment (requires context)',
  },
  {
    type: 'tool-usage',
    prompt: 'Move the hotel check-in to the next day',
    expectedTool: 'update_segment',
    requiredParams: ['segmentId', 'updates'],
    description: 'Update segment timing',
  },

  // Search Tools
  {
    type: 'tool-usage',
    prompt: 'Find flights from SFO to Tokyo in April',
    expectedTool: 'search_flights',
    requiredParams: ['origin', 'destination', 'departureDate'],
    description: 'Flight search',
  },
  {
    type: 'tool-usage',
    prompt: 'Search for hotels near Shibuya Station in Tokyo',
    expectedTool: 'search_hotels',
    requiredParams: ['location', 'checkInDate', 'checkOutDate'],
    description: 'Hotel search',
  },

  // Information Retrieval
  {
    type: 'tool-usage',
    prompt: "What's on my itinerary so far?",
    expectedTool: 'get_itinerary',
    requiredParams: [],
    description: 'Retrieve current itinerary',
  },
];

/**
 * Instruction Adherence Scenarios
 * Tests that the model follows CRITICAL instructions from system prompt
 */
const INSTRUCTION_SCENARIOS: InstructionScenario[] = [
  // ONE question rule
  {
    type: 'instruction-adherence',
    prompt: 'I want to plan a trip to Japan',
    criticalRule: 'ONE_QUESTION_RULE',
    validationFn: (response) => {
      // Check that response contains at most 1 question mark in the text content
      const content = response.message?.content || '';
      const questionCount = (content.match(/\?/g) || []).length;
      return questionCount <= 1;
    },
    description: 'Should ask ONE question, not multiple',
  },

  // MUST call tool (not just text)
  {
    type: 'instruction-adherence',
    prompt: 'Add a lunch at Nobu Malibu tomorrow at noon',
    criticalRule: 'MUST_CALL_TOOL',
    validationFn: (response) => {
      return !!(response.message?.tool_calls && response.message.tool_calls.length > 0);
    },
    description: 'Must call add_activity tool, not just acknowledge with text',
  },

  // Don't hallucinate search results - use search_web
  {
    type: 'instruction-adherence',
    prompt: 'What are the best restaurants in Paris?',
    criticalRule: 'USE_SEARCH_NOT_HALLUCINATE',
    validationFn: (response) => {
      // Should call search_web tool OR ask clarifying question
      const hasSearchTool = response.message?.tool_calls?.some(
        (tc: any) => tc.function?.name === 'search_web'
      );
      const hasQuestion = (response.message?.content || '').includes('?');
      return hasSearchTool || hasQuestion;
    },
    description: 'Should use search_web tool, not hallucinate restaurant names',
  },

  // Don't assume missing info
  {
    type: 'instruction-adherence',
    prompt: 'Add a flight',
    criticalRule: 'ASK_BEFORE_ASSUMING',
    validationFn: (response) => {
      // Should ask for missing details (origin, destination, date)
      const content = response.message?.content || '';
      const hasQuestion = content.includes('?');
      const asksForDetails = /origin|destination|date|when|where/i.test(content);
      return hasQuestion && asksForDetails;
    },
    description: 'Should ask for origin/destination/date, not assume',
  },

  // Acknowledge confirmed bookings
  {
    type: 'instruction-adherence',
    prompt: 'Help me plan my flights',
    criticalRule: 'ACKNOWLEDGE_EXISTING_BOOKINGS',
    validationFn: (response) => {
      // Should mention existing flights in the response
      const content = response.message?.content || '';
      const mentionsFlights = /flight|JFK|LAX|United/i.test(content);
      return mentionsFlights;
    },
    description: 'Should acknowledge existing flight booking',
    context: {
      segments: [
        {
          type: 'FLIGHT',
          airline: { name: 'United Airlines', code: 'UA' },
          flightNumber: 'UA123',
          origin: { code: 'JFK', name: 'JFK Airport', city: 'New York' },
          destination: { code: 'LAX', name: 'LAX Airport', city: 'Los Angeles' },
          departureTime: '2026-03-01T09:00:00Z',
          arrivalTime: '2026-03-01T12:00:00Z',
        },
      ],
    },
  },

  // Save data with tools (update_itinerary)
  {
    type: 'instruction-adherence',
    prompt: 'I want to go to Croatia from April 14-21',
    criticalRule: 'SAVE_DATA_WITH_TOOLS',
    validationFn: (response) => {
      // Should call update_itinerary tool to save destination and dates
      const hasUpdateTool = response.message?.tool_calls?.some(
        (tc: any) => tc.function?.name === 'update_itinerary'
      );
      return !!hasUpdateTool;
    },
    description: 'Must call update_itinerary to save trip details',
  },

  // Hotel mentioned = mandatory add_hotel call
  {
    type: 'instruction-adherence',
    prompt: "We're staying at Hotel L'Esplanade in Grand Case",
    criticalRule: 'HOTEL_MENTIONED_CALL_TOOL',
    validationFn: (response) => {
      // Should call add_hotel tool
      const hasHotelTool = response.message?.tool_calls?.some(
        (tc: any) => tc.function?.name === 'add_hotel'
      );
      return !!hasHotelTool;
    },
    description: 'Must call add_hotel when hotel is mentioned',
  },

  // Booking data = ground truth (not title)
  {
    type: 'instruction-adherence',
    prompt: 'What trip am I planning?',
    criticalRule: 'BOOKINGS_ARE_GROUND_TRUTH',
    validationFn: (response) => {
      // Should mention St. Maarten (from bookings), not NYC (from title)
      const content = response.message?.content || '';
      const mentionsStMaarten = /st\.?\s*maarten|sxm/i.test(content);
      const mentionsNYCAsDestination = /going to nyc|trip to nyc|planning.*nyc/i.test(content);
      return mentionsStMaarten && !mentionsNYCAsDestination;
    },
    description: 'Should infer destination from bookings, not misleading title',
    context: {
      title: 'Deciding between NYC and St. Maarten',
      description: 'Not sure where to go yet',
      segments: [
        {
          type: 'FLIGHT',
          origin: { code: 'JFK', city: 'New York' },
          destination: { code: 'SXM', city: 'Philipsburg', country: 'St. Maarten' },
          departureTime: '2026-01-08T10:00:00Z',
        },
        {
          type: 'HOTEL',
          property: { name: "Hotel L'Esplanade" },
          location: { name: 'Grand Case', city: 'Grand Case', country: 'St. Maarten' },
          checkInDate: '2026-01-08',
          checkOutDate: '2026-01-15',
        },
      ],
    },
  },
];

/**
 * All scenarios
 */
const ALL_SCENARIOS: Scenario[] = [
  ...TOOL_USAGE_SCENARIOS,
  ...INSTRUCTION_SCENARIOS,
];

/**
 * Evaluation result for a single scenario
 */
interface ScenarioEvalResult {
  model: string;
  scenarioType: ScenarioType;
  scenario: string;
  description: string;

  // Tool Usage Metrics
  toolCallAttempted: boolean;
  correctToolCalled: boolean;
  requiredParamsPresent: boolean;
  toolUsageScore: number; // 0-1

  // Instruction Adherence Metrics
  criticalRuleFollowed: boolean;
  instructionScore: number; // 0-1

  // Overall
  passed: boolean;

  // Metadata
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;

  // Debug
  response: any;
  validationDetails?: string;
}

/**
 * Aggregate metrics for a model
 */
interface ModelEvalMetrics {
  model: string;

  // Overall scores
  toolAccuracy: number; // % of tool scenarios passed
  instructionAdherence: number; // % of instruction scenarios passed
  overallScore: number; // Combined score

  // Performance
  avgLatencyMs: number;
  totalTokens: number;
  estimatedCostPer1k: number;

  // Details
  scenariosPassed: number;
  scenariosFailed: number;
  totalScenarios: number;

  // Results
  results: ScenarioEvalResult[];
}

/**
 * System prompt for Trip Designer (minimal version for testing)
 */
const MINIMAL_SYSTEM_PROMPT = `You are an expert travel designer assistant helping users plan their trips through conversation.

CRITICAL INSTRUCTIONS:

1. TOOL CALLS ARE MANDATORY for data persistence
   - When user mentions hotels: MUST call add_hotel
   - When user mentions dining/activities: MUST call add_activity
   - When user provides trip details: MUST call update_itinerary
   - Your verbal acknowledgment is NOT enough - only tool calls save data

2. ONE QUESTION RULE
   - Ask ONE focused question at a time
   - Do not ask multiple questions in a single response

3. BOOKING DATA = GROUND TRUTH
   - Actual bookings (flights, hotels) are FACTS
   - Infer real destination from bookings, not title/description
   - If flights show destination X, user is GOING to X (not "deciding")

4. USE SEARCH TOOLS
   - For restaurant/hotel recommendations: use search_web
   - Do not hallucinate specific business names
   - Do not make up information

5. ASK BEFORE ASSUMING
   - If critical info is missing (origin, destination, dates), ASK
   - Do not assume or guess required parameters

Available tools are provided in the tools array.`;

/**
 * Build context message for scenarios with context
 */
function buildContextMessage(scenario: Scenario): ChatCompletionMessageParam[] {
  if (scenario.type !== 'instruction-adherence' || !scenario.context) {
    return [];
  }

  const { segments, title, description } = scenario.context;

  let contextStr = 'Current itinerary context:\n';

  if (title) contextStr += `Title: ${title}\n`;
  if (description) contextStr += `Description: ${description}\n`;

  if (segments && segments.length > 0) {
    contextStr += `\nSegments:\n`;
    segments.forEach((seg, idx) => {
      contextStr += `${idx + 1}. ${seg.type}: ${JSON.stringify(seg)}\n`;
    });
  }

  return [{
    role: 'system',
    content: contextStr,
  }];
}

/**
 * Evaluate a single scenario with a model
 */
async function evaluateScenario(
  client: OpenAI,
  model: string,
  scenario: Scenario
): Promise<ScenarioEvalResult> {
  const startTime = Date.now();

  try {
    // Build messages
    const contextMessages = buildContextMessage(scenario);
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: MINIMAL_SYSTEM_PROMPT },
      ...contextMessages,
      { role: 'user', content: scenario.prompt },
    ];

    // Call model
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: ALL_TOOLS as ChatCompletionTool[],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const latencyMs = Date.now() - startTime;
    const choice = response.choices[0];
    const message = choice?.message;

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const totalTokens = response.usage?.total_tokens || 0;
    const estimatedCost = calculateCost(model, inputTokens, outputTokens);

    // Evaluate based on scenario type
    let result: ScenarioEvalResult;

    if (scenario.type === 'tool-usage') {
      result = evaluateToolUsage(
        model,
        scenario,
        { message, latencyMs, inputTokens, outputTokens, totalTokens, estimatedCost }
      );
    } else {
      result = evaluateInstructionAdherence(
        model,
        scenario,
        { message, latencyMs, inputTokens, outputTokens, totalTokens, estimatedCost }
      );
    }

    return result;

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      model,
      scenarioType: scenario.type,
      scenario: scenario.prompt,
      description: scenario.description,
      toolCallAttempted: false,
      correctToolCalled: false,
      requiredParamsPresent: false,
      toolUsageScore: 0,
      criticalRuleFollowed: false,
      instructionScore: 0,
      passed: false,
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      response: null,
      validationDetails: `Error: ${errorMsg}`,
    };
  }
}

/**
 * Evaluate tool usage scenario
 */
function evaluateToolUsage(
  model: string,
  scenario: ToolUsageScenario,
  metrics: any
): ScenarioEvalResult {
  const { message, latencyMs, inputTokens, outputTokens, totalTokens, estimatedCost } = metrics;

  const toolCalls = message?.tool_calls || [];
  const toolCallAttempted = toolCalls.length > 0;

  let correctToolCalled = false;
  let requiredParamsPresent = false;
  let validationDetails = '';

  if (toolCallAttempted) {
    // Check if correct tool was called
    const correctTool = toolCalls.find(
      (tc: any) => tc.function?.name === scenario.expectedTool
    );

    correctToolCalled = !!correctTool;

    if (correctTool) {
      // Check if required params are present
      try {
        const args = JSON.parse(correctTool.function.arguments);
        const missingParams = scenario.requiredParams.filter(
          param => !(param in args) && !hasNestedParam(args, param)
        );

        requiredParamsPresent = missingParams.length === 0;

        if (!requiredParamsPresent) {
          validationDetails = `Missing required params: ${missingParams.join(', ')}`;
        }
      } catch (e) {
        validationDetails = 'Failed to parse tool arguments';
      }
    } else {
      const calledTools = toolCalls.map((tc: any) => tc.function?.name).join(', ');
      validationDetails = `Called wrong tool(s): ${calledTools} (expected: ${scenario.expectedTool})`;
    }
  } else {
    validationDetails = 'No tool call attempted (text-only response)';
  }

  // Calculate score
  const toolUsageScore = (
    (toolCallAttempted ? 0.33 : 0) +
    (correctToolCalled ? 0.33 : 0) +
    (requiredParamsPresent ? 0.34 : 0)
  );

  const passed = toolCallAttempted && correctToolCalled && requiredParamsPresent;

  return {
    model,
    scenarioType: 'tool-usage',
    scenario: scenario.prompt,
    description: scenario.description,
    toolCallAttempted,
    correctToolCalled,
    requiredParamsPresent,
    toolUsageScore,
    criticalRuleFollowed: passed,
    instructionScore: passed ? 1 : 0,
    passed,
    latencyMs,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    response: message,
    validationDetails,
  };
}

/**
 * Evaluate instruction adherence scenario
 */
function evaluateInstructionAdherence(
  model: string,
  scenario: InstructionScenario,
  metrics: any
): ScenarioEvalResult {
  const { message, latencyMs, inputTokens, outputTokens, totalTokens, estimatedCost } = metrics;

  let criticalRuleFollowed = false;
  let validationDetails = '';

  try {
    criticalRuleFollowed = scenario.validationFn({ message });
    if (!criticalRuleFollowed) {
      validationDetails = `Failed validation for rule: ${scenario.criticalRule}`;
    }
  } catch (error) {
    validationDetails = `Validation error: ${error instanceof Error ? error.message : String(error)}`;
  }

  const instructionScore = criticalRuleFollowed ? 1 : 0;

  // Tool usage metrics (not primary for instruction scenarios)
  const toolCalls = message?.tool_calls || [];
  const toolCallAttempted = toolCalls.length > 0;

  return {
    model,
    scenarioType: 'instruction-adherence',
    scenario: scenario.prompt,
    description: scenario.description,
    toolCallAttempted,
    correctToolCalled: false, // Not applicable for instruction scenarios
    requiredParamsPresent: false, // Not applicable
    toolUsageScore: 0, // Not primary metric
    criticalRuleFollowed,
    instructionScore,
    passed: criticalRuleFollowed,
    latencyMs,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
    response: message,
    validationDetails,
  };
}

/**
 * Check if args has a nested parameter (e.g., "origin.code")
 */
function hasNestedParam(args: any, param: string): boolean {
  const parts = param.split('.');
  let current = args;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }

  return true;
}

/**
 * Aggregate results by model
 */
function aggregateResults(results: ScenarioEvalResult[]): ModelEvalMetrics[] {
  const byModel = new Map<string, ScenarioEvalResult[]>();

  for (const result of results) {
    if (!byModel.has(result.model)) {
      byModel.set(result.model, []);
    }
    byModel.get(result.model)!.push(result);
  }

  return Array.from(byModel.entries()).map(([model, modelResults]) => {
    const toolScenarios = modelResults.filter(r => r.scenarioType === 'tool-usage');
    const instructionScenarios = modelResults.filter(r => r.scenarioType === 'instruction-adherence');

    const toolAccuracy = toolScenarios.length > 0
      ? toolScenarios.filter(r => r.passed).length / toolScenarios.length
      : 0;

    const instructionAdherence = instructionScenarios.length > 0
      ? instructionScenarios.filter(r => r.passed).length / instructionScenarios.length
      : 0;

    const overallScore = (toolAccuracy + instructionAdherence) / 2;

    const avgLatencyMs = modelResults.reduce((sum, r) => sum + r.latencyMs, 0) / modelResults.length;
    const totalTokens = modelResults.reduce((sum, r) => sum + r.totalTokens, 0);

    // Calculate cost per 1k interactions (assuming avg tokens per interaction)
    const avgTokensPerInteraction = totalTokens / modelResults.length;
    const costPer1k = calculateCost(model, avgTokensPerInteraction / 2, avgTokensPerInteraction / 2) * 1000;

    return {
      model,
      toolAccuracy,
      instructionAdherence,
      overallScore,
      avgLatencyMs,
      totalTokens,
      estimatedCostPer1k: costPer1k,
      scenariosPassed: modelResults.filter(r => r.passed).length,
      scenariosFailed: modelResults.filter(r => !r.passed).length,
      totalScenarios: modelResults.length,
      results: modelResults,
    };
  });
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(metrics: ModelEvalMetrics[]): string {
  const sortedByScore = [...metrics].sort((a, b) => b.overallScore - a.overallScore);

  let md = '# Trip Designer Comprehensive Evaluation\n\n';
  md += `*Generated: ${new Date().toISOString()}*\n\n`;

  // Summary table
  md += '## Overall Results\n\n';
  md += '| Model | Tool Accuracy | Instruction Adherence | Avg Latency | Cost/1k | Overall |\n';
  md += '|-------|---------------|----------------------|-------------|---------|---------|\\n';

  for (const m of sortedByScore) {
    const toolPct = (m.toolAccuracy * 100).toFixed(0) + '%';
    const instrPct = (m.instructionAdherence * 100).toFixed(0) + '%';
    const latency = m.avgLatencyMs.toFixed(0) + 'ms';
    const cost = '$' + m.estimatedCostPer1k.toFixed(2);
    const overall = (m.overallScore * 100).toFixed(0) + '%';

    md += `| ${m.model} | ${toolPct} | ${instrPct} | ${latency} | ${cost} | ${overall} |\n`;
  }

  // Detailed results
  md += '\n## Detailed Results\n\n';

  for (const m of sortedByScore) {
    md += `### ${m.model}\n\n`;
    md += `- **Overall Score**: ${(m.overallScore * 100).toFixed(1)}%\n`;
    md += `- **Tool Accuracy**: ${(m.toolAccuracy * 100).toFixed(1)}% (${m.results.filter(r => r.scenarioType === 'tool-usage' && r.passed).length}/${m.results.filter(r => r.scenarioType === 'tool-usage').length} passed)\n`;
    md += `- **Instruction Adherence**: ${(m.instructionAdherence * 100).toFixed(1)}% (${m.results.filter(r => r.scenarioType === 'instruction-adherence' && r.passed).length}/${m.results.filter(r => r.scenarioType === 'instruction-adherence').length} passed)\n`;
    md += `- **Avg Latency**: ${m.avgLatencyMs.toFixed(0)}ms\n`;
    md += `- **Est. Cost/1k**: $${m.estimatedCostPer1k.toFixed(2)}\n\n`;

    // Failed scenarios
    const failed = m.results.filter(r => !r.passed);
    if (failed.length > 0) {
      md += '**Failed Scenarios:**\n';
      for (const f of failed) {
        md += `- ${f.description}: ${f.validationDetails}\n`;
      }
      md += '\n';
    }
  }

  // Recommendations
  md += '## Recommendations\n\n';
  const best = sortedByScore[0];
  const cheapest = [...metrics].sort((a, b) => a.estimatedCostPer1k - b.estimatedCostPer1k)[0];
  const fastest = [...metrics].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];

  md += `- **Best Overall**: ${best.model} (${(best.overallScore * 100).toFixed(1)}% score)\n`;
  md += `- **Most Cost-Effective**: ${cheapest.model} ($${cheapest.estimatedCostPer1k.toFixed(2)}/1k)\n`;
  md += `- **Fastest**: ${fastest.model} (${fastest.avgLatencyMs.toFixed(0)}ms avg)\n`;

  return md;
}

/**
 * Resolve model alias to full OpenRouter model ID
 */
function resolveModelAlias(alias: string): string {
  // Check if it's already a full model ID (contains "/")
  if (alias.includes('/')) {
    return alias;
  }

  // Try to resolve alias
  const resolved = MODEL_ALIASES[alias.toLowerCase()];
  if (resolved) {
    return resolved;
  }

  // If not found in aliases, try prefixing common providers
  if (alias.startsWith('claude')) {
    return `anthropic/${alias}`;
  }
  if (alias.startsWith('gpt')) {
    return `openai/${alias}`;
  }
  if (alias.startsWith('gemini')) {
    return `google/${alias}`;
  }

  // Return as-is if no match (will likely fail, but let OpenRouter handle it)
  return alias;
}

/**
 * Parse CLI arguments
 */
function parseArgs(): { models: string[]; scenarios: ScenarioType[] } {
  const args = process.argv.slice(2);
  const modelsArg = args.find(a => a.startsWith('--models='));
  const scenariosArg = args.find(a => a.startsWith('--scenarios='));

  let models: string[];
  if (modelsArg) {
    // Resolve aliases to full model IDs
    const modelAliases = modelsArg.split('=')[1].split(',').map(m => m.trim());
    models = modelAliases.map(resolveModelAlias);
  } else {
    models = [...ALL_MODELS];
  }

  const scenarios = scenariosArg
    ? (scenariosArg.split('=')[1].split(',').map(s => s.trim()) as ScenarioType[])
    : (['tool-usage', 'instruction-adherence'] as ScenarioType[]);

  return { models, scenarios };
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

  // Parse arguments
  const { models, scenarios: scenarioTypes } = parseArgs();

  // Filter scenarios by type
  const scenarios = ALL_SCENARIOS.filter(s => (scenarioTypes as string[]).includes(s.type));

  console.log('Trip Designer Comprehensive Evaluation');
  console.log('======================================\n');
  console.log(`Models: ${models.join(', ')}`);
  console.log(`Scenario Types: ${scenarioTypes.join(', ')}`);
  console.log(`Total Scenarios: ${scenarios.length}\n`);

  // Initialize client
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/itinerizer',
      'X-Title': 'Itinerizer Trip Designer Eval',
    },
  });

  const allResults: ScenarioEvalResult[] = [];

  // Evaluate each model
  for (const model of models) {
    console.log(`\nEvaluating ${model}...`);

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      console.log(`  [${i + 1}/${scenarios.length}] ${scenario.description}...`);

      const result = await evaluateScenario(client, model, scenario);
      allResults.push(result);

      const status = result.passed ? '✅' : '❌';
      console.log(`    ${status} ${result.passed ? 'PASSED' : 'FAILED'}`);

      if (!result.passed && result.validationDetails) {
        console.log(`       ${result.validationDetails}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Aggregate results
  const metrics = aggregateResults(allResults);

  // Generate outputs
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const resultsDir = join(process.cwd(), 'tests/eval/results');

  // Ensure results directory exists
  mkdirSync(resultsDir, { recursive: true });

  // Write JSON
  const jsonPath = join(resultsDir, `trip-designer-comprehensive-eval-${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify({ metrics, allResults }, null, 2));

  // Write Markdown
  const markdown = generateMarkdownReport(metrics);
  const mdPath = join(resultsDir, `trip-designer-comprehensive-eval-${timestamp}.md`);
  writeFileSync(mdPath, markdown);

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('EVALUATION COMPLETE');
  console.log('='.repeat(80));
  console.log('\nResults written to:');
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  Markdown: ${mdPath}`);

  console.log('\n' + markdown);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEvaluation().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runEvaluation, evaluateScenario, ALL_SCENARIOS, TOOL_USAGE_SCENARIOS, INSTRUCTION_SCENARIOS };
