/**
 * Manual test script for tool chaining functionality
 * This tests that the Trip Designer can make multiple rounds of tool calls
 */

import { TripDesignerService, InMemorySessionStorage } from './src/services/trip-designer/index.js';
import type { ItineraryId } from './src/domain/types/branded.js';

// Mock services to verify tool chaining without actual API calls
const mockItineraryService = {
  async get(id: ItineraryId) {
    return {
      success: true,
      value: {
        id,
        title: 'Test Itinerary',
        segments: [],
        destinations: [],
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }
    };
  }
};

async function testToolChaining() {
  console.log('=== Testing Tool Chaining ===\n');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('ERROR: OPENROUTER_API_KEY environment variable not set');
    process.exit(1);
  }

  const service = new TripDesignerService(
    {
      apiKey,
      model: 'anthropic/claude-3.5-haiku',
      streaming: true,
    },
    new InMemorySessionStorage(),
    {
      itineraryService: mockItineraryService,
    }
  );

  const testItineraryId = 'test-tool-chaining' as ItineraryId;

  // Create session
  console.log('Creating session...');
  const sessionResult = await service.createSession(testItineraryId);

  if (!sessionResult.success) {
    console.error('Failed to create session:', sessionResult.error);
    process.exit(1);
  }

  const sessionId = sessionResult.value;
  console.log(`Session created: ${sessionId}\n`);

  // Test streaming with a complex request that requires multiple tool calls
  console.log('Testing chatStream with complex request...');
  console.log('Request: "Add a hotel in Paris for 3 nights, then add a flight from Paris to Rome"\n');

  let toolCallCount = 0;
  let toolRounds = 0;
  let lastToolCall: string | null = null;

  try {
    for await (const event of service.chatStream(
      sessionId,
      'Add a hotel in Paris for 3 nights starting tomorrow, then add a flight from Paris to Rome the day after'
    )) {
      if (event.type === 'tool_call') {
        toolCallCount++;

        // Track when we move to a new round (when we see a different tool after execution)
        if (lastToolCall && lastToolCall !== event.name) {
          toolRounds++;
        }
        lastToolCall = event.name;

        console.log(`[Tool Call ${toolCallCount}] ${event.name}:`, JSON.stringify(event.arguments, null, 2));
      } else if (event.type === 'tool_result') {
        console.log(`[Tool Result] ${event.name}:`, event.success ? 'SUCCESS' : 'FAILED');
      } else if (event.type === 'text') {
        process.stdout.write(event.content);
      } else if (event.type === 'done') {
        console.log('\n\n[Done]');
        console.log(`- Itinerary updated: ${event.itineraryUpdated}`);
        console.log(`- Segments modified: ${event.segmentsModified?.length || 0}`);
        console.log(`- Tokens: ${event.tokens?.total || 0}`);
        console.log(`- Cost: $${event.cost?.total.toFixed(4) || '0.0000'}`);
      }
    }

    console.log('\n\n=== Tool Chaining Test Results ===');
    console.log(`Total tool calls: ${toolCallCount}`);
    console.log(`Estimated tool rounds: ${toolRounds + 1}`);

    if (toolCallCount >= 2) {
      console.log('\n✅ SUCCESS: Tool chaining is working! Model made multiple tool calls.');
    } else {
      console.log('\n⚠️  WARNING: Only one tool call detected. Tool chaining may not be working as expected.');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

// Run the test
testToolChaining().catch(console.error);
