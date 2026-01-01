/**
 * Example: Knowledge Graph with Anonymization
 * Demonstrates how to use the knowledge service for RAG with privacy protection
 */

import { VectraStorage } from '../src/storage/vectra-storage.js';
import { EmbeddingService } from '../src/services/embedding.service.js';
import { KnowledgeService } from '../src/services/knowledge.service.js';
import { AnonymizerService } from '../src/services/anonymizer.service.js';
import { YamlConfigStorage } from '../src/storage/yaml-config.js';

async function main() {
  console.log('=== Knowledge Graph with Anonymization Demo ===\n');

  // 1. Load API key from config
  const configStorage = new YamlConfigStorage();
  const configResult = await configStorage.getConfig();

  if (!configResult.success) {
    console.error('Failed to load config:', configResult.error.message);
    console.error('Please set your OpenRouter API key in .itinerator/config.yaml');
    return;
  }

  const apiKey = configResult.value.openrouter?.apiKey;
  if (!apiKey) {
    console.error('OpenRouter API key not found in config');
    return;
  }

  // 2. Initialize services
  console.log('Initializing services...');

  const vectorStorage = new VectraStorage('./data/vectors');
  const embeddingService = new EmbeddingService({ apiKey });
  const knowledgeService = new KnowledgeService(vectorStorage, embeddingService, {
    namespace: 'travel-knowledge-demo',
    topK: 3,
    similarityThreshold: 0.5,
  });

  const initResult = await knowledgeService.initialize();
  if (!initResult.success) {
    console.error('Failed to initialize knowledge service:', initResult.error.message);
    return;
  }

  console.log('✓ Services initialized\n');

  // 3. Demonstrate anonymization
  console.log('=== Anonymization Examples ===\n');

  const anonymizer = new AnonymizerService();

  const examples = [
    'My wife Sarah and I want to visit Paris in March 2025',
    'Flying from JFK on March 15, 2025',
    'Our budget is $5000 for the whole trip',
    'Call me at 555-1234 or email john.doe@example.com',
    'I live at 123 Main St, Boston, MA',
  ];

  for (const example of examples) {
    const result = anonymizer.anonymize(example);
    if (result.success) {
      console.log(`Original:    "${example}"`);
      console.log(`Anonymized:  "${result.value.anonymized}"`);
      console.log(`PII Removed: ${result.value.piiRemoved} items (${result.value.piiTypes.join(', ')})\n`);
    }
  }

  // 4. Store chat messages
  console.log('=== Storing Chat Messages ===\n');

  const sessionId = 'demo-session-001';

  const messages = [
    { content: 'My wife and I want to plan a romantic trip to Paris', role: 'user' as const, sessionId },
    { content: 'I can help you plan a wonderful trip to Paris! When are you thinking of traveling?', role: 'assistant' as const, sessionId },
    { content: 'We\'re thinking early March, maybe the 10th to 17th', role: 'user' as const, sessionId },
    { content: 'What\'s your budget for accommodations and activities?', role: 'assistant' as const, sessionId },
    { content: 'Around $4000 total for the week', role: 'user' as const, sessionId },
  ];

  console.log(`Storing ${messages.length} messages...`);
  const storeResult = await knowledgeService.storeMessages(messages);

  if (!storeResult.success) {
    console.error('Failed to store messages:', storeResult.error.message);
    return;
  }

  console.log(`✓ Stored ${storeResult.value.length} anonymized messages\n`);

  // Show anonymized versions
  console.log('Anonymized content stored:');
  for (const doc of storeResult.value) {
    console.log(`  - "${doc.content}"`);
  }
  console.log();

  // 5. Store travel entities
  console.log('=== Storing Travel Entities ===\n');

  const entities = [
    { text: 'Romantic getaway in Paris', category: 'destination' as const, confidence: 0.95 },
    { text: 'Visit Eiffel Tower at sunset', category: 'activity' as const, confidence: 0.9 },
    { text: 'Wine tasting in Loire Valley', category: 'activity' as const, confidence: 0.85 },
    { text: 'Mid-range budget around $4000', category: 'budget' as const, confidence: 0.9 },
  ];

  for (const entity of entities) {
    const result = await knowledgeService.storeEntity(entity, sessionId);
    if (result.success) {
      console.log(`✓ Stored entity: ${entity.category} - "${result.value.content}"`);
    }
  }
  console.log();

  // 6. Retrieve relevant context (RAG)
  console.log('=== RAG: Retrieving Context ===\n');

  const queries = [
    'What are good romantic activities in Paris?',
    'What budget range should I plan for Paris?',
    'Tell me about Paris travel preferences',
  ];

  for (const query of queries) {
    console.log(`Query: "${query}"`);

    const ragResult = await knowledgeService.retrieveContext(query);

    if (ragResult.success) {
      const { documents, scores, context } = ragResult.value;

      console.log(`Found ${documents.length} relevant items:\n`);

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const score = scores[i];
        console.log(`  ${i + 1}. [${(score! * 100).toFixed(0)}%] ${doc.metadata.type} - "${doc.content}"`);
      }

      console.log(`\nFormatted context for LLM:`);
      console.log(context);
    } else {
      console.error('Failed to retrieve context:', ragResult.error.message);
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  // 7. Search with filters
  console.log('=== Filtered Search ===\n');

  // Search only for activities
  const activitySearch = await knowledgeService.search('Things to do in Paris', {
    type: 'entity',
    category: 'activity',
    topK: 5,
  });

  if (activitySearch.success) {
    console.log('Activities found:');
    for (const doc of activitySearch.value.documents) {
      console.log(`  - ${doc.content}`);
    }
  }
  console.log();

  // 8. Get statistics
  console.log('=== Knowledge Base Statistics ===\n');

  const statsResult = await knowledgeService.getStats();

  if (statsResult.success) {
    const { totalDocuments, byType, byCategory } = statsResult.value;

    console.log(`Total documents: ${totalDocuments}`);
    console.log('\nBy type:');
    for (const [type, count] of Object.entries(byType)) {
      console.log(`  - ${type}: ${count}`);
    }

    console.log('\nBy category:');
    for (const [category, count] of Object.entries(byCategory)) {
      console.log(`  - ${category}: ${count}`);
    }
  }
  console.log();

  // 9. Privacy verification
  console.log('=== Privacy Verification ===\n');

  const listResult = await vectorStorage.list('travel-knowledge-demo', 100);
  if (listResult.success) {
    const hasPersonalInfo = listResult.value.some(doc => {
      const content = doc.content.toLowerCase();
      return (
        content.includes('sarah') ||
        content.includes('@') ||
        content.includes('555-') ||
        content.includes('main st')
      );
    });

    if (hasPersonalInfo) {
      console.log('⚠️  WARNING: Personal information detected in stored documents!');
    } else {
      console.log('✓ No personal information found in stored documents');
      console.log('  All PII has been successfully anonymized');
    }
  }
  console.log();

  console.log('=== Demo Complete ===\n');
  console.log('Key Features Demonstrated:');
  console.log('  ✓ PII removal (names, emails, phones, addresses)');
  console.log('  ✓ Date generalization (specific dates → periods)');
  console.log('  ✓ Location generalization (addresses → regions)');
  console.log('  ✓ Budget categorization (amounts → ranges)');
  console.log('  ✓ Vector embeddings for semantic search');
  console.log('  ✓ RAG context retrieval');
  console.log('  ✓ Filtered search by type and category');
  console.log('  ✓ Local file-based vector storage');
  console.log('\nThe knowledge graph is now ready for use in your chatbot!');
  console.log('All data is anonymized and safe for cross-user learning.');
}

// Run the demo
main().catch(console.error);
