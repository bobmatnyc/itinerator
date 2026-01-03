/**
 * Example: How to Use Traveler Persona Agent
 * Demonstrates programmatic usage of the persona agent for custom testing
 *
 * Usage:
 *   npx tsx tests/e2e/example-persona-test.ts
 *
 * @module tests/e2e/example-persona-test
 */

import { TravelerPersonaAgent, PERSONAS } from './traveler-persona-agent.js';
import type { TravelerPersona } from './traveler-persona-agent.js';

/**
 * Example 1: Test a single built-in persona
 */
async function testSinglePersona() {
  console.log('📝 Example 1: Testing Single Persona\n');

  // Find the romantic couple persona
  const persona = PERSONAS.find(p => p.id === 'romantic-couple');
  if (!persona) {
    throw new Error('Persona not found');
  }

  console.log(`Testing: ${persona.name}`);
  console.log(`Type: ${persona.type}`);
  console.log(`Trip: ${persona.tripRequest.origin} → ${persona.tripRequest.destination}\n`);

  // Create agent
  const agent = new TravelerPersonaAgent(persona, {
    verbose: true,
    maxTurns: 15,
    apiBaseUrl: 'http://localhost:5176/api/v1'
  });

  // Run conversation
  const result = await agent.runConversation();

  // Check results
  console.log(`\n📊 Results:`);
  console.log(`✅ Valid: ${result.valid}`);
  console.log(`📈 Score: ${result.validation.score}/100`);
  console.log(`💬 Turns: ${result.turns}`);
  console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);

  if (result.itinerary) {
    console.log(`🎫 Segments: ${result.itinerary.segments.length}`);
  }

  if (result.validation.issues.length > 0) {
    console.log(`\n⚠️  Issues:`);
    result.validation.issues.forEach(issue => {
      console.log(`  [${issue.severity}] ${issue.message}`);
    });
  }
}

/**
 * Example 2: Create and test a custom persona
 */
async function testCustomPersona() {
  console.log('\n\n📝 Example 2: Testing Custom Persona\n');

  // Define a custom persona
  const customPersona: TravelerPersona = {
    id: 'wellness-retreat',
    name: 'Emma Wellness',
    type: 'solo',
    travelers: [{ name: 'Emma', type: 'adult', age: 38 }],
    preferences: {
      budget: 'luxury',
      pace: 'relaxed',
      accommodation: 'resort',
      interests: ['yoga', 'meditation', 'spa', 'healthy dining', 'nature'],
      dietaryRestrictions: ['vegan', 'gluten-free']
    },
    tripRequest: {
      origin: 'NYC',
      destination: 'Bali',
      duration: '2 weeks',
      specialRequests: ['yoga retreat', 'wellness focus', 'quiet location']
    },
    expectations: {
      minSegments: 6,
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
      shouldInclude: ['yoga', 'spa', 'wellness', 'meditation'],
      shouldNotInclude: ['nightlife', 'party', 'adventure sports'],
      budgetRange: { min: 3000, max: 6000 }
    },
    communicationStyle: 'mindful, health-conscious, seeks tranquility and balance'
  };

  console.log(`Testing custom persona: ${customPersona.name}`);
  console.log(`Focus: Wellness retreat in Bali\n`);

  const agent = new TravelerPersonaAgent(customPersona, {
    verbose: true,
    maxTurns: 15
  });

  const result = await agent.runConversation();

  console.log(`\n📊 Results:`);
  console.log(`✅ Valid: ${result.valid}`);
  console.log(`📈 Score: ${result.validation.score}/100`);

  // Check for wellness-specific segments
  if (result.itinerary) {
    const activitySegments = result.itinerary.segments.filter(s => s.type === 'ACTIVITY');
    console.log(`🧘 Activities planned: ${activitySegments.length}`);

    const wellnessActivities = activitySegments.filter(s =>
      s.notes?.toLowerCase().includes('yoga') ||
      s.notes?.toLowerCase().includes('spa') ||
      s.notes?.toLowerCase().includes('meditation')
    );
    console.log(`🌿 Wellness activities: ${wellnessActivities.length}`);
  }
}

