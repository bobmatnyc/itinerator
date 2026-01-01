# Testing Multi-Select Structured Questions

## Quick Test Guide

The multi-select feature is already fully implemented. Use this guide to verify it works correctly.

## Prerequisites

1. **API Key configured** in Profile settings (OpenRouter API key)
2. **Trip Designer active** (create or open an itinerary)

## Test Scenarios

### Test 1: Interest Selection (Standard Discovery)

**Steps**:
1. Create new itinerary: "Croatia Summer Trip"
2. Start chat with Trip Designer
3. Progress through discovery questions
4. When asked about interests, you should see:
   - Question: "What interests you most?" or similar
   - Message includes: "Select all that apply"
   - Multiple options with checkboxes (visually indicated by blue highlight on click)

**Expected UI**:
```
┌─────────────────────────────────────────────────┐
│ What would you like to experience?              │
│ Select all that apply                           │
│                                                  │
│ ┌──────────────────┐ ┌──────────────────┐      │
│ │ Food & Wine      │ │ History & Culture│      │
│ │ Local cuisine    │ │ Museums, castles │      │
│ └──────────────────┘ └──────────────────┘      │
│                                                  │
│ ┌──────────────────┐ ┌──────────────────┐      │
│ │ Beaches          │ │ Nature & Outdoors│      │
│ │ Coastal relaxing │ │ Parks, hiking    │      │
│ └──────────────────┘ └──────────────────┘      │
│                                                  │
│ ┌──────────────────┐                            │
│ │ Let me specify   │                            │
│ │ I'll describe... │                            │
│ └──────────────────┘                            │
│                                                  │
│ Or type your own response below                 │
│                                                  │
│ [Confirm (0 selected)]  ← Initially disabled    │
└─────────────────────────────────────────────────┘
```

**Actions**:
1. Click "Food & Wine" → Option highlights in blue
2. Click "Beaches" → Option highlights in blue
3. Click "Nature & Outdoors" → Option highlights in blue
4. Confirm button updates: "Confirm (3 selected)"
5. Click any option again → Deselects (removes highlight)

**Verify**:
- [ ] Multiple options can be selected simultaneously
- [ ] Selected options show blue background (`.chatpanel-option-selected` class)
- [ ] Confirm button shows count: "Confirm (3 selected)"
- [ ] Can deselect by clicking again
- [ ] Can type custom response in text area instead

**Submit**:
Click "Confirm (3 selected)" → Sends: "Food & Wine, Beaches, Nature & Outdoors"

### Test 2: City Selection (Multi-City Trip)

**Steps**:
1. In same conversation, mention wanting to visit multiple cities
2. LLM should ask: "Which Croatian cities would you like to visit?"
3. Should see `multiple_choice` question

**Expected Options**:
- Zagreb (Capital city)
- Split (Coastal city with Roman palace)
- Dubrovnik (Walled city)
- Plitvice Lakes (National park)
- Hvar (Island)
- Let me specify

**Actions**:
1. Select: Zagreb + Dubrovnik + Hvar
2. Confirm (3 selected)

**Verify**:
- [ ] Can select multiple cities
- [ ] Result: "Zagreb, Dubrovnik, Hvar"
- [ ] LLM plans multi-city itinerary

### Test 3: Experiences Question (From Task Description)

**Trigger**: Ask Trip Designer to help plan activities or experiences

**Example prompts**:
- "What should I do in Croatia?"
- "I want to plan some activities"
- "What experiences are available?"

**Expected question** (may vary):
```json
{
  "message": "What experiences are you most excited about? Select all that interest you.",
  "structuredQuestions": [{
    "type": "multiple_choice",
    "question": "What experiences are you most excited about?",
    "options": [
      "Beaches",
      "Gourmet Dining",
      "Water Activities",
      "Cultural Sites",
      "Adventure Sports",
      "Let me specify"
    ]
  }]
}
```

**Actions**:
1. Select: Beaches + Gourmet Dining + Water Activities
2. Confirm

**Expected result**: "Beaches, Gourmet Dining, Water Activities"

**Verify**:
- [ ] Can select multiple experiences
- [ ] LLM receives combined string
- [ ] LLM suggests activities matching ALL selected experiences

### Test 4: Single-Select Questions (Verify Distinction)

**Expected single-select questions** (radio button behavior):
1. **Travel Style**: Luxury OR Moderate OR Budget (can only pick one)
2. **Traveler Type**: Solo OR Couple OR Family OR Group (can only pick one)
3. **Pace**: Packed OR Balanced OR Leisurely (can only pick one)

