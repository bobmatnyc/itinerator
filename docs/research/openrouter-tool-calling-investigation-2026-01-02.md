# OpenRouter Tool Calling Investigation - Trip Designer Issue

**Date:** 2026-01-02
**Issue:** Trip Designer outputs JSON text with `tool_calls` instead of using native OpenAI tool calling format
**Current Model:** `anthropic/claude-3.5-haiku` via OpenRouter

---

## Investigation Results

### 1. What Model is Being Used in Tests?

**Finding:** The test output shows **`anthropic/claude-sonnet-4`** is actually being used, NOT `claude-3.5-haiku`

```
Model: anthropic/claude-sonnet-4
API: http://localhost:5176/api/v1
Max turns: 15
```

**Evidence from code:**
- Default in `trip-designer.service.ts`: `const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku';`
- Test override appears to be using `anthropic/claude-sonnet-4` instead

**Problem manifestation in test logs (lines 149-179):**
```json
{
  "tool_calls": [
    {
      "name": "add_traveler",
      "arguments": {
        "firstName": "Alex",
        "type": "adult",
        "isPrimary": true,
        "origin": "New York City"
      }
    }
  ]
}
```

The model is returning JSON **text** containing a `tool_calls` array instead of using OpenAI's native `tool_calls` format in the API response.

---

### 2. Does OpenRouter Support Tool Calling for Anthropic Models?

**✅ YES - OpenRouter fully supports native tool calling for Anthropic models**

**Key findings:**

