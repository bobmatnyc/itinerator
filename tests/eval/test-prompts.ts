/**
 * Test prompts for model evaluation
 * Each agent has specific test cases covering different scenarios
 */

import type { AgentTestSuite } from './types';

export const TEST_SUITES: AgentTestSuite[] = [
  {
    agent: 'trip-designer',
    prompts: [
      // Discovery phase
      {
        prompt: 'I want to plan a trip',
        expectedBehavior:
          'Agent should ask ONE discovery question about destination, dates, or travelers',
        category: 'discovery',
      },
      {
        prompt: 'I want to go to Japan',
        expectedBehavior:
          'Agent should ask ONE question about trip duration or dates',
        category: 'discovery',
      },
      {
        prompt: "I'm traveling with my family",
        expectedBehavior:
          'Agent should ask ONE question about number/ages of travelers',
        category: 'discovery',
      },

      // Refinement phase
      {
        prompt: 'I want to go to Japan for 2 weeks in April',
        expectedBehavior:
          'Agent should gather requirements and ask ONE refinement question',
        category: 'refinement',
      },
      {
        prompt: 'We prefer hotels over hostels',
        expectedBehavior:
          'Agent should acknowledge preference and ask ONE follow-up question',
        category: 'refinement',
      },

      // Tool use
      {
        prompt: 'Add a flight from SFO to NRT on April 1st',
        expectedBehavior:
          'Agent should use add_segment tool to add flight',
        category: 'tool-use',
      },
      {
        prompt: 'Add 5 nights at Park Hyatt Tokyo',
        expectedBehavior:
          'Agent should use add_segment tool to add accommodation',
        category: 'tool-use',
      },
      {
        prompt: 'Remove the flight to Tokyo',
        expectedBehavior:
          'Agent should use delete_segment tool to remove segment',
        category: 'tool-use',
      },

      // General interactions
      {
        prompt: 'What do you have planned for me so far?',
        expectedBehavior:
          'Agent should use get_itinerary tool to show current itinerary',
        category: 'general',
      },
      {
        prompt: "I don't know where to go yet",
        expectedBehavior:
          'Agent should ask ONE discovery question to help narrow down destination',
        category: 'discovery',
      },
    ],
  },

  {
    agent: 'help',
    prompts: [
      // Feature questions
      {
        prompt: 'How do I add a flight?',
        expectedBehavior:
          'Agent should explain flight addition process clearly',
        category: 'general',
      },
      {
        prompt: 'What features does the app have?',
        expectedBehavior:
          'Agent should list key features of the application',
        category: 'general',
      },
      {
        prompt: 'How do I start planning a trip?',
        expectedBehavior:
          'Agent should explain trip planning workflow',
        category: 'general',
      },

      // Handoff scenarios
      {
        prompt: 'I want to start planning a trip',
        expectedBehavior:
          'Agent should detect planning intent and suggest handoff to trip-designer',
        category: 'general',
      },
      {
        prompt: 'Find me hotels in Tokyo',
        expectedBehavior:
          'Agent should detect search intent and suggest handoff to travel-agent',
        category: 'general',
      },

      // Troubleshooting
      {
        prompt: "I can't see my itinerary",
        expectedBehavior:
          'Agent should provide troubleshooting steps',
        category: 'general',
      },
      {
        prompt: 'The app is not responding',
        expectedBehavior:
          'Agent should suggest debugging steps',
        category: 'general',
      },
    ],
  },

  {
    agent: 'travel-agent',
    prompts: [
      // Search queries
      {
        prompt: 'Search for hotels in Tokyo',
        expectedBehavior:
          'Agent should use search tool to find hotels in Tokyo',
        category: 'tool-use',
      },
      {
        prompt: 'Find flights from LAX to Paris in June',
        expectedBehavior:
          'Agent should use search tool to find flights',
        category: 'tool-use',
      },
      {
        prompt: 'What are the best restaurants in Rome?',
        expectedBehavior:
          'Agent should use search tool to find restaurants',
        category: 'tool-use',
      },

      // Refinement
      {
        prompt: 'I need a hotel near the station',
        expectedBehavior:
          'Agent should ask for city/location before searching',
        category: 'discovery',
      },
      {
        prompt: 'Find cheap flights',
        expectedBehavior:
          'Agent should ask for origin, destination, and dates',
        category: 'discovery',
      },

      // Synthesis
      {
        prompt: 'Compare these three hotels for me',
        expectedBehavior:
          'Agent should analyze and compare hotel options',
        category: 'general',
      },
      {
        prompt: 'Which flight should I book?',
        expectedBehavior:
          'Agent should provide recommendation based on preferences',
        category: 'general',
      },
    ],
  },
];

/**
 * Get test prompts for a specific agent
 */
export function getTestPromptsForAgent(agent: string) {
  const suite = TEST_SUITES.find((s) => s.agent === agent);
  return suite ? suite.prompts : [];
}

/**
 * Get all test prompts across all agents
 */
export function getAllTestPrompts() {
  return TEST_SUITES.flatMap((suite) =>
    suite.prompts.map((p) => ({
      ...p,
      agent: suite.agent,
    }))
  );
}

/**
 * Get test prompts by category
 */
export function getTestPromptsByCategory(
  category: 'discovery' | 'refinement' | 'tool-use' | 'general'
) {
  return getAllTestPrompts().filter((p) => p.category === category);
}
