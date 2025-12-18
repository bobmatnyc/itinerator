/**
 * JSON file-based storage implementation
 * @module storage/json-storage
 */

import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createStorageError } from '../core/errors.js';
import type { StorageError } from '../core/errors.js';
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';
import { itinerarySchema } from '../domain/schemas/itinerary.schema.js';
import type { ItineraryId } from '../domain/types/branded.js';
import type { Itinerary } from '../domain/types/itinerary.js';
import type { ItineraryStorage, ItinerarySummary } from './storage.interface.js';

/**
 * JSON file-based storage for itineraries
 */
export class JsonItineraryStorage implements ItineraryStorage {
  /**
   * Creates a new JSON storage instance
   * @param basePath - Base directory for storing itinerary files (default: ./data/itineraries)
   */
  constructor(private readonly basePath: string = './data/itineraries') {}

  /**
   * Get the file path for an itinerary
   * @param id - The itinerary ID
   * @returns The full file path
   */
  private getPath(id: ItineraryId): string {
    return join(this.basePath, `${id}.json`);
  }

  /** Regex to detect ISO 8601 date strings */
  private static readonly ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

  /**
   * Serialize an itinerary to JSON (dates are automatically converted to ISO strings)
   * @param itinerary - The itinerary to serialize
   * @returns JSON string
   */
  private serialize(itinerary: Itinerary): string {
    return JSON.stringify(itinerary, null, 2);
  }

  /**
   * Deserialize JSON with automatic Date revival from ISO strings
   * @param json - JSON string to parse
   * @returns Parsed object with Date instances
   */
  private deserialize(json: string): unknown {
    return JSON.parse(json, (_key, value) => {
      // Automatically convert ISO date strings back to Date objects
      if (typeof value === 'string' && JsonItineraryStorage.ISO_DATE_REGEX.test(value)) {
        return new Date(value);
      }
      return value;
    });
  }

  /**
   * Initialize storage by creating the base directory
   */
  async initialize(): Promise<Result<void, StorageError>> {
    try {
      await mkdir(this.basePath, { recursive: true });
      return ok(undefined);
    } catch (error) {
      return err(
        createStorageError(
          'WRITE_ERROR',
          `Failed to initialize storage directory: ${this.basePath}`,
          { error: error instanceof Error ? error.message : String(error) }
        )
      );
    }
  }

  /**
   * Save an itinerary (create or update)
   * Uses atomic write (write to .tmp file, then rename)
   */
  async save(itinerary: Itinerary): Promise<Result<Itinerary, StorageError>> {
    try {
      // Ensure directory exists
      await mkdir(dirname(this.getPath(itinerary.id)), { recursive: true });

      // Update version and timestamps
      const updatedItinerary: Itinerary = {
        ...itinerary,
        version: itinerary.version + 1,
        updatedAt: new Date(),
      };

      // Atomic write: write to temp file, then rename
      const filePath = this.getPath(itinerary.id);
      const tempPath = `${filePath}.tmp`;

      const data = this.serialize(updatedItinerary);
      await writeFile(tempPath, data, 'utf-8');

      // Atomic rename
      await rename(tempPath, filePath);

      return ok(updatedItinerary);
    } catch (error) {
      return err(
        createStorageError('WRITE_ERROR', `Failed to save itinerary ${itinerary.id}`, {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Load an itinerary by ID
   */
  async load(id: ItineraryId): Promise<Result<Itinerary, StorageError>> {
    const filePath = this.getPath(id);

    try {
      // Check if file exists
      await access(filePath);
    } catch {
      return err(createStorageError('NOT_FOUND', `Itinerary ${id} not found`));
    }

    try {
      // Read and parse file
      const data = await readFile(filePath, 'utf-8');
      const parsed = this.deserialize(data);

      // Validate with Zod schema
      const result = itinerarySchema.safeParse(parsed);

      if (!result.success) {
        return err(
          createStorageError('VALIDATION_ERROR', `Invalid itinerary data for ${id}`, {
            errors: result.error.errors,
          })
        );
      }

      // Safe cast: Zod brand is compatible with our brand
      return ok(result.data as unknown as Itinerary);
    } catch (error) {
      return err(
        createStorageError('READ_ERROR', `Failed to load itinerary ${id}`, {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Delete an itinerary
   */
  async delete(id: ItineraryId): Promise<Result<void, StorageError>> {
    const filePath = this.getPath(id);

    try {
      // Check if file exists
      await access(filePath);
    } catch {
      return err(createStorageError('NOT_FOUND', `Itinerary ${id} not found`));
    }

    try {
      await unlink(filePath);
      return ok(undefined);
    } catch (error) {
      return err(
        createStorageError('WRITE_ERROR', `Failed to delete itinerary ${id}`, {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * List all itinerary summaries
   * Returns summaries sorted by updatedAt descending
   */
  async list(): Promise<Result<ItinerarySummary[], StorageError>> {
    try {
      // Ensure directory exists
      await mkdir(this.basePath, { recursive: true });

      // Read directory
      const files = await readdir(this.basePath);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      // Load each file and extract summary
      const summaries: ItinerarySummary[] = [];

      for (const file of jsonFiles) {
        const filePath = join(this.basePath, file);

        try {
          const data = await readFile(filePath, 'utf-8');
          const parsed = this.deserialize(data);

          // Validate with schema
          const result = itinerarySchema.safeParse(parsed);

          if (result.success) {
            // Safe cast: Zod brand is compatible with our brand
            const itinerary = result.data as unknown as Itinerary;
            summaries.push({
              id: itinerary.id,
              title: itinerary.title,
              status: itinerary.status,
              startDate: itinerary.startDate,
              endDate: itinerary.endDate,
              travelerCount: itinerary.travelers.length,
              segmentCount: itinerary.segments.length,
              updatedAt: itinerary.updatedAt,
            });
          }
        } catch {
          // Skip invalid files
        }
      }

      // Sort by updatedAt descending
      summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return ok(summaries);
    } catch (error) {
      return err(
        createStorageError('READ_ERROR', 'Failed to list itineraries', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Check if an itinerary exists
   */
  async exists(id: ItineraryId): Promise<boolean> {
    try {
      await access(this.getPath(id));
      return true;
    } catch {
      return false;
    }
  }
}
