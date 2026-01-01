/**
 * LLM-as-judge for response quality evaluation
 * Uses a cheaper model (Haiku) to evaluate response quality
 */

interface QualityScore {
  relevance: number; // 0-1: How relevant is the response to the prompt?
  helpfulness: number; // 0-1: How helpful is the response?
  clarity: number; // 0-1: How clear and understandable?
  correctness: number; // 0-1: Is the response factually correct?
  overall: number; // 0-1: Average of all metrics
  reasoning: string; // Explanation from judge
}

const JUDGE_MODEL = 'anthropic/claude-3-haiku';
const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator of AI assistant responses.
Evaluate the response on these criteria:

1. **Relevance** (0-1): Does the response address the user's prompt?
2. **Helpfulness** (0-1): Does it provide useful, actionable information?
3. **Clarity** (0-1): Is it clear, well-structured, and easy to understand?
4. **Correctness** (0-1): Is the information accurate and appropriate?

Return your evaluation as JSON:
{
  "relevance": 0.0-1.0,
  "helpfulness": 0.0-1.0,
  "clarity": 0.0-1.0,
  "correctness": 0.0-1.0,
  "reasoning": "brief explanation of scores"
}

Be objective and fair. Consider the context and expected behavior.`;

/**
 * Evaluate response quality using LLM-as-judge
 * @param prompt - Original user prompt
 * @param response - AI response to evaluate
 * @param expectedBehavior - What the agent should do (context)
 * @param apiKey - OpenRouter API key
 * @returns Quality score breakdown
 */
export async function evaluateResponseQuality(
  prompt: string,
  response: string,
  expectedBehavior: string,
  apiKey: string
): Promise<QualityScore> {
  const evaluationPrompt = `
User Prompt:
"""
${prompt}
"""

AI Response:
"""
${response}
"""

Expected Behavior:
"""
${expectedBehavior}
"""

Evaluate this response according to the criteria.`;

  try {
    const judgeResponse = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/yourusername/itinerator',
          'X-Title': 'Itinerizer Model Eval',
        },
        body: JSON.stringify({
          model: JUDGE_MODEL,
          messages: [
            { role: 'system', content: JUDGE_SYSTEM_PROMPT },
            { role: 'user', content: evaluationPrompt },
          ],
          temperature: 0.0, // Deterministic evaluation
          max_tokens: 500,
        }),
      }
    );

    if (!judgeResponse.ok) {
      throw new Error(
        `Judge API error: ${judgeResponse.status} ${judgeResponse.statusText}`
      );
    }

    const data = await judgeResponse.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in judge response');
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in judge response');
    }

    const scores = JSON.parse(jsonMatch[0]);

    const overall =
      (scores.relevance +
        scores.helpfulness +
        scores.clarity +
        scores.correctness) /
      4;

    return {
      relevance: scores.relevance,
      helpfulness: scores.helpfulness,
      clarity: scores.clarity,
      correctness: scores.correctness,
      overall,
      reasoning: scores.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.error('Error in quality judge:', error);
    // Return neutral scores on error
    return {
      relevance: 0.5,
      helpfulness: 0.5,
      clarity: 0.5,
      correctness: 0.5,
      overall: 0.5,
      reasoning: `Error during evaluation: ${error}`,
    };
  }
}

/**
 * Batch evaluate multiple responses
 */
export async function batchEvaluateQuality(
  evaluations: Array<{
    prompt: string;
    response: string;
    expectedBehavior: string;
  }>,
  apiKey: string,
  delayMs: number = 1000
): Promise<QualityScore[]> {
  const results: QualityScore[] = [];

  for (const evaluation of evaluations) {
    const score = await evaluateResponseQuality(
      evaluation.prompt,
      evaluation.response,
      evaluation.expectedBehavior,
      apiKey
    );
    results.push(score);

    // Rate limiting: delay between requests
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Calculate aggregate quality metrics
 */
export function aggregateQualityScores(scores: QualityScore[]): {
  avgRelevance: number;
  avgHelpfulness: number;
  avgClarity: number;
  avgCorrectness: number;
  avgOverall: number;
  minOverall: number;
  maxOverall: number;
} {
  if (scores.length === 0) {
    return {
      avgRelevance: 0,
      avgHelpfulness: 0,
      avgClarity: 0,
      avgCorrectness: 0,
      avgOverall: 0,
      minOverall: 0,
      maxOverall: 0,
    };
  }

  const sum = scores.reduce(
    (acc, score) => ({
      relevance: acc.relevance + score.relevance,
      helpfulness: acc.helpfulness + score.helpfulness,
      clarity: acc.clarity + score.clarity,
      correctness: acc.correctness + score.correctness,
      overall: acc.overall + score.overall,
    }),
    {
      relevance: 0,
      helpfulness: 0,
      clarity: 0,
      correctness: 0,
      overall: 0,
    }
  );

  const count = scores.length;

  return {
    avgRelevance: sum.relevance / count,
    avgHelpfulness: sum.helpfulness / count,
    avgClarity: sum.clarity / count,
    avgCorrectness: sum.correctness / count,
    avgOverall: sum.overall / count,
    minOverall: Math.min(...scores.map((s) => s.overall)),
    maxOverall: Math.max(...scores.map((s) => s.overall)),
  };
}
