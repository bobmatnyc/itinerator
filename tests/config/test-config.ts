/**
 * Test configuration and constants
 */

export const TEST_CONFIG = {
  // API endpoints
  api: {
    baseUrl: process.env.VITE_API_URL || 'http://localhost:5177',
    timeout: 10000,
  },

  // Test user credentials
  testUsers: {
    solo: {
      email: 'alex.chen@example.com',
      userId: 'test-user-solo-001',
    },
    family: {
      email: 'sarah.johnson@example.com',
      userId: 'test-user-family-001',
    },
    business: {
      email: 'marcus.williams@globalcorp.com',
      userId: 'test-user-business-001',
    },
  },

  // LLM evaluation settings
  llm: {
    provider: 'openrouter',
    defaultModel: 'anthropic/claude-3-haiku',
    evaluationModel: 'anthropic/claude-3-opus',
    maxRetries: 3,
    temperature: 0.7,
  },

  // E2E test settings
  e2e: {
    headless: process.env.CI === 'true',
    slowMo: 0,
    viewport: {
      width: 1280,
      height: 720,
    },
    screenshotOnFailure: true,
  },

  // Fixture paths
  fixtures: {
    itineraries: './tests/fixtures/itineraries',
    personas: './tests/fixtures/personas',
  },
} as const;

export default TEST_CONFIG;
