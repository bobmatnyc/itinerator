/**
 * Test API client for E2E tests
 * Provides typed methods for all API endpoints with authentication
 */

import type { Itinerary } from '../../src/domain/types/index.js';
import type { TripDesignerSession } from '../../src/domain/types/trip-designer.js';
import type { SSEEvent } from './sse-parser.js';
import { parseSSEStream } from './sse-parser.js';

export interface CreateSessionResponse {
  sessionId: string;
}

export interface TestClientConfig {
  baseUrl?: string;
  apiKey?: string;
}

/**
 * API client for E2E tests
 */
export class TestClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: TestClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.VITE_API_URL || 'http://localhost:5176';
    this.apiKey = config.apiKey || process.env.ITINERIZER_TEST_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('ITINERIZER_TEST_API_KEY environment variable is required');
    }
  }

  /**
   * Get base headers for all requests
   */
  private getHeaders(includeAIKey = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add test user email for scoping
    if (process.env.ITINERIZER_TEST_USER_EMAIL) {
      headers['X-User-Email'] = process.env.ITINERIZER_TEST_USER_EMAIL;
    }

    // Add OpenRouter API key for AI-powered endpoints
    if (includeAIKey) {
      headers['X-OpenRouter-API-Key'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Handle API response and throw on error
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Use status text if JSON parsing fails
      }
      throw new Error(`API error: ${errorMessage}`);
    }
    return response.json();
  }

  // =========================================================================
  // Session Management
  // =========================================================================

  /**
   * Create a new Trip Designer session
   */
  async createSession(itineraryId?: string, mode: 'trip-designer' | 'help' = 'trip-designer'): Promise<CreateSessionResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/designer/sessions`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ itineraryId, mode }),
    });
    return this.handleResponse<CreateSessionResponse>(response);
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<TripDesignerSession> {
    const response = await fetch(`${this.baseUrl}/api/v1/designer/sessions/${sessionId}`, {
      headers: this.getHeaders(true),
    });
    return this.handleResponse<TripDesignerSession>(response);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/designer/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true),
    });

    if (!response.ok) {
      let errorMessage = `${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Use status text if JSON parsing fails
      }
      throw new Error(`Delete session failed: ${errorMessage}`);
    }
  }

  /**
   * Send a message and get non-streaming response
   */
  async sendMessage(sessionId: string, message: string): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/api/v1/designer/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  /**
   * Send a message and stream the response
   */
  async *streamMessage(sessionId: string, message: string): AsyncGenerator<SSEEvent> {
    const response = await fetch(`${this.baseUrl}/api/v1/designer/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      let errorMessage = `${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Use status text if JSON parsing fails
      }
      throw new Error(`Stream error: ${errorMessage}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    yield* parseSSEStream(response);
  }

  // =========================================================================
  // Itinerary Management
  // =========================================================================

  /**
   * Create a new itinerary
   */
  async createItinerary(data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    draft?: boolean;
    tags?: string[];
    tripType?: string;
    status?: string;
  }): Promise<Itinerary> {
    const response = await fetch(`${this.baseUrl}/api/v1/itineraries`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<Itinerary>(response);
  }

  /**
   * Get an itinerary by ID
   */
  async getItinerary(id: string): Promise<Itinerary> {
    const response = await fetch(`${this.baseUrl}/api/v1/itineraries/${id}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<Itinerary>(response);
  }

  /**
   * Update an itinerary
   */
  async updateItinerary(id: string, data: {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    tripType?: string;
    tags?: string[];
  }): Promise<Itinerary> {
    const response = await fetch(`${this.baseUrl}/api/v1/itineraries/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<Itinerary>(response);
  }

  /**
   * Delete an itinerary
   */
  async deleteItinerary(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/itineraries/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      let errorMessage = `${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Use status text if JSON parsing fails
      }
      throw new Error(`Delete failed: ${errorMessage}`);
    }
  }

  /**
   * Get all itineraries
   */
  async getItineraries(): Promise<Itinerary[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/itineraries`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<Itinerary[]>(response);
  }
}

/**
 * Create a test client instance
 */
export function createTestClient(config?: TestClientConfig): TestClient {
  return new TestClient(config);
}
