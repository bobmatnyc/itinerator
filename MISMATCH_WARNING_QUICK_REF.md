# Mismatch Warning - Quick Reference

## What Changed

The title/destination mismatch warning is now **impossible for the LLM to ignore**.

## How It Works

### 1. Detection
When a user imports flights (e.g., JFK → SXM) into an itinerary titled "New York Winter Getaway":
- System detects title mentions "New York" (departure city)
- Actual destination is "St. Maarten"
- Mismatch detected ✓

### 2. Warning Generation
A new function `generateMismatchWarning()` creates a standalone, prominent warning:

```
## 🚨🚨🚨 STOP - CRITICAL DATA CONFLICT DETECTED 🚨🚨🚨

**YOU MUST ADDRESS THIS ISSUE BEFORE ANYTHING ELSE**
...
**MANDATORY ACTION - YOU MUST DO THIS IN YOUR FIRST RESPONSE**:
1. ⚠️ Point out this title/destination mismatch to the user
2. ⚠️ Explain that the title mentions their departure city
3. ⚠️ Ask if they want to update the title
4. ⚠️ DO NOT proceed with trip suggestions until acknowledged
```

### 3. Context Injection
The warning appears at the VERY TOP of the Trip Designer context:

```
[🚨 MISMATCH WARNING - CANNOT BE IGNORED]

---

[Itinerary Summary]

---

[Other Context]
```

## Files Modified

1. **src/services/trip-designer/itinerary-summarizer.ts**
   - Added: `generateMismatchWarning()` - new prominent warning generator
   - Updated: `summarizeItinerary()` - removed mismatch from summary

2. **src/services/trip-designer/trip-designer.service.ts**
   - Import: Added `generateMismatchWarning`
   - Logic: Inject warning at top of context if detected

## Testing

**Scenario**: Import JFK → SXM flights with title "New York Winter Getaway"

**Expected LLM Response**:
```
I noticed that your trip title mentions "New York," but you're actually
traveling to St. Maarten. This commonly happens when importing confirmation
emails. Would you like me to update the title to "St. Maarten Winter Getaway"?
```

## Why This Works

1. **Position**: Warning appears FIRST, before everything else
2. **Language**: ALL CAPS, triple emojis, "YOU MUST"
3. **Instructions**: Explicit numbered steps
4. **Requirement**: "IN YOUR FIRST RESPONSE"
5. **Visibility**: Separate section with visual separators

## Deployment

```bash
# Build succeeds
npm run build

# Deploy to Vercel
git add .
git commit -m "feat: make title/destination mismatch warning impossible to ignore"
git push

# Vercel auto-deploys
```

## Verification

1. Import a flight confirmation with origin city in email subject
2. Create chat session
3. LLM should IMMEDIATELY point out the mismatch
4. If not, check logs for `[generateMismatchWarning]` output

## Rollback

If this causes issues:
```bash
git revert HEAD
git push
```

The old code still works - we just added a new warning section.
