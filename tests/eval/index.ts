/**
 * Model evaluation framework
 *
 * Main entry point for the evaluation system
 */

export * from './types';
export * from './test-prompts';
export { runEvaluation, runAgentEval, calculateMetrics } from './model-comparison';
export {
  evaluateFormatCompliance,
  evaluateJsonCompliance,
  evaluateOneQuestionRule,
  evaluateMarkdownQuality,
  getQuestionCount,
} from './metrics/format-compliance';
export {
  evaluateResponseQuality,
  batchEvaluateQuality,
  aggregateQualityScores,
} from './metrics/quality-judge';
export {
  calculateCost,
  estimateMonthlyCost,
  calculateCostPer1k,
  getPricingInfo,
  compareCosts,
  MODEL_PRICING,
} from './metrics/cost-calculator';
export {
  generateConsoleReport,
  generateMarkdownReport,
  generateRecommendationsFile,
} from './report-generator';
