/**
 * Parser Registry
 * @module services/import/parsers
 */

import type { IParser, ImportFormat } from '../types.js';
import { PDFParser } from './pdf.parser.js';
import { EmailParser } from './email.parser.js';
import { ICSParser } from './ics.parser.js';
import { TextParser } from './text.parser.js';
import { JSONParser } from './json.parser.js';
import type { LLMExtractor } from '../extractors/llm.extractor.js';
import type { SchemaOrgExtractor } from '../extractors/schema-org.extractor.js';

/**
 * Parser registry configuration
 */
export interface ParserRegistryConfig {
  llmExtractor: LLMExtractor;
  schemaOrgExtractor: SchemaOrgExtractor;
}

/**
 * Parser registry - maps formats to parsers
 */
export class ParserRegistry {
  private parsers: Map<ImportFormat, IParser> = new Map();

  constructor(config: ParserRegistryConfig) {
    // Register all parsers
    this.registerParser(new PDFParser({ llmExtractor: config.llmExtractor }));
    this.registerParser(new EmailParser({
      llmExtractor: config.llmExtractor,
      schemaOrgExtractor: config.schemaOrgExtractor,
    }));
    this.registerParser(new ICSParser());
    this.registerParser(new TextParser({ llmExtractor: config.llmExtractor }));
    this.registerParser(new JSONParser());
  }

  /**
   * Register a parser
   */
  private registerParser(parser: IParser): void {
    for (const format of parser.supportedFormats) {
      this.parsers.set(format, parser);
    }
  }

  /**
   * Get parser for format
   */
  get(format: ImportFormat): IParser {
    const parser = this.parsers.get(format);

    if (!parser) {
      // Fall back to text parser for unknown formats
      const textParser = this.parsers.get('text');
      if (!textParser) {
        throw new Error(`No parser available for format: ${format}`);
      }
      return textParser;
    }

    return parser;
  }

  /**
   * Check if format is supported
   */
  supports(format: ImportFormat): boolean {
    return this.parsers.has(format);
  }
}

// Re-export parsers
export { PDFParser } from './pdf.parser.js';
export { EmailParser } from './email.parser.js';
export { ICSParser } from './ics.parser.js';
export { TextParser } from './text.parser.js';
export { JSONParser } from './json.parser.js';
