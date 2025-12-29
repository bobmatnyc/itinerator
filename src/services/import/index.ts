/**
 * Unified Import Service
 * @module services/import
 */

import type { ImportRequest, ImportResult } from './types.js';
import { FormatDetector } from './format-detector.js';
import { LLMExtractor } from './extractors/llm.extractor.js';
import { SchemaOrgExtractor } from './extractors/schema-org.extractor.js';
import { ParserRegistry } from './parsers/index.js';

/**
 * Import service configuration
 */
export interface ImportServiceConfig {
  /** OpenRouter API key for LLM extraction */
  apiKey: string;
  /** Model to use for LLM extraction (optional) */
  model?: string;
}

/**
 * Unified Import Service
 * Auto-detects format and routes to appropriate parser
 */
export class ImportService {
  private formatDetector: FormatDetector;
  private parserRegistry: ParserRegistry;
  private llmExtractor: LLMExtractor;
  private schemaOrgExtractor: SchemaOrgExtractor;

  constructor(config: ImportServiceConfig) {
    // Initialize components
    this.formatDetector = new FormatDetector();
    this.llmExtractor = new LLMExtractor({
      apiKey: config.apiKey,
      model: config.model,
    });
    this.schemaOrgExtractor = new SchemaOrgExtractor();

    // Initialize parser registry
    this.parserRegistry = new ParserRegistry({
      llmExtractor: this.llmExtractor,
      schemaOrgExtractor: this.schemaOrgExtractor,
    });
  }

  /**
   * Import from any source
   * Auto-detects format and extracts booking data
   */
  async import(request: ImportRequest): Promise<ImportResult> {
    try {
      // Detect format
      const format = this.formatDetector.detect(request);

      // Get appropriate parser
      const parser = this.parserRegistry.get(format);

      // Parse and extract
      const result = await parser.parse(request);

      return result;
    } catch (error) {
      return {
        success: false,
        format: 'unknown',
        segments: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error during import'],
      };
    }
  }

  /**
   * Import from file upload
   */
  async importFromUpload(
    content: Buffer | string,
    filename: string,
    mimeType?: string
  ): Promise<ImportResult> {
    return this.import({
      source: 'upload',
      content,
      filename,
      mimeType,
    });
  }

  /**
   * Import from email
   */
  async importFromEmail(
    content: string,
    metadata: {
      fromEmail?: string;
      subject?: string;
      receivedAt?: string;
    }
  ): Promise<ImportResult> {
    return this.import({
      source: 'email',
      content,
      metadata,
    });
  }

  /**
   * Import from plain text
   */
  async importFromText(text: string): Promise<ImportResult> {
    return this.import({
      source: 'text',
      content: text,
    });
  }

  /**
   * Import from URL (fetch content first)
   */
  async importFromUrl(url: string): Promise<ImportResult> {
    try {
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || undefined;

      // Try to get content as text first
      let content: string | Buffer;
      if (contentType?.includes('pdf')) {
        content = Buffer.from(await response.arrayBuffer());
      } else {
        content = await response.text();
      }

      return this.import({
        source: 'url',
        content,
        mimeType: contentType,
      });
    } catch (error) {
      return {
        success: false,
        format: 'unknown',
        segments: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Failed to fetch URL'],
      };
    }
  }
}

// Re-export types
export type {
  ImportSource,
  ImportFormat,
  ImportRequest,
  ImportResult,
  ExtractedSegment,
} from './types.js';
