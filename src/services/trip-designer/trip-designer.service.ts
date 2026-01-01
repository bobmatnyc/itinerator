/**
 * Trip Designer Agent service - conversational trip planning
 * @module services/trip-designer/trip-designer
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { createStorageError, createValidationError } from '../../core/errors.js';
import type { StorageError, ValidationError } from '../../core/errors.js';
import { err, ok } from '../../core/result.js';
import type { Result } from '../../core/result.js';
import type { ItineraryId, SegmentId } from '../../domain/types/branded.js';
import type {
  TripDesignerConfig,
  TripDesignerSession,
  SessionId,
  AgentResponse,
  ToolCall,
  ToolExecutionResult,
  TripDesignerError,
  Message,
  StreamEvent,
} from '../../domain/types/trip-designer.js';
import { SessionManager, InMemorySessionStorage } from './session.js';
import type { SessionStorage } from './session.js';
import { ALL_TOOLS, ESSENTIAL_TOOLS, HELP_AGENT_TOOLS } from './tools.js';
import { TRIP_DESIGNER_SYSTEM_PROMPT, TRIP_DESIGNER_SYSTEM_PROMPT_MINIMAL, COMPACTION_SYSTEM_PROMPT, HELP_AGENT_SYSTEM_PROMPT } from '../../prompts/index.js';
import type { TripDesignerMode } from '../../domain/types/trip-designer.js';
import { ToolExecutor } from './tool-executor.js';
import type { KnowledgeService } from '../knowledge.service.js';
import type { WeaviateKnowledgeService } from '../weaviate-knowledge.service.js';
import type { TravelAgentFacade } from '../travel-agent-facade.service.js';
import { isWeaviateKnowledgeService } from '../knowledge-factory.js';
import { summarizeItineraryMinimal, summarizeItinerary, generateMismatchWarning } from './itinerary-summarizer.js';

/**
 * Default model for Trip Designer
 *
 * Model Selection (2025-12-23):
 * - Claude 3.5 Haiku: Recommended replacement for deprecated Claude 3 Haiku
 * - Better format compliance, perfect ONE question rule, cost-effective
 * - See: tests/eval/results/EVALUATION_SUMMARY.md
 *
 * Available Haiku models (OpenRouter):
 * - claude-3-haiku: $0.25/1M (deprecated soon)
 * - claude-3.5-haiku: $0.80/1M (current, recommended)
 * - claude-haiku-4.5: $1.00/1M (latest)
 *
 * Can be overridden via TripDesignerConfig.model
 */
const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku';

/**
 * Claude 3.5 Haiku pricing (USD per 1M tokens)
 * See: https://openrouter.ai/anthropic/claude-3.5-haiku
 */
