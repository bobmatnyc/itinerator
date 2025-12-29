/**
 * Text Parser - Extract booking data from plain text
 * @module services/import/parsers/text
 */

import type { IParser, ImportRequest, ImportResult, ImportFormat } from '../types.js';
import type { LLMExtractor } from '../extractors/llm.extractor.js';

/**
 * Text parser configuration
 */
export interface TextParserConfig {
  /** LLM extractor for text analysis */
  llmExtractor: LLMExtractor;
}

/**
 * Plain text parser using LLM extraction
 */
export class TextParser implements IParser {
  supportedFormats: ImportFormat[] = ['text'];
  private llmExtractor: LLMExtractor;

  constructor(config: TextParserConfig) {
    this.llmExtractor = config.llmExtractor;
  }

  /**
   * Parse plain text and extract booking data
   */
  async parse(request: ImportRequest): Promise<ImportResult> {
    try {
      // Convert content to string
      const text = Buffer.isBuffer(request.content)
        ? request.content.toString('utf8')
        : request.content;

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          format: 'text',
          segments: [],
          confidence: 0,
          errors: ['Empty text content'],
        };
      }

      // Use LLM to extract bookings
      const result = await this.llmExtractor.extract(text, 'text');

      return {
        ...result,
        format: 'text',
      };
    } catch (error) {
      return {
        success: false,
        format: 'text',
        segments: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Failed to parse text'],
      };
    }
  }
}