/**
 * Example 3: Compare multiple personas on the same route
 */
async function comparePersonas() {
  console.log('\n\n📝 Example 3: Comparing Multiple Personas\n');

  // Test 3 different personas on the same NYC → Paris route
  const personasToCompare = [
    PERSONAS.find(p => p.id === 'budget-student'),
    PERSONAS.find(p => p.id === 'romantic-couple'),
    PERSONAS.find(p => p.id === 'business-traveler')
  ].filter(Boolean) as TravelerPersona[];

  // Override destination to NYC → Paris for all
  const results = [];

  for (const persona of personasToCompare) {
    console.log(`\nTesting ${persona.name}...`);

    const modifiedPersona = {
      ...persona,
      tripRequest: {
        ...persona.tripRequest,
        destination: 'Paris',
        origin: 'NYC'
      }
    };

    const agent = new TravelerPersonaAgent(modifiedPersona, {
      verbose: false, // Less noise for comparison
      maxTurns: 12
    });

    const result = await agent.runConversation();
    results.push({
      persona: persona.name,
      type: persona.type,
      budget: persona.preferences.budget,
      score: result.validation.score,
      segments: result.itinerary?.segments.length || 0,
      duration: result.duration
    });
  }

  // Print comparison table
  console.log('\n\n📊 Comparison Results:\n');
  console.log('| Persona | Type | Budget | Score | Segments | Duration |');
  console.log('|---------|------|--------|-------|----------|----------|');

  for (const r of results) {
    console.log(
      `| ${r.persona.padEnd(20)} | ${r.type.padEnd(8)} | ${r.budget.padEnd(8)} | ${r.score}/100 | ${r.segments} | ${(r.duration / 1000).toFixed(1)}s |`
    );
  }
}

/**
 * Example 4: Test error handling with problematic input
 */
async function testErrorHandling() {
  console.log('\n\n📝 Example 4: Testing Error Handling\n');

  // Create a persona with conflicting requirements
  const problematicPersona: TravelerPersona = {
    id: 'impossible-request',
    name: 'Impossible Tim',
    type: 'solo',
    travelers: [{ name: 'Tim', type: 'adult', age: 30 }],
    preferences: {
      budget: 'budget', // Budget traveler
      pace: 'packed',
      accommodation: 'hostel',
      interests: ['luxury experiences', 'michelin dining'] // But wants luxury
    },
    tripRequest: {
      origin: 'NYC',
      destination: 'Tokyo',
      duration: '2 days' // Very short
    },
    expectations: {
      minSegments: 20, // Unrealistic for 2 days
      expectedSegmentTypes: ['FLIGHT', 'HOTEL', 'ACTIVITY'],
      shouldInclude: ['luxury', 'michelin'],
      budgetRange: { min: 0, max: 500 } // Impossible budget for luxury Tokyo
    }
  };

  console.log('Testing impossible requirements...\n');

  const agent = new TravelerPersonaAgent(problematicPersona, {
    verbose: false,
    maxTurns: 10
  });

  const result = await agent.runConversation();

  console.log('📊 Results:');
  console.log(`✅ Valid: ${result.valid}`);
  console.log(`📈 Score: ${result.validation.score}/100`);
  console.log(`⚠️  Issues: ${result.validation.issues.length}`);

  // Show validation issues
  if (result.validation.issues.length > 0) {
    console.log('\n⚠️  Validation Issues:');
    result.validation.issues.forEach((issue, i) => {
      console.log(`\n${i + 1}. [${issue.severity.toUpperCase()}] ${issue.category}`);
      console.log(`   ${issue.message}`);
      if (issue.expected !== undefined) {
        console.log(`   Expected: ${JSON.stringify(issue.expected)}`);
        console.log(`   Actual: ${JSON.stringify(issue.actual)}`);
      }
    });
  }

  console.log('\n💡 This demonstrates how the validation catches unrealistic expectations!');
}