const CLAUDE_PRICING = {
  inputCostPer1M: 0.80,
  outputCostPer1M: 4.00,
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<TripDesignerConfig> = {
  model: DEFAULT_MODEL,
  maxTokens: 4096,
  temperature: 0.7,
  sessionCostLimit: 2.0,
  streaming: false,
  compactionThreshold: 0.5, // 50% = 100k tokens for more aggressive compression
};

/**
 * Trip Designer Agent service
 */
export class TripDesignerService {
  private client: OpenAI;
  private config: TripDesignerConfig;
  private sessionManager: SessionManager;
  private toolExecutor: ToolExecutor;
  private deps: {
    itineraryService?: unknown;
    segmentService?: unknown;
    dependencyService?: unknown;
  };
  private knowledgeService?: KnowledgeService | WeaviateKnowledgeService;
  private knowledgeInitialized = false;
  private travelAgentFacade?: TravelAgentFacade;

  /**
   * Create a new Trip Designer service
   */
  constructor(
    config: TripDesignerConfig,
    sessionStorage?: SessionStorage,
    dependencies?: {
      itineraryService?: unknown;
      segmentService?: unknown;
      dependencyService?: unknown;
      knowledgeService?: KnowledgeService | WeaviateKnowledgeService;
      travelAgentFacade?: TravelAgentFacade;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize OpenRouter client
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/itinerizer',
        'X-Title': 'Itinerizer Trip Designer',
      },
    });

    // Initialize session manager
    const storage = sessionStorage || new InMemorySessionStorage();
    this.sessionManager = new SessionManager(storage);

    // Initialize tool executor
    this.toolExecutor = new ToolExecutor(dependencies);

    // Store dependencies for use in buildMessages
    this.deps = {
      itineraryService: dependencies?.itineraryService,
      segmentService: dependencies?.segmentService,
      dependencyService: dependencies?.dependencyService,
    };

    // Store knowledge service if provided (lazy initialization)
    this.knowledgeService = dependencies?.knowledgeService;

    // Store travel agent facade if provided
    this.travelAgentFacade = dependencies?.travelAgentFacade;
  }

  /**
   * Truncate tool result to prevent token bloat
   * Limits result size to maxChars to avoid overwhelming context
   */
  private truncateToolResult(result: unknown, maxChars: number = 2000): string {
    const jsonStr = JSON.stringify(result);
    if (jsonStr.length <= maxChars) {
      return jsonStr;
    }

    // Truncate and add indicator
    return jsonStr.substring(0, maxChars) + '... [truncated]';
  }

  /**
   * Get tools based on agent mode and message count
   */
  private getToolsForMode(agentMode: TripDesignerMode | undefined, isFirstMessage: boolean): ChatCompletionTool[] {
    // Help mode only has the switch_to_trip_designer tool
    if (agentMode === 'help') {
      return HELP_AGENT_TOOLS as ChatCompletionTool[];
    }

    // Trip designer mode: use essential tools for first message, all tools otherwise
    const tools = isFirstMessage ? ESSENTIAL_TOOLS : ALL_TOOLS;
    return tools as ChatCompletionTool[];
  }

  /**
   * Get system prompt based on agent mode
   */
  private getSystemPromptForMode(agentMode: TripDesignerMode | undefined): string {
    if (agentMode === 'help') {
      return HELP_AGENT_SYSTEM_PROMPT;
    }
    return TRIP_DESIGNER_SYSTEM_PROMPT;
  }

  /**
   * Create a new trip planning session or help session
   * If the itinerary already has content, injects a summary into the initial context
   */
  async createSession(itineraryId?: ItineraryId, mode: 'trip-designer' | 'help' = 'trip-designer'): Promise<Result<SessionId, StorageError>> {
    const sessionResult = await this.sessionManager.createSession(itineraryId, mode);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const session = sessionResult.value;

    // Check if the itinerary has existing content
    if (this.deps.itineraryService) {
      const itineraryService = this.deps.itineraryService as any;
      const itineraryResult = await itineraryService.get(itineraryId);

      if (itineraryResult.success) {
        const itinerary = itineraryResult.value;

        // If itinerary has segments or meaningful metadata, inject context
        const hasContent =
          itinerary.segments.length > 0 ||
          itinerary.title !== 'New Itinerary' ||
          (itinerary.destinations && itinerary.destinations.length > 0) ||
          (itinerary.tripPreferences && Object.keys(itinerary.tripPreferences).length > 0);

        if (hasContent) {
          // Check for title/destination mismatch FIRST - this gets top priority
          const mismatchWarning = generateMismatchWarning(itinerary);

          // Use Travel Agent facade for summary if available, otherwise fallback to direct summarizer
          let summary: string;
          if (this.travelAgentFacade) {
            const summaryResult = await this.travelAgentFacade.summarize(itineraryId);
            if (summaryResult.success) {
              summary = summaryResult.value.summary;
            } else {
              // Fallback to direct summarizer if Travel Agent fails
              summary = summarizeItinerary(itinerary);
            }
          } else {
            // Fallback to direct summarizer if Travel Agent not available
            summary = summarizeItinerary(itinerary);
          }

          // Build context message with mismatch warning appearing FIRST if present
          let contextMessage = '';

          if (mismatchWarning) {
            // CRITICAL: Mismatch warning goes at the very top for maximum visibility
            contextMessage = `${mismatchWarning}

---

The user is working on an existing itinerary. Here's the current state:

${summary}

Important: Since the itinerary already has content, skip any questions about information that's already provided in the summary above. Instead, acknowledge what's already planned and offer to help refine, modify, or extend the itinerary.

CRITICAL: If the summary shows "⚠️ EXISTING BOOKINGS" with luxury/premium properties or cabin classes, DO NOT ask about travel style or budget - infer the luxury/premium preference from the bookings and proceed accordingly. The existing bookings define the expected quality level.`;
          } else {
            // No mismatch - use standard context message
            contextMessage = `The user is working on an existing itinerary. Here's the current state:

${summary}

Important: Since the itinerary already has content, skip any questions about information that's already provided in the summary above. Instead, acknowledge what's already planned and offer to help refine, modify, or extend the itinerary.

CRITICAL: If the summary shows "⚠️ EXISTING BOOKINGS" with luxury/premium properties or cabin classes, DO NOT ask about travel style or budget - infer the luxury/premium preference from the bookings and proceed accordingly. The existing bookings define the expected quality level.`;
          }

          await this.sessionManager.addMessage(session.id, {
            role: 'system',
            content: contextMessage,
          });
        }
      }
    }

    return ok(session.id);
  }

  /**
   * Create a new help session
   * This session starts in help mode and can switch to trip designer mode
   */
  async createHelpSession(itineraryId: ItineraryId): Promise<Result<SessionId, StorageError>> {
    const sessionResult = await this.sessionManager.createSession(itineraryId);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const session = sessionResult.value;

    // Set initial mode to help
    session.agentMode = 'help';
    await this.sessionManager.updateSession(session);

    return ok(session.id);
  }

  /**
   * Set the agent mode for an existing session
   */
  async setAgentMode(sessionId: SessionId, mode: TripDesignerMode): Promise<Result<void, StorageError>> {
    const sessionResult = await this.sessionManager.getSession(sessionId);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const session = sessionResult.value;
    session.agentMode = mode;
    return this.sessionManager.updateSession(session);
  }

  /**
   * Send a message and get agent response
   */
  async chat(
    sessionId: SessionId,
    userMessage: string
  ): Promise<Result<AgentResponse, TripDesignerError>> {
    // Get session
    const sessionResult = await this.sessionManager.getSession(sessionId);
    if (!sessionResult.success) {
      return err({ type: 'session_not_found', sessionId });
    }

    const session = sessionResult.value;

    // Add user message to session
    const addMessageResult = await this.sessionManager.addMessage(sessionId, {
      role: 'user',
      content: userMessage,
    });

    if (!addMessageResult.success) {
      return err({ type: 'session_not_found', sessionId });
    }

    // Check if compaction needed BEFORE building messages
    const shouldCompact = this.sessionManager.shouldCompact(session, this.config.compactionThreshold);
    if (shouldCompact) {
      console.log(`Compaction triggered for session ${sessionId}. Messages: ${session.messages.length}, Estimated tokens: ${this.estimateSessionTokens(session)}`);
      const compactResult = await this.compactSession(sessionId);
      if (!compactResult.success) {
        // Log warning but continue
        console.warn('Session compaction failed:', compactResult.error);
      } else {
        // Reload session after compaction
        const reloadResult = await this.sessionManager.getSession(sessionId);
        if (reloadResult.success) {
          Object.assign(session, reloadResult.value);
        }
      }
    }

    // Build messages for LLM with RAG context
    const messages = await this.buildMessagesWithRAG(session, userMessage);

    // Get tools based on agent mode
    const isFirstMessage = session.messages.filter(m => m.role === 'user').length === 1;
    const tools = this.getToolsForMode(session.agentMode, isFirstMessage);

    // Call LLM with tools
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model || DEFAULT_MODEL,
        messages,
        tools: tools as ChatCompletionTool[],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      const choice = response.choices[0];
      if (!choice) {
        return err({
          type: 'llm_api_error',
          error: 'No response from LLM',
          retryable: true,
        });
      }

      const assistantMessage = choice.message;
      const toolCalls = assistantMessage.tool_calls;

      // Track token usage
      const usage = response.usage;
      const inputTokens = usage?.prompt_tokens || 0;
      const outputTokens = usage?.completion_tokens || 0;

      // Execute tool calls if any
      let toolResults: ToolExecutionResult[] = [];
      let segmentsModified: SegmentId[] = [];

      if (toolCalls && toolCalls.length > 0) {
        // Convert to our ToolCall format
        const ourToolCalls: ToolCall[] = toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));

        // Execute tool calls sequentially to prevent race conditions
        // (e.g., duplicate detection needs to see previously added segments)
        const executionResults: ToolExecutionResult[] = [];
        for (const tc of ourToolCalls) {
          const result = await this.toolExecutor.execute({
            sessionId,
            itineraryId: session.itineraryId,
            toolCall: tc,
          });
          executionResults.push(result);
        }

        toolResults = executionResults;

        // Collect modified segment IDs and check for mode switches
        for (const result of executionResults) {
          if (result.success && result.metadata?.segmentId) {
            segmentsModified.push(result.metadata.segmentId);
          }
          // Check if switch_to_trip_designer was called
          if (result.success && typeof result.result === 'object' && result.result !== null) {
            const resultObj = result.result as Record<string, unknown>;
            if (resultObj.action === 'switch_agent' && resultObj.newMode === 'trip_designer') {
              // Update session mode
              session.agentMode = 'trip_designer';
              await this.sessionManager.updateSession(session);
            }
          }
        }

        // Add assistant message with tool calls
        await this.sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content: assistantMessage.content || '',
          toolCalls: ourToolCalls,
          tokens: { input: inputTokens, output: outputTokens },
        });

        // Add tool results as separate messages (truncated to save tokens)
        for (const result of toolResults) {
          await this.sessionManager.addMessage(sessionId, {
            role: 'tool',
            content: this.truncateToolResult(result.result || { error: result.error }),
            toolResults: [result],
          });
        }

        // Make a second call to get natural language response with tool results
        const toolResultMessages: ChatCompletionMessageParam[] = toolResults.map((result) => ({
          role: 'tool' as const,
          tool_call_id: result.toolCallId,
          content: JSON.stringify(result.result || { error: result.error }),
        }));

        const finalResponse = await this.client.chat.completions.create({
          model: this.config.model || DEFAULT_MODEL,
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: assistantMessage.content,
              tool_calls: toolCalls,
            },
            ...toolResultMessages,
          ],
          tools, // Include tools so model can generate natural language responses or chain tool calls
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
        });

        const finalChoice = finalResponse.choices[0];
        const finalMessage = finalChoice?.message.content || '';

        // Add final assistant message
        await this.sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content: finalMessage,
          tokens: {
            input: finalResponse.usage?.prompt_tokens || 0,
            output: finalResponse.usage?.completion_tokens || 0,
          },
        });

        // Store conversation in knowledge graph (async, don't wait)
        this.storeConversation(sessionId, userMessage, finalMessage).catch((error) => {
          console.warn('Failed to store conversation:', error);
        });

        // Return agent response
        return ok({
          message: finalMessage,
          itineraryUpdated: segmentsModified.length > 0,
          segmentsModified,
          toolCallsMade: ourToolCalls,
        });
      } else {
        // No tool calls, just a message
        const content = assistantMessage.content || '';

        // Add assistant message
        await this.sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content,
          tokens: { input: inputTokens, output: outputTokens },
        });

        // Parse structured questions if any (from JSON in message)
        const structuredQuestions = this.parseStructuredQuestions(content);
        const cleanMessage = this.extractCleanMessage(content);

        // Store conversation in knowledge graph (async, don't wait)
        this.storeConversation(sessionId, userMessage, cleanMessage).catch((error) => {
          console.warn('Failed to store conversation:', error);
        });

        return ok({
          message: cleanMessage,
          itineraryUpdated: false,
          structuredQuestions,
        });
      }
    } catch (error) {
      // Handle API errors
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        // 401 - Invalid API key
        if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
          return err({
            type: 'llm_api_error',
            error: 'Invalid OpenRouter API key. Please check your API key in Profile settings.',
            retryable: false,
          });
        }

        // 400 - Bad request (often means invalid API key or model)
        if (errorMsg.includes('400')) {
          if (errorMsg.includes('provider') || errorMsg.includes('model')) {
            return err({
              type: 'llm_api_error',
              error: 'Invalid API key or model configuration. Please verify your OpenRouter API key in Profile settings and ensure it has credits.',
              retryable: false,
            });
          }
          return err({
            type: 'llm_api_error',
            error: `Bad request: ${error.message}. Please check your OpenRouter API key in Profile settings.`,
            retryable: false,
          });
        }

        // 429 - Rate limit
        if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          return err({
            type: 'rate_limit_exceeded',
            retryAfter: 60,
          });
        }
      }

      return err({
        type: 'llm_api_error',
        error: error instanceof Error ? error.message : String(error),
        retryable: true,
      });
    }
  }

  /**
   * Send a message and stream the response
   * Yields StreamEvent objects for SSE transmission
   */
  async *chatStream(
    sessionId: SessionId,
    userMessage: string
  ): AsyncGenerator<StreamEvent, void, unknown> {
    // Get session
    const sessionResult = await this.sessionManager.getSession(sessionId);
    if (!sessionResult.success) {
      yield { type: 'error', message: 'Session not found' };
      return;
    }

    const session = sessionResult.value;

    // Add user message to session
    const addMessageResult = await this.sessionManager.addMessage(sessionId, {
      role: 'user',
      content: userMessage,
    });

    if (!addMessageResult.success) {
      yield { type: 'error', message: 'Failed to add message to session' };
      return;
    }

    // Check if compaction needed BEFORE building messages
    const shouldCompact = this.sessionManager.shouldCompact(session, this.config.compactionThreshold);
    if (shouldCompact) {
      console.log(`Compaction triggered for session ${sessionId}. Messages: ${session.messages.length}, Estimated tokens: ${this.estimateSessionTokens(session)}`);
      const compactResult = await this.compactSession(sessionId);
      if (!compactResult.success) {
        console.warn('Session compaction failed:', compactResult.error);
      } else {
        // Reload session after compaction
        const reloadResult = await this.sessionManager.getSession(sessionId);
        if (reloadResult.success) {
          Object.assign(session, reloadResult.value);
        }
      }
    }

    // Build messages for LLM with RAG context
    const messages = await this.buildMessagesWithRAG(session, userMessage);

    // Get tools based on agent mode
    const isFirstMessage = session.messages.filter(m => m.role === 'user').length === 1;
    const tools = this.getToolsForMode(session.agentMode, isFirstMessage);

    try {
      // Call LLM with streaming enabled
      console.log(`[chatStream] Calling LLM for session ${sessionId}, model: ${this.config.model || DEFAULT_MODEL}`);
      const stream = await this.client.chat.completions.create({
        model: this.config.model || DEFAULT_MODEL,
        messages,
        tools,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true,
      });
      console.log(`[chatStream] Stream created, starting to read chunks...`);

      let fullContent = '';
      let toolCalls: ToolCall[] = [];
      let toolCallsInProgress: Map<number, Partial<ToolCall>> = new Map();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let chunkCount = 0;

      // Stream the response
      for await (const chunk of stream) {
        chunkCount++;
        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        // Log ALL chunks with structure
        console.log(`[chatStream] Chunk ${chunkCount}: content=${delta?.content?.length || 0}, tools=${delta?.tool_calls?.length || 0}, finish=${finishReason || 'none'}`);

        // Track token usage if available
        if (chunk.usage) {
          totalInputTokens = chunk.usage.prompt_tokens || 0;
          totalOutputTokens = chunk.usage.completion_tokens || 0;
        }

        if (!delta) continue;

        // Handle text content
        if (delta.content) {
          fullContent += delta.content;
          console.log(`[chatStream] Yielding text: ${delta.content.length} chars`);
          yield { type: 'text', content: delta.content };
        }

        // Handle tool calls - accumulate by index
        if (delta.tool_calls) {
          console.log(`[chatStream] Raw tool_calls delta:`, JSON.stringify(delta.tool_calls, null, 2));

          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index;
            if (index === undefined) {
              console.log(`[chatStream] WARNING: tool call delta missing index:`, JSON.stringify(toolCallDelta));
              continue;
            }

            console.log(`[chatStream] Processing tool call delta at index ${index}:`, JSON.stringify(toolCallDelta));

            // Get or create tool call at this index
            let toolCall = toolCallsInProgress.get(index);

            if (!toolCall) {
              // Start new tool call
              toolCall = {
                id: toolCallDelta.id || '',
                type: 'function',
                function: {
                  name: toolCallDelta.function?.name || '',
                  arguments: toolCallDelta.function?.arguments || '',
                },
              };
              toolCallsInProgress.set(index, toolCall);
              console.log(`[chatStream] Started tool call at index ${index}: ${toolCall.function?.name}, initial args: "${toolCall.function?.arguments}"`);
            } else {
              // Append to existing tool call
              if (toolCallDelta.id) {
                toolCall.id = toolCallDelta.id;
              }
              if (toolCall.function) {
                if (toolCallDelta.function?.name) {
                  toolCall.function.name += toolCallDelta.function.name;
                  console.log(`[chatStream] Appended to tool name at index ${index}: ${toolCall.function.name}`);
                }
                if (toolCallDelta.function?.arguments) {
                  const beforeLen = toolCall.function.arguments.length;
                  toolCall.function.arguments += toolCallDelta.function.arguments;
                  console.log(`[chatStream] Appended ${toolCallDelta.function.arguments.length} chars to tool call ${index}, before: ${beforeLen}, after: ${toolCall.function.arguments.length}, content: "${toolCallDelta.function.arguments}"`);
                }
              }
            }

            console.log(`[chatStream] Tool call at index ${index} after processing:`, JSON.stringify(toolCall));
          }
        }

        // When stream finishes with tool_calls, finalize all accumulated tool calls
        if (finishReason === 'tool_calls') {
          console.log(`[chatStream] Stream finished with tool_calls, finalizing ${toolCallsInProgress.size} tool calls`);
          console.log(`[chatStream] Tool calls map contents:`, Array.from(toolCallsInProgress.entries()).map(([idx, tc]) => ({
            index: idx,
            id: tc.id,
            name: tc.function?.name,
            argsLength: tc.function?.arguments?.length || 0,
            args: tc.function?.arguments,
          })));

          for (const [index, toolCall] of toolCallsInProgress.entries()) {
            console.log(`[chatStream] Finalizing tool call at index ${index}:`, JSON.stringify(toolCall));

            if (toolCall.id && toolCall.function) {
              const completeToolCall = toolCall as ToolCall;
              toolCalls.push(completeToolCall);
              console.log(`[chatStream] Finalized tool call: ${completeToolCall.function.name}, args length: ${completeToolCall.function.arguments.length}, args: "${completeToolCall.function.arguments}"`);

              // Parse arguments and emit tool_call event
              // Note: Some tools like get_itinerary have no parameters (empty arguments is valid)
              let args: any = {};
              const argsStr = completeToolCall.function.arguments || '';
              if (argsStr.trim().length > 0) {
                try {
                  args = JSON.parse(argsStr);
                } catch (parseError) {
                  console.error(`[chatStream] Failed to parse tool arguments for ${completeToolCall.function.name}:`, parseError);
                  console.error(`[chatStream] Arguments were: "${argsStr}"`);
                }
              }
              yield {
                type: 'tool_call',
                name: completeToolCall.function.name,
                arguments: args,
              };
            } else {
              console.error(`[chatStream] Tool call at index ${index} is incomplete:`, {
                hasId: !!toolCall.id,
                hasFunction: !!toolCall.function,
                toolCall: JSON.stringify(toolCall)
              });
            }
          }
          toolCallsInProgress.clear();
        }
      }

      console.log(`[chatStream] Stream ended, received ${chunkCount} chunks, content length: ${fullContent.length}, toolCalls: ${toolCalls.length}`);

      // Finalize any remaining tool calls (shouldn't happen if finish_reason was set correctly)
      if (toolCallsInProgress.size > 0) {
        console.log(`[chatStream] Finalizing ${toolCallsInProgress.size} remaining tool calls after stream end`);
        for (const [index, toolCall] of toolCallsInProgress.entries()) {
          if (toolCall.id && toolCall.function) {
            const completeToolCall = toolCall as ToolCall;
            toolCalls.push(completeToolCall);
            console.log(`[chatStream] Finalized remaining tool call: ${completeToolCall.function.name}, args length: ${completeToolCall.function.arguments.length}`);

            // Note: Some tools like get_itinerary have no parameters (empty arguments is valid)
            let args: any = {};
            const argsStr = completeToolCall.function.arguments || '';
            if (argsStr.trim().length > 0) {
              try {
                args = JSON.parse(argsStr);
              } catch (parseError) {
                console.error(`[chatStream] Failed to parse tool arguments for ${completeToolCall.function.name}:`, parseError);
                console.error(`[chatStream] Arguments were:`, argsStr);
              }
            }
            yield {
              type: 'tool_call',
              name: completeToolCall.function.name,
              arguments: args,
            };
          }
        }
        toolCallsInProgress.clear();
      }

      // Handle tool calls if any
      let segmentsModified: SegmentId[] = [];
      let itineraryMetadataChanged = false; // Track non-segment changes (destinations, dates, etc.)

      if (toolCalls.length > 0) {
        console.log(`[chatStream] ====== TOOL EXECUTION PHASE ======`);
        console.log(`[chatStream] Executing ${toolCalls.length} tool calls: ${toolCalls.map(tc => tc.function.name).join(', ')}`);
        // Add assistant message with tool calls
        await this.sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content: fullContent,
          toolCalls,
        });

        // Execute tool calls sequentially to prevent race conditions
        // (e.g., duplicate detection needs to see previously added segments)
        const executionResults: ToolExecutionResult[] = [];
        for (const tc of toolCalls) {
          const result = await this.toolExecutor.execute({
            sessionId,
            itineraryId: session.itineraryId,
            toolCall: tc,
          });
          executionResults.push(result);
        }

        // Count successes/failures and log errors
        const successCount = executionResults.filter(r => r.success).length;
        const failureCount = executionResults.length - successCount;
        console.log(`[chatStream] Tool results: ${successCount} success, ${failureCount} failure`);

        // Log detailed error information for failures
        for (let i = 0; i < executionResults.length; i++) {
          const result = executionResults[i];
          const toolCall = toolCalls[i];
          if (!result.success) {
            console.error(`[chatStream] Tool "${toolCall.function.name}" failed:`, result.error);
            console.error(`[chatStream] Tool arguments:`, toolCall.function.arguments);
          }
        }

        // Emit tool results
        for (let i = 0; i < executionResults.length; i++) {
          const result = executionResults[i];
          const toolCall = toolCalls[i];

          console.log(`[chatStream] Processing tool result ${i}:`, {
            toolName: toolCall.function.name,
            success: result.success,
            hasMetadata: !!result.metadata,
            segmentId: result.metadata?.segmentId,
            resultHasSegmentId: result.result && typeof result.result === 'object' && 'segmentId' in result.result
          });

          yield {
            type: 'tool_result',
            name: toolCall.function.name,
            result: result.result,
            success: result.success,
          };

          // Track modified segments - check BOTH metadata and result
          if (result.success) {
            // First check metadata.segmentId (preferred)
            if (result.metadata?.segmentId) {
              console.log(`[chatStream] Segment modified via metadata:`, result.metadata.segmentId);
              segmentsModified.push(result.metadata.segmentId);
            }
            // Fallback: check result.segmentId (for backward compatibility)
            else if (typeof result.result === 'object' && result.result !== null) {
              const resultObj = result.result as Record<string, unknown>;
              if (resultObj.segmentId && typeof resultObj.segmentId === 'string') {
                console.log(`[chatStream] Segment modified via result.segmentId:`, resultObj.segmentId);
                segmentsModified.push(resultObj.segmentId as any);
              }
            }
          }

          // Track itinerary metadata changes (destinations, dates, etc.)
          // These don't modify segments but should trigger UI refresh
          if (result.success && typeof result.result === 'object' && result.result !== null) {
            const resultObj = result.result as Record<string, unknown>;
            if (resultObj.itineraryChanged === true) {
              console.log(`[chatStream] Itinerary metadata changed`);
              // Set flag to signal itinerary metadata changed
              itineraryMetadataChanged = true;
            }
          }

          // Check if switch_to_trip_designer was called
          if (result.success && typeof result.result === 'object' && result.result !== null) {
            const resultObj = result.result as Record<string, unknown>;
            if (resultObj.action === 'switch_agent' && resultObj.newMode === 'trip_designer') {
              // Update session mode
              session.agentMode = 'trip_designer';
              await this.sessionManager.updateSession(session);
            }
          }
        }

        // Add tool results as messages (truncated to save tokens)
        for (const result of executionResults) {
          await this.sessionManager.addMessage(sessionId, {
            role: 'tool',
            content: this.truncateToolResult(result.result || { error: result.error }),
            toolResults: [result],
          });
        }

        // Make second call to get natural language response
        console.log(`[chatStream] ====== SECOND STREAM PHASE ======`);
        console.log(`[chatStream] Starting second stream to get natural language response...`);
        const toolResultMessages: ChatCompletionMessageParam[] = executionResults.map((result) => ({
          role: 'tool' as const,
          tool_call_id: result.toolCallId,
          content: JSON.stringify(result.result || { error: result.error }),
        }));

        // Log tool result sizes for debugging
        console.log(`[chatStream] Tool result sizes:`, toolResultMessages.map((msg, i) => ({
          index: i,
          toolCallId: (msg as { tool_call_id?: string }).tool_call_id?.substring(0, 20),
          contentLength: typeof msg.content === 'string' ? msg.content.length : 0,
        })));

        // Calculate total context size
        const baseMessagesSize = JSON.stringify(messages).length;
        const toolResultsSize = JSON.stringify(toolResultMessages).length;
        const totalContextSize = baseMessagesSize + toolResultsSize;
        console.log(`[chatStream] Context sizes: base=${baseMessagesSize}, toolResults=${toolResultsSize}, total=${totalContextSize}`);

        const finalStream = await this.client.chat.completions.create({
          model: this.config.model || DEFAULT_MODEL,
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: fullContent,
              tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              })),
            },
            ...toolResultMessages,
            // Add a prompt to guide the model to respond naturally based on tool results
            {
              role: 'user' as const,
              content: 'Now please synthesize the tool results and respond to my original request with helpful, specific information. Do NOT call any more tools - just provide a conversational response based on what you learned.',
            },
          ],
          // Note: Intentionally NOT passing tools here to force a text response
          // Tool chaining is not implemented in the second stream processing loop
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          stream: true,
        });

        console.log(`[chatStream] Second stream created WITHOUT tools (forcing text response)`);

        let finalContent = '';
        let finalChunkCount = 0;
        for await (const chunk of finalStream) {
          finalChunkCount++;
          const choice = chunk.choices[0];
          const delta = choice?.delta;
          const finishReason = choice?.finish_reason;

          // Log second stream chunks with full details
          console.log(`[chatStream] Second stream chunk ${finalChunkCount}: content=${delta?.content?.length || 0}, finish=${finishReason || 'none'}, role=${delta?.role || 'none'}`);

          // If no content, log the full chunk to diagnose issues
          if (!delta?.content && finalChunkCount <= 5) {
            console.log(`[chatStream] Second stream chunk ${finalChunkCount} RAW:`, JSON.stringify({
              id: chunk.id,
              model: chunk.model,
              choices: chunk.choices?.map(c => ({
                index: c.index,
                delta: c.delta,
                finish_reason: c.finish_reason,
              })),
              usage: chunk.usage,
            }));
          }

          // Log if there are unexpected tool calls in the response
          if (delta?.tool_calls) {
            console.warn(`[chatStream] WARNING: Second stream returned tool_calls (unexpected):`, JSON.stringify(delta.tool_calls));
          }

          // Track token usage from second call
          if (chunk.usage) {
            totalInputTokens += chunk.usage.prompt_tokens || 0;
            totalOutputTokens += chunk.usage.completion_tokens || 0;
          }

          if (delta?.content) {
            finalContent += delta.content;
            console.log(`[chatStream] Yielding text from second stream: ${delta.content.length} chars`);
            yield { type: 'text', content: delta.content };
          }
        }
        console.log(`[chatStream] ====== FINALIZING ======`);
        console.log(`[chatStream] Second stream ended, received ${finalChunkCount} chunks, finalContent length: ${finalContent.length}`);

        // Handle empty second stream response
        if (finalContent.length === 0) {
          console.warn(`[chatStream] WARNING: Second stream returned empty content! Generating fallback response.`);
          // Provide a fallback message so user isn't left with nothing
          finalContent = "I've processed your request. Let me know if you need anything else!";
          yield { type: 'text', content: finalContent };
        }

        // Add final assistant message
        await this.sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content: finalContent,
        });

        // Store conversation in knowledge graph (async, don't wait)
        this.storeConversation(sessionId, userMessage, finalContent).catch((error) => {
          console.warn('Failed to store conversation:', error);
        });

        // Parse structured questions from final message
        const structuredQuestions = this.parseStructuredQuestions(finalContent);
        if (structuredQuestions && structuredQuestions.length > 0) {
          yield {
            type: 'structured_questions',
            questions: structuredQuestions,
          };
        }

        // Calculate costs
        const totalTokens = totalInputTokens + totalOutputTokens;
        const inputCost = (totalInputTokens / 1_000_000) * CLAUDE_PRICING.inputCostPer1M;
        const outputCost = (totalOutputTokens / 1_000_000) * CLAUDE_PRICING.outputCostPer1M;
        const totalCost = inputCost + outputCost;

        // Emit done event
        console.log(`[chatStream] ====== EMITTING DONE EVENT ======`);
        console.log(`[chatStream] segmentsModified:`, segmentsModified);
        console.log(`[chatStream] itineraryMetadataChanged:`, itineraryMetadataChanged);
        console.log(`[chatStream] itineraryUpdated will be:`, segmentsModified.length > 0 || itineraryMetadataChanged);

        yield {
          type: 'done',
          itineraryUpdated: segmentsModified.length > 0 || itineraryMetadataChanged,
          segmentsModified,
          tokens: {
            input: totalInputTokens,
            output: totalOutputTokens,
            total: totalTokens,
          },
          cost: {
            input: inputCost,
            output: outputCost,
            total: totalCost,
          },
        };
        console.log(`[chatStream] ====== STREAM COMPLETE ======`);
      } else {
        // No tool calls, just a message
        await this.sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content: fullContent,
        });

        // Store conversation in knowledge graph (async, don't wait)
        this.storeConversation(sessionId, userMessage, fullContent).catch((error) => {
          console.warn('Failed to store conversation:', error);
        });

        // Parse structured questions
        const structuredQuestions = this.parseStructuredQuestions(fullContent);
        if (structuredQuestions && structuredQuestions.length > 0) {
          yield {
            type: 'structured_questions',
            questions: structuredQuestions,
          };
        }

        // Calculate costs
        const totalTokens = totalInputTokens + totalOutputTokens;
        const inputCost = (totalInputTokens / 1_000_000) * CLAUDE_PRICING.inputCostPer1M;
        const outputCost = (totalOutputTokens / 1_000_000) * CLAUDE_PRICING.outputCostPer1M;
        const totalCost = inputCost + outputCost;

        // Emit done event
        yield {
          type: 'done',
          itineraryUpdated: false,
          tokens: {
            input: totalInputTokens,
            output: totalOutputTokens,
            total: totalTokens,
          },
          cost: {
            input: inputCost,
            output: outputCost,
            total: totalCost,
          },
        };
      }
    } catch (error) {
      // Handle API errors
      console.error(`[chatStream] Error in stream:`, error);
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
          errorMessage = 'Invalid OpenRouter API key. Please check your API key in Profile settings.';
        } else if (errorMsg.includes('400')) {
          if (errorMsg.includes('provider') || errorMsg.includes('model')) {
            errorMessage = 'Invalid API key or model configuration. Please verify your OpenRouter API key in Profile settings and ensure it has credits.';
          } else {
            errorMessage = `Bad request: ${error.message}. Please check your OpenRouter API key in Profile settings.`;
          }
        } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        } else {
          errorMessage = error.message;
        }
      }

      yield { type: 'error', message: errorMessage };
    }
  }

  /**
   * Get current session state
   */
  async getSession(sessionId: SessionId): Promise<Result<TripDesignerSession, StorageError>> {
    return this.sessionManager.getSession(sessionId);
  }

  /**
   * Compact session history when context limit approaching
   *
   * This method summarizes the conversation history to reduce token count:
   * 1. Extract trip profile from early messages
   * 2. Keep recent messages (last 10)
   * 3. Replace older messages with a structured summary
   * 4. Preserve all tool calls and results
   */
  async compactSession(sessionId: SessionId): Promise<Result<void, StorageError>> {
    // Get session
    const sessionResult = await this.sessionManager.getSession(sessionId);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const session = sessionResult.value;

    // Don't compact if already recently compacted
    const lastCompacted = session.metadata.lastCompactedAt;
    if (lastCompacted) {
      const timeSinceCompaction = Date.now() - lastCompacted.getTime();
      const minTimeBetweenCompactions = 5 * 60 * 1000; // 5 minutes
      if (timeSinceCompaction < minTimeBetweenCompactions) {
        return ok(undefined);
      }
    }

    // Keep recent messages (last 5-7 for more aggressive compression)
    const KEEP_RECENT_COUNT = 6;
    const recentMessages = session.messages.slice(-KEEP_RECENT_COUNT);
    const oldMessages = session.messages.slice(0, -KEEP_RECENT_COUNT);

    // If not enough old messages to compact, skip
    if (oldMessages.length < 5) {
      return ok(undefined);
    }

    try {
      // Build conversation history for summarization
      const conversationHistory = oldMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      // Get itinerary context
      let itineraryContext = '';
      if (this.deps.itineraryService) {
        const itineraryService = this.deps.itineraryService as any;
        const itineraryResult = await itineraryService.get(session.itineraryId);
        if (itineraryResult.success) {
          itineraryContext = summarizeItineraryMinimal(itineraryResult.value);
        }
      }

      // Call LLM to generate summary
      const response = await this.client.chat.completions.create({
        model: this.config.model || DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: COMPACTION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Summarize the following trip planning conversation. Current itinerary state: ${itineraryContext || 'New trip'}

Conversation to summarize:
${conversationHistory}

Provide a structured JSON summary following the format in your system instructions.`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for more focused summarization
      });

      const summaryContent = response.choices[0]?.message.content;
      if (!summaryContent) {
        console.warn('No summary generated, skipping compaction');
        return ok(undefined);
      }

      // Parse the summary (it should be JSON)
      let summary;
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = summaryContent.match(/```json\s*([\s\S]*?)\s*```/) ||
                         summaryContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          summary = JSON.parse(jsonStr);
        } else {
          summary = JSON.parse(summaryContent);
        }
      } catch (error) {
        console.warn('Failed to parse compaction summary, using raw content');
        summary = { summary: summaryContent };
      }

      // Create a single system message with the summary
      const summaryMessage: Message = {
        role: 'system',
        content: `[Conversation Summary - ${oldMessages.length} messages compacted on ${new Date().toLocaleString()}]

${JSON.stringify(summary, null, 2)}

Recent conversation continues below...`,
        timestamp: new Date(),
      };

      // Replace old messages with summary + keep recent messages
      session.messages = [summaryMessage, ...recentMessages];

      // Update metadata
      session.metadata.lastCompactedAt = new Date();
      session.metadata.messageCount = session.messages.length;

      // Recalculate total tokens (more accurate estimation)
      const summaryTokens = Math.ceil(summaryMessage.content.length / 4);
      let recentTokens = 0;
      for (const m of recentMessages) {
        if (m.tokens) {
          recentTokens += (m.tokens.input || 0) + (m.tokens.output || 0);
        } else {
          // Estimate from content if no tracked tokens
          recentTokens += Math.ceil(m.content.length / 4);
        }
      }
      session.metadata.totalTokens = summaryTokens + recentTokens;

      console.log(`Session compacted: ${oldMessages.length} messages -> 1 summary. Estimated tokens: ${session.metadata.totalTokens}`);

      // Save updated session
      return this.sessionManager.updateSession(session);
    } catch (error) {
      console.error('Session compaction failed:', error);
      return err(
        createStorageError(
          'UNKNOWN',
          `Session compaction failed: ${error instanceof Error ? error.message : String(error)}`,
          { sessionId }
        )
      );
    }
  }

  /**
   * Lazily initialize knowledge service
   */
  private async ensureKnowledgeInitialized(): Promise<void> {
    if (!this.knowledgeService || this.knowledgeInitialized) {
      return;
    }

    try {
      const result = await this.knowledgeService.initialize();
      if (result.success) {
        this.knowledgeInitialized = true;
      } else {
        console.warn('Failed to initialize knowledge service:', result.error.message);
      }
    } catch (error) {
      console.warn('Knowledge service initialization error:', error);
    }
  }

  /**
   * Retrieve RAG context for a user query with KB-first flow
   * For Weaviate: Uses searchWithFallback
   * For Vectra: Uses retrieveContext
   */
  private async retrieveRAGContext(
    query: string,
    session?: TripDesignerSession
  ): Promise<string | null> {
    if (!this.knowledgeService || !this.knowledgeInitialized) {
      await this.ensureKnowledgeInitialized();
    }

    if (!this.knowledgeService || !this.knowledgeInitialized) {
      return null; // Graceful degradation
    }

    try {
      // Get itinerary context if available
      let itinerary: any = undefined;
      if (session && this.deps.itineraryService) {
        const itineraryService = this.deps.itineraryService as any;
        const itineraryResult = await itineraryService.get(session.itineraryId);
        if (itineraryResult.success) {
          itinerary = itineraryResult.value;
        }
      }

      // Use KB-first search for Weaviate
      if (isWeaviateKnowledgeService(this.knowledgeService)) {
        const searchResult = await this.knowledgeService.searchWithFallback(query, {
          itinerary,
          destinationName: itinerary?.destinations?.[0]?.name,
          travelDate: itinerary ? new Date(itinerary.startDate) : undefined,
        });

        if (searchResult.success && searchResult.value.results.length > 0) {
          // Format results as context
          const results = searchResult.value.results;
          const contextParts = results.map((r, i) => {
            return `[${i + 1}] [${r.category}] ${r.rawContent} (relevance: ${(r.relevanceScore * 100).toFixed(0)}%)`;
          });

          return `Knowledge Base Results (${searchResult.value.source}):\n${contextParts.join('\n')}`;
        }

        // If fallback flag is set, indicate web search should be used
        if (searchResult.success && searchResult.value.kbFallback) {
          return null; // Let OpenRouter :online handle web search
        }
      } else {
        // Fallback to Vectra retrieveContext
        const result = await this.knowledgeService.retrieveContext(query, {
          type: 'chat',
        });

        if (result.success && result.value.documents.length > 0) {
          return result.value.context;
        }
      }
    } catch (error) {
      console.warn('RAG context retrieval failed:', error);
    }

    return null;
  }

  /**
   * Store chat messages in knowledge graph
   */
  private async storeConversation(
    sessionId: SessionId,
    userMessage: string,
    assistantMessage: string
  ): Promise<void> {
    if (!this.knowledgeService || !this.knowledgeInitialized) {
      await this.ensureKnowledgeInitialized();
    }

    if (!this.knowledgeService || !this.knowledgeInitialized) {
      return; // Graceful degradation
    }

    try {
      // Store conversation based on knowledge service type
      if (isWeaviateKnowledgeService(this.knowledgeService)) {
        // For Weaviate, store as structured knowledge
        const conversationText = `User: ${userMessage}\n\nAssistant: ${assistantMessage}`;
        await this.knowledgeService.storeKnowledge({
          content: conversationText,
          category: 'tip',
          source: 'trip_designer',
        }, {
          sessionId,
        });
      } else {
        // For Vectra, store both messages in batch
        await this.knowledgeService.storeMessages([
          {
            content: userMessage,
            role: 'user',
            sessionId,
          },
          {
            content: assistantMessage,
            role: 'assistant',
            sessionId,
          },
        ]);
      }
    } catch (error) {
      console.warn('Failed to store conversation in knowledge graph:', error);
    }
  }

  /**
   * Build messages array for LLM from session
   * Uses minimal prompt for first message to reduce token count
   * Uses Help agent prompt when in help mode
   */
  private async buildMessages(
    session: TripDesignerSession,
    options?: { useMinimalPrompt?: boolean }
  ): Promise<ChatCompletionMessageParam[]> {
    // Inject current date context for date awareness
    const today = new Date();
    const dateContext = `## Current Date Context

Today is ${today.toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})} (${today.toISOString().split('T')[0]}).

IMPORTANT: All suggested dates MUST be in the future. Do not suggest dates that have already passed.

---

`;

    // Select base system prompt based on agent mode
    let systemPrompt = dateContext + this.getSystemPromptForMode(session.agentMode);
    let hasItineraryContent = false;

    // For help mode, we don't need itinerary context in the system prompt
    if (session.agentMode === 'help') {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
      ];

      // Add conversation history
      for (const message of session.messages) {
        if (message.role === 'user' || message.role === 'assistant' || message.role === 'system') {
          messages.push({
            role: message.role,
            content: message.content,
          });
        }
      }

      return messages;
    }

    // Check if the itinerary has content and inject context
    if (this.deps.itineraryService) {
      const itineraryService = this.deps.itineraryService as any;
      const itineraryResult = await itineraryService.get(session.itineraryId);
      if (itineraryResult.success) {
        const itinerary = itineraryResult.value;

        // If itinerary has segments or substantial metadata, include detailed summary
        if (itinerary.segments.length > 0 || itinerary.title !== 'New Itinerary') {
          hasItineraryContent = true;
          const summary = summarizeItinerary(itinerary);

          console.log('[Trip Designer] Building context for itinerary:', itinerary.id);
          console.log('[Trip Designer] Title:', itinerary.title);
          console.log('[Trip Designer] Summary length:', summary.length);
          console.log('[Trip Designer] Summary preview:', summary.substring(0, 300));

          systemPrompt = `${TRIP_DESIGNER_SYSTEM_PROMPT}

## Current Itinerary Context

You are editing an existing itinerary. Here's the current state:

${summary}

## ⚠️ CRITICAL: INFER PREFERENCES FROM EXISTING BOOKINGS

Check the "EXISTING BOOKINGS" section above. The bookings tell you everything about travel style:
- **Luxury/boutique hotel?** → They travel luxury. Don't ask about style or budget.
- **Business class flight?** → Premium traveler. Skip budget questions.
- **Budget hotel/hostel?** → Budget-conscious. Suggest value options.

**NEVER ask questions the bookings already answer.** Acknowledge their choices and match your suggestions accordingly.

The user wants to modify or extend this itinerary. Help them while respecting their booking-inferred preferences.`;
        }
      }
    }

    // Use minimal prompt for first message of NEW itinerary to save tokens
    if (options?.useMinimalPrompt && !hasItineraryContent) {
      systemPrompt = TRIP_DESIGNER_SYSTEM_PROMPT_MINIMAL;
    }

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    // Add conversation history
    for (const message of session.messages) {
      if (message.role === 'user' || message.role === 'assistant' || message.role === 'system') {
        messages.push({
          role: message.role,
          content: message.content,
        });
      }
    }

    return messages;
  }

  /**
   * Build messages with RAG context injected
   * Determines whether to use minimal prompt based on message count
   */
  private async buildMessagesWithRAG(
    session: TripDesignerSession,
    currentUserMessage: string
  ): Promise<ChatCompletionMessageParam[]> {
    // Use minimal prompt only for the very first user message (context message)
    const isFirstMessage = session.messages.filter(m => m.role === 'user').length === 1;
    const useMinimalPrompt = isFirstMessage;

    // Get base messages (now async with itinerary context)
    const messages = await this.buildMessages(session, { useMinimalPrompt });

    // Skip RAG on first message to save tokens
    if (useMinimalPrompt) {
      return messages;
    }

    // Try to retrieve RAG context (pass session for itinerary context)
    const ragContext = await this.retrieveRAGContext(currentUserMessage, session);

    if (ragContext) {
      // Inject RAG context into system prompt
      const systemMessage = messages[0];
      if (systemMessage && systemMessage.role === 'system') {
        // Append RAG context to existing system prompt (which may already have itinerary context)
        systemMessage.content = `${systemMessage.content}

## Relevant Knowledge from Previous Conversations

${ragContext}

Use this relevant knowledge to inform your responses, but prioritize the current conversation context.`;
      }
    }

    return messages;
  }

  /**
   * Parse structured questions from message content
   * Looks for JSON blocks in the message (code-fenced or naked)
   */
  private parseStructuredQuestions(content: string): any[] | undefined {
    // Try to find code-fenced JSON blocks first
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1] || '{}');
        return parsed.structuredQuestions;
      } catch {
        // Fall through to try naked JSON
      }
    }

    // Try to find naked JSON object with structuredQuestions
    const nakedJsonMatch = content.match(/\{[\s\S]*"structuredQuestions"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
    if (nakedJsonMatch) {
      try {
        const parsed = JSON.parse(nakedJsonMatch[0]);
        return parsed.structuredQuestions;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Extract clean message from content, removing JSON blocks
   * If content has a JSON response format, extract just the message field
   */
  private extractCleanMessage(content: string): string {
    // Try to parse as JSON response format first (code-fenced)
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1] || '{}');
        if (parsed.message) {
          return parsed.message;
        }
      } catch {
        // Fall through
      }
      // Remove the JSON block from content
      return content.replace(/```json\s*[\s\S]*?\s*```/g, '').trim();
    }

    // Try naked JSON
    const nakedJsonMatch = content.match(/\{[\s\S]*"message"\s*:\s*"[\s\S]*"[\s\S]*"structuredQuestions"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
    if (nakedJsonMatch) {
      try {
        const parsed = JSON.parse(nakedJsonMatch[0]);
        if (parsed.message) {
          return parsed.message;
        }
      } catch {
        // Fall through
      }
      // Remove naked JSON from content
      return content.replace(nakedJsonMatch[0], '').trim();
    }

    // Return content as-is if no JSON found
    return content;
  }

  /**
   * Estimate total context tokens for a session
   * This matches the logic in SessionManager.shouldCompact()
   *
   * IMPORTANT: Accounts for:
   * - System prompt (~5-7k tokens with tool definitions)
   * - Itinerary context (~1-2k tokens)
   * - RAG context (0-2k tokens)
   * - All message content (including tool results)
   */
  private estimateSessionTokens(session: TripDesignerSession): number {
    // System prompt includes tool definitions, which are substantial
    const systemPromptTokens = 7000; // More accurate estimate for full system prompt + tools + itinerary

    let messageTokens = 0;
    for (const msg of session.messages) {
      if (msg.tokens) {
        // Use actual tracked tokens if available
        messageTokens += (msg.tokens.input || 0) + (msg.tokens.output || 0);
      } else {
        // More accurate estimation: ~4 chars per token
        messageTokens += Math.ceil(msg.content.length / 4);
      }

      // Account for tool results which can be large even after truncation
      if (msg.toolResults && msg.toolResults.length > 0) {
        for (const toolResult of msg.toolResults) {
          const resultJson = JSON.stringify(toolResult.result || {});
          messageTokens += Math.ceil(resultJson.length / 4);
        }
      }
    }

    return systemPromptTokens + messageTokens;
  }

  /**
   * Clean up idle sessions periodically
   */
  async cleanupIdleSessions(): Promise<number> {
    return this.sessionManager.cleanupIdleSessions();
  }

  /**
   * Get statistics about active sessions
   */
  getStats(): {
    activeSessions: number;
  } {
    return {
      activeSessions: this.sessionManager.getActiveSessionCount(),
    };
  }

  /**
   * Delete a session by ID
   */
  async deleteSession(sessionId: SessionId): Promise<Result<void, StorageError>> {
    return this.sessionManager.deleteSession(sessionId);
  }

  /**
   * Delete all sessions for an itinerary
   * Used when an itinerary is deleted to prevent orphaned sessions
   */
  deleteSessionsByItineraryId(itineraryId: ItineraryId): void {
    this.sessionManager.deleteByItineraryId(itineraryId);
  }
}
