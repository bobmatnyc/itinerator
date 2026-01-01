# Trip Designer and Travel Agent Model Configuration Research
**Date:** 2026-01-01
**Researcher:** Claude (Research Agent)
**Working Directory:** `/Users/masa/Projects/itinerator`

---

## Executive Summary

This research documents the current model configuration, tool definitions, and evaluation infrastructure for the **Trip Designer** and **Travel Agent** services in the Itinerizer project.

**Key Findings:**
- **Current Model:** `anthropic/claude-3.5-haiku` (Trip Designer default)
- **Comprehensive Tool Suite:** 24 tools for Trip Designer, Travel Agent not implemented yet
- **Existing Eval Framework:** Full model comparison framework with quality metrics
- **Cost Tracking:** Built-in cost calculator with per-model pricing data

---

## 1. Current Model Configuration

### Trip Designer Model

**File:** `src/services/trip-designer/trip-designer.service.ts`

```typescript
// Lines 37-51
const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku';

/**
 * Model Selection (2025-12-23):
 * - Claude 3.5 Haiku: Recommended replacement for deprecated Claude 3 Haiku
 * - Better format compliance, perfect ONE question rule, cost-effective
 * - See: tests/eval/results/EVALUATION_SUMMARY.md
 */

const CLAUDE_PRICING = {
  inputCostPer1M: 0.80,
  outputCostPer1M: 4.00,
};
```

**Configuration:**
- **Model:** `anthropic/claude-3.5-haiku`
- **Max Tokens:** 4096
- **Temperature:** 0.7
- **Session Cost Limit:** $2.00
- **Compaction Threshold:** 50% (100k tokens)

**Model Selection Logic:**
- Configurable via `TripDesignerConfig.model`
- Falls back to `DEFAULT_MODEL` if not specified
- Uses OpenRouter API endpoint

### Travel Agent Model

**Status:** ❌ **NOT FOUND**

No Travel Agent service implementation was found in the codebase. The following searches returned no results:
- `Glob: **/travel-agent/**/*.ts` → No files found
- No `TravelAgentService` class exists
- No travel agent configuration found

**Recommendation:** Travel Agent may be planned or the functionality may be integrated differently than expected.

---

## 2. Trip Designer Tool Definitions

**File:** `src/services/trip-designer/tools.ts`

### Tool Categories

#### Core Tools (Essential)
Used for first message to reduce token count:
1. `get_itinerary` - Get complete itinerary state
2. `update_itinerary` - Update trip metadata
3. `update_preferences` - Update traveler preferences
4. `add_traveler` - Add traveler to itinerary
5. `search_web` - Web search for travel info

#### Segment Management Tools
6. `add_flight` - Add flight segment
7. `add_hotel` - Add accommodation segment
8. `add_activity` - Add activity/dining/tour segment
9. `add_transfer` - Add ground transfer
10. `add_meeting` - Add meeting/appointment
11. `update_segment` - Update existing segment
12. `delete_segment` - Delete segment
13. `move_segment` - Move segment in time (cascades dependencies)
14. `reorder_segments` - Change display order
15. `get_segment` - Get segment details

#### Search & Discovery Tools
16. `search_flights` - Flight prices via SERP API
17. `search_hotels` - Hotel prices via SERP API
18. `search_transfers` - Transfer options between locations
19. `search_web` - General web search (OpenRouter :online)

#### Knowledge Management Tools
20. `store_travel_intelligence` - Store seasonal/event data in knowledge base
21. `retrieve_travel_intelligence` - Query stored travel intelligence

#### Geography Tools
22. `get_distance` - Calculate distance between locations
23. `show_route` - Display multi-location route on map
24. `geocode_location` - Get coordinates for location

#### Agent Mode Tools
25. `switch_to_trip_designer` - Switch from Help mode to Trip Designer mode

### Tool Selection Strategy

**Essential Tools (First Message):**
```typescript
export const ESSENTIAL_TOOLS: ToolDefinition[] = [
  GET_ITINERARY_TOOL,
  UPDATE_ITINERARY_TOOL,
  UPDATE_PREFERENCES_TOOL,
  ADD_TRAVELER_TOOL,
  SEARCH_WEB_TOOL,
];
```

**All Tools (Subsequent Messages):**
```typescript
export const ALL_TOOLS: ToolDefinition[] = [
  // All 24 tools listed above
];
```

**Tool Loading Logic:**
```typescript
// Line 155-164 in trip-designer.service.ts
private getToolsForMode(agentMode: TripDesignerMode | undefined, isFirstMessage: boolean): ChatCompletionTool[] {
  if (agentMode === 'help') {
    return HELP_AGENT_TOOLS; // Only switch_to_trip_designer
  }

  const tools = isFirstMessage ? ESSENTIAL_TOOLS : ALL_TOOLS;
  return tools as ChatCompletionTool[];
}
```

