/**
 * Type definitions for model evaluation framework
 */

export interface EvalMetrics {
  formatCompliance: number; // 0-1: JSON structure correct
  oneQuestionCompliance: number; // 0-1: follows ONE question rule
  toolUseAccuracy: number; // 0-1: uses correct tools
  responseQuality: number; // 0-1: LLM-as-judge score
  avgLatency: number; // ms
  avgTokens: number; // tokens per response
  estimatedCost: number; // USD per 1k interactions
  overall: number; // 0-1: weighted average of all metrics
}

export interface EvalSample {
  prompt: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  hasValidJson: boolean;
  questionCount: number;
  toolsCalled: string[];
  formatCompliance: number;
  oneQuestionCompliance: number;
  qualityScore?: {
    relevance: number;
    helpfulness: number;
    clarity: number;
    correctness: number;
    overall: number;
    reasoning: string;
  };
}

export interface EvalResult {
  model: string;
  agent: string;
  metrics: EvalMetrics;
  samples: EvalSample[];
  timestamp: string;
}

export interface EvalConfig {
  agents: string[];
  models: string[];
  samplesPerAgent: number;
  delayBetweenRequests: number;
  enableQualityJudge: boolean;
  outputDir: string;
}

export interface TestPrompt {
  prompt: string;
  expectedBehavior: string;
  category: 'discovery' | 'refinement' | 'tool-use' | 'general';
}

export interface AgentTestSuite {
  agent: string;
  prompts: TestPrompt[];
}
