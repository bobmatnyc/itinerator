# Manual Test Plan - Layout & Mismatch Detection

## Prerequisites
1. Start dev server: `cd viewer-svelte && npm run dev`
2. Open browser to `http://localhost:5176`
3. Open browser console (F12 / Cmd+Opt+I)

---

## Test 1: Layout - List-Only View

**Steps:**
1. Navigate to `/itineraries`
2. Observe the layout

**Expected:**
- [ ] 2 panes visible:
  - Left pane: Itinerary list (320px width)
  - Right pane: Empty state message ("Select an itinerary")
- [ ] Header at top with "My Itineraries" title
- [ ] "New" button in header
- [ ] No chat panel visible

**Result:** ✅ / ❌

---

## Test 2: Layout - Detail View (3 Panes)

**Steps:**
1. From `/itineraries`, click any itinerary
2. Observe the layout

**Expected:**
- [ ] 3 panes visible:
  - Pane 1: Itinerary list (280px width)
  - Pane 2: Chat panel (resizable, default 350px)
  - Pane 3: Detail content
- [ ] Header at top
- [ ] Selected itinerary highlighted in list
- [ ] Resize handle between chat and content panes

**Result:** ✅ / ❌

---

## Test 3: Layout - Manual Edit Mode (2 Panes)

**Steps:**
1. From itinerary detail page
2. Toggle "Edit Mode" to "Manual"
3. Observe the layout

**Expected:**
- [ ] 2 panes visible:
  - Pane 1: Itinerary list (280px width)
  - Pane 2: Detail content (chat panel hidden)
- [ ] No chat panel
- [ ] No resize handle

**Result:** ✅ / ❌

---

## Test 4: Layout - Chat Resize

**Steps:**
1. From itinerary detail page (AI edit mode)
2. Click and drag the resize handle between chat and content
3. Try to resize below 250px
4. Try to resize above 600px

**Expected:**
- [ ] Resize handle responds to drag
- [ ] Width changes smoothly
- [ ] Minimum width enforced: 250px
- [ ] Maximum width enforced: 600px
- [ ] Cursor changes to `col-resize` on hover

**Result:** ✅ / ❌

---

## Test 5: Mismatch Detection - Console Logs

**Steps:**
1. Navigate to St. Maarten itinerary:
   - Find "New York Winter Getaway" in the list
   - ID: `43fe5ca6-2f12-4f7e-9a05-55936a70f493`
2. Open browser console
3. Type a message in chat: "What's this trip about?"
4. Send the message
5. Check console logs BEFORE LLM responds

**Expected Console Output:**
```
[summarizeItinerary] Title: New York Winter Getaway
[summarizeItinerary] Mismatch result: {
  "hasMismatch": true,
  "titleMentions": "New York",
  "actualDestination": "St. Maarten",
  "suggestedTitle": "St. Maarten Winter Getaway",
  "explanation": "Title mentions \"New York\" (your departure city) but you're actually traveling to \"St. Maarten\". This often happens when importing confirmation emails sent from the departure city."
}
[Trip Designer] Building context for itinerary: 43fe5ca6-2f12-4f7e-9a05-55936a70f493
[Trip Designer] Title: New York Winter Getaway
[Trip Designer] Summary length: 800+ (approximate)
[Trip Designer] Summary preview: ⚠️ **TITLE/DESTINATION MISMATCH DETECTED**
- Current title: "New York Winter Getaway"
- Title mentions: "New York" (departure city)
- Actual destination: "St. Maarten"
...
```

**Checklist:**
- [ ] `[summarizeItinerary]` logs appear
- [ ] Mismatch result shows `hasMismatch: true`
- [ ] Title mentions "New York"
- [ ] Actual destination is "St. Maarten"
- [ ] Summary preview starts with ⚠️ warning

**Result:** ✅ / ❌

---

## Test 6: Mismatch Detection - LLM Response

**Steps:**
1. After sending message in Test 5
2. Wait for LLM response
3. Read the response carefully

**Expected LLM Behavior:**
The LLM should:
- [ ] Acknowledge the title/destination mismatch
- [ ] Mention that title says "New York" but destination is "St. Maarten"
- [ ] Offer to update the title
- [ ] Suggest something like "St. Maarten Winter Getaway"

**Example Good Response:**
> "I notice there's a mismatch in your itinerary title. It says 'New York Winter Getaway' but you're actually traveling to St. Maarten! This often happens when importing emails. Would you like me to update the title to 'St. Maarten Winter Getaway' to better reflect your actual destination?"

**Example Bad Response:**
> "This looks like a great winter getaway to New York! Let me help you plan..."

