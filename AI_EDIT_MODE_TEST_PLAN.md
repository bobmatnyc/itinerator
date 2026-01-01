# AI Edit Mode Auto-Initialization - Test Plan

## Quick Test (2 minutes)

### Test Case 1: Auto-Initialize with Context
**Steps**:
1. Navigate to `/itineraries` and select an existing itinerary with segments
2. Toggle from "Manual" to "AI" edit mode
3. **Expected**: Chat panel appears with "Connected" message
4. **Expected**: LLM greets you by name (if set in profile)
5. **Expected**: LLM acknowledges the trip (title, dates, destinations)
6. **Expected**: LLM mentions number of existing segments

**Example Greeting**:
```
Hi Masa! I can see you're working on your Croatia Business Trip
scheduled for May 15-22, 2025. You currently have 5 segments planned
including flights, hotels, and activities. Would you like me to help
refine your itinerary or add anything?
```

### Test Case 2: Empty Itinerary
**Steps**:
1. Create a new itinerary with title and dates but no segments
2. Toggle to AI mode
3. **Expected**: LLM acknowledges title and dates
4. **Expected**: LLM notes itinerary is empty and ready to plan

**Example Greeting**:
```
Hi Masa! I see you're planning a trip to Tokyo from June 1-10, 2025.
Your itinerary is currently empty and ready to be planned. Let's start
building your perfect trip! What kind of experience are you looking for?
```

### Test Case 3: Inferred Destination
**Steps**:
1. Create itinerary with title "Paris Vacation" but no explicit destinations
2. Toggle to AI mode
3. **Expected**: LLM infers "Paris" as destination from title
4. **Expected**: Uses Paris in context (not asking "where are you going?")

### Test Case 4: Mismatch Warnings
**Steps**:
1. Import email with luxury hotel booking
2. Toggle to AI mode
3. **Expected**: LLM is aware of luxury preference
4. **Expected**: Doesn't ask about budget/travel style
5. **Expected**: Suggests matching quality level

### Test Case 5: Past Dates Warning
**Steps**:
1. Open itinerary with past end date
2. Toggle to AI mode
3. **Expected**: Modal appears asking to update dates
4. Options: "Update to next year", "Choose different dates", or "Cancel"

### Test Case 6: No Redundant Context
**Steps**:
1. Toggle to AI mode (session created)
2. Send a message, get response
3. Toggle back to Manual mode
4. Toggle back to AI mode
5. **Expected**: New session created (old one deleted)
6. **Expected**: Fresh context sent (not duplicate)
7. **Expected**: No leaked messages from previous session

## Integration Tests

### Backend Session Creation
**Verify**:
- `POST /api/v1/designer/sessions` with `itineraryId` parameter
- Response includes `sessionId`
- Session loads itinerary and generates summary
- Summary includes mismatch warnings if applicable

### Context Message Flow
**Verify**:
- `sendContextMessage()` is called after session creation
- Context message is NOT visible in chat history
- Only LLM's response appears to user
- Context includes all relevant itinerary details

### Session Cleanup
**Verify**:
- When switching itineraries, old session is deleted
- `DELETE /api/v1/designer/sessions/:sessionId` is called
- New session created for new itinerary
- No context leakage between sessions

## Edge Cases

### 1. No API Key Configured
**Expected**: Error message prompting to add API key in profile

### 2. Session Creation Fails
**Expected**: Error shown, chat disabled, option to retry

### 3. Network Error During Context Send
**Expected**: Error shown, session state cleared, can retry

### 4. Itinerary Changes While Chat Open
**Expected**:
- If segments added/removed via manual edit
- Chat continues with original context
- User can ask "what's currently planned?" to refresh

### 5. Very Long Itinerary (100+ segments)
**Expected**:
- Summary is generated (may be lengthy)
- Context sent successfully
- If session grows too large, compaction kicks in

## Manual Verification Checklist

- [ ] ChatPanel receives `itineraryId` prop when in AI mode
- [ ] Session created with `itineraryId` parameter
- [ ] `sendInitialContext()` builds context from itinerary
- [ ] Context includes user name, dates, destinations, segments
- [ ] LLM greeting acknowledges trip details
- [ ] No duplicate context when toggling modes
- [ ] Old session deleted when switching itineraries
- [ ] Past dates trigger modal warning
- [ ] Mismatch warnings included in context
- [ ] Empty itinerary handled gracefully

## Performance Verification

**Check**:
- Context sent only once per session (not on every message)
- Session creation happens quickly (<500ms)
- Chat appears immediately (no long loading state)
- Streaming response starts within 1-2 seconds

## Acceptance Criteria (from original spec)

- [x] When toggling to AI mode on an itinerary, session auto-initializes
- [x] Trip Designer receives itinerary summary as context
- [x] Mismatch warnings (if any) are included in context
- [x] LLM's first response acknowledges the trip context
- [x] No duplicate context sending on repeated toggles

## Debugging

If greeting doesn't include trip context:

1. **Check browser console** for:
   ```
   [ChatPanel] Sending initial context: ...
   ```

2. **Verify itineraryId prop**:
   - Open DevTools → Components
   - Find ChatPanel component
   - Check props: `itineraryId` should be set

3. **Check network tab**:
   - `POST /api/v1/designer/sessions` → should include `itineraryId`
   - `POST /api/v1/designer/sessions/:id/messages` → context message
   - Check response for session creation

4. **Backend logs**:
   - Check for itinerary summary generation
   - Verify context injection in session creation

## Known Limitations

1. **Context refresh**: If itinerary changes during chat, context is NOT auto-refreshed
   - User must toggle modes or ask "what's currently planned?"

2. **Destination inference**: Only works for common title patterns
   - "Paris Vacation" ✅
   - "Weekend Getaway" ❌ (too generic)

3. **Session persistence**: Sessions are in-memory only
   - Cleared on server restart
   - Not shared across browser tabs
