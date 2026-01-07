import type { Itinerary, ItineraryListItem, ModelConfig, AgentResponse, ChatStreamEvent } from './types';

// For SvelteKit deployment, use relative URLs (same origin)
// For standalone Express server, use VITE_API_URL (defaults to localhost:5177)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Get OpenRouter API key from localStorage
 * Reads directly to avoid issues with Svelte 5 runes in non-component context
 */
function getOpenRouterApiKey(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // Try new unified storage first
    const settings = localStorage.getItem('itinerator_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.openRouterKey) return parsed.openRouterKey;
    }

    // Fall back to legacy storage
    return localStorage.getItem('itinerator_api_key');
  } catch {
    return null;
  }
}

/**
 * Get user email from localStorage
 * Reads directly to avoid issues with Svelte 5 runes in non-component context
 */
function getUserEmail(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // Try new unified storage first
    const settings = localStorage.getItem('itinerator_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.email) return parsed.email;
    }

    // Fall back to legacy storage
    return localStorage.getItem('itinerator_user_email');
  } catch {
    return null;
  }
}

/**
 * Get base headers for all API requests
 * Includes user email for server-side scoping
 */
function getBaseHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const userEmail = getUserEmail();
  if (userEmail) {
    headers['X-User-Email'] = userEmail;
  }

  return headers;
}

/**
 * Get headers for AI-powered API requests
 * Includes both user email and OpenRouter API key
 */
function getAIHeaders(): HeadersInit {
  const headers = { ...getBaseHeaders() };

  const apiKey = getOpenRouterApiKey();
  if (apiKey) {
    headers['X-OpenRouter-API-Key'] = apiKey;
  }

  return headers;
}

