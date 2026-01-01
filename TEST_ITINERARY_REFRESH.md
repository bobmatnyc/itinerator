# Test Plan: Itinerary UI Refresh After Tool Calls

## Test Scenario 1: Add Hotel
**Setup**: Open an itinerary with 2 segments

**Steps**:
1. Open Trip Designer chat
2. Type: "Add a hotel in Paris for tonight"
3. Wait for tool execution to complete
4. Observe segment count in UI

**Expected Result**:
- UI shows "3 SEGMENTS" without manual reload
- Success indicator appears briefly
- New hotel segment visible in itinerary list

**Pass Criteria**: ✅ UI updates automatically

---

## Test Scenario 2: Add Flight
**Setup**: Open an itinerary with 1 segment

**Steps**:
1. Open Trip Designer chat
2. Type: "Add a flight from LAX to JFK tomorrow at 9am"
3. Wait for tool execution to complete
4. Observe segment count in UI

**Expected Result**:
- UI shows "2 SEGMENTS" without manual reload
- Success indicator appears briefly
- New flight segment visible in itinerary list

**Pass Criteria**: ✅ UI updates automatically

---

## Test Scenario 3: Add Activity
**Setup**: Open an itinerary with 0 segments

**Steps**:
1. Open Trip Designer chat
2. Type: "Add a museum visit tomorrow afternoon"
3. Wait for tool execution to complete
4. Observe segment count in UI

**Expected Result**:
- UI shows "1 SEGMENT" without manual reload
- "Itinerary is currently empty" message disappears
- New activity segment visible in itinerary list

**Pass Criteria**: ✅ UI updates automatically

---

## Test Scenario 4: Multiple Tool Calls in One Message
**Setup**: Open an itinerary with 0 segments

**Steps**:
1. Open Trip Designer chat
2. Type: "Add a hotel for tomorrow night and book a flight for the next morning"
3. Wait for both tool executions to complete
4. Observe segment count in UI

**Expected Result**:
- UI shows "2 SEGMENTS" without manual reload
- Both segments appear in itinerary list
- Success indicator appears briefly after final tool completes

**Pass Criteria**: ✅ UI updates automatically

---

## Test Scenario 5: Delete Segment
**Setup**: Open an itinerary with 3 segments

**Steps**:
1. Open Trip Designer chat
2. Type: "Remove the hotel booking"
3. Wait for tool execution to complete
4. Observe segment count in UI

**Expected Result**:
- UI shows "2 SEGMENTS" without manual reload
- Deleted segment disappears from itinerary list
- Success indicator appears briefly

**Pass Criteria**: ✅ UI updates automatically

---

## Test Scenario 6: Update Segment
**Setup**: Open an itinerary with 1 hotel segment

**Steps**:
1. Open Trip Designer chat
2. Type: "Change the hotel check-in to tomorrow"
3. Wait for tool execution to complete
4. Observe segment details in UI

**Expected Result**:
- Segment count stays the same (1 SEGMENT)
- Hotel segment shows updated check-in date
- Success indicator appears briefly

**Pass Criteria**: ✅ UI updates automatically with new data

---

## Regression Test: Help Agent (No Itinerary)
**Setup**: Navigate to Help page (no itinerary context)

**Steps**:
1. Open Help chat
2. Type: "How do I import a PDF?"
3. Wait for response
4. Observe behavior

**Expected Result**:
- Response appears normally
- No itinerary refresh attempted
- No errors in console

**Pass Criteria**: ✅ Help mode unaffected by fix

---

## Visual Indicators Test
**Setup**: Open any itinerary

**Steps**:
1. Add a segment via Trip Designer
2. Observe UI feedback during refresh

**Expected Result**:
1. "Updating itinerary..." indicator appears immediately
2. Data loads in background (await completes)
3. After 1 second, indicator changes to "Itinerary updated!"
4. Success message disappears after 2 more seconds

**Pass Criteria**: ✅ Visual feedback is clear and smooth

---

## Performance Test
**Setup**: Open an itinerary with 20+ segments

**Steps**:
1. Add a new segment via Trip Designer
2. Measure time from tool completion to UI update
3. Check console for errors

**Expected Result**:
- UI updates within 1-2 seconds
- No console errors
- No UI lag or freezing

**Pass Criteria**: ✅ Refresh is performant even with many segments

---

## Edge Case: Rapid Consecutive Updates
**Setup**: Open an itinerary

**Steps**:
1. Type: "Add 3 hotels for the next 3 nights"
2. Wait for all tool calls to complete
3. Observe UI behavior

**Expected Result**:
- UI updates after each tool call completes
- Final segment count is correct
- No duplicate refresh calls
- No race conditions

**Pass Criteria**: ✅ Handles multiple rapid updates gracefully

---

## Automated Test (Future)
```typescript
// E2E Test with Playwright
test('itinerary refreshes after tool call', async ({ page }) => {
  // Navigate to itinerary
  await page.goto('/itineraries/test-id');

  // Initial state: 2 segments
  await expect(page.locator('[data-testid="segment-count"]')).toHaveText('2 SEGMENTS');

  // Send message to Trip Designer
  await page.fill('[data-testid="chat-input"]', 'Add a hotel in Paris');
  await page.click('[data-testid="chat-send"]');

  // Wait for tool execution and refresh
  await page.waitForSelector('[data-testid="update-success"]');

  // Verify UI updated
  await expect(page.locator('[data-testid="segment-count"]')).toHaveText('3 SEGMENTS');
});
```

---

## Manual Testing Checklist
- [ ] Scenario 1: Add Hotel ✅
- [ ] Scenario 2: Add Flight ✅
- [ ] Scenario 3: Add Activity ✅
- [ ] Scenario 4: Multiple Tool Calls ✅
- [ ] Scenario 5: Delete Segment ✅
- [ ] Scenario 6: Update Segment ✅
- [ ] Regression: Help Agent ✅
- [ ] Visual Indicators ✅
- [ ] Performance Test ✅
- [ ] Edge Case: Rapid Updates ✅

---

## Success Criteria Summary
All tests pass if:
1. ✅ UI automatically refreshes after tool calls
2. ✅ Segment count updates without manual reload
3. ✅ Visual feedback is clear (loading → success)
4. ✅ No regressions in Help mode
5. ✅ Performance is acceptable (<2s refresh)
6. ✅ No console errors during refresh
