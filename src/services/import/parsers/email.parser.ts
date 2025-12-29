/**
 * Email Parser - Extract booking data from emails
 * @module services/import/parsers/email
 */

import type { IParser, ImportRequest, ImportResult, ImportFormat } from '../types.js';
import { htmlToText } from '../utils/html-to-text.js';
import type { SchemaOrgExtractor } from '../extractors/schema-org.extractor.js';
import type { LLMExtractor } from '../extractors/llm.extractor.js';

/**
 * Email parser configuration
 */
export interface EmailParserConfig {
  /** Schema.org extractor (tries first, free) */
  schemaOrgExtractor: SchemaOrgExtractor;
  /** LLM extractor (fallback, requires API) */
  llmExtractor: LLMExtractor;
}

/**
 * Email parser with Schema.org extraction + LLM fallback
 */
export class EmailParser implements IParser {
  supportedFormats: ImportFormat[] = ['email', 'html'];
  private schemaOrgExtractor: SchemaOrgExtractor;
  private llmExtractor: LLMExtractor;

  constructor(config: EmailParserConfig) {
    this.schemaOrgExtractor = config.schemaOrgExtractor;
    this.llmExtractor = config.llmExtractor;
  }

  /**
   * Parse email and extract booking data
   */
  async parse(request: ImportRequest): Promise<ImportResult> {
    try {
      // Convert content to string
      const content = Buffer.isBuffer(request.content)
        ? request.content.toString('utf8')
        : request.content;

      // Try Schema.org extraction first (free, instant)
      const schemaResult = await this.schemaOrgExtractor.extract(content, 'email');

      // If Schema.org found bookings, return them
      if (schemaResult.success && schemaResult.segments.length > 0) {
        return {
          ...schemaResult,
          format: 'email',
          summary: `Found ${schemaResult.segments.length} booking(s) from Schema.org data`,
        };
      }

      // Fall back to LLM extraction
      const text = this.extractEmailText(content, request.metadata);
      const llmResult = await this.llmExtractor.extract(text, 'email');

      return {
        ...llmResult,
        format: 'email',
      };
    } catch (error) {
      return {
        success: false,
        format: 'email',
        segments: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Failed to parse email'],
      };
    }
  }

  /**
   * Extract text from email content
   */
  private extractEmailText(content: string, metadata?: ImportRequest['metadata']): string {
    const parts: string[] = [];

    // Add metadata if available
    if (metadata) {
      if (metadata.fromEmail) parts.push(`From: ${metadata.fromEmail}`);
      if (metadata.subject) parts.push(`Subject: ${metadata.subject}`);
      if (metadata.receivedAt) parts.push(`Date: ${metadata.receivedAt}`);
      if (parts.length > 0) parts.push(''); // Empty line
    }

    // Convert HTML to text if it looks like HTML
    if (content.includes('<html') || content.includes('<!DOCTYPE')) {
      const text = htmlToText(content);
      parts.push(text);
    } else {
      // Plain text email
      parts.push(content);
    }

    return parts.join('\n');
  }
}
