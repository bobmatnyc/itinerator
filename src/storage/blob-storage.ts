/**
 * Vercel Blob storage implementation
 * @module storage/blob-storage
 */

import { del, head, list, put } from '@vercel/blob';
import { createStorageError } from '../core/errors.js';
import type { StorageError } from '../core/errors.js';
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';
import { itinerarySchema } from '../domain/schemas/itinerary.schema.js';
import type { ItineraryId } from '../domain/types/branded.js';
import type { Itinerary } from '../domain/types/itinerary.js';
import type { ItineraryStorage, ItinerarySummary } from './storage.interface.js';

/**
 * Vercel Blob storage for itineraries
 * Uses Vercel Blob for cloud storage in production environments
 */
export class BlobItineraryStorage implements ItineraryStorage {
  private readonly prefix = 'itineraries/';

  /** Regex to detect ISO 8601 date strings */
  private static readonly ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

  /**
   * Creates a new Blob storage instance
   * Requires BLOB_READ_WRITE_TOKEN environment variable
   */
  constructor() {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required for BlobItineraryStorage');
    }
  }

  /**
   * Get the blob key for an itinerary
   * @param id - The itinerary ID
   * @returns The blob key (e.g., "itineraries/uuid.json")
   */
  private getKey(id: ItineraryId): string {
    return `${this.prefix}${id}.json`;
  }

  /**
   * Serialize an itinerary to JSON
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
      if (typeof value === 'string' && BlobItineraryStorage.ISO_DATE_REGEX.test(value)) {
        return new Date(value);
      }
      return value;
    });
  }

  /**
   * Initialize storage (no-op for Vercel Blob)
   * Blob storage doesn't require initialization
   */
  async initialize(): Promise<Result<void, StorageError>> {
    console.log('🌐 Using Vercel Blob storage for itineraries');
    return ok(undefined);
  }

  /**
   * Save an itinerary (create or update)
   */
  async save(itinerary: Itinerary): Promise<Result<Itinerary, StorageError>> {
    const key = this.getKey(itinerary.id);

    try {
      // Update timestamp
      const updatedItinerary: Itinerary = {
        ...itinerary,
        updatedAt: new Date(),
      };

      const data = this.serialize(updatedItinerary);

      // Delete existing blob if it exists (required for updates)
      try {
        const existing = await head(key);
        if (existing) {
          await del(existing.url);
          console.log('Deleted existing blob for update:', key);
        }
      } catch (e) {
        // Blob doesn't exist, that's fine for new creates
        console.log('No existing blob to delete:', key);
      }

      // Upload to Vercel Blob
      await put(key, data, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });

      return ok(updatedItinerary);
    } catch (error) {
      console.error('Blob save failed:', {
        key,
        itineraryId: itinerary.id,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error,
      });
      return err(
        createStorageError('WRITE_ERROR', `Failed to save itinerary ${itinerary.id} to Blob`, {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Load an itinerary by ID
   */
  async load(id: ItineraryId): Promise<Result<Itinerary, StorageError>> {
    try {
      const key = this.getKey(id);

      // Check if blob exists
      const blobInfo = await head(key);

      if (!blobInfo) {
        return err(createStorageError('NOT_FOUND', `Itinerary ${id} not found in Blob`));
      }

      // Fetch the blob content
      const response = await fetch(blobInfo.url);

      if (!response.ok) {
        return err(
          createStorageError('READ_ERROR', `Failed to fetch itinerary ${id} from Blob`, {
            status: response.status,
          })
        );
      }

      const json = await response.text();
      const parsed = this.deserialize(json);

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
      // Handle "Blob not found" errors
      if (error instanceof Error && error.message.includes('not found')) {
        return err(createStorageError('NOT_FOUND', `Itinerary ${id} not found in Blob`));
      }

      return err(
        createStorageError('READ_ERROR', `Failed to load itinerary ${id} from Blob`, {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Delete an itinerary
   */
  async delete(id: ItineraryId): Promise<Result<void, StorageError>> {
    try {
      const key = this.getKey(id);

      // Check if blob exists
      const blobInfo = await head(key);

      if (!blobInfo) {
        return err(createStorageError('NOT_FOUND', `Itinerary ${id} not found in Blob`));
      }

      // Delete the blob using its URL
      await del(blobInfo.url);

      return ok(undefined);
    } catch (error) {
      // Handle "Blob not found" errors
      if (error instanceof Error && error.message.includes('not found')) {
        return err(createStorageError('NOT_FOUND', `Itinerary ${id} not found in Blob`));
      }

      return err(
        createStorageError('WRITE_ERROR', `Failed to delete itinerary ${id} from Blob`, {
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
      // List all blobs with the itineraries prefix
      const { blobs } = await list({ prefix: this.prefix });

      const summaries: ItinerarySummary[] = [];

      // Load each blob and extract summary
      for (const blob of blobs) {
        try {
          // Fetch blob content
          const response = await fetch(blob.url);

          if (!response.ok) {
            // Skip blobs that can't be fetched
            continue;
          }

          const json = await response.text();
          const parsed = this.deserialize(json);

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
              createdBy: itinerary.createdBy,
            });
          }
        } catch {
          // Skip invalid blobs
        }
      }

      // Sort by updatedAt descending
      summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return ok(summaries);
    } catch (error) {
      return err(
        createStorageError('READ_ERROR', 'Failed to list itineraries from Blob', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * List itineraries for a specific user
   * Returns summaries where user is owner, editor, or viewer (with role field populated)
   * Sorted by updatedAt descending
   */
  async listByUser(userEmail: string): Promise<Result<ItinerarySummary[], StorageError>> {
    try {
      // List all blobs with the itineraries prefix
      const { blobs } = await list({ prefix: this.prefix });

      const summaries: ItinerarySummary[] = [];
      const normalizedEmail = userEmail.toLowerCase().trim();

      // Load each blob and extract summary
      for (const blob of blobs) {
        try {
          // Fetch blob content
          const response = await fetch(blob.url);

          if (!response.ok) {
            // Skip blobs that can't be fetched
            continue;
          }

          const json = await response.text();
          const parsed = this.deserialize(json);

          // Validate with schema
          const result = itinerarySchema.safeParse(parsed);

          if (result.success) {
            const itinerary = result.data as unknown as Itinerary;

            // Determine user's role
            let userRole: 'owner' | 'editor' | 'viewer' | undefined = undefined;

            if (itinerary.permissions) {
              // Check permissions field
              const { owners, editors, viewers } = itinerary.permissions;
              if (owners.map(e => e.toLowerCase()).includes(normalizedEmail)) {
                userRole = 'owner';
              } else if (editors.map(e => e.toLowerCase()).includes(normalizedEmail)) {
                userRole = 'editor';
              } else if (viewers.map(e => e.toLowerCase()).includes(normalizedEmail)) {
                userRole = 'viewer';
              }
            } else {
              // Backward compatibility: if no permissions, check createdBy
              const createdBy = itinerary.createdBy?.toLowerCase().trim();
              if (createdBy === normalizedEmail) {
                userRole = 'owner';
              }
            }

            // Only include if user has any role
            if (userRole) {
              summaries.push({
                id: itinerary.id,
                title: itinerary.title,
                status: itinerary.status,
                startDate: itinerary.startDate,
                endDate: itinerary.endDate,
                travelerCount: itinerary.travelers.length,
                segmentCount: itinerary.segments.length,
                updatedAt: itinerary.updatedAt,
                createdBy: itinerary.createdBy,
                role: userRole,
              });
            }
          }
        } catch {
          // Skip invalid blobs
        }
      }

      // Sort by updatedAt descending
      summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return ok(summaries);
    } catch (error) {
      return err(
        createStorageError('READ_ERROR', 'Failed to list itineraries from Blob', {
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
      const key = this.getKey(id);
      const blobInfo = await head(key);
      return blobInfo !== null;
    } catch {
      return false;
    }
  }
}