// API v1 route constants
const API_V1 = {
  BASE: '/api/v1',
  HEALTH: '/api/v1/health',
  ITINERARIES: '/api/v1/itineraries',
  DESIGNER: {
    SESSIONS: '/api/v1/designer/sessions',
  },
  AGENT: {
    IMPORT_PDF: '/api/v1/agent/import/pdf',
    COSTS: '/api/v1/agent/costs',
    MODELS: '/api/v1/agent/models',
  },
} as const;

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Try to extract error message from response body
    let errorMessage = `${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // If JSON parsing fails, use status text
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

/**
 * Fetch wrapper with timeout support
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch wrapper that includes credentials for cookie-based auth
 * Required for cross-origin requests (e.g., ngrok tunnels)
 * Includes timeout and better error classification
 */
async function fetchWithCredentials(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    return await fetchWithTimeout(url, {
      ...options,
      credentials: 'include', // Always send cookies
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      if (error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to server. Please check your connection and try again.');
      }
    }
    throw error;
  }
}

export const apiClient = {
  // Health check
  async checkHealth(): Promise<{ status: string; timestamp: string; service: string }> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.HEALTH}`, {
      cache: 'no-store',
    });
    return handleResponse(response);
  },

  // Get all itineraries
  async getItineraries(): Promise<ItineraryListItem[]> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}`, {
      headers: getBaseHeaders(),
    });
    return handleResponse<ItineraryListItem[]>(response);
  },

  // Get single itinerary
  async getItinerary(id: string): Promise<Itinerary> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}/${id}`, {
      headers: getBaseHeaders(),
    });
    return handleResponse<Itinerary>(response);
  },

  // Create a new blank itinerary
  async createItinerary(data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
  }): Promise<Itinerary> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}`, {
      method: 'POST',
      headers: getBaseHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Itinerary>(response);
  },

  // Update itinerary metadata
  async updateItinerary(
    id: string,
    data: {
      title?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      tripType?: string;
      tags?: string[];
    }
  ): Promise<Itinerary> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}/${id}`, {
      method: 'PATCH',
      headers: getBaseHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Itinerary>(response);
  },

  // Delete itinerary
  async deleteItinerary(id: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}/${id}`, {
      method: 'DELETE',
      headers: getBaseHeaders(),
    });
    if (!response.ok) {
      // Try to extract error message from response body
      let errorMessage = `${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If JSON parsing fails, use status text
      }
      throw new Error(errorMessage);
    }
  },

  // Add segment to itinerary
  async addSegment(itineraryId: string, segmentData: Partial<import('./types').Segment>): Promise<import('./types').Itinerary> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}/${itineraryId}/segments`, {
      method: 'POST',
      headers: getBaseHeaders(),
      body: JSON.stringify(segmentData),
    });
    return handleResponse<import('./types').Itinerary>(response);
  },

  // Update segment
  async updateSegment(
    itineraryId: string,
    segmentId: string,
    segmentData: Partial<import('./types').Segment>
  ): Promise<import('./types').Itinerary> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}/${itineraryId}/segments/${segmentId}`, {
      method: 'PATCH',
      headers: getBaseHeaders(),
      body: JSON.stringify(segmentData),
    });
    return handleResponse<import('./types').Itinerary>(response);
  },

  // Delete segment
  async deleteSegment(itineraryId: string, segmentId: string): Promise<import('./types').Itinerary> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}/${itineraryId}/segments/${segmentId}`, {
      method: 'DELETE',
      headers: getBaseHeaders(),
    });
    return handleResponse<import('./types').Itinerary>(response);
  },

  // Add traveler
  async addTraveler(
    itineraryId: string,
    travelerData: {
      firstName: string;
      lastName: string;
      type?: string;
      email?: string;
      phone?: string;
    }
  ): Promise<import('./types').Itinerary> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}/${itineraryId}/travelers`, {
      method: 'POST',
      headers: getBaseHeaders(),
      body: JSON.stringify(travelerData),
    });
    return handleResponse<import('./types').Itinerary>(response);
  },

  // Update traveler
  async updateTraveler(
    itineraryId: string,
    travelerId: string,
    travelerData: {
      firstName?: string;
      lastName?: string;
      type?: string;
      email?: string;
      phone?: string;
    }
  ): Promise<import('./types').Itinerary> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}/${itineraryId}/travelers/${travelerId}`, {
      method: 'PATCH',
      headers: getBaseHeaders(),
      body: JSON.stringify(travelerData),
    });
    return handleResponse<import('./types').Itinerary>(response);
  },

  // Delete traveler
  async deleteTraveler(itineraryId: string, travelerId: string): Promise<import('./types').Itinerary> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}/${itineraryId}/travelers/${travelerId}`, {
      method: 'DELETE',
      headers: getBaseHeaders(),
    });
    return handleResponse<import('./types').Itinerary>(response);
  },

  // Update trip preferences
  async updateTripPreferences(
    itineraryId: string,
    preferences: Record<string, unknown>
  ): Promise<import('./types').Itinerary> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.ITINERARIES}/${itineraryId}/preferences`, {
      method: 'PATCH',
      headers: getBaseHeaders(),
      body: JSON.stringify(preferences),
    });
    return handleResponse<import('./types').Itinerary>(response);
  },

  // Get available models
  async getModels(): Promise<ModelConfig[]> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.AGENT.MODELS}`, {
      headers: getBaseHeaders(),
    });
    return handleResponse<ModelConfig[]>(response);
  },

  // Import PDF
  async importPDF(file: File, model?: string): Promise<{
    success: boolean;
    itinerary: Itinerary;
    usage: {
      model: string;
      inputTokens: number;
      outputTokens: number;
      costUSD: number;
    };
    continuityValidation?: {
      valid: boolean;
      gaps: unknown[];
      segmentCount: number;
      summary: string;
    };
  }> {
    const formData = new FormData();
    formData.append('file', file);
    if (model) {
      formData.append('model', model);
    }

    // Get headers without Content-Type (browser sets it with boundary for multipart)
    const headers: HeadersInit = {};
    const userEmail = getUserEmail();
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }

    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.AGENT.IMPORT_PDF}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse(response);
  },

  // Get cost summary
  async getCosts(): Promise<unknown> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.AGENT.COSTS}`, {
      headers: getBaseHeaders(),
    });
    return handleResponse(response);
  },

  // Chat endpoints (AI-powered - use getAIHeaders for API key)
  async createChatSession(itineraryId?: string, mode: 'trip-designer' | 'help' = 'trip-designer'): Promise<{ sessionId: string }> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.DESIGNER.SESSIONS}`, {
      method: 'POST',
      headers: getAIHeaders(),
      body: JSON.stringify({ itineraryId, mode }),
    });
    return handleResponse<{ sessionId: string }>(response);
  },

  async sendChatMessage(sessionId: string, message: string): Promise<AgentResponse> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.DESIGNER.SESSIONS}/${sessionId}/messages`, {
      method: 'POST',
      headers: getAIHeaders(),
      body: JSON.stringify({ message }),
    });
    return handleResponse<AgentResponse>(response);
  },

  async getChatSession(sessionId: string): Promise<unknown> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.DESIGNER.SESSIONS}/${sessionId}`, {
      headers: getAIHeaders(),
    });
    return handleResponse(response);
  },

  async deleteChatSession(sessionId: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.DESIGNER.SESSIONS}/${sessionId}`, {
      method: 'DELETE',
      headers: getAIHeaders(),
    });
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete session: ${response.status} ${response.statusText}`);
    }
  },

  async *sendChatMessageStream(sessionId: string, message: string): AsyncGenerator<ChatStreamEvent> {
    const response = await fetchWithCredentials(`${API_BASE_URL}${API_V1.DESIGNER.SESSIONS}/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: getAIHeaders(),
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      // Try to extract error message from response body
      let errorMessage = `${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If JSON parsing fails, use status text
      }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Append new data to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent: string | null = null;
        let currentData: string | null = null;

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6).trim();
          } else if (line === '' && currentEvent && currentData) {
            // Complete event received
            try {
              const data = JSON.parse(currentData);
              yield { type: currentEvent, ...data } as ChatStreamEvent;
            } catch (e) {
              console.error('Failed to parse SSE data:', currentData, e);
            }
            currentEvent = null;
            currentData = null;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};
