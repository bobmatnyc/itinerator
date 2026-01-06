/**
 * Services layer exports
 * @module services
 */

// Collection-level itinerary operations
export { ItineraryCollectionService } from './itinerary-collection.service.js';
export type { CreateItineraryInput } from './itinerary-collection.service.js';

// Content-level itinerary operations
export { ItineraryService } from './itinerary.service.js';

// Travel Agent facade
export { TravelAgentFacade } from './travel-agent-facade.service.js';
export type {
  AnalysisResult,
  SummaryResult,
  GapFillingResult,
  GapFillingOptions,
} from './travel-agent-facade.service.js';

export { SegmentService } from './segment.service.js';

export { DependencyService } from './dependency.service.js';
export type { DependencyGraph } from './dependency.service.js';

export { WorkingContextService } from './working-context.service.js';

export { LLMEvaluatorService } from './llm-evaluator.service.js';
export type {
  LLMEvaluationCriteria,
  QualitativeMetrics,
  QuantitativeMetrics,
  CompositeScores,
  ModelTestResult,
  TestCase,
  ModelComparisonReport,
  OptimizationCriteria,
} from './llm-evaluator.service.js';

export { TravelAgentService } from './travel-agent.service.js';
export type {
  TravelAgentConfig,
  PlausibilityResult,
  TravelPreferences,
  TravelSearchResult,
} from './travel-agent.service.js';

export { ModelSelectorService, AVAILABLE_MODELS } from './model-selector.service.js';
export type { ModelConfig, CostEstimate } from './model-selector.service.js';

export { normalizeImportData } from './schema-normalizer.service.js';
export type { NormalizationStats } from './schema-normalizer.service.js';

export { DurationInferenceService } from './duration-inference.service.js';
export type { InferredDuration, DurationConfidence } from './duration-inference.service.js';

export { TravelAgentReviewService } from './travel-agent-review.service.js';
export type {
  SemanticIssue,
  SemanticReviewResult,
  SemanticIssueType,
  SemanticIssueSeverity,
} from './travel-agent-review.service.js';

export { GeocodingService } from './geocoding.service.js';
export type { GeocodingResult } from './geocoding.service.js';

export { AnonymizerService } from './anonymizer.service.js';
export { EmbeddingService } from './embedding.service.js';
export type { EmbeddingConfig, EmbeddingResult, BatchEmbeddingResult } from './embedding.service.js';

// Vectra-based knowledge service
export { KnowledgeService } from './knowledge.service.js';
export type { KnowledgeConfig, ChatMessage, RAGResult } from './knowledge.service.js';

// Weaviate-based knowledge service
export { WeaviateKnowledgeService } from './weaviate-knowledge.service.js';
export type {
  RawKnowledge,
  KnowledgeContext,
  SearchContext,
  KnowledgeResult,
  KBSearchResult,
  WeaviateKnowledgeConfig,
} from './weaviate-knowledge.service.js';

// Knowledge service factory
export {
  createKnowledgeService,
  createWeaviateKnowledgeService,
  createVectraKnowledgeService,
} from './knowledge-factory.js';
export type { KnowledgeBackend } from './knowledge-factory.js';

// Currency exchange service
export { CurrencyExchangeService } from './currency-exchange.service.js';
export type { CurrencyExchangeConfig } from './currency-exchange.service.js';
