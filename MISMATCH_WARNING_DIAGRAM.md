# Mismatch Warning - Before/After Visual

## BEFORE: Warning Buried in Summary

```
┌─────────────────────────────────────────────────────────────┐
│ Trip Designer Context (System Message)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ The user is working on an existing itinerary.               │
│ Here's the current state:                                   │
│                                                              │
│ ⚠️ **TITLE/DESTINATION MISMATCH DETECTED**       ← Buried   │
│ - Current title: "New York Winter Getaway"                  │
│ - Title mentions: "New York" (departure city)               │
│ - Actual destination: "St. Maarten"                         │
│ ...                                                          │
│                                                              │
│ **Trip**: New York Winter Getaway                           │
│ **Dates**: Jan 15-22, 2025 (8 days)                        │
│ **Travelers**: John Doe                                     │
│ **Destinations**: St. Maarten                               │
│                                                              │
│ **Segments**: 2 flights, 1 hotel (3 total)                 │
│ - Flight: Jan 15 (JFK → SXM)                               │
│ - Hotel: Jan 15 (7 nights, L'Esplanade)                    │
│ - Flight: Jan 22 (SXM → JFK)                               │
│                                                              │
│ **⚠️ EXISTING BOOKINGS** (use to infer preferences):        │
│ - 🏨 HOTEL: L'Esplanade in St. Maarten → LUXURY style      │
│ - ✈️ FLIGHT: JFK → SXM (Economy) → ECONOMY style           │
│                                                              │
│ Important: Since the itinerary already has content...       │
│                                                              │
│ CRITICAL: If the summary shows "⚠️ EXISTING BOOKINGS"       │
│ with luxury/premium properties...                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
    LLM sees many "CRITICAL" sections
    Mismatch warning gets lost in noise
           │
           ▼
    ❌ LLM ignores the mismatch
```

## AFTER: Warning at Top, Impossible to Ignore

```
┌─────────────────────────────────────────────────────────────┐
│ Trip Designer Context (System Message)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ## 🚨🚨🚨 STOP - CRITICAL DATA CONFLICT DETECTED 🚨🚨🚨      │
│                                                              │
│ **YOU MUST ADDRESS THIS ISSUE BEFORE ANYTHING ELSE**        │
│                                                              │
│ **PROBLEM**: The itinerary title does NOT match the         │
│ actual travel destination.                                  │
│                                                              │
│ **Current Title**: "New York Winter Getaway"                │
│ **Title Mentions**: "New York" ← DEPARTURE city             │
│ **Actual Destination**: "St. Maarten" ← Where they're GOING│
│                                                              │
│ **WHY THIS HAPPENED**: This commonly occurs when importing  │
│ confirmation emails sent from the departure city.           │
│                                                              │
│ **SUGGESTED FIX**: "St. Maarten Winter Getaway"             │
│                                                              │
│ **MANDATORY ACTION - YOU MUST DO THIS IN YOUR FIRST         │
│ RESPONSE**:                                                 │
│ 1. ⚠️ Point out this title/destination mismatch            │
│ 2. ⚠️ Explain title mentions departure city                │
│ 3. ⚠️ Ask if they want to update the title                 │
│ 4. ⚠️ DO NOT proceed until this is acknowledged            │
│                                                              │
│ **DO NOT IGNORE THIS WARNING** - The user needs to know.   │
│                                                              │
│ ───────────────────────────────────────────────────────────  │
│                                                              │
│ The user is working on an existing itinerary.               │
│ Here's the current state:                                   │
│                                                              │
│ **Trip**: New York Winter Getaway                           │
│ **Dates**: Jan 15-22, 2025 (8 days)                        │
│ **Travelers**: John Doe                                     │
│ **Destinations**: St. Maarten                               │
│                                                              │
│ **Segments**: 2 flights, 1 hotel (3 total)                 │
│ - Flight: Jan 15 (JFK → SXM)                               │
│ - Hotel: Jan 15 (7 nights, L'Esplanade)                    │
│ - Flight: Jan 22 (SXM → JFK)                               │
│                                                              │
│ **⚠️ EXISTING BOOKINGS** (use to infer preferences):        │
│ - 🏨 HOTEL: L'Esplanade in St. Maarten → LUXURY style      │
│ - ✈️ FLIGHT: JFK → SXM (Economy) → ECONOMY style           │
│                                                              │
│ Important: Since the itinerary already has content...       │
│                                                              │
│ CRITICAL: If the summary shows "⚠️ EXISTING BOOKINGS"       │
│ with luxury/premium properties...                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
    LLM sees warning FIRST
    Strong language + explicit instructions
           │
           ▼
    ✅ LLM acknowledges mismatch in first response
```

## Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Position** | Buried in summary | At the very top |
| **Language** | "⚠️ MISMATCH DETECTED" | "🚨🚨🚨 STOP - CRITICAL DATA CONFLICT" |
| **Instructions** | "ACTION REQUIRED: You should..." | "MANDATORY ACTION - YOU MUST DO THIS IN YOUR FIRST RESPONSE" |
| **Visibility** | Mixed with other info | Separate section with separator |
| **Emphasis** | One warning emoji | Triple fire emojis + ALL CAPS |
| **Explicitness** | General suggestion | Numbered mandatory steps |

## Context Flow

### Before
```
Context Message
├── Intro
├── Summary
│   ├── ⚠️ Mismatch (hidden here)
│   ├── Trip details
│   ├── Segments
│   └── ⚠️ Existing bookings
└── Important notes
    └── CRITICAL: Luxury inference
```

### After
```
Context Message
├── 🚨🚨🚨 MISMATCH WARNING (TOP PRIORITY)
│   ├── YOU MUST ADDRESS THIS FIRST
│   ├── Clear problem explanation
│   ├── Why it happened
│   └── MANDATORY numbered actions
├── ─────────────────────
├── Intro
├── Summary
│   ├── Trip details
│   ├── Segments
│   └── ⚠️ Existing bookings
└── Important notes
    └── CRITICAL: Luxury inference
```

## Expected LLM Behavior

### Before (Warning Ignored)
```
LLM: "I see you're planning a trip to New York! What kind of activities
are you interested in? Would you like restaurant recommendations in the city?"
```
❌ Completely ignored that they're going to St. Maarten

### After (Warning Acknowledged)
```
LLM: "I noticed an important issue with your itinerary title. It says
'New York Winter Getaway,' but you're actually traveling to St. Maarten!
This commonly happens when importing confirmation emails.

Would you like me to update the title to 'St. Maarten Winter Getaway'
to correctly reflect your destination?

Once we fix that, I can help you with recommendations for your St. Maarten trip!"
```
✅ Mismatch acknowledged in FIRST response

## Testing Checklist

- [ ] Build succeeds
- [ ] Import JFK → SXM flight with title "New York Trip"
- [ ] Create chat session
- [ ] LLM's first response mentions the mismatch
- [ ] LLM asks to update the title
- [ ] LLM doesn't proceed with suggestions until acknowledged
