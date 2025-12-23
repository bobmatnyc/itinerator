/**
 * Cost estimation for LLM models
 *
 * Pricing data from:
 * - OpenRouter: https://openrouter.ai/models
 * - Updated as of 2025-01-22
 */

/**
 * Pricing per 1M tokens (input/output in USD)
 */
export const MODEL_PRICING: Record<
  string,
  { input: number; output: number }
> = {
  // Anthropic models
  'anthropic/claude-sonnet-4': { input: 3, output: 15 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'anthropic/claude-opus-4': { input: 15, output: 75 },

  // OpenAI models
  'openai/gpt-4o': { input: 2.5, output: 10 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },

  // Google models
  'google/gemini-2.0-flash': { input: 0.075, output: 0.3 },
  'google/gemini-pro-1.5': { input: 1.25, output: 5 },
};

/**
 * Calculate cost for a single interaction
 * @param model - Model identifier
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    console.warn(`No pricing data for model ${model}, using 0`);
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Estimate monthly cost based on usage patterns
 * @param model - Model identifier
 * @param avgInputTokens - Average input tokens per interaction
 * @param avgOutputTokens - Average output tokens per interaction
 * @param interactionsPerMonth - Estimated monthly interactions
 * @returns Estimated monthly cost in USD
 */
export function estimateMonthlyCost(
  model: string,
  avgInputTokens: number,
  avgOutputTokens: number,
  interactionsPerMonth: number
): number {
  const costPerInteraction = calculateCost(
    model,
    avgInputTokens,
    avgOutputTokens
  );
  return costPerInteraction * interactionsPerMonth;
}

/**
 * Calculate cost per 1k interactions (useful for comparison)
 * @param model - Model identifier
 * @param avgInputTokens - Average input tokens per interaction
 * @param avgOutputTokens - Average output tokens per interaction
 * @returns Cost per 1k interactions in USD
 */
export function calculateCostPer1k(
  model: string,
  avgInputTokens: number,
  avgOutputTokens: number
): number {
  return calculateCost(model, avgInputTokens, avgOutputTokens) * 1000;
}

/**
 * Get pricing info for a model
 */
export function getPricingInfo(model: string) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return null;
  }

  return {
    model,
    inputPer1M: pricing.input,
    outputPer1M: pricing.output,
    // Example: cost for 1k interactions with 500 input + 500 output tokens
    exampleCostPer1k: calculateCostPer1k(model, 500, 500),
  };
}

/**
 * Compare costs between two models
 */
export function compareCosts(
  model1: string,
  model2: string,
  avgInputTokens: number,
  avgOutputTokens: number
): {
  model1: string;
  model2: string;
  model1CostPer1k: number;
  model2CostPer1k: number;
  costDifference: number;
  percentDifference: number;
  cheaper: string;
} {
  const cost1 = calculateCostPer1k(model1, avgInputTokens, avgOutputTokens);
  const cost2 = calculateCostPer1k(model2, avgInputTokens, avgOutputTokens);

  const costDifference = Math.abs(cost1 - cost2);
  const percentDifference =
    ((costDifference / Math.min(cost1, cost2)) * 100);

  return {
    model1,
    model2,
    model1CostPer1k: cost1,
    model2CostPer1k: cost2,
    costDifference,
    percentDifference,
    cheaper: cost1 < cost2 ? model1 : model2,
  };
}
