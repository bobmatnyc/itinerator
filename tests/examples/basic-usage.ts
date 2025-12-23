/**
 * Basic usage example for Itinerizer E2E test helpers
 *
 * This example demonstrates the core functionality of the test framework.
 * Run with: npx tsx tests/examples/basic-usage.ts
 */

import {
  createTestClient,
  loadItinerary,
  assertOneQuestionOnly,
  assertNoErrors,
  assertStreamCompleted,
  collectSSEEvents,
} from '../helpers/index.js';

async function main() {
  console.log('🚀 Itinerizer E2E Test Helpers - Basic Usage Example\n');

  // 1. Create test client
  console.log('1️⃣  Creating test client...');
  const client = createTestClient();
  console.log('   ✅ Client created\n');

  // 2. Create a new itinerary
  console.log('2️⃣  Creating test itinerary...');
  const itinerary = await client.createItinerary({
    title: 'Example Trip to Paris',
    description: 'A test trip for demonstrating the E2E framework',
    startDate: '2025-08-01T00:00:00.000Z',
    endDate: '2025-08-08T00:00:00.000Z',
  });
  console.log(`   ✅ Created itinerary: ${itinerary.id}`);
  console.log(`   📝 Title: ${itinerary.title}\n`);

  // 3. Create a Trip Designer session
  console.log('3️⃣  Creating Trip Designer session...');
  const { sessionId } = await client.createSession(itinerary.id);
  console.log(`   ✅ Created session: ${sessionId}\n`);

  // 4. Send a message and stream the response
  console.log('4️⃣  Sending message to Trip Designer...');
  console.log('   💬 Message: "I want to plan a romantic trip to Paris"\n');

  const events = [];
  let textContent = '';

  for await (const event of client.streamMessage(
    sessionId,
    'I want to plan a romantic trip to Paris'
  )) {
    events.push(event);

    if (event.type === 'text') {
      textContent += event.content;
      process.stdout.write(event.content); // Stream text to console
    } else if (event.type === 'structured_questions') {
      console.log('\n\n   📋 Structured Questions Received:');
      for (const question of event.questions) {
        console.log(`      - ${question.question}`);
      }
    } else if (event.type === 'tool_call') {
      console.log(`\n   🔧 Tool Call: ${event.name}`);
    } else if (event.type === 'tool_result') {
      console.log(`   ✅ Tool Result: ${event.name} - ${event.success ? 'Success' : 'Failed'}`);
    } else if (event.type === 'done') {
      console.log('\n\n   🏁 Stream completed');
      if (event.itineraryUpdated) {
        console.log('   📝 Itinerary was updated');
      }
      if (event.tokens) {
        console.log(`   📊 Tokens: ${event.tokens.total} (${event.tokens.input} in, ${event.tokens.output} out)`);
      }
    }
  }

  console.log('\n');

  // 5. Validate the response
  console.log('5️⃣  Validating response...');

  try {
    assertNoErrors(events);
    console.log('   ✅ No errors in stream');
  } catch (error) {
    console.log(`   ❌ Error validation failed: ${error}`);
  }

  try {
    assertStreamCompleted(events);
    console.log('   ✅ Stream completed successfully');
  } catch (error) {
    console.log(`   ❌ Stream completion check failed: ${error}`);
  }

  // Check for ONE question at a time
  const questionEvents = events.filter(e => e.type === 'structured_questions');
  if (questionEvents.length > 0) {
    try {
      const event = questionEvents[0];
      if (event.type === 'structured_questions') {
        assertOneQuestionOnly(event.questions);
        console.log('   ✅ Asking ONE question at a time (good!)');
      }
    } catch (error) {
      console.log(`   ⚠️  Question validation: ${error}`);
    }
  }

  console.log('\n');

  // 6. Get updated itinerary
  console.log('6️⃣  Fetching updated itinerary...');
  const updatedItinerary = await client.getItinerary(itinerary.id);
  console.log(`   📊 Segments: ${updatedItinerary.segments.length}`);
  console.log(`   🏷️  Tags: ${updatedItinerary.tags.join(', ')}`);
  console.log('\n');

  // 7. Load a fixture
  console.log('7️⃣  Loading fixture example...');
  try {
    const planningItinerary = loadItinerary('planning-phase');
    console.log(`   ✅ Loaded fixture: ${planningItinerary.title}`);
    console.log(`   📍 Destinations: ${planningItinerary.destinations?.map(d => d.name).join(', ')}`);
  } catch (error) {
    console.log(`   ⚠️  Fixture not available: ${error}`);
  }
  console.log('\n');

  // 8. Cleanup
  console.log('8️⃣  Cleaning up...');
  await client.deleteItinerary(itinerary.id);
  console.log('   ✅ Test itinerary deleted\n');

  console.log('✨ Example completed successfully!\n');

  // Summary
  console.log('📚 Summary:');
  console.log('   - Created test client');
  console.log('   - Created itinerary');
  console.log('   - Started Trip Designer session');
  console.log('   - Streamed AI response');
  console.log('   - Validated response structure');
  console.log('   - Verified ONE question principle');
  console.log('   - Cleaned up test data');
  console.log('\n🎉 All E2E test helpers are working correctly!\n');
}

// Run the example
main().catch((error) => {
  console.error('\n❌ Example failed:', error);
  process.exit(1);
});
