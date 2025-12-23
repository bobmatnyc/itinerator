/**
 * Model configurations for E2E testing
 *
 * LOCKED_MODELS: Production model assignments for each agent type
 * EVAL_MODELS: Models available for evaluation and experimentation
 */

export const LOCKED_MODELS = {
  'trip-designer': {
    model: 'anthropic/claude-sonnet-4',
    description: 'Best balance of reasoning, tool use, and cost',
    maxTokens: 4096,
  },
  'help': {
    model: 'anthropic/claude-3-haiku',
    description: 'Fast and cheap for simple Q&A',
    maxTokens: 2048,
  },
  'travel-agent': {
    model: 'anthropic/claude-sonnet-4',
    description: 'Needs reasoning for search synthesis',
    maxTokens: 4096,
  },
} as const;

export const EVAL_MODELS = [
  'anthropic/claude-sonnet-4',
  'anthropic/claude-3-haiku',
  'anthropic/claude-opus-4',
  'openai/gpt-4o',
  'google/gemini-2.0-flash',
] as const;

export type AgentType = keyof typeof LOCKED_MODELS;
export type EvalModel = (typeof EVAL_MODELS)[number];

/**
 * Get the locked production model for an agent type
 */
export function getModelForAgent(agent: AgentType): string {
  return LOCKED_MODELS[agent].model;
}

/**
 * Get the max tokens configuration for an agent type
 */
export function getMaxTokensForAgent(agent: AgentType): number {
  return LOCKED_MODELS[agent].maxTokens;
}

/**
 * Get full model configuration for an agent type
 */
export function getModelConfig(agent: AgentType) {
  return LOCKED_MODELS[agent];
}

/**
 * Validate that a model is in the eval set
 */
export function isEvalModel(model: string): model is EvalModel {
  return EVAL_MODELS.includes(model as EvalModel);
}

/**
 * Get description for a model
 */
export function getModelDescription(agent: AgentType): string {
  return LOCKED_MODELS[agent].description;
}