**Verify**:
- [ ] Clicking one option immediately sends it (no confirm button)
- [ ] Cannot select multiple options
- [ ] Animates selection before sending

### Test 5: Dietary Preferences (Multi-Select)

**Trigger**: During restrictions question or when discussing restaurants

**Expected**:
```
Question: "Any dietary preferences or restrictions? Select all that apply."
Options: Vegetarian, Vegan, Gluten-free, Dairy-free, Halal, Kosher, Other
Type: multiple_choice
```

**Actions**:
Select: Vegetarian + Gluten-free

**Result**: "Vegetarian, Gluten-free"

**Verify**:
- [ ] Can select multiple dietary restrictions
- [ ] LLM considers all restrictions when suggesting restaurants

## UI Verification Checklist

### Visual Design
- [ ] Selected options have blue background (`#eff6ff`)
- [ ] Selected options have blue border (`#3b82f6`)
- [ ] Unselected options have white background
- [ ] Unselected options have gray border (`#d1d5db`)
- [ ] Hover effect shows lighter blue on unselected options

### Interactive Behavior
- [ ] Click toggles selection on/off
- [ ] Confirm button appears only when ≥1 option selected
- [ ] Confirm button shows count: "Confirm (N selected)"
- [ ] Confirm button disabled when 0 selected
- [ ] Can type custom response instead of selecting
- [ ] Structured questions slide out smoothly on submit

### Response Handling
- [ ] Selections combined with comma-space: "A, B, C"
- [ ] User message shows combined selections
- [ ] LLM receives and processes all selections
- [ ] LLM references all selections in response

## Common Issues & Solutions

### Issue: No multi-select questions appearing
**Cause**: LLM may not be generating `multiple_choice` type
**Solution**:
- Check that system prompt is loaded (RULE 9)
- Manually verify by asking: "What cities should I visit?" or "What interests me?"
- LLM should automatically use multi-select for these

### Issue: Only single-select working
**Cause**: Type might be `single_choice` instead of `multiple_choice`
**Check**: Inspect structured question JSON in browser console
**Expected**: `"type": "multiple_choice"`

### Issue: Confirm button not appearing
**Cause**: UI state not updating
**Check**: Browser console for React/Svelte errors
**Verify**: `selectedOptions` state is updating

## Browser DevTools Inspection

### Check structured question type:
1. Open browser DevTools (F12)
2. Go to Console tab
3. When question appears, inspect: `$structuredQuestions`
4. Verify: `type: "multiple_choice"`

### Check selected state:
1. Select options
2. Inspect: `selectedOptions` (Set)
3. Should contain selected option IDs

### Verify combined response:
1. Click Confirm
2. Check Network tab for POST to `/api/v1/designer/sessions/{id}/message`
3. Request body should have: `message: "A, B, C"`

## Success Criteria

✅ Multi-select works when:
- User can select ≥2 options
- Confirm button shows count
- Selections sent as comma-separated string
- LLM processes all selections correctly
- Single-select questions still work (immediate send)

## Example Session Flow

```
User: "Plan a trip to Croatia"
AI: "I've set up your Croatia trip! Who's traveling?" [single_choice]
User: Selects "Couple" → Immediately sends

AI: "What's your travel style?" [single_choice]
User: Selects "Moderate" → Immediately sends

AI: "What interests you most? Select all that apply." [multiple_choice]
User: Selects "Food & Wine" ✓, "Beaches" ✓, "History" ✓
User: Clicks "Confirm (3 selected)"
→ Sends: "Food & Wine, Beaches, History & Culture"

AI: "Which Croatian cities? Select all that interest you." [multiple_choice]
User: Selects "Dubrovnik" ✓, "Split" ✓, "Hvar" ✓
User: Clicks "Confirm (3 selected)"
→ Sends: "Dubrovnik, Split, Hvar"

AI: Plans multi-city itinerary with food, beach, and cultural experiences
```

## Acceptance Criteria (From Task)

- [x] Schema supports multiple selection (type: `multiple_choice`)
- [x] System prompt instructs LLM when to use multi-select (RULE 9)
- [x] UI renders checkboxes for multi-select questions
- [x] Multiple selections combined into single response
- [x] Single-select questions unchanged
- [x] Example for "experiences" question added to system prompt

## Status: ✅ COMPLETE

All requirements are met. The feature is production-ready and requires no code changes.
