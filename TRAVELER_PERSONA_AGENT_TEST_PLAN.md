# Traveler Persona Agent - Test Plan

## Pre-requisites

1. **Environment Setup**
   ```bash
   export OPENROUTER_API_KEY="your-key-here"  # pragma: allowlist secret
   ```

2. **Start Development Server**
   ```bash
   cd viewer-svelte
   npm run dev
   # Server should be running on http://localhost:5176
   ```

## Test Cases

### Test 1: Basic Authentication Flow
**Objective**: Verify agent can authenticate and create itinerary

```bash
npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker --max-turns 1 --verbose
```

**Expected Output**:
```
🔐 Authenticating as test@test.com...
✅ Authenticated successfully

🎭 Alex the Backpacker - Creating itinerary...
✅ Itinerary created: <uuid>

🎭 Creating Trip Designer session...
✅ Session created: <session-id>

👤 Alex the Backpacker: <generated message>
🤖 Trip Designer: <AI response>
```

**Success Criteria**:
- ✅ Authentication succeeds
- ✅ Itinerary created
- ✅ Session created
- ✅ At least one conversation turn completes
- ❌ No 401/403 errors

### Test 2: Verbose vs Quiet Output
**Objective**: Verify verbose flag controls output

**Verbose Mode**:
```bash
npx tsx tests/e2e/traveler-persona-agent.ts --persona romantic-couple --max-turns 1 --verbose
```

**Expected**: Detailed logs with 🔐, ✅, 👤, 🤖 emojis

**Quiet Mode**:
```bash
npx tsx tests/e2e/traveler-persona-agent.ts --persona romantic-couple --max-turns 1 --quiet
```

**Expected**: Minimal output, only final results

### Test 3: Error Handling - No Server
**Objective**: Verify error messages are helpful

```bash
# Stop the server first
npx tsx tests/e2e/traveler-persona-agent.ts --persona family-vacation --max-turns 1 --verbose
```

**Expected Output**:
```
🔐 Authenticating as test@test.com...
❌ Failed to authenticate: <error details>
Error: Authentication failed: ...
```

**Success Criteria**:
- ✅ Clear error message indicating what went wrong
- ✅ HTTP status code shown
- ✅ Full error response displayed (when verbose)

### Test 4: Error Handling - Missing API Key
**Objective**: Verify API key validation

```bash
unset OPENROUTER_API_KEY
npx tsx tests/e2e/traveler-persona-agent.ts --persona business-traveler
```

**Expected Output**:
```
Error: OPENROUTER_API_KEY is required
```

**Success Criteria**:
- ✅ Clear error message about missing API key
- ✅ Fails fast before attempting network requests

### Test 5: Help Text
**Objective**: Verify documentation is complete

```bash
npx tsx tests/e2e/traveler-persona-agent.ts --help
```

**Expected**: Help text showing:
- ✅ All available flags (--persona, --type, --model, etc.)
- ✅ --verbose and --quiet flags documented
- ✅ All available personas listed
- ✅ Usage examples provided

### Test 6: Full Conversation - All Personas
**Objective**: Run all personas through short conversations

```bash
npx tsx tests/e2e/traveler-persona-agent.ts --max-turns 3
```

**Expected**:
- ✅ All 8 personas complete authentication
- ✅ All 8 personas create itineraries
- ✅ All 8 personas have at least 1 conversation turn
- ✅ Results saved to JSON and Markdown
- ✅ Quality reports generated

### Test 7: Custom Configuration
**Objective**: Verify all CLI options work

```bash
npx tsx tests/e2e/traveler-persona-agent.ts \
  --persona adventure-group \
  --model anthropic/claude-3.5-sonnet \
  --api http://localhost:5176/api/v1 \
  --max-turns 5 \
  --verbose
```

**Expected**:
- ✅ Uses specified model
- ✅ Uses specified API URL
- ✅ Stops after 5 turns
- ✅ Shows verbose output

### Test 8: Type Filter
**Objective**: Test type-based persona filtering

```bash
npx tsx tests/e2e/traveler-persona-agent.ts --type solo --max-turns 2
```

**Expected**:
- ✅ Runs only solo personas (solo-backpacker, open-ended)
- ✅ Each completes authentication and conversation

## Integration Test Checklist

After all tests pass, verify:

- [ ] Authentication works with session cookies
- [ ] All API endpoints accept authenticated requests
- [ ] Error messages are descriptive and helpful
- [ ] Verbose logging aids debugging
- [ ] Multiple personas can run in sequence
- [ ] Results are saved correctly
- [ ] Quality reports are generated
- [ ] Memory usage is reasonable

## Performance Benchmarks

Expected performance:
- **Authentication**: < 1 second
- **Itinerary Creation**: < 2 seconds
- **Session Creation**: < 2 seconds
- **Message Turn**: 5-15 seconds (depends on LLM)
- **Full Conversation (10 turns)**: 1-3 minutes

## Debugging Guide

### Authentication Fails
```
Error: Authentication failed: 404
```

**Checks**:
1. Is server running? `curl http://localhost:5176/api/auth/login`
2. Is API URL correct? Check `--api` flag
3. Is `/api/auth/login` endpoint working?

### Session Creation Fails
```
Error: Failed to create session: 401
```

**Checks**:
1. Did authentication succeed?
2. Is session cookie being sent?
3. Run with `--verbose` to see headers

### Message Sending Fails
```
Error: Failed to send message: 403
```

**Checks**:
1. Is OPENROUTER_API_KEY set?
2. Is API key valid?
3. Check X-OpenRouter-API-Key header in verbose output

### No Conversation Progress
```
✅ Session created but no messages sent
```

**Checks**:
1. Check persona LLM responses
2. Verify OpenAI client configuration
3. Check OpenRouter API status

## Success Metrics

The agent is working correctly when:

1. **Authentication**: 100% success rate
2. **Itinerary Creation**: 100% success rate
3. **Conversation Turns**: ≥80% completion rate
4. **Error Messages**: Always informative
5. **Performance**: Within benchmarks above

## Manual Verification

After running tests, manually verify in the UI:

1. Navigate to http://localhost:5176
2. Check that itineraries were created under `test@test.com`
3. Verify segments were added during conversations
4. Check that Trip Designer sessions are visible
5. Confirm conversation history is saved

## Regression Testing

Run this before each release:

```bash
# Quick smoke test (1 persona, 2 turns)
npx tsx tests/e2e/traveler-persona-agent.ts --persona solo-backpacker --max-turns 2

# Full test suite (all personas, 10 turns)
npx tsx tests/e2e/traveler-persona-agent.ts --max-turns 10

# Check results
ls -lh tests/e2e/results/
cat tests/e2e/results/persona-test-*.md
```

## Next Steps

1. Run Test 1-8 in order
2. Fix any issues found
3. Run full test suite
4. Review quality reports
5. Document any edge cases found
6. Add to CI/CD pipeline (optional)