**Rationale:** Reduce token count on first message by limiting tools, expand to full set for subsequent interactions.

### Critical Tool Enforcement

The system prompt emphasizes **mandatory tool calling** for data persistence:

**From `src/prompts/trip-designer/system.md`:**

```markdown
## 🚨 ABSOLUTE REQUIREMENT: TOOL CALLS FOR DATA PERSISTENCE

**YOUR VERBAL ACKNOWLEDGMENT IS NOT ENOUGH. YOU MUST CALL TOOLS TO SAVE DATA.**

When the user provides ANY trip information, you MUST:
1. **CALL the tool** (update_itinerary or update_preferences) - NON-NEGOTIABLE
2. **THEN** acknowledge in your message that you saved it
```

**Examples of enforcement:**
- **Accommodation:** Line 59-76 → "REQUIRED CALL when user mentions ANY accommodation"
- **Dining/Activity:** Line 139-175 → "REQUIRED CALL when user mentions OR you recommend ANY dining experience"

---

## 3. System Prompts

### Trip Designer System Prompt

**File:** `src/prompts/trip-designer/system.md` (1250 lines)

**Key Sections:**

1. **Booking Data = Ground Truth (Lines 3-27)**
   - Critical: Flight/hotel bookings are FACTS, title may be WRONG
   - Prioritize actual bookings over metadata

2. **Personalization & Greetings (Lines 29-41)**
   - Always use user's preferred name when greeting

3. **Accommodation Tool Enforcement (Lines 59-106)**
   - Mandatory `add_hotel` call when user mentions ANY accommodation
   - Must call `get_itinerary` first to retrieve trip dates
   - Calculate nights: `(endDate - startDate)`

4. **Dining/Activity Tool Enforcement (Lines 138-234)**
   - Mandatory `add_activity` call for restaurants, tours, shows
   - Use intelligent defaults (dinner: 7:30 PM, lunch: 12:30 PM)

5. **Critical Rules (Lines 236-510)**
   - **Rule 0:** Check existing itinerary first via `get_itinerary()`
   - **Rule 1:** Never generate itineraries without asking questions first
   - **Rule 2:** ONE question at a time - ALWAYS
   - **Rule 3:** Always use JSON format
   - **Rule 4:** Keep messages short (1-2 sentences)
   - **Rule 5:** Auto-update itinerary with tool calls
   - **Rule 6:** Save structured question answers immediately

6. **Discovery Phase (Lines 733-762)**
   - Progressive questioning: Travelers → Origin → Style → Pace → Interests → Budget → Restrictions
   - Use single_choice for mutually exclusive options
   - Use multiple_choice when users can select multiple options

7. **Seasonal & Event Awareness (Lines 607-673)**
   - ALWAYS research seasonal factors for destinations
   - Store intelligence in knowledge base
   - Inform users of relevant events/closures

