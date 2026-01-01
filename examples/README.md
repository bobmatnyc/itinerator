# Itinerator Examples

This directory contains example scripts demonstrating various features of Itinerator.

## Trip Designer API Demo

**File:** `trip-designer-api-demo.ts`

Demonstrates the complete flow of using the Trip Designer API:
- Creating an itinerary
- Starting a chat session
- Having a conversation with the AI agent
- Viewing session statistics

**Prerequisites:**
1. Start the SvelteKit server: `cd viewer-svelte && npm run dev`
2. Configure your OpenRouter API key in `.itinerator/config.yaml`:
   ```yaml
   openrouter:
     apiKey: "your-api-key-here"
   ```

**Run:**
```bash
npx tsx examples/trip-designer-api-demo.ts
```

**Expected Output:**
```
🌏 Trip Designer API Demo
========================

📝 Creating a new itinerary...
✅ Created itinerary: abc123...
   Title: Summer Trip to Japan

💬 Creating a chat session...
✅ Created session: session_1234567890_abc123...

👤 User: Hi! I'm planning a trip to Japan with my partner...
🤖 Agent: [AI response with suggestions]
   ✨ Itinerary updated (1 segments modified)
   🔧 Tools used: update_trip_profile

📊 Session Summary
------------------
Messages: 6
Tokens used: 1234
Cost: $0.0245

✅ Demo completed successfully!
```

## Travel Agent Demo

**File:** `travel-agent-demo.ts`

Demonstrates the Travel Agent service (older implementation):
- Creating a trip from scratch
- Asking questions about destinations
- Reviewing and approving suggestions

**Run:**
```bash
npx tsx examples/travel-agent-demo.ts
```

## Adding Your Own Examples

When creating new examples:

1. **Use TypeScript** - All examples should be `.ts` files
2. **Add error handling** - Show users how to handle errors gracefully
3. **Include comments** - Explain what each step does
4. **Check prerequisites** - Verify API keys and services are available
5. **Show expected output** - Help users know what success looks like

Example template:

```typescript
/**
 * Example: [Feature Name]
 *
 * Demonstrates: [What this example shows]
 *
 * Prerequisites:
 * - [Requirement 1]
 * - [Requirement 2]
 *
 * Run: npx tsx examples/your-example.ts
 */

async function main() {
  try {
    console.log('🚀 Starting example...\n');

    // Your code here

    console.log('✅ Example completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
```

## Troubleshooting

### "API key not configured"

Configure your OpenRouter API key:
```bash
# Option 1: YAML config (recommended)
npx itinerator config set openrouter.apiKey YOUR_KEY

# Option 2: Environment variable
export OPENROUTER_API_KEY=YOUR_KEY
```

### "Connection refused"

Make sure the SvelteKit server is running:
```bash
cd viewer-svelte && npm run dev
```

The server should start on http://localhost:5176

### "Failed to create itinerary"

Check that:
1. The server is running
2. Storage directories exist (`data/itineraries/`)
3. You have write permissions

### TypeScript errors

Install dependencies:
```bash
npm install
```

Build the project:
```bash
npm run build
```
