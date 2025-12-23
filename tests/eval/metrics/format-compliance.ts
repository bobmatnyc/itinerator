/**
 * Format compliance metrics for evaluating LLM responses
 */

interface StructuredQuestions {
  discovery?: string[];
  refinement?: string[];
  confirmation?: string[];
}

/**
 * Evaluate if response contains valid JSON when expected
 * @param response - LLM response text
 * @returns 1.0 if JSON is valid, 0.0 if invalid, 0.5 if no JSON expected
 */
export function evaluateJsonCompliance(response: string): number {
  // Extract JSON blocks (looking for ```json or bare JSON objects)
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
  const bareJsonRegex = /^(\{[\s\S]*\})$/m;

  const jsonBlocks = Array.from(response.matchAll(jsonBlockRegex));
  const bareJson = response.match(bareJsonRegex);

  // If no JSON found, assume it's not required
  if (jsonBlocks.length === 0 && !bareJson) {
    return 0.5;
  }

  // Try to parse all JSON blocks
  let validCount = 0;
  let totalCount = 0;

  for (const match of jsonBlocks) {
    totalCount++;
    try {
      JSON.parse(match[1]);
      validCount++;
    } catch {
      // Invalid JSON
    }
  }

  if (bareJson) {
    totalCount++;
    try {
      JSON.parse(bareJson[1]);
      validCount++;
    } catch {
      // Invalid JSON
    }
  }

  return totalCount > 0 ? validCount / totalCount : 0.5;
}

/**
 * Parse structured questions from response
 */
function parseStructuredQuestions(response: string): StructuredQuestions {
  const questions: StructuredQuestions = {};

  // Look for structured questions format
  const discoveryMatch = response.match(
    /discovery["\s:]*\[([^\]]*)\]/i
  );
  const refinementMatch = response.match(
    /refinement["\s:]*\[([^\]]*)\]/i
  );
  const confirmationMatch = response.match(
    /confirmation["\s:]*\[([^\]]*)\]/i
  );

  if (discoveryMatch) {
    questions.discovery = extractQuestions(discoveryMatch[1]);
  }
  if (refinementMatch) {
    questions.refinement = extractQuestions(refinementMatch[1]);
  }
  if (confirmationMatch) {
    questions.confirmation = extractQuestions(confirmationMatch[1]);
  }

  return questions;
}

/**
 * Extract individual questions from a string
 */
function extractQuestions(text: string): string[] {
  // Handle both JSON array format and quoted strings
  try {
    // Try parsing as JSON array
    const parsed = JSON.parse(`[${text}]`);
    return parsed.filter((q: unknown) => typeof q === 'string' && q.trim());
  } catch {
    // Fallback: split by quotes
    const questions = text
      .split(/["']/)
      .filter((q) => q.trim() && !q.match(/^\s*,\s*$/))
      .map((q) => q.trim());
    return questions;
  }
}

/**
 * Count total questions in response
 */
function countQuestions(questions: StructuredQuestions): number {
  let count = 0;
  if (questions.discovery) count += questions.discovery.length;
  if (questions.refinement) count += questions.refinement.length;
  if (questions.confirmation) count += questions.confirmation.length;
  return count;
}

/**
 * Evaluate ONE question rule compliance
 * @param response - LLM response text
 * @returns 1.0 if exactly one question OR no questions (valid), 0.0 if multiple
 */
export function evaluateOneQuestionRule(response: string): number {
  const questions = parseStructuredQuestions(response);
  const totalQuestions = countQuestions(questions);

  // No questions is valid (agent providing info, not asking)
  if (totalQuestions === 0) {
    return 1.0;
  }

  // Exactly one question is perfect
  if (totalQuestions === 1) {
    return 1.0;
  }

  // Multiple questions is violation
  return 0.0;
}

/**
 * Get question count details
 */
export function getQuestionCount(response: string): {
  total: number;
  byCategory: StructuredQuestions;
} {
  const questions = parseStructuredQuestions(response);
  return {
    total: countQuestions(questions),
    byCategory: questions,
  };
}

/**
 * Evaluate markdown formatting quality
 * @param response - LLM response text
 * @returns 0-1 score based on markdown quality
 */
export function evaluateMarkdownQuality(response: string): number {
  let score = 1.0;

  // Check for proper heading hierarchy (# then ##, not jumping to ###)
  const headings = response.match(/^#{1,6}\s/gm) || [];
  if (headings.length > 0) {
    let prevLevel = 0;
    for (const heading of headings) {
      const level = heading.match(/^#{1,6}/)?.[0].length || 0;
      if (level - prevLevel > 1) {
        score -= 0.1; // Penalty for skipping levels
      }
      prevLevel = level;
    }
  }

  // Check for proper list formatting
  const hasLists = /^[\s]*[-*+]\s/m.test(response);
  const hasNumberedLists = /^[\s]*\d+\.\s/m.test(response);

  // Check for code blocks with language specified
  const codeBlocks = response.match(/```(\w+)?/g) || [];
  const codeBlocksWithLang = codeBlocks.filter((cb) =>
    cb.match(/```\w+/)
  ).length;
  if (codeBlocks.length > 0) {
    score *= codeBlocksWithLang / codeBlocks.length;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Comprehensive format compliance check
 */
export function evaluateFormatCompliance(response: string): {
  jsonCompliance: number;
  oneQuestionCompliance: number;
  markdownQuality: number;
  overall: number;
  details: {
    hasValidJson: boolean;
    questionCount: number;
    questionDetails: StructuredQuestions;
  };
} {
  const jsonCompliance = evaluateJsonCompliance(response);
  const oneQuestionCompliance = evaluateOneQuestionRule(response);
  const markdownQuality = evaluateMarkdownQuality(response);
  const questionInfo = getQuestionCount(response);

  // Overall score: weighted average
  // JSON compliance: 30%, One question rule: 40%, Markdown: 30%
  const overall =
    jsonCompliance * 0.3 +
    oneQuestionCompliance * 0.4 +
    markdownQuality * 0.3;

  return {
    jsonCompliance,
    oneQuestionCompliance,
    markdownQuality,
    overall,
    details: {
      hasValidJson: jsonCompliance >= 0.5,
      questionCount: questionInfo.total,
      questionDetails: questionInfo.byCategory,
    },
  };
}
