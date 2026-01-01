# Trip Designer: One Question at a Time Fix

## Problem

The Trip Designer AI was responding with walls of text containing multiple questions instead of asking ONE focused question at a time with clickable choices.

**Bad behavior example:**
```
"I'd be happy to help you plan a week-long trip! However, I need a bit more information...
- Where are you thinking of going?
- What type of experience are you looking for?
- Any constraints on timing?
- Do you prefer to travel during peak season or shoulder season?"
```

**Desired behavior:**
```
"I'd love to help you plan a week-long trip! Where are you thinking of going?"

[🏖️ Beach destination] [🏙️ City exploration] [🏔️ Mountains/Nature] [🎭 Cultural sites] [Let me specify]
```

## Root Cause

The system prompts had a rule about "one question at a time" but it wasn't enforced strongly enough. The AI was:
1. Listing multiple questions in the message text
2. Not using the `structuredQuestions` format consistently
3. Not including an "Other" option for user flexibility

## Solution

### Files Modified

1. **`/Users/masa/Projects/itinerator/src/prompts/trip-designer/system.md`**
   - Strengthened RULE 2 with explicit forbidden patterns
   - Added visual examples showing wrong vs. right patterns
   - Added requirement for "Other" option in single_choice questions
   - Added example of perfect response structure in RULE 4
   - Expanded "CRITICAL: ONE QUESTION AT A TIME" section with forbidden/correct patterns

2. **`/Users/masa/Projects/itinerator/src/prompts/trip-designer/system-minimal.md`**
   - Strengthened section 5 (One Question at a Time)
   - Added explicit wrong/right examples
   - Made it clear: EXACTLY ONE question, NO EXCEPTIONS

### Key Changes

#### RULE 2: Enhanced
```markdown
### RULE 2: ONE QUESTION AT A TIME - ALWAYS ⚠️ CRITICAL
- **EXACTLY ONE** structured question per response - NO EXCEPTIONS
- The `structuredQuestions` array MUST contain exactly 1 question (not 0, not 2+)
- NEVER list multiple questions in your message text
- NEVER ask compound questions ("Who's traveling and what's your budget?")
- WRONG: "A few questions: 1) Who's traveling? 2) What's your budget?"
- RIGHT: Ask about travelers, wait for response, THEN ask about budget in next turn
```

#### RULE 4: Added Perfect Example
```json
{
  "message": "Portugal in January sounds wonderful! Let's start planning. Who will be on this trip?",
  "structuredQuestions": [{
    "id": "travelers",
    "type": "single_choice",
    "question": "Who will be traveling?",
    "options": [
      {"id": "solo", "label": "Solo", "description": "Just me"},
      {"id": "couple", "label": "Couple", "description": "Traveling with partner"},
      {"id": "family", "label": "Family", "description": "With kids"},
      {"id": "group", "label": "Friends", "description": "Group of adults"}
    ]
  }]
}
```

#### Discovery Phase: Added "Other" Option Guidance
```markdown
**IMPORTANT**: For single_choice questions with limited options, ALWAYS include a final option like:
- "Let me specify" / "Other - I'll type it" / "Something else"
- When user clicks this option, follow up with a `text` type question to get their custom input
- This gives users flexibility while still providing guided options
```

#### New Section: CRITICAL: ONE QUESTION AT A TIME
Added explicit forbidden patterns:
- ❌ "I'd be happy to help! However, I need more information: Where? When? Who?"
- ❌ "A few questions to get started: 1) Destination? 2) Dates? 3) Budget?"
- ❌ "To plan your trip I need to know your travel style, budget, and interests"
- ❌ ANY response with multiple questions in the message text
- ❌ ANY response with zero or 2+ questions in `structuredQuestions` array

And correct pattern:
- ✅ Message: 1-2 sentence conversational text
- ✅ `structuredQuestions`: Array with EXACTLY ONE question object
- ✅ Wait for user's response before asking next question
- ✅ Progress through discovery one question at a time

#### Enhanced Examples Section
Added explicit "wall of text" bad example:
```json
{
  "message": "I'd love to help plan your trip! However, I need a bit more information to create the perfect itinerary. First, who will be traveling? Second, what's your budget range? Third, what type of experiences interest you most? And finally, do you have any dietary restrictions or mobility concerns?",
  "structuredQuestions": []
}
```

With clear explanation of why it's wrong:
- ❌ Multiple questions in message text
- ❌ Empty `structuredQuestions` array
- ❌ Overwhelming the user
- ❌ No clickable options

## Expected Behavior After Fix

### First Interaction (New Itinerary)
**User**: "I want to plan a week-long trip to Portugal in January"

**AI Response**:
```json
{
  "message": "Portugal in January sounds wonderful! Let's plan the perfect trip. First, who's traveling?",
  "structuredQuestions": [{
    "id": "travelers",
    "type": "single_choice",
    "question": "Who will be on this trip?",
    "options": [
      {"id": "solo", "label": "Solo", "description": "Just me"},
      {"id": "couple", "label": "Couple", "description": "Traveling with partner"},
      {"id": "family", "label": "Family", "description": "With kids"},
      {"id": "group", "label": "Friends", "description": "Group of adults"},
      {"id": "other", "label": "Let me specify", "description": "I'll type it"}
    ]
  }]
}
```

**User clicks**: "Couple"

**AI Response**:
```json
{
  "message": "Great! A couple's trip to Portugal. What's your travel style?",
  "structuredQuestions": [{
    "id": "travel_style",
    "type": "single_choice",
    "question": "How do you like to travel?",
    "options": [
      {"id": "luxury", "label": "Luxury", "description": "5-star hotels, fine dining"},
      {"id": "moderate", "label": "Moderate", "description": "Comfortable and nice"},
      {"id": "budget", "label": "Budget-Friendly", "description": "Smart spending"},
      {"id": "backpacker", "label": "Backpacker", "description": "Hostels, local transport"},
      {"id": "other", "label": "Let me specify", "description": "I'll type it"}
    ]
  }]
}
```

And so on... ONE question at a time, progressive discovery.

## UI Support

The UI (`ChatPanel.svelte`) already fully supports this pattern:
- Renders `structuredQuestions` as clickable buttons
- Supports all question types: `single_choice`, `multiple_choice`, `scale`, `date_range`, `text`
- Shows loading states and animations
- Handles user selections and sends responses back

No UI changes needed - the fix is entirely in the AI prompts.

## Testing

After deploying this fix, test with:
1. **New itinerary**: "Plan a week-long trip to Japan"
   - Should ask ONE question about travelers
   - After answer, should ask ONE question about style
   - Should never list multiple questions

2. **Existing itinerary**: Open an itinerary with existing content
   - Should acknowledge what exists
   - Should ask ONE question about what user wants help with

3. **Out-of-order user responses**: "I'm a couple traveling luxury style to Japan for 2 weeks"
   - Should acknowledge all provided info
   - Should skip those questions
   - Should ask ONE next question (e.g., interests)

## Rollout

No deployment needed beyond updating the prompt files. Changes take effect immediately on next conversation.

## Metrics to Monitor

- User engagement with structured questions (button click rate)
- Average questions asked before trip planning starts
- User feedback on conversation flow
- Completion rate of discovery phase

---

**Date**: 2025-12-22
**Modified Files**:
- `/src/prompts/trip-designer/system.md`
- `/src/prompts/trip-designer/system-minimal.md`
