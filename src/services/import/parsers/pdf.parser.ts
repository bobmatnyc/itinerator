/**
 * PDF Parser - Extract text from PDF and parse with LLM
 * @module services/import/parsers/pdf
 */

// NOTE: pdf-parse is loaded dynamically to avoid initialization bug
// The library tries to load a test file on import which fails in bundlers
import type { IParser, ImportRequest, ImportResult, ImportFormat } from '../types.js';
import type { LLMExtractor } from '../extractors/llm.extractor.js';

/**
 * PDF parser configuration
 */
export interface PDFParserConfig {
  /** LLM extractor for text-to-booking conversion */
  llmExtractor: LLMExtractor;
}

/**
 * PDF parser using pdf-parse and LLM extraction
 */
export class PDFParser implements IParser {
  supportedFormats: ImportFormat[] = ['pdf'];
  private llmExtractor: LLMExtractor;

  constructor(config: PDFParserConfig) {
    this.llmExtractor = config.llmExtractor;
  }

  /**
   * Parse PDF and extract booking data
   */
  async parse(request: ImportRequest): Promise<ImportResult> {
    try {
      // Ensure content is a Buffer
      const buffer = Buffer.isBuffer(request.content)
        ? request.content
        : Buffer.from(request.content);

      // Dynamic import to avoid pdf-parse initialization bug
      // (The library tries to load ./test/data/05-versions-space.pdf on import)
      const pdfParse = (await import('pdf-parse')).default;

      // Extract text from PDF
      const data = await pdfParse(buffer);
      const text = data.text;

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          format: 'pdf',
          segments: [],
          confidence: 0,
          errors: ['PDF contains no extractable text'],
        };
      }

      // Use LLM to extract bookings from text
      const result = await this.llmExtractor.extract(text, 'pdf');

      return {
        ...result,
        format: 'pdf',
      };
    } catch (error) {
      return {
        success: false,
        format: 'pdf',
        segments: [],
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Failed to parse PDF'],
      };
    }
  }
}