/**
 * Example 5: Extract conversation insights
 */
async function extractConversationInsights() {
  console.log('\n\n📝 Example 5: Extracting Conversation Insights\n');

  const persona = PERSONAS.find(p => p.id === 'family-vacation');
  if (!persona) return;

  const agent = new TravelerPersonaAgent(persona, {
    verbose: false,
    maxTurns: 10
  });

  const result = await agent.runConversation();

  console.log('🔍 Conversation Analysis:\n');

  // Count tool calls
  const toolCalls = result.transcript
    .filter(m => m.role === 'assistant' && m.toolCalls)
    .flatMap(m => m.toolCalls || []);

  const toolCallCounts = toolCalls.reduce((acc, tool) => {
    acc[tool] = (acc[tool] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('🔧 Tool Usage:');
  Object.entries(toolCallCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count}x`);
    });

  // Analyze conversation flow
  console.log('\n💬 Conversation Flow:');
  console.log(`  Total messages: ${result.transcript.length}`);
  console.log(`  User messages: ${result.transcript.filter(m => m.role === 'user').length}`);
  console.log(`  Assistant messages: ${result.transcript.filter(m => m.role === 'assistant').length}`);

  // Average message length
  const avgUserMsgLength = result.transcript
    .filter(m => m.role === 'user')
    .reduce((sum, m) => sum + m.content.length, 0) / result.turns;

  console.log(`  Avg user message length: ${avgUserMsgLength.toFixed(0)} chars`);

  // Time analysis
  if (result.transcript.length >= 2) {
    const firstMsg = result.transcript[0].timestamp;
    const lastMsg = result.transcript[result.transcript.length - 1].timestamp;
    const conversationDuration = lastMsg.getTime() - firstMsg.getTime();

    console.log(`\n⏱️  Timing:`);
    console.log(`  Total duration: ${(conversationDuration / 1000).toFixed(2)}s`);
    console.log(`  Avg time per turn: ${(conversationDuration / result.turns / 1000).toFixed(2)}s`);
  }

  // Show sample messages
  console.log('\n📝 Sample Messages:');
  result.transcript.slice(0, 4).forEach((msg, i) => {
    const preview = msg.content.substring(0, 80) + (msg.content.length > 80 ? '...' : '');
    console.log(`  [${msg.role}]: ${preview}`);
  });
}

// ===== MAIN =====

async function main() {
  console.log('🎭 Traveler Persona Agent - Examples\n');
  console.log('=' .repeat(80));

  const examples = [
    { name: 'Single Persona Test', fn: testSinglePersona },
    { name: 'Custom Persona Test', fn: testCustomPersona },
    { name: 'Compare Personas', fn: comparePersonas },
    { name: 'Error Handling', fn: testErrorHandling },
    { name: 'Conversation Insights', fn: extractConversationInsights }
  ];

  // Check for specific example
  const arg = process.argv[2];
  if (arg) {
    const exampleNum = parseInt(arg, 10);
    if (exampleNum >= 1 && exampleNum <= examples.length) {
      await examples[exampleNum - 1].fn();
      return;
    }
  }

  // Show menu
  console.log('\nAvailable Examples:');
  examples.forEach((ex, i) => {
    console.log(`  ${i + 1}. ${ex.name}`);
  });

  console.log('\nUsage:');
  console.log('  npx tsx tests/e2e/example-persona-test.ts <number>');
  console.log('\nExample:');
  console.log('  npx tsx tests/e2e/example-persona-test.ts 1\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export {
  testSinglePersona,
  testCustomPersona,
  comparePersonas,
  testErrorHandling,
  extractConversationInsights
};
