# Testing Guide: Hotel Tool Call Enforcement

## Quick Test Scenarios

### Test 1: Simple Hotel Mention
**Input:**
```
"We're staying at Hotel L'Esplanade"
```

**Expected Behavior:**
1. AI calls `get_itinerary()` to retrieve trip dates
2. AI calls `add_hotel()` with:
   - property.name: "Hotel L'Esplanade"
   - checkInDate and checkOutDate from trip (or asks user if not available)
3. AI responds: "I've added Hotel L'Esplanade to your itinerary..."

**Verification:**
- [ ] Tool call for `get_itinerary` appears in logs
- [ ] Tool call for `add_hotel` appears in logs
- [ ] Hotel segment added to itinerary JSON
- [ ] Dates are valid (not null or placeholder)

---

### Test 2: Airbnb Mention
**Input:**
```
"We booked an Airbnb in downtown Portland"
```

**Expected Behavior:**
1. AI calls `get_itinerary()`
2. AI calls `add_hotel()` with:
   - property.name: "Airbnb" or "Downtown Portland Airbnb"
   - location.city: "Portland"
   - dates from trip or asks user
3. AI acknowledges the addition

**Verification:**
- [ ] Tool called despite "Airbnb" instead of "hotel"
- [ ] Location parsed correctly
- [ ] Accommodation segment created

---

### Test 3: Casual "Staying At" Phrase
**Input:**
```
"staying at l'esplanade"
```

**Expected Behavior:**
- AI still recognizes this as accommodation mention
- Tool call triggered
- Property name captured

**Verification:**
- [ ] Lowercase + informal phrasing still triggers tool
- [ ] Hotel added to itinerary

---

### Test 4: No Trip Dates Yet
**Input:**
```
User has NOT provided trip dates
User: "We're staying at the Ritz Carlton"
```

**Expected Behavior:**
1. AI calls `get_itinerary()` → finds no dates
2. AI calls `add_hotel()` (might fail or need dates)
3. AI asks: "What are your check-in and check-out dates?"

**Verification:**
- [ ] AI recognizes missing dates
- [ ] AI explicitly asks for dates
- [ ] Does NOT use null or placeholder dates

---

### Test 5: Multiple Hotels (Multi-City Trip)
**Input:**
```
Trip: 7 days
User: "3 nights in Zagreb at Hotel Esplanade, then 4 nights in Split at Hotel Park"
```

**Expected Behavior:**
1. AI calls `get_itinerary()` to get trip dates
2. AI calls `add_hotel()` for Hotel Esplanade (first 3 nights)
3. AI calls `add_hotel()` for Hotel Park (next 4 nights)
4. No gaps between hotels

**Verification:**
- [ ] Both hotels added
- [ ] Sequential dates (no overlap or gap)
- [ ] Total nights = trip duration
- [ ] Each hotel has correct night count

---

## How to Test

### Option 1: Manual Testing via Web UI
1. Start the viewer: `cd viewer-svelte && npm run dev`
2. Open http://localhost:5176
3. Create a new trip or open existing
4. Enter test phrases in chat
5. Check browser console for tool calls
6. Verify itinerary JSON updates

### Option 2: Check Conversation Logs
1. Look in viewer logs for tool invocations
2. Search for `add_hotel` tool calls
3. Verify they occur BEFORE text responses

### Option 3: Inspect Itinerary JSON
1. Open `data/itineraries/[id].json`
2. Check `segments` array
3. Verify accommodation segments exist with:
   - Valid property.name
   - Valid location
   - Valid checkInDate/checkOutDate (YYYY-MM-DD format)
   - No null values

---

## Red Flags (Failures)

### 🚨 Failure Mode 1: Verbal Only Response
```
User: "We're staying at Hotel X"
AI: "Great choice! Hotel X is wonderful..."
[NO TOOL CALL]
```
**Problem**: AI acknowledged but didn't call tool
**Fix**: Verify system prompt is loaded correctly

### 🚨 Failure Mode 2: Null Dates
```json
{
  "type": "accommodation",
  "checkInDate": null,
  "checkOutDate": null
}
```
**Problem**: Tool called but dates not populated
**Fix**: Ensure `get_itinerary()` called first or user asked for dates

### 🚨 Failure Mode 3: Wrong Segment Type
```json
{
  "type": "activity",  // ❌ Should be "accommodation"
  "name": "Hotel L'Esplanade"
}
```
**Problem**: AI used wrong tool (e.g., add_activity instead of add_hotel)
**Fix**: Check tool description emphasis

### 🚨 Failure Mode 4: Tool Call After Response
```
1. AI responds: "I've noted Hotel X..."
2. AI calls add_hotel()
```
**Problem**: Tool call happened but AFTER verbal response
**Fix**: Verify prompt emphasizes "tool call FIRST, then respond"

---

## Success Metrics

After testing, verify:

- ✅ 100% of accommodation mentions → `add_hotel` tool call
- ✅ Tool call happens BEFORE verbal acknowledgment
- ✅ All accommodation segments have valid dates
- ✅ No null or placeholder values
- ✅ Dates retrieved from trip when available
- ✅ User asked for dates when trip has none
- ✅ Multi-hotel scenarios handled correctly

---

## Debugging Tips

### Enable Verbose Logging
Check Trip Designer service logs for:
```
Tool call: add_hotel
Arguments: { property: {...}, location: {...}, ... }
```

### Check System Prompt Loading
Verify that `src/prompts/trip-designer/system.md` is being loaded:
```bash
grep "ACCOMMODATION MENTIONED" src/prompts/trip-designer/system.md
```

### Inspect Tool Definition
Verify tool description has "REQUIRED CALL":
```bash
grep "REQUIRED CALL" src/services/trip-designer/tools.ts
```

### Monitor OpenRouter API Calls
Check that tools are being sent to OpenRouter with updated descriptions.

---

## Rollback Plan

If the fix causes issues:

1. **Revert system prompt:**
```bash
git checkout HEAD~1 src/prompts/trip-designer/system.md
```

2. **Revert tool description:**
```bash
git checkout HEAD~1 src/services/trip-designer/tools.ts
```

3. **Rebuild:**
```bash
npm run build
```

---

## Next Steps After Validation

If tests pass:
1. ✅ Close the GitHub issue
2. ✅ Update changelog
3. ✅ Consider applying same pattern to other tools:
   - `add_flight` (when user mentions flights)
   - `add_activity` (when user mentions activities)
   - `add_traveler` (when user mentions companions)

If tests fail:
1. ❌ Document failure mode
2. ❌ Adjust prompt language (make it even stronger)
3. ❌ Consider adding explicit examples to tool parameters

---

**Testing Checklist:**
- [ ] Test 1: Simple hotel mention ✓
- [ ] Test 2: Airbnb mention ✓
- [ ] Test 3: Casual "staying at" ✓
- [ ] Test 4: No trip dates ✓
- [ ] Test 5: Multiple hotels ✓
- [ ] No red flags observed ✓
- [ ] Success metrics met ✓

**Status**: Ready for Testing
**Priority**: High (Core Functionality)
