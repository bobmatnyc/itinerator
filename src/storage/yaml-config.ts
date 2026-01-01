/**
 * YAML-based application configuration
 * @module storage/yaml-config
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import YAML from 'yaml';
import { createStorageError } from '../core/errors.js';
import type { StorageError } from '../core/errors.js';
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';
import type { ImportConfig } from '../domain/types/import.js';
import { DEFAULT_IMPORT_MODEL } from '../domain/types/import.js';

/**
 * Full application configuration structure
 */
export interface YamlAppConfig {
  /** OpenRouter configuration */
  openrouter?: {
    /** API key for OpenRouter */
    apiKey?: string;
    /** Default model for imports */
    defaultModel?: string;
  };
  /** Import pipeline configuration */
  import?: {
    /** Maximum tokens for LLM response */
    maxTokens?: number;
    /** Temperature for LLM (0-1) */
    temperature?: number;
  };
  /** Cost tracking configuration */
  costTracking?: {
    /** Enable cost tracking */
    enabled?: boolean;
    /** Path for cost log file */
    logPath?: string;
  };
  /** SerpAPI configuration */
  serpapi?: {
    /** SerpAPI API key */
    apiKey?: string;
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: YamlAppConfig = {
  openrouter: {
    defaultModel: DEFAULT_IMPORT_MODEL,
  },
  import: {
    maxTokens: 4096,
    temperature: 0.1,
  },
  costTracking: {
    enabled: true,
    logPath: './data/imports/cost-log.json',
  },
};

/**
 * YAML-based configuration storage
 */
export class YamlConfigStorage {
  /** In-memory cache of configuration */
  private config: YamlAppConfig | null = null;

  /**
   * Creates a new YAML config storage instance
   * @param configPath - Path to config file (default: ./.itinerator/config.yaml)
   */
  constructor(private readonly configPath: string = './.itinerator/config.yaml') {}

  /**
   * Initialize configuration storage
   * Creates the config directory and default config if needed
   */
  async initialize(): Promise<Result<void, StorageError>> {
    try {
      // Create directory
      await mkdir(dirname(this.configPath), { recursive: true });

      // Try to load existing config
      const loadResult = await this.load();

      if (!loadResult.success) {
        // Create default config if none exists
        const saveResult = await this.save(DEFAULT_CONFIG);
        if (!saveResult.success) {
          return saveResult;
        }
        this.config = DEFAULT_CONFIG;
      }

      return ok(undefined);
    } catch (error) {
      return err(
        createStorageError('WRITE_ERROR', 'Failed to initialize YAML config storage', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<Result<YamlAppConfig, StorageError>> {
    try {
      const data = await readFile(this.configPath, 'utf-8');
      const config = YAML.parse(data) as YamlAppConfig;
      this.config = config;
      return ok(config);
    } catch (error) {
      // File doesn't exist or can't be read
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return err(createStorageError('NOT_FOUND', 'Configuration file not found'));
      }

      return err(
        createStorageError('READ_ERROR', 'Failed to load YAML configuration', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Save configuration to disk
   */
  async save(config: YamlAppConfig): Promise<Result<void, StorageError>> {
    try {
      // Ensure directory exists
      await mkdir(dirname(this.configPath), { recursive: true });

      // Write YAML file
      const data = YAML.stringify(config, { indent: 2 });
      await writeFile(this.configPath, data, 'utf-8');

      // Update cache
      this.config = config;

      return ok(undefined);
    } catch (error) {
      return err(
        createStorageError('WRITE_ERROR', 'Failed to save YAML configuration', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Get cached config or load from disk
   */
  async getConfig(): Promise<Result<YamlAppConfig, StorageError>> {
    if (this.config) {
      return ok(this.config);
    }
    return this.load();
  }

  /**
   * Get import configuration
   * Combines defaults with user settings
   */
  async getImportConfig(): Promise<Result<ImportConfig, StorageError>> {
    const configResult = await this.getConfig();
    if (!configResult.success) {
      return configResult;
    }

    const config = configResult.value;
    const apiKey = config.openrouter?.apiKey;

    if (!apiKey) {
      return err(
        createStorageError('VALIDATION_ERROR', 'OpenRouter API key not configured', {
          hint: `Add your API key to ${this.configPath}`,
        })
      );
    }

    const importConfig: ImportConfig = {
      apiKey,
      defaultModel: config.openrouter?.defaultModel ?? DEFAULT_IMPORT_MODEL,
      maxTokens: config.import?.maxTokens ?? 4096,
      temperature: config.import?.temperature ?? 0.1,
      costTrackingEnabled: config.costTracking?.enabled ?? true,
      costLogPath: config.costTracking?.logPath ?? './data/imports/cost-log.json',
    };

    // Add SerpAPI config if available
    if (config.serpapi?.apiKey) {
      importConfig.serpapi = {
        apiKey: config.serpapi.apiKey,
      };
    }

    return ok(importConfig);
  }

  /**
   * Set OpenRouter API key
   */
  async setApiKey(apiKey: string): Promise<Result<void, StorageError>> {
    const configResult = await this.getConfig();

    // Use existing config or defaults
    const config = configResult.success ? configResult.value : { ...DEFAULT_CONFIG };

    // Update API key
    if (!config.openrouter) {
      config.openrouter = {};
    }
    config.openrouter.apiKey = apiKey;

    return this.save(config);
  }

  /**
   * Clear the in-memory config cache
   * Useful for test isolation
   */
  clearCache(): void {
    this.config = null;
  }

  /**
   * Check if API key is configured
   */
  async hasApiKey(): Promise<boolean> {
    const configResult = await this.getConfig();
    if (!configResult.success) {
      return false;
    }
    return !!configResult.value.openrouter?.apiKey;
  }
}