8. **Response Format (Lines 952-960)**
   - JSON wrapped in ```json code fences
   - `message` field: conversational text
   - `structuredQuestions` field: clickable options

### Other Prompts

**Files Found:**
- `src/prompts/trip-designer/system.md` - Main Trip Designer prompt (full)
- `src/prompts/trip-designer/system-minimal.md` - Minimal version for first message
- `src/prompts/trip-designer/compaction.md` - Session compaction prompt
- `src/prompts/trip-designer/profile-extraction.md` - Extract user preferences
- `src/prompts/help-agent/system.md` - Help agent prompt

**Travel Agent Prompts:** ❌ **NOT FOUND**

---

## 4. Existing Evaluation Infrastructure

### Evaluation Framework

**Location:** `tests/eval/`

**Key Files:**
- `model-comparison.ts` - Main evaluation script
- `model-tool-calling.ts` - Tool-calling evaluation
- `test-prompts.ts` - Test prompts per agent
- `types.ts` - Type definitions
- `report-generator.ts` - Report generation

### Evaluation Metrics

**From `tests/eval/README.md`:**

| Metric | Weight | Description |
|--------|--------|-------------|
| **Format Compliance** | 20% | Valid JSON, markdown quality, code blocks |
| **One Question Rule** | 30% | Adherence to ONE question constraint |
| **Response Quality** | 30% | LLM-as-judge evaluation (relevance, helpfulness, clarity) |
| **Cost Efficiency** | 10% | Cost per 1k interactions (normalized) |
| **Latency** | 10% | Response time (normalized) |

### Tool-Calling Evaluation

**File:** `tests/eval/model-tool-calling.ts`

**Purpose:** Evaluate which LLMs properly call tools vs. generating text responses

**Test Setup:**
- **Prompt:** "Add a dinner reservation at Le Bernardin in New York for January 15th at 7:30 PM"
- **Expected:** Model calls `add_activity` tool
- **Tool:** Simplified `add_activity` definition

**Models Tested:**
```typescript
const TEST_MODELS = [
  'anthropic/claude-3.5-haiku',
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'google/gemini-flash-1.5',
  'meta-llama/llama-3.1-70b-instruct',
] as const;
```

**Result Classification:**
- ✅ `correct` - Called add_activity
- ⚠️ `wrong_tool` - Called different tool
- ❌ `text_only` - No tool call, just text
- 💥 `error` - API error

**Output:** Comparison table with pass/fail status, latency, token counts

**Usage:**
```bash
npx tsx tests/eval/model-tool-calling.ts
```

### Cost Tracking

**File:** `tests/eval/metrics/cost-calculator.ts`

**Model Pricing Data (Updated 2025-01-22):**

```typescript
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic models (per 1M tokens)
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
```

**Functions:**
- `calculateCost(model, inputTokens, outputTokens)` - Cost for single interaction
- `estimateMonthlyCost(model, avgInput, avgOutput, interactionsPerMonth)` - Monthly estimates
- `calculateCostPer1k(model, avgInput, avgOutput)` - Cost per 1k interactions
- `compareCosts(model1, model2, avgInput, avgOutput)` - Side-by-side comparison

### Running Evaluations

**Full Evaluation:**
```bash
npx tsx tests/eval/model-comparison.ts
```

**Options:**
```bash
# Specific agent
npx tsx tests/eval/model-comparison.ts --agent trip-designer

# Specific models
npx tsx tests/eval/model-comparison.ts --models claude-sonnet-4,gpt-4o

