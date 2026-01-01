/**
 * Application configuration storage
 * @module storage/config-storage
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createStorageError } from '../core/errors.js';
import type { StorageError } from '../core/errors.js';
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';
import type { ItineraryId } from '../domain/types/branded.js';

/**
 * Application configuration structure
 */
export interface AppConfig {
  /** Currently selected working itinerary ID */
  workingItineraryId?: ItineraryId;
  /** Default currency for new itineraries (ISO 4217) */
  defaultCurrency?: string;
  /** Last time config was updated */
  lastUpdated: Date;
}

/**
 * Storage for application configuration
 */
export class ConfigStorage {
  /** In-memory cache of configuration */
  private config: AppConfig | null = null;

  /**
   * Creates a new configuration storage instance
   * @param configPath - Path to config file (default: ./.itinerator/config.json)
   */
  constructor(private readonly configPath: string = './.itinerator/config.json') {}

  /** Regex to detect ISO 8601 date strings */
  private static readonly ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

  /**
   * Serialize config to JSON (dates are automatically converted to ISO strings)
   */
  private serialize(config: AppConfig): string {
    return JSON.stringify(config, null, 2);
  }

  /**
   * Deserialize JSON with automatic Date revival from ISO strings
   */
  private deserialize(json: string): AppConfig {
    const parsed = JSON.parse(json, (_key, value) => {
      // Automatically convert ISO date strings back to Date objects
      if (typeof value === 'string' && ConfigStorage.ISO_DATE_REGEX.test(value)) {
        return new Date(value);
      }
      return value;
    });

    return parsed as AppConfig;
  }

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
        const defaultConfig: AppConfig = {
          lastUpdated: new Date(),
        };

        const saveResult = await this.save(defaultConfig);
        if (!saveResult.success) {
          return saveResult;
        }

        this.config = defaultConfig;
      }

      return ok(undefined);
    } catch (error) {
      return err(
        createStorageError('WRITE_ERROR', 'Failed to initialize config storage', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<Result<AppConfig, StorageError>> {
    try {
      const data = await readFile(this.configPath, 'utf-8');
      const config = this.deserialize(data);
      this.config = config;
      return ok(config);
    } catch (error) {
      // File doesn't exist or can't be read
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return err(createStorageError('NOT_FOUND', 'Configuration file not found'));
      }

      return err(
        createStorageError('READ_ERROR', 'Failed to load configuration', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Save configuration to disk
   */
  async save(config: AppConfig): Promise<Result<void, StorageError>> {
    try {
      // Ensure directory exists
      await mkdir(dirname(this.configPath), { recursive: true });

      // Update timestamp
      const updatedConfig: AppConfig = {
        ...config,
        lastUpdated: new Date(),
      };

      // Write to file
      const data = this.serialize(updatedConfig);
      await writeFile(this.configPath, data, 'utf-8');

      // Update cache
      this.config = updatedConfig;

      return ok(undefined);
    } catch (error) {
      return err(
        createStorageError('WRITE_ERROR', 'Failed to save configuration', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Clear the in-memory config cache
   * Useful for test isolation
   */
  clearCache(): void {
    this.config = null;
  }

  /**
   * Get the current working itinerary ID
   */
  async getWorkingItineraryId(): Promise<ItineraryId | undefined> {
    if (!this.config) {
      const loadResult = await this.load();
      if (!loadResult.success) {
        return undefined;
      }
    }

    return this.config?.workingItineraryId;
  }

  /**
   * Set the working itinerary ID
   */
  async setWorkingItineraryId(id: ItineraryId | undefined): Promise<Result<void, StorageError>> {
    // Load config if not cached
    if (!this.config) {
      const loadResult = await this.load();
      if (!loadResult.success) {
        // Create new config if doesn't exist
        this.config = {
          lastUpdated: new Date(),
        };
      }
    }

    // Update working itinerary ID
    const { workingItineraryId: _old, ...rest } = this.config ?? { lastUpdated: new Date() };
    const updatedConfig: AppConfig = {
      ...rest,
      ...(id ? { workingItineraryId: id } : {}),
      lastUpdated: new Date(),
    };

    return this.save(updatedConfig);
  }
}
