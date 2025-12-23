/**
 * Test API client helper
 */

import TEST_CONFIG from '../config/test-config.js';

export class TestApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || TEST_CONFIG.api.baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make a GET request
   */
  async get<T>(endpoint: string, userId?: string): Promise<T> {
    const headers = { ...this.defaultHeaders };
    if (userId) {
      headers['x-user-id'] = userId;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`GET ${endpoint} failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make a POST request
   */
  async post<T>(endpoint: string, data: any, userId?: string): Promise<T> {
    const headers = { ...this.defaultHeaders };
    if (userId) {
      headers['x-user-id'] = userId;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`POST ${endpoint} failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make a PUT request
   */
  async put<T>(endpoint: string, data: any, userId?: string): Promise<T> {
    const headers = { ...this.defaultHeaders };
    if (userId) {
      headers['x-user-id'] = userId;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`PUT ${endpoint} failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make a DELETE request
   */
  async delete(endpoint: string, userId?: string): Promise<void> {
    const headers = { ...this.defaultHeaders };
    if (userId) {
      headers['x-user-id'] = userId;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(`DELETE ${endpoint} failed: ${response.statusText}`);
    }
  }

  /**
   * Test helper: Create an itinerary
   */
  async createItinerary(data: any, userId: string) {
    return this.post('/api/v1/itineraries', data, userId);
  }

  /**
   * Test helper: Get an itinerary
   */
  async getItinerary(id: string, userId: string) {
    return this.get(`/api/v1/itineraries/${id}`, userId);
  }

  /**
   * Test helper: List itineraries
   */
  async listItineraries(userId: string) {
    return this.get('/api/v1/itineraries', userId);
  }

  /**
   * Test helper: Delete an itinerary
   */
  async deleteItinerary(id: string, userId: string) {
    return this.delete(`/api/v1/itineraries/${id}`, userId);
  }

  /**
   * Test helper: Create a Trip Designer session
   */
  async createDesignerSession(userId: string) {
    return this.post('/api/v1/designer/sessions', {}, userId);
  }

  /**
   * Test helper: Send a message in Trip Designer
   */
  async sendDesignerMessage(sessionId: string, message: string, userId: string) {
    return this.post(`/api/v1/designer/sessions/${sessionId}/messages`, { message }, userId);
  }
}

/**
 * Create a test API client instance
 */
export function createTestApiClient(baseUrl?: string): TestApiClient {
  return new TestApiClient(baseUrl);
}
