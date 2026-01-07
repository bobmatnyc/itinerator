/**
 * Itineraries Store - Svelte 5 Runes
 *
 * Manages itinerary list, selection, and operations with centralized state.
 * Provides methods for CRUD operations on itineraries and segments.
 *
 * This store uses Svelte 5 runes ($state) internally while providing
 * backward-compatible writable stores for components using $ syntax.
 */

import { writable, derived, get } from 'svelte/store';
import type { Itinerary, ItineraryListItem, ModelConfig, Segment } from '../types';
import { apiClient } from '../api';
import { eventBus } from './events';
import { authStore } from './auth.svelte';

/**
 * Data structure for creating a new itinerary
 */
interface CreateItineraryData {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
}

/**
 * Data structure for updating itinerary metadata
 */
interface UpdateItineraryData {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  tripType?: string;
  tags?: string[];
}

// Core writable stores (backward compatible with Svelte 4 pattern)
export const itineraries = writable<ItineraryListItem[]>([]);
export const itinerariesLoading = writable<boolean>(true);
export const itinerariesError = writable<string | null>(null);

export const selectedItineraryId = writable<string | undefined>(undefined);
export const selectedItinerary = writable<Itinerary | null>(null);
export const selectedItineraryLoading = writable<boolean>(false);

export const models = writable<ModelConfig[]>([]);
export const modelsLoading = writable<boolean>(false);

export const importing = writable<boolean>(false);

/**
 * Itineraries store methods
 */
class ItinerariesStore {
  /**
   * Load all itineraries from API
   * Gracefully handles errors by showing empty state instead of blocking UI
   */
  async loadAll(): Promise<void> {
    itinerariesLoading.set(true);
    itinerariesError.set(null);
    try {
      console.log('[Store] Fetching itineraries...');
      const data = await apiClient.getItineraries();
      console.log('[Store] Received itineraries:', data.length, data);

      // Add userRole to each itinerary based on current user
      const userEmail = authStore.userEmail;
      const enrichedData = data.map(itinerary => {
        let userRole: 'owner' | 'editor' | 'viewer' | 'none' = 'none';

        if (userEmail && itinerary.permissions) {
          if (itinerary.permissions.owners?.includes(userEmail)) {
            userRole = 'owner';
          } else if (itinerary.permissions.editors?.includes(userEmail)) {
            userRole = 'editor';
          } else if (itinerary.permissions.viewers?.includes(userEmail)) {
            userRole = 'viewer';
          }
        }

        return {
          ...itinerary,
          userRole
        };
      });

      itineraries.set(enrichedData);
    } catch (err) {
      console.error('[Store] Failed to load itineraries:', err);
      // Set empty array instead of error to show empty state UI
      // This prevents API failures from blocking the entire view
      itineraries.set([]);
      itinerariesError.set(err instanceof Error ? err.message : 'Failed to load itineraries');
    } finally {
      itinerariesLoading.set(false);
    }
  }

  /**
   * Load detailed itinerary data
   * @param id - Itinerary ID to load
   */
  async loadDetail(id: string): Promise<void> {
    selectedItineraryLoading.set(true);
    try {
      const data = await apiClient.getItinerary(id);
      selectedItinerary.set(data);
      // Only update ID if it actually changed to avoid triggering reactive effects
      if (get(selectedItineraryId) !== id) {
        selectedItineraryId.set(id);
      }
    } catch (err) {
      console.error('Failed to load itinerary:', err);
      selectedItinerary.set(null);
    } finally {
      selectedItineraryLoading.set(false);
    }
  }

  /**
   * Select an itinerary and load its details
   * @param id - Itinerary ID to select
   */
  async select(id: string): Promise<void> {
    await this.loadDetail(id);
  }

  /**
   * Create a new itinerary
   * @param data - Itinerary creation data
   * @returns Created itinerary
   */
  async create(data: CreateItineraryData): Promise<Itinerary> {
    const newItinerary = await apiClient.createItinerary(data);
    // Reload the list to include the new itinerary
    await this.loadAll();
    return newItinerary;
  }

  /**
   * Update itinerary metadata
   * @param id - Itinerary ID to update
   * @param data - Update data
   */
  async update(id: string, data: UpdateItineraryData): Promise<void> {
    await apiClient.updateItinerary(id, data);
    // Reload the list to reflect updates
    await this.loadAll();
    // Refresh selected if it was updated
    if (get(selectedItineraryId) === id) {
      await this.loadDetail(id);
    }
  }

