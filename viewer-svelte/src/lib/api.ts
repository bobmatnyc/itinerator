import type { Itinerary, ItineraryListItem, ModelConfig, AgentResponse, ChatStreamEvent } from './types';
import { settingsStore } from './stores/settings.svelte';

// For SvelteKit deployment, use relative URLs (same origin)
// For standalone Express server, use VITE_API_URL (defaults to localhost:5177)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Get headers for AI-powered API requests
 * Includes OpenRouter API key from user settings
 */
function getAIHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const apiKey = settingsStore.getApiKey();
  if (apiKey) {
    headers['X-OpenRouter-API-Key'] = apiKey;
  }

  return headers;
}

// API v1 route constants
const API_V1 = {
  BASE: '/api/v1',
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

export const apiClient = {
  // Get all itineraries
  async getItineraries(): Promise<ItineraryListItem[]> {
    const response = await fetch(`${API_BASE_URL}${API_V1.ITINERARIES}`);
    return handleResponse<ItineraryListItem[]>(response);
  },

  // Get single itinerary
  async getItinerary(id: string): Promise<Itinerary> {
    const response = await fetch(`${API_BASE_URL}${API_V1.ITINERARIES}/${id}`);
    return handleResponse<Itinerary>(response);
  },

  // Create a new blank itinerary
  async createItinerary(data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
  }): Promise<Itinerary> {
    const response = await fetch(`${API_BASE_URL}${API_V1.ITINERARIES}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_BASE_URL}${API_V1.ITINERARIES}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Itinerary>(response);
  },

  // Delete itinerary
  async deleteItinerary(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}${API_V1.ITINERARIES}/${id}`, {
      method: 'DELETE',
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
    const response = await fetch(`${API_BASE_URL}${API_V1.ITINERARIES}/${itineraryId}/segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_BASE_URL}${API_V1.ITINERARIES}/${itineraryId}/segments/${segmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(segmentData),
    });
    return handleResponse<import('./types').Itinerary>(response);
  },

  // Delete segment
  async deleteSegment(itineraryId: string, segmentId: string): Promise<import('./types').Itinerary> {
    const response = await fetch(`${API_BASE_URL}${API_V1.ITINERARIES}/${itineraryId}/segments/${segmentId}`, {
      method: 'DELETE',
    });
    return handleResponse<import('./types').Itinerary>(response);
  },

  // Get available models
  async getModels(): Promise<ModelConfig[]> {
    const response = await fetch(`${API_BASE_URL}${API_V1.AGENT.MODELS}`);
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

    const response = await fetch(`${API_BASE_URL}${API_V1.AGENT.IMPORT_PDF}`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  // Get cost summary
  async getCosts(): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}${API_V1.AGENT.COSTS}`);
    return handleResponse(response);
  },

  // Chat endpoints (AI-powered - use getAIHeaders for API key)
  async createChatSession(itineraryId: string): Promise<{ sessionId: string }> {
    const response = await fetch(`${API_BASE_URL}${API_V1.DESIGNER.SESSIONS}`, {
      method: 'POST',
      headers: getAIHeaders(),
      body: JSON.stringify({ itineraryId }),
    });
    return handleResponse<{ sessionId: string }>(response);
  },

  async sendChatMessage(sessionId: string, message: string): Promise<AgentResponse> {
    const response = await fetch(`${API_BASE_URL}${API_V1.DESIGNER.SESSIONS}/${sessionId}/messages`, {
      method: 'POST',
      headers: getAIHeaders(),
      body: JSON.stringify({ message }),
    });
    return handleResponse<AgentResponse>(response);
  },

  async getChatSession(sessionId: string): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}${API_V1.DESIGNER.SESSIONS}/${sessionId}`, {
      headers: getAIHeaders(),
    });
    return handleResponse(response);
  },

  async *sendChatMessageStream(sessionId: string, message: string): AsyncGenerator<ChatStreamEvent> {
    const response = await fetch(`${API_BASE_URL}${API_V1.DESIGNER.SESSIONS}/${sessionId}/messages/stream`, {
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