**Result:** ✅ / ❌

---

## Test 7: Mismatch Detection - No False Positives

**Steps:**
1. Navigate to "Family Adventure in Moab" itinerary
   - Title correctly mentions "Moab"
   - Flights: New York → Salt Lake City (round trip)
   - Destination: Moab, Utah
2. Send a chat message: "Tell me about this trip"
3. Check console logs

**Expected:**
- [ ] Console shows `hasMismatch: false`
- [ ] NO warning in summary preview
- [ ] LLM does NOT mention title mismatch
- [ ] LLM correctly identifies trip as Moab adventure

**Result:** ✅ / ❌

---

## Test 8: Navigation - List Selection

**Steps:**
1. From detail page, click different itinerary in list
2. Observe URL change
3. Observe detail content update

**Expected:**
- [ ] URL changes to `/itineraries/{new-id}`
- [ ] Detail content updates to show new itinerary
- [ ] Chat history clears (new session)
- [ ] Selected item in list updates

**Result:** ✅ / ❌

---

## Test 9: Navigation - Delete from List

**Steps:**
1. From detail page
2. Click delete (trash icon) on a DIFFERENT itinerary in the list
3. Confirm deletion

**Expected:**
- [ ] Confirmation modal appears
- [ ] After confirm, itinerary removed from list
- [ ] Current detail page STAYS on current itinerary
- [ ] Toast notification shows "Itinerary deleted"

**Result:** ✅ / ❌

---

## Test 10: Navigation - Delete Current Itinerary

**Steps:**
1. From detail page
2. Click "Delete" button in detail header
3. Confirm deletion

**Expected:**
- [ ] Confirmation modal appears
- [ ] After confirm, redirects to `/itineraries`
- [ ] List view shown (no detail)
- [ ] Deleted itinerary removed from list
- [ ] Toast notification shows "Itinerary deleted"

**Result:** ✅ / ❌

---

## Debugging Tips

### If Layout Shows Wrong Number of Panes:
1. Check browser console for errors
2. Inspect DOM to see which components are rendering
3. Verify `selectedId` value in itineraries layout
4. Check `showChatSidebar` value in detail page

### If Mismatch Detection Not Working:
1. Verify console logs appear at all
2. Check if summary is being generated (`summarizeItinerary` called)
3. Inspect full summary text (copy from console)
4. Check if warning is at the TOP of the summary
5. Verify system prompt includes the summary

### If Mismatch Still Not Acknowledged:
If logs show mismatch detected but LLM doesn't acknowledge:

**Option A: Make warning more prominent**
Move warning to separate section at top of system prompt:
```markdown
# ⚠️ CRITICAL ALERT

TITLE/DESTINATION MISMATCH DETECTED:
- Current title: "New York Winter Getaway"
- Title mentions: "New York" (departure city)
- Actual destination: "St. Maarten"

YOU MUST acknowledge this mismatch in your first response and offer to fix the title.
```

**Option B: Include in user message**
Instead of system prompt, inject warning into user message:
```typescript
const userMessage = `
⚠️ IMPORTANT: The itinerary title mentions "New York" but the actual destination is "St. Maarten". Please acknowledge this mismatch.

User's question: ${originalMessage}
`;
```

**Option C: Reduce context size**
Trim other context to ensure warning isn't truncated:
- Remove verbose segment details
- Shorten booking inference section
- Focus only on critical info

---

## Success Criteria

All tests should pass (✅) for the fix to be considered complete:

**Layout Tests:** Test 1-4 ✅
**Mismatch Detection Tests:** Test 5-7 ✅
**Navigation Tests:** Test 8-10 ✅

---

## Next Steps After Testing

1. If all tests pass → Commit changes
2. If Test 5 passes but Test 6 fails → Implement Option A, B, or C above
3. If Test 5 fails → Debug summarizer and Trip Designer service
4. If layout tests fail → Review conditional rendering logic in layouts

---

## Test Results Summary

Date: _____________
Tester: _____________

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| 1. List-Only View | ⬜ | |
| 2. Detail View (3 Panes) | ⬜ | |
| 3. Manual Edit Mode | ⬜ | |
| 4. Chat Resize | ⬜ | |
| 5. Mismatch Logs | ⬜ | |
| 6. Mismatch LLM Response | ⬜ | |
| 7. No False Positives | ⬜ | |
| 8. List Selection | ⬜ | |
| 9. Delete from List | ⬜ | |
| 10. Delete Current | ⬜ | |

**Overall Result:** ⬜ PASS / ⬜ FAIL

**Issues Found:**
-
-
-

**Recommended Actions:**
-
-