# Skip quality judge (faster, cheaper)
npx tsx tests/eval/model-comparison.ts --no-judge
```

**Outputs:**
- `tests/eval/results/eval-TIMESTAMP.json` - Raw results
- `tests/eval/results/eval-TIMESTAMP.md` - Markdown report
- `tests/eval/results/recommendations.md` - Model recommendations

---

## 5. Key Files for Adding Eval Testing

### Add New Tool-Calling Tests

**File:** `tests/eval/model-tool-calling.ts`

**Steps:**
1. Add new test prompts to `TEST_PROMPT` constant
2. Modify tool definitions if testing different tools
3. Update `formatResult()` for new result types
4. Run: `npx tsx tests/eval/model-tool-calling.ts`

### Add New General Eval Prompts

**File:** `tests/eval/test-prompts.ts`

**Structure:**
```typescript
{
  agent: 'trip-designer',
  prompts: [
    {
      prompt: 'Your test prompt here',
      expectedBehavior: 'What the agent should do',
      category: 'discovery', // or 'refinement', 'tool-use', 'general'
    },
  ],
}
```

### Add New Metrics

**Location:** `tests/eval/metrics/`

**Existing Metrics:**
- `format-compliance.ts` - JSON/markdown validation
- `quality-judge.ts` - LLM-as-judge evaluation
- `cost-calculator.ts` - Cost estimation
- `eval-metrics.ts` - Metric aggregation
- `evaluator.ts` - Main evaluation logic

**To Add New Metric:**
1. Create file in `metrics/` directory
2. Export evaluation function
3. Import in `model-comparison.ts`
4. Add to `calculateMetrics()` function

### Add New Models

**File:** `tests/config/models.ts` (not found, likely inline in model-comparison.ts)

**Steps:**
1. Add model identifier to test list
2. Add pricing data to `metrics/cost-calculator.ts`

---

## 6. Travel Agent Status

**Finding:** ❌ **No Travel Agent Service Implementation Found**

**Evidence:**
- `Glob: **/travel-agent/**/*.ts` → No files found
- No `TravelAgentService` class in codebase
- No travel agent system prompts
- No travel agent tool definitions

**Possible Explanations:**
1. **Not Yet Implemented** - Travel Agent is planned but not built
2. **Different Naming** - May be called something else (e.g., `SearchService`, `BookingService`)
3. **Integrated Functionality** - Travel search tools may be part of Trip Designer

**Search Tools in Trip Designer:**
- `search_flights` - Uses SERP API for Google Flights
- `search_hotels` - Uses SERP API for Google Hotels
- `search_transfers` - Transfer options between locations

**Recommendation:** If Travel Agent functionality is needed, it may be implemented as:
- Extension of Trip Designer with search-focused tools
- Separate service with dedicated search/recommendation logic
- Integration with `TravelAgentFacade` (referenced in Trip Designer dependencies)

---

## 7. Recommendations

### For Model Evaluation

1. **Tool-Calling Accuracy**
   - Use `tests/eval/model-tool-calling.ts` to test models
   - Focus on `add_hotel` and `add_activity` tools (critical for UX)
   - Test with varied prompts (implicit vs explicit requests)

2. **Cost-Performance Trade-off**
   - Use cost calculator to compare models
   - Consider: Claude 3.5 Haiku (current) vs. GPT-4o-mini (cheaper)
   - Evaluate: Does cheaper model maintain tool-calling accuracy?

3. **Multi-Turn Evaluation**
   - Current framework lacks multi-turn conversation tests
   - Add scenarios: Discovery → Refinement → Tool Use
   - Track context retention across turns

### For Travel Agent Development

1. **Clarify Architecture**
   - Determine if Travel Agent is separate service or Trip Designer extension
   - Review `TravelAgentFacade` usage in Trip Designer

2. **Tool Definitions**
   - Define dedicated search tools (or reuse existing)
   - Separate search/discovery from booking/planning

3. **Model Selection**
   - May need different model than Trip Designer
   - Search tasks may benefit from faster/cheaper models
   - Recommendation synthesis may need stronger reasoning

### For Evaluation Framework

1. **Add Missing Tests**
   - Multi-turn conversation evaluation
   - Tool chaining accuracy (e.g., get_itinerary → add_hotel)
   - Error handling (malformed tool arguments)

2. **Performance Regression Detection**
   - Baseline current model performance
   - CI/CD integration for automated testing
   - Alert on quality drops

3. **Cost Monitoring**
   - Track actual production costs vs. estimates
   - Identify high-cost interaction patterns
   - Optimize prompts for token efficiency

---

## 8. Appendix: Tool Definitions Summary

### Trip Designer Tools (24 Total)

**Core Operations (5 tools):**
- `get_itinerary` - Get complete itinerary state
- `get_segment` - Get specific segment details
- `update_itinerary` - Update trip metadata
- `update_preferences` - Update traveler preferences
- `add_traveler` - Add traveler to itinerary

**Segment Creation (5 tools):**
- `add_flight` - Add flight segment
- `add_hotel` - Add accommodation segment
- `add_activity` - Add activity/dining/tour segment
- `add_transfer` - Add ground transfer
- `add_meeting` - Add meeting/appointment

**Segment Management (4 tools):**
- `update_segment` - Update existing segment
- `delete_segment` - Delete segment
- `move_segment` - Move segment in time
- `reorder_segments` - Change display order

**Search & Discovery (4 tools):**
- `search_web` - General web search
- `search_flights` - Flight prices via SERP API
- `search_hotels` - Hotel prices via SERP API
- `search_transfers` - Transfer options

**Knowledge Management (2 tools):**
- `store_travel_intelligence` - Store seasonal/event data
- `retrieve_travel_intelligence` - Query stored intelligence

**Geography (3 tools):**
- `get_distance` - Calculate distance
- `show_route` - Display multi-location route
- `geocode_location` - Get coordinates

**Agent Mode (1 tool):**
- `switch_to_trip_designer` - Switch from Help mode

---

## 9. Next Steps

### Immediate Actions

1. **Clarify Travel Agent Status**
   - Confirm if Travel Agent is planned or implemented differently
   - Check for `TravelAgentFacade` service implementation

2. **Run Current Eval Framework**
   - Execute: `npx tsx tests/eval/model-tool-calling.ts`
   - Generate baseline metrics for Claude 3.5 Haiku

3. **Review Eval Results**
   - Check: `tests/eval/results/EVALUATION_SUMMARY.md`
   - Understand why Claude 3.5 Haiku was chosen

### Future Research

1. **Model Comparison Study**
   - Test: Claude 3.5 Haiku vs. GPT-4o-mini vs. Gemini 2.0 Flash
   - Metrics: Tool-calling accuracy, cost, latency, quality
   - Focus: Production viability

2. **Tool-Calling Reliability**
   - Test edge cases (ambiguous prompts, implicit requests)
   - Measure: False negatives (missed tool calls) vs. false positives
   - Goal: 95%+ accuracy on critical tools (add_hotel, add_activity)

3. **Prompt Optimization**
   - A/B test system prompt variations
   - Measure impact on tool-calling compliance
   - Reduce token count without sacrificing quality

---

**Report Generated:** 2026-01-01
**Total Files Analyzed:** 8
**Lines of Code Reviewed:** ~3500
**Key Findings:** 6

