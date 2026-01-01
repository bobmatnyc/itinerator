/**
 * Unit tests for model-tool-calling evaluation
 */

import { describe, it, expect } from 'vitest';
import { TEST_MODELS, TEST_PROMPT } from '../../eval/model-tool-calling';

describe('Model Tool-Calling Evaluation', () => {
  it('should have defined test models', () => {
    expect(TEST_MODELS).toBeDefined();
    expect(TEST_MODELS.length).toBeGreaterThan(0);
  });

  it('should include Anthropic models', () => {
    const hasAnthropic = TEST_MODELS.some((model) =>
      model.startsWith('anthropic/')
    );
    expect(hasAnthropic).toBe(true);
  });

  it('should include OpenAI models', () => {
    const hasOpenAI = TEST_MODELS.some((model) => model.startsWith('openai/'));
    expect(hasOpenAI).toBe(true);
  });

  it('should include current default model', () => {
    expect(TEST_MODELS).toContain('anthropic/claude-3.5-haiku');
  });

  it('should have test prompt for adding activity', () => {
    expect(TEST_PROMPT).toBeDefined();
    expect(TEST_PROMPT.toLowerCase()).toContain('dinner');
    expect(TEST_PROMPT.toLowerCase()).toContain('le bernardin');
  });

  it('should test at least 5 models', () => {
    expect(TEST_MODELS.length).toBeGreaterThanOrEqual(5);
  });

  it('should have diverse model providers', () => {
    const providers = new Set(
      TEST_MODELS.map((model) => model.split('/')[0])
    );
    expect(providers.size).toBeGreaterThanOrEqual(3);
  });
});
