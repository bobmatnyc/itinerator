# Traveler Persona Test Results - Post Prompt Fix

**Test Date:** 2026-01-01
**Test Command:** `npx tsx tests/e2e/traveler-persona-agent.ts --personas family,adventure --max-turns 5`
**Model:** anthropic/claude-sonnet-4

## Summary

The prompt fix did **NOT solve the tool calling problem**. While we saw some `add_activity` calls in the backpacker persona, the critical booking tools (`add_flight`, `add_hotel`) are still not being used consistently.

## Test Results by Persona

### 1. Alex the Backpacker (Solo) - FAIL
**Score:** 45/100
**Duration:** 158.17s
**Segments Created:** 4 (expected ≥10)

**Tools Called:**
- ✅ `add_activity` (8 calls) - **This is progress!**
- ❌ `add_flight` - **NEVER CALLED**
- ❌ `add_hotel` - **NEVER CALLED**
- ✅ `update_itinerary`, `update_preferences` - Called multiple times

**Issues:**
- Missing FLIGHT and HOTEL segments
- Missing keyword: "hostel"
- Model is calling `add_activity` but not booking transportation or accommodation

**Agent Behavior:**
> The agent talked extensively about booking hostels ("Let's book me into those hostels ASAP - especially Lub d Bangkok Siam") but never actually called `add_hotel` tool.

---

### 2. Sarah & Michael (Couple) - FAIL
**Score:** 20/100
**Duration:** 124.54s
**Segments Created:** 0 (expected ≥8)

**Tools Called:**
- ❌ `add_flight` - **NEVER CALLED**
- ❌ `add_hotel` - **NEVER CALLED**
- ❌ `add_activity` - **NEVER CALLED**
- ✅ `update_itinerary`, `add_traveler` - Called
- ❌ `search_web` - Called but no bookings made

**Issues:**
- **ZERO segments created**
- Missing all expected segment types
- Missing keywords: "wine", "sunset"

**Agent Behavior:**
> Agent discussed hotels ("Please book Le Sirenuse in Positano and Belmond Hotel Caruso in Ravello") but never called booking tools.

---

### 3. The Johnson Family (Family) - FAIL
**Score:** 20/100
**Duration:** 140.33s
**Segments Created:** 0 (expected ≥6)

**Tools Called:**
- ❌ `add_flight` - **NEVER CALLED**
- ❌ `add_hotel` - **NEVER CALLED**
- ❌ `add_activity` - **NEVER CALLED**
- ✅ `update_itinerary`, `add_traveler` - Called extensively

**Issues:**
- **ZERO segments created**
- Missing keywords: "Disney", "Universal", "pool", "resort"

---

### 4. Jennifer Chen (Business) - FAIL
**Score:** 20/100
**Duration:** 119.55s
**Segments Created:** 0 (expected ≥5)

**Tools Called:**
- ✅ `search_flights` - Called 3 times ✨
- ❌ `add_flight` - **NEVER CALLED despite search results**
- ❌ `add_hotel` - **NEVER CALLED**
- ✅ `update_itinerary` - Called

**Issues:**
- **ZERO segments created**
- Missing keywords: "wifi", "central"

**Agent Behavior:**
> Agent searched for flights but never booked them despite user asking to "book those ASAP"

---

### 5. The Hendersons (Senior) - INCOMPLETE
Test was still running when snapshot was taken.

**Tools Called (partial):**
- ✅ `add_traveler` - Called

## Key Findings

### What's Working ✅
1. **`add_activity` is being called** (8 times in backpacker scenario)
2. **`search_flights` is working** (business persona)
3. **`update_itinerary` and `add_traveler` work** consistently
4. **Agent understands context** and discusses bookings correctly

### What's Broken ❌
1. **`add_flight` is NEVER called** even when user explicitly requests booking
2. **`add_hotel` is NEVER called** even when user requests specific hotels
3. **Search → Book gap:** Agent searches for flights but doesn't book them
4. **Talk vs Action:** Agent discusses bookings but doesn't execute them

## Root Cause Analysis

The prompt fix **did NOT solve the problem** because:

1. **The issue is NOT with `add_activity`** - this tool works fine
2. **The issue IS with `add_flight` and `add_hotel`** - these are never called
3. **Pattern suggests tool definition problem**, not prompt problem

## Evidence: Talk vs Action

| Persona | User Said | Agent Response | Tool Called | Segment Created |
|---------|-----------|----------------|-------------|-----------------|
| Backpacker | "book me into those hostels" | "I'll lock in those bookings" | `update_itinerary` | ❌ NO |
| Couple | "book Le Sirenuse in Positano" | "I'll start by updating..." | `update_itinerary` | ❌ NO |
| Business | "Can you start by showing me flight options? I'd like to book those ASAP" | *searches flights* | `search_flights` | ❌ NO |
| Family | *explicitly requests Disney bookings* | *discusses itinerary* | `update_itinerary` | ❌ NO |

## Next Steps

### Hypothesis
The `add_flight` and `add_hotel` tool definitions may be:
1. **Missing from the tool schema** provided to the model
2. **Malformed in the tool definition**
3. **Shadowed by other tools** with similar names

### Recommended Actions

1. **Verify tool availability:**
   ```bash
   # Check what tools are actually being sent to the model
   grep -r "add_flight\|add_hotel" src/services/trip-designer/
   ```

2. **Compare tool definitions:**
   - Why does `add_activity` work but `add_hotel` doesn't?
   - Are parameter requirements too strict?

3. **Check tool registration:**
   - Are `add_flight` and `add_hotel` properly registered?
   - Are they in the same tool array as `add_activity`?

4. **Test tool calling directly:**
   ```typescript
   // Minimal test: can the model call add_hotel at all?
   const response = await chat({
     messages: [{
       role: "user",
       content: "Book me a hotel called 'Test Hotel' in Tokyo for 2 nights starting 2025-09-01"
     }],
     tools: [addHotelTool, addFlightTool, addActivityTool]
   });
   ```

## Conclusion

**The prompt fix helped with `add_activity` but did not solve the core problem.**

The model is actively **choosing not to use** `add_flight` and `add_hotel` tools even when:
- Users explicitly request bookings
- The conversation context is perfect
- Other tools (`search_flights`, `add_activity`) work fine

This strongly suggests a **tool definition or registration issue**, not a prompt issue.
