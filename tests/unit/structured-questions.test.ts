import { describe, it, expect } from 'vitest';

/**
 * Unit tests for structured question parsing and validation
 *
 * Tests the ONE question rule enforcement from trip designer prompts
 * and structured question parsing from agent responses.
 */

// Types from viewer-svelte/src/lib/types.ts
interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  imageUrl?: string;
}

interface StructuredQuestion {
  id: string;
  type: 'single_choice' | 'multiple_choice' | 'scale' | 'date_range' | 'text';
  question: string;
  context?: string;
  options?: QuestionOption[];
  scale?: {
    min: number;
    max: number;
    step?: number;
    minLabel?: string;
    maxLabel?: string;
  };
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse structured questions from JSON response
 */
function parseStructuredQuestions(jsonString: string): StructuredQuestion[] {
  try {
    const parsed = JSON.parse(jsonString);

    // Handle response wrapped in { message, structuredQuestions }
    if (parsed.structuredQuestions && Array.isArray(parsed.structuredQuestions)) {
      return parsed.structuredQuestions;
    }

    // Handle direct array
    if (Array.isArray(parsed)) {
      return parsed;
    }

    return [];
  } catch (error) {
    console.warn('Failed to parse structured questions:', error);
    return [];
  }
}

/**
 * Validate ONE question rule (from trip designer prompts)
 * The system should enforce asking ONE question at a time
 */
function validateOneQuestionRule(questions: StructuredQuestion[]): {
  valid: boolean;
  error?: string;
} {
  if (questions.length === 0) {
    return { valid: false, error: 'No questions provided' };
  }

  if (questions.length > 1) {
    return { valid: false, error: 'Multiple questions provided. Only ONE question allowed at a time.' };
  }

  return { valid: true };
}

/**
 * Validate question structure
 */
function validateQuestionStructure(question: StructuredQuestion): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!question.id) {
    errors.push('Question missing required field: id');
  }

  if (!question.type) {
    errors.push('Question missing required field: type');
  }

  if (!question.question || question.question.trim() === '') {
    errors.push('Question missing required field: question (or empty)');
  }

  // Type-specific validation
  if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    if (!question.options || question.options.length === 0) {
      errors.push(`${question.type} question must have options`);
    }
  }

  if (question.type === 'scale') {
    if (!question.scale) {
      errors.push('Scale question must have scale configuration');
    } else {
      if (question.scale.min === undefined || question.scale.max === undefined) {
        errors.push('Scale question must have min and max values');
      }
      if (question.scale.min >= question.scale.max) {
        errors.push('Scale min must be less than max');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('parseStructuredQuestions', () => {
  it('parses valid JSON with structuredQuestions array', () => {
    const json = JSON.stringify({
      message: 'Please choose',
      structuredQuestions: [
        {
          id: 'dest-1',
          type: 'single_choice',
          question: 'Where would you like to go?',
          options: [
            { id: 'tokyo', label: 'Tokyo' },
            { id: 'kyoto', label: 'Kyoto' }
          ]
        }
      ]
    });

    const questions = parseStructuredQuestions(json);

    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe('dest-1');
    expect(questions[0].type).toBe('single_choice');
    expect(questions[0].question).toBe('Where would you like to go?');
    expect(questions[0].options).toHaveLength(2);
  });

  it('returns empty array for invalid JSON', () => {
    const invalidJson = '{ "message": "incomplete';
    const questions = parseStructuredQuestions(invalidJson);

    expect(questions).toEqual([]);
  });

  it('handles missing structuredQuestions field', () => {
    const json = JSON.stringify({
      message: 'Just a message'
    });

    const questions = parseStructuredQuestions(json);

    expect(questions).toEqual([]);
  });

  it('handles direct array of questions', () => {
    const json = JSON.stringify([
      {
        id: 'q1',
        type: 'text',
        question: 'What is your budget?'
      }
    ]);

    const questions = parseStructuredQuestions(json);

    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe('q1');
  });

  it('handles empty structuredQuestions array', () => {
    const json = JSON.stringify({
      message: 'No questions',
      structuredQuestions: []
    });

    const questions = parseStructuredQuestions(json);

    expect(questions).toEqual([]);
  });

  it('handles null structuredQuestions', () => {
    const json = JSON.stringify({
      message: 'Test',
      structuredQuestions: null
    });

    const questions = parseStructuredQuestions(json);

    expect(questions).toEqual([]);
  });

  it('parses scale question correctly', () => {
    const json = JSON.stringify({
      structuredQuestions: [
        {
          id: 'budget-scale',
          type: 'scale',
          question: 'What is your budget flexibility?',
          scale: {
            min: 1,
            max: 5,
            step: 1,
            minLabel: 'Strict',
            maxLabel: 'Flexible'
          }
        }
      ]
    });

    const questions = parseStructuredQuestions(json);

    expect(questions).toHaveLength(1);
    expect(questions[0].type).toBe('scale');
    expect(questions[0].scale?.min).toBe(1);
    expect(questions[0].scale?.max).toBe(5);
  });

  it('parses multiple_choice question with multiple options', () => {
    const json = JSON.stringify({
      structuredQuestions: [
        {
          id: 'interests',
          type: 'multiple_choice',
          question: 'Select your interests',
          options: [
            { id: 'food', label: 'Food & Dining' },
            { id: 'culture', label: 'Culture & History' },
            { id: 'nature', label: 'Nature & Outdoors' },
            { id: 'shopping', label: 'Shopping' }
          ]
        }
      ]
    });

    const questions = parseStructuredQuestions(json);

    expect(questions).toHaveLength(1);
    expect(questions[0].type).toBe('multiple_choice');
    expect(questions[0].options).toHaveLength(4);
  });
});

describe('ONE question rule', () => {
  it('validates single question is allowed', () => {
    const questions: StructuredQuestion[] = [
      {
        id: 'q1',
        type: 'single_choice',
        question: 'Choose destination',
        options: [
          { id: 'tokyo', label: 'Tokyo' },
          { id: 'kyoto', label: 'Kyoto' }
        ]
      }
    ];

    const result = validateOneQuestionRule(questions);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('fails when multiple questions provided', () => {
    const questions: StructuredQuestion[] = [
      {
        id: 'q1',
        type: 'single_choice',
        question: 'Choose destination',
        options: [{ id: 'tokyo', label: 'Tokyo' }]
      },
      {
        id: 'q2',
        type: 'text',
        question: 'What is your budget?'
      }
    ];

    const result = validateOneQuestionRule(questions);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Multiple questions');
    expect(result.error).toContain('ONE question');
  });

  it('validates question structure (id, text, options)', () => {
    const question: StructuredQuestion = {
      id: 'dest-choice',
      type: 'single_choice',
      question: 'Where would you like to go?',
      options: [
        { id: 'tokyo', label: 'Tokyo' },
        { id: 'osaka', label: 'Osaka' }
      ]
    };

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('handles edge case of empty questions array', () => {
    const questions: StructuredQuestion[] = [];

    const result = validateOneQuestionRule(questions);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('No questions provided');
  });

  it('enforces exactly ONE question (not zero, not two+)', () => {
    // Zero questions
    expect(validateOneQuestionRule([]).valid).toBe(false);

    // One question (valid)
    expect(validateOneQuestionRule([
      { id: 'q1', type: 'text', question: 'Test?' }
    ]).valid).toBe(true);

    // Two questions (invalid)
    expect(validateOneQuestionRule([
      { id: 'q1', type: 'text', question: 'Test 1?' },
      { id: 'q2', type: 'text', question: 'Test 2?' }
    ]).valid).toBe(false);

    // Three questions (invalid)
    expect(validateOneQuestionRule([
      { id: 'q1', type: 'text', question: 'Test 1?' },
      { id: 'q2', type: 'text', question: 'Test 2?' },
      { id: 'q3', type: 'text', question: 'Test 3?' }
    ]).valid).toBe(false);
  });
});

describe('validateQuestionStructure', () => {
  it('validates required fields are present', () => {
    const validQuestion: StructuredQuestion = {
      id: 'q1',
      type: 'text',
      question: 'What is your name?'
    };

    const result = validateQuestionStructure(validQuestion);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when id is missing', () => {
    const question = {
      type: 'text',
      question: 'Test?'
    } as StructuredQuestion;

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Question missing required field: id');
  });

  it('fails when type is missing', () => {
    const question = {
      id: 'q1',
      question: 'Test?'
    } as StructuredQuestion;

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Question missing required field: type');
  });

  it('fails when question text is missing or empty', () => {
    const question1: StructuredQuestion = {
      id: 'q1',
      type: 'text',
      question: ''
    };

    const result1 = validateQuestionStructure(question1);
    expect(result1.valid).toBe(false);
    expect(result1.errors.some(e => e.includes('question (or empty)'))).toBe(true);

    const question2 = {
      id: 'q2',
      type: 'text'
    } as StructuredQuestion;

    const result2 = validateQuestionStructure(question2);
    expect(result2.valid).toBe(false);
  });

  it('fails when single_choice has no options', () => {
    const question: StructuredQuestion = {
      id: 'q1',
      type: 'single_choice',
      question: 'Choose one',
      options: []
    };

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('single_choice question must have options');
  });

  it('fails when multiple_choice has no options', () => {
    const question: StructuredQuestion = {
      id: 'q1',
      type: 'multiple_choice',
      question: 'Choose many'
    };

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('multiple_choice question must have options');
  });

  it('fails when scale question has no scale configuration', () => {
    const question: StructuredQuestion = {
      id: 'q1',
      type: 'scale',
      question: 'Rate this'
    };

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Scale question must have scale configuration');
  });

  it('fails when scale min/max are missing', () => {
    const question: StructuredQuestion = {
      id: 'q1',
      type: 'scale',
      question: 'Rate this',
      scale: {} as any
    };

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Scale question must have min and max values');
  });

  it('fails when scale min >= max', () => {
    const question: StructuredQuestion = {
      id: 'q1',
      type: 'scale',
      question: 'Rate this',
      scale: { min: 5, max: 1 }
    };

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Scale min must be less than max');
  });

  it('validates text question (no extra requirements)', () => {
    const question: StructuredQuestion = {
      id: 'q1',
      type: 'text',
      question: 'Enter your budget'
    };

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(true);
  });

  it('validates date_range question (no extra requirements)', () => {
    const question: StructuredQuestion = {
      id: 'q1',
      type: 'date_range',
      question: 'Select travel dates'
    };

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(true);
  });

  it('accumulates multiple validation errors', () => {
    const question = {
      type: 'single_choice',
      question: '',
      options: []
    } as StructuredQuestion;

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors).toContain('Question missing required field: id');
    expect(result.errors.some(e => e.includes('question (or empty)'))).toBe(true);
    expect(result.errors).toContain('single_choice question must have options');
  });

  it('validates optional fields are truly optional', () => {
    const question: StructuredQuestion = {
      id: 'q1',
      type: 'single_choice',
      question: 'Choose',
      options: [{ id: '1', label: 'Option 1' }]
      // context, validation are optional
    };

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(true);
  });

  it('allows context and validation fields when present', () => {
    const question: StructuredQuestion = {
      id: 'q1',
      type: 'text',
      question: 'Enter budget',
      context: 'This helps us plan better',
      validation: {
        required: true,
        min: 100,
        max: 10000
      }
    };

    const result = validateQuestionStructure(question);

    expect(result.valid).toBe(true);
  });
});