  /**
   * Delete an itinerary
   * @param id - Itinerary ID to delete
   */
  async delete(id: string): Promise<void> {
    await apiClient.deleteItinerary(id);
    // Clear selection if deleted was selected
    if (get(selectedItineraryId) === id) {
      selectedItinerary.set(null);
      selectedItineraryId.set(undefined);
    }
    // Reload the list
    await this.loadAll();
  }

  /**
   * Add a segment to an itinerary
   * @param itineraryId - Itinerary ID
   * @param segmentData - Segment data to add
   */
  async addSegment(itineraryId: string, segmentData: Partial<Segment>): Promise<void> {
    const updatedItinerary = await apiClient.addSegment(itineraryId, segmentData);
    // Update the selected itinerary if it matches
    if (get(selectedItineraryId) === itineraryId) {
      selectedItinerary.set(updatedItinerary);
    }
    // Reload the list to update segment counts
    await this.loadAll();
  }

  /**
   * Update a segment in an itinerary
   * @param itineraryId - Itinerary ID
   * @param segmentId - Segment ID to update
   * @param segmentData - Updated segment data
   */
  async updateSegment(
    itineraryId: string,
    segmentId: string,
    segmentData: Partial<Segment>
  ): Promise<void> {
    const updatedItinerary = await apiClient.updateSegment(itineraryId, segmentId, segmentData);
    // Update the selected itinerary if it matches
    if (get(selectedItineraryId) === itineraryId) {
      selectedItinerary.set(updatedItinerary);
    }
    // Reload the list to reflect updates
    await this.loadAll();
  }

  /**
   * Delete a segment from an itinerary
   * @param itineraryId - Itinerary ID
   * @param segmentId - Segment ID to delete
   */
  async deleteSegment(itineraryId: string, segmentId: string): Promise<void> {
    const updatedItinerary = await apiClient.deleteSegment(itineraryId, segmentId);
    // Update the selected itinerary if it matches
    if (get(selectedItineraryId) === itineraryId) {
      selectedItinerary.set(updatedItinerary);
    }
    // Reload the list to update segment counts
    await this.loadAll();
  }

  /**
   * Load available import models
   */
  async loadModels(): Promise<void> {
    modelsLoading.set(true);
    try {
      const data = await apiClient.getModels();
      models.set(data);
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      modelsLoading.set(false);
    }
  }

  /**
   * Import PDF and create itinerary
   * @param file - PDF file to import
   * @param model - Optional model name to use
   * @returns Success status
   */
  async importPDF(file: File, model?: string): Promise<boolean> {
    importing.set(true);
    try {
      await apiClient.importPDF(file, model);
      // Reload itineraries after successful import
      await this.loadAll();
      return true;
    } catch (err) {
      console.error('Failed to import PDF:', err);
      throw err;
    } finally {
      importing.set(false);
    }
  }

  /**
   * Clear all itinerary data
   * Used when logging out or switching users
   */
  clear(): void {
    itineraries.set([]);
    selectedItinerary.set(null);
    selectedItineraryId.set(undefined);
    itinerariesError.set(null);
  }
}

// Export singleton instance
export const itinerariesStore = new ItinerariesStore();

// Listen for auth:logout events to clear itinerary data
eventBus.on('auth:logout', () => {
  itinerariesStore.clear();
});

// Export backward-compatible function aliases (same signatures as original)
export const loadItineraries = () => itinerariesStore.loadAll();
export const loadItinerary = (id: string) => itinerariesStore.loadDetail(id);
export const selectItinerary = (id: string) => itinerariesStore.select(id);
export const createItinerary = (data: CreateItineraryData) => itinerariesStore.create(data);
export const updateItinerary = (id: string, data: UpdateItineraryData) => itinerariesStore.update(id, data);
export const deleteItinerary = (id: string) => itinerariesStore.delete(id);
export const addSegment = (itineraryId: string, segmentData: Partial<Segment>) =>
  itinerariesStore.addSegment(itineraryId, segmentData);
export const updateSegment = (itineraryId: string, segmentId: string, segmentData: Partial<Segment>) =>
  itinerariesStore.updateSegment(itineraryId, segmentId, segmentData);
export const deleteSegment = (itineraryId: string, segmentId: string) =>
  itinerariesStore.deleteSegment(itineraryId, segmentId);
export const loadModels = () => itinerariesStore.loadModels();
export const importPDF = (file: File, model?: string) => itinerariesStore.importPDF(file, model);
export const clearItineraries = () => itinerariesStore.clear();