1. **Native Support via "Anthropic Skin"**
   - OpenRouter's "Anthropic Skin" behaves exactly like the Anthropic API
   - Handles model mapping and passes through advanced features like "Thinking" blocks and native tool use
   - Source: [OpenRouter Claude Code Integration](https://openrouter.ai/docs/guides/guides/claude-code-integration)

2. **Tool Calling API**
   - OpenRouter accepts OpenAI-style tool calling requests
   - For non-OpenAI providers (including Anthropic), requests are "transformed accordingly"
   - When tools are sent, OpenRouter only routes to providers that natively support tool use
   - Source: [OpenRouter Tool Calling](https://openrouter.ai/docs/guides/features/tool-calling)

3. **Tool Choice Parameters**
   - `'none'` - model won't call any tool
   - `'auto'` - model can choose between message or tools
   - `'required'` - model must call one or more tools
   - Can force specific tool: `{"type": "function", "function": {"name": "my_function"}}`
   - Source: [OpenRouter API Parameters](https://openrouter.ai/docs/api/reference/parameters)

4. **Known Quirk**
   - OpenRouter uses OpenAI-style API format
   - But Claude through OpenRouter uses `toolu_...` format for tool IDs instead of `call_...` format
   - This is generally handled by OpenRouter's compatibility layer
   - Source: [GitHub Issue #747](https://github.com/karthink/gptel/issues/747)

---

### 3. Would `anthropic/claude-sonnet-4` Be Better for Tool Calling?

**✅ YES - Claude Sonnet 4 has significantly improved tool calling capabilities**

**Comparison:**

| Feature | Claude 3.5 Haiku | Claude Sonnet 4 |
|---------|------------------|-----------------|
| **Tool Calling** | Basic support | **Improved tool orchestration** |
| **Parallel Execution** | Limited | **Speculative parallel execution** |
| **Context Management** | Standard | **Enhanced context tracking** |
| **Token Awareness** | Basic | **Token usage tracking across tool calls** |
| **Use Cases** | Simple tasks | **Multi-step workflows, agentic tasks** |
| **Pricing** | $0.80/1M input | Higher (premium model) |

**Claude Sonnet 4.5 capabilities:**
- Stronger agentic capabilities
- Improved tool orchestration
- Speculative parallel execution
- More efficient context and memory management
- Enhanced context tracking and token usage awareness
- Well-suited for multi-context and long-running workflows
- Source: [Claude Sonnet 4.5 on OpenRouter](https://openrouter.ai/anthropic/claude-sonnet-4.5)

**Claude Haiku 4.5 (alternative recommendation):**
- Matches Claude Sonnet 4's performance on tool use tasks
- Much lower cost than Sonnet 4
- Extended thinking capabilities
- Full support for coding, bash, web search, and computer-use tools
- Source: [Claude Haiku 4.5 on OpenRouter](https://openrouter.ai/anthropic/claude-haiku-4.5)

---

### 4. Is There a Setting to Enable/Disable Tool Calling?

**NO explicit toggle, but there are configuration parameters that control tool calling behavior:**

#### Available Parameters:

1. **`tools` parameter** (array)
   - Defines available tools using OpenAI format
   - If omitted, model won't have access to tools
   - OpenRouter transforms this for Anthropic models automatically
   - Source: [OpenRouter Tool Calling](https://openrouter.ai/docs/guides/features/tool-calling)

2. **`tool_choice` parameter** (string | object)
   - `'none'` - disables tool calling
   - `'auto'` - model decides (default)
   - `'required'` - forces tool use
   - Can specify particular tool to force
   - Source: [OpenRouter API Parameters](https://openrouter.ai/docs/api/reference/parameters)

3. **`parallel_tool_calls` parameter** (boolean)
   - `true` - model can call multiple tools simultaneously
   - `false` - tools called sequentially
   - Only applies when tools are provided
   - Source: [OpenRouter Tool Calling](https://openrouter.ai/docs/guides/features/tool-calling)

4. **`response_format` parameter** (object)
   - Setting `{ "type": "json_object" }` enables JSON mode
   - Forces model to produce valid JSON
   - **⚠️ This might be causing the issue** if it's forcing JSON text instead of native tool calls
   - Source: [OpenRouter API Parameters](https://openrouter.ai/docs/api/reference/parameters)

5. **`transforms` parameter** (array)
   - Applied to prompt before sending to model
   - Default includes "middle-out" for context compression
   - Set to empty array `[]` to disable all transforms
   - Source: [OpenRouter Message Transforms](https://openrouter.ai/docs/transforms)

---

## Root Cause Analysis

**The problem is likely NOT the model itself, but configuration:**

1. **Hypothesis 1: `response_format` is set to `json_object`**
   - This would force the model to output JSON text instead of using native tool calls
   - Need to check Trip Designer service configuration

2. **Hypothesis 2: Missing or incorrect `tool_choice` parameter**
   - If not set to `'auto'` or `'required'`, model might default to text output

3. **Hypothesis 3: Tools not properly defined in OpenAI format**
   - OpenRouter expects OpenAI-style tool definitions
   - Need to verify tool schema format

---

## Recommendations

### Immediate Actions:

1. **Verify Configuration Parameters**
   - Check if `response_format: { type: "json_object" }` is being set
   - Ensure `tool_choice` is set to `'auto'` or `'required'`
   - Verify `tools` array is properly formatted in OpenAI style

2. **Check OpenAI Client Setup**
   - The service uses `OpenAI` client from `openai` package
   - Ensure it's configured correctly for OpenRouter endpoint
   - Verify API base URL is set to `https://openrouter.ai/api/v1`

3. **Review Tool Definitions**
   - Ensure tools are defined using OpenAI's function calling schema
   - Verify tool names and parameter schemas are correct

### Model Recommendations:

**Option 1: Claude Haiku 4.5** (Recommended for cost-effectiveness)
- Model: `anthropic/claude-haiku-4.5`
- Pricing: ~$1.00/1M input tokens
- Tool calling: Matches Sonnet 4 performance
- Best for: Cost-conscious production use

**Option 2: Claude Sonnet 4** (Current test model)
- Model: `anthropic/claude-sonnet-4` or `anthropic/claude-sonnet-4-20250514`
- Pricing: Premium tier
- Tool calling: Advanced orchestration and parallel execution
- Best for: Complex multi-step workflows requiring reliability

**Option 3: Keep Claude 3.5 Haiku** (Current default)
- Model: `anthropic/claude-3.5-haiku`
- Pricing: $0.80/1M input tokens (lowest cost)
- Tool calling: Basic but functional
- **⚠️ Deprecated:** Claude 3.5 Haiku was deprecated on 2025-12-19
- Best for: Budget-constrained scenarios (but upgrade soon)

### Long-term Solution:

**Migrate to Claude Haiku 4.5** as the default model:
- Better tool calling reliability than 3.5 Haiku
- Only $0.20 more per 1M tokens
- Future-proof (not deprecated)
- Matches Sonnet 4 on tool use tasks
- Supports extended thinking and multi-step workflows

---

## Next Steps

1. **Debug current configuration:**
   - Add logging to see actual OpenRouter API request/response
   - Check if `response_format`, `tool_choice`, and `tools` are set correctly
   - Verify OpenAI client is using OpenRouter endpoint

2. **Test with explicit tool calling configuration:**
   ```typescript
   const response = await this.client.chat.completions.create({
     model: 'anthropic/claude-sonnet-4',
     messages: [...],
     tools: [...], // OpenAI format tool definitions
     tool_choice: 'auto', // Explicitly enable tool calling
     // DO NOT set response_format to json_object
   });
   ```

3. **Upgrade model:**
   - Short-term: Keep using `anthropic/claude-sonnet-4` for testing
   - Long-term: Switch default to `anthropic/claude-haiku-4.5` for production

---

## Sources

- [OpenRouter Claude Code Integration](https://openrouter.ai/docs/guides/guides/claude-code-integration)
- [OpenRouter Tool & Function Calling](https://openrouter.ai/docs/guides/features/tool-calling)
- [OpenRouter API Parameters](https://openrouter.ai/docs/api/reference/parameters)
- [OpenRouter Message Transforms](https://openrouter.ai/docs/transforms)
- [Claude Sonnet 4.5 on OpenRouter](https://openrouter.ai/anthropic/claude-sonnet-4.5)
- [Claude Haiku 4.5 on OpenRouter](https://openrouter.ai/anthropic/claude-haiku-4.5)
- [Claude 3.5 Haiku on OpenRouter](https://openrouter.ai/anthropic/claude-3.5-haiku)
- [OpenRouter Tool Use Issue #747](https://github.com/karthink/gptel/issues/747)
- [Claude Model Deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)
