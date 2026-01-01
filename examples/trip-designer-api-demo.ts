/**
 * Trip Designer API Usage Example
 *
 * This example demonstrates how to use the Trip Designer API endpoints
 * to have a conversational interaction about trip planning.
 *
 * Prerequisites:
 * 1. Start the API server: npm run server
 * 2. Configure OpenRouter API key in .itinerator/config.yaml
 *
 * Run this example:
 * npx tsx examples/trip-designer-api-demo.ts
 */

const BASE_URL = 'http://localhost:5177/api';

interface SessionResponse {
  sessionId: string;
}

interface AgentResponse {
  message: string;
  itineraryUpdated?: boolean;
  segmentsModified?: string[];
  toolCallsMade?: any[];
  structuredQuestions?: any[];
}

interface Session {
  id: string;
  itineraryId: string;
  messages: any[];
  tripProfile: any;
  metadata: {
    messageCount: number;
    totalTokens: number;
    costUSD?: number;
  };
}

async function createItinerary(): Promise<string> {
  console.log('📝 Creating a new itinerary...');

  const response = await fetch(`${BASE_URL}/itineraries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Summer Trip to Japan',
      description: 'A two-week adventure exploring Tokyo and Kyoto',
      startDate: '2025-06-15',
      endDate: '2025-06-29',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create itinerary: ${response.statusText}`);
  }

  const itinerary = await response.json();
  console.log(`✅ Created itinerary: ${itinerary.id}`);
  console.log(`   Title: ${itinerary.title}`);
  console.log('');

  return itinerary.id;
}

async function createSession(itineraryId: string): Promise<string> {
  console.log('💬 Creating a chat session...');

  const response = await fetch(`${BASE_URL}/chat/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itineraryId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create session: ${error.message || response.statusText}`);
  }

  const data: SessionResponse = await response.json();
  console.log(`✅ Created session: ${data.sessionId}`);
  console.log('');

  return data.sessionId;
}

async function sendMessage(sessionId: string, message: string): Promise<AgentResponse> {
  console.log(`👤 User: ${message}`);

  const response = await fetch(`${BASE_URL}/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Chat failed: ${error.message || response.statusText}`);
  }

  const agentResponse: AgentResponse = await response.json();

  console.log(`🤖 Agent: ${agentResponse.message}`);

  if (agentResponse.itineraryUpdated) {
    console.log(`   ✨ Itinerary updated (${agentResponse.segmentsModified?.length || 0} segments modified)`);
  }

  if (agentResponse.toolCallsMade && agentResponse.toolCallsMade.length > 0) {
    console.log(`   🔧 Tools used: ${agentResponse.toolCallsMade.map(t => t.function.name).join(', ')}`);
  }

  if (agentResponse.structuredQuestions && agentResponse.structuredQuestions.length > 0) {
    console.log(`   ❓ Questions: ${agentResponse.structuredQuestions.length}`);
  }

  console.log('');

  return agentResponse;
}

async function getSessionDetails(sessionId: string): Promise<Session> {
  const response = await fetch(`${BASE_URL}/chat/sessions/${sessionId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get session: ${error.message || response.statusText}`);
  }

  return response.json();
}

async function main() {
  console.log('🌏 Trip Designer API Demo');
  console.log('========================\n');

  try {
    // Step 1: Create an itinerary
    const itineraryId = await createItinerary();

    // Step 2: Create a chat session
    const sessionId = await createSession(itineraryId);

    // Step 3: Have a conversation
    await sendMessage(
      sessionId,
      "Hi! I'm planning a trip to Japan with my partner. We love food and culture."
    );

    await sendMessage(
      sessionId,
      "Can you help me add a day trip to Kyoto? We want to see temples and try local cuisine."
    );

    await sendMessage(
      sessionId,
      "What's a good budget for this trip?"
    );

    // Step 4: Get session summary
    console.log('📊 Session Summary');
    console.log('------------------');
    const session = await getSessionDetails(sessionId);
    console.log(`Messages: ${session.metadata.messageCount}`);
    console.log(`Tokens used: ${session.metadata.totalTokens}`);
    if (session.metadata.costUSD) {
      console.log(`Cost: $${session.metadata.costUSD.toFixed(4)}`);
    }
    console.log('');

    // Step 5: Subscribe to real-time updates (SSE)
    console.log('🔔 Subscribing to itinerary updates...');
    console.log('   (Press Ctrl+C to exit)');
    console.log('');

    // Note: In a real application, you'd use EventSource in the browser
    // For Node.js, you'd need a library like 'eventsource'
    console.log('   SSE endpoint: GET /api/itineraries/' + itineraryId + '/events');
    console.log('   (SSE subscription would go here in a browser or with eventsource library)');
    console.log('');

    console.log('✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.message.includes('API key not configured')) {
      console.error('');
      console.error('💡 Make sure to:');
      console.error('   1. Start the API server: npm run server');
      console.error('   2. Configure your OpenRouter API key in .itinerator/config.yaml');
      console.error('   Or set the OPENROUTER_API_KEY environment variable');
    }

    process.exit(1);
  }
}

main();
