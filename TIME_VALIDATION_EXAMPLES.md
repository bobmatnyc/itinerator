# Time Validation - Visual Examples

## UI Appearance

### Example 1: Activity Too Early (ERROR)

**Before Fix:**
```
┌────────────────────────────────────────────────────┐
│ 🎯 Imperial Palace Gardens                        │
│    Tokyo                                           │
│                                                    │
│ 4:00 AM · 🤖 Auto-generated · ⚠️ Time issue      │
│                                                    │
│ Visit the historic Imperial Palace Gardens...     │
└────────────────────────────────────────────────────┘
```

**Hover Tooltip:**
```
      ┌─────────────────────────────────────────┐
      │ Time Validation Issue                   │
      │                                         │
      │ Too early for most attractions          │
      │ (gardens, museums typically open 9 AM)  │
      │                                         │
      │ ┌─────────────────────────────────────┐ │
      │ │      Fix to 9:00 AM                 │ │
      │ └─────────────────────────────────────┘ │
      └─────────────────────────────────────────┘
            ▼
```

**After Fix:**
```
┌────────────────────────────────────────────────────┐
│ 🎯 Imperial Palace Gardens                        │
│    Tokyo                                           │
│                                                    │
│ 9:00 AM · 🤖 Auto-generated                       │
│                                                    │
│ Visit the historic Imperial Palace Gardens...     │
└────────────────────────────────────────────────────┘
```

### Example 2: Dining Too Early (WARNING)

**Card Display:**
```
┌────────────────────────────────────────────────────┐
│ 🍽️ Tsukiji Outer Market                          │
│    Tokyo                                           │
│                                                    │
│ 6:00 AM · 🤖 Auto-generated · ⚡ Time issue       │
│                                                    │
│ Famous seafood market with fresh sushi            │
│ breakfast                                          │
│                                                    │
│ Price: ¥2,500                                      │
│                                                    │
│ TripAdvisor  Yelp  Google Maps                    │
└────────────────────────────────────────────────────┘
```

**Tooltip:**
```
      ┌─────────────────────────────────────────┐
      │ Time Validation Issue                   │
      │                                         │
      │ Very early for breakfast                │
      │ (most restaurants open 7-8 AM)          │
      │                                         │
      │ ┌─────────────────────────────────────┐ │
      │ │      Fix to 8:00 AM                 │ │
      │ └─────────────────────────────────────┘ │
      └─────────────────────────────────────────┘
            ▼
```

### Example 3: Red-Eye Flight (INFO)

**Card Display:**
```
┌────────────────────────────────────────────────────┐
│ ✈️ JFK → HND                                       │
│    Japan Airlines JL006                            │
│                                                    │
│ 2:00 AM · 📄 Imported · ℹ️ Time issue            │
│                                                    │
│ Economy • Seat 42A                                 │
│ Duration: 13h 30m                                  │
│                                                    │
│ Price: $950                                        │
└────────────────────────────────────────────────────┘
```

**Tooltip:**
```
      ┌─────────────────────────────────────────┐
      │ Time Validation Issue                   │
      │                                         │
      │ Red-eye or very early morning flight    │
      │ (verify departure time)                 │
      │                                         │
      │ No fix suggested - flights operate 24/7 │
      └─────────────────────────────────────────┘
            ▼
```

### Example 4: Hotel Early Check-in (WARNING)

**Card Display:**
```
┌────────────────────────────────────────────────────┐
│ 🏨 Park Hyatt Tokyo - Night 1 of 3                │
│    Tokyo                                           │
│                                                    │
│ 8:00 AM · ✏️ User added · ⚡ Time issue           │
│                                                    │
│ Deluxe Room • City View                           │
│ Breakfast included                                 │
│                                                    │
│ Price: $450/night                                  │
└────────────────────────────────────────────────────┘
```

**Tooltip:**
```
      ┌─────────────────────────────────────────┐
      │ Time Validation Issue                   │
      │                                         │
      │ Early check-in                          │
      │ (standard is 3 PM, early check-in may   │
      │ require extra fee)                      │
      │                                         │
      │ ┌─────────────────────────────────────┐ │
      │ │      Fix to 3:00 PM                 │ │
      │ └─────────────────────────────────────┘ │
      └─────────────────────────────────────────┘
            ▼
```

## Badge Color Coding

### ERROR Badge (Red)
```
⚠️ Time issue
```
- Background: `bg-red-100` (light red)
- Text: `text-red-800` (dark red)
- Border: `border-red-300`
- **Use case:** Very likely incorrect, should be fixed

### WARNING Badge (Amber)
```
⚡ Time issue
```
- Background: `bg-amber-100` (light amber)
- Text: `text-amber-800` (dark amber)
- Border: `border-amber-300`
- **Use case:** Likely incorrect or unusual, review needed

### INFO Badge (Blue)
```
ℹ️ Time issue
```
- Background: `bg-blue-100` (light blue)
- Text: `text-blue-800` (dark blue)
- Border: `border-blue-300`
- **Use case:** Unusual but potentially valid, verify intentional

## Itinerary Day View

**With Multiple Issues:**
```
Wednesday, April 2

┌────────────────────────────────────────────────────┐
│ 🍽️ Breakfast at Tsukiji                          │
│ 6:00 AM · ⚡ Time issue                           │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 🎯 Senso-ji Temple                                │
│ 9:00 AM                                            │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 🍽️ Sushi lunch                                    │
│ 12:00 PM                                           │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 🎯 Tokyo Skytree                                  │
│ 4:00 AM · ⚠️ Time issue                           │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 🍽️ Dinner in Shibuya                             │
│ 7:00 PM                                            │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ 🏨 Park Hyatt Tokyo - Night 2 of 3               │
│ All day                                            │
└────────────────────────────────────────────────────┘
```

## Future Enhancement: Summary Banner

**Concept (not yet implemented):**
```
┌────────────────────────────────────────────────────┐
│ ⚠️ 3 time issues detected                         │
│                                                    │
│ • 1 error (very likely wrong)                     │
│ • 2 warnings (likely wrong)                       │
│                                                    │
│ [Review Issues] [Fix All]                         │
└────────────────────────────────────────────────────┘

Your Itinerary
```

## API Response Example

```json
{
  "issues": [
    {
      "segmentId": "seg_abc123",
      "segmentType": "ACTIVITY",
      "segmentName": "Imperial Palace Gardens",
      "currentTime": "2025-04-02T04:00:00Z",
      "validation": {
        "isValid": false,
        "severity": "error",
        "issue": "Too early for most attractions (gardens, museums typically open 9 AM)",
        "suggestedTime": "09:00",
        "category": "too_early"
      }
    },
    {
      "segmentId": "seg_def456",
      "segmentType": "ACTIVITY",
      "segmentName": "Tsukiji Outer Market",
      "currentTime": "2025-04-02T06:00:00Z",
      "validation": {
        "isValid": false,
        "severity": "warning",
        "issue": "Very early for breakfast (most restaurants open 7-8 AM)",
        "suggestedTime": "08:00",
        "category": "meal_timing"
      }
    }
  ],
  "summary": {
    "total": 2,
    "bySeverity": {
      "error": 1,
      "warning": 1,
      "info": 0
    },
    "byCategory": {
      "too_early": 1,
      "meal_timing": 1
    }
  }
}
```

## Test Scenarios

### Scenario 1: Attraction at 4 AM
**Input:** Activity segment with 4:00 AM start time
**Expected:**
- ⚠️ Red badge (ERROR)
- Message: "Too early for most attractions..."
- Suggested fix: 9:00 AM
- Fix button available

### Scenario 2: Restaurant at 2 AM
**Input:** Activity segment (category: "dining") with 2:00 AM start time
**Expected:**
- ⚠️ Red badge (ERROR)
- Message: "Too early for dining (most restaurants closed)"
- Suggested fix: 8:00 AM
- Fix button available

### Scenario 3: Hotel at 8 AM
**Input:** Hotel segment with 8:00 AM check-in
**Expected:**
- ⚡ Amber badge (WARNING)
- Message: "Early check-in (standard is 3 PM...)"
- Suggested fix: 3:00 PM
- Fix button available

### Scenario 4: Flight at 2 AM
**Input:** Flight segment with 2:00 AM departure
**Expected:**
- ℹ️ Blue badge (INFO)
- Message: "Red-eye or very early morning flight (verify...)"
- No suggested fix (flights operate 24/7)
- No fix button

### Scenario 5: Normal Activity at 10 AM
**Input:** Activity segment with 10:00 AM start time
**Expected:**
- No badge shown
- No validation message
- Normal display

## Accessibility Features

- **Color + Icon:** Each severity uses both color AND icon (⚠️ ⚡ ℹ️)
- **Screen reader text:** Badge has aria-label with full message
- **Keyboard navigation:** Tooltip and fix button keyboard accessible
- **High contrast:** Works with high contrast mode (icons visible)

## Mobile Responsive Design

On mobile (<640px), the badge may stack below the time:
```
┌──────────────────────────┐
│ 🎯 Imperial Palace       │
│    Gardens               │
│                          │
│ 4:00 AM                  │
│ ⚠️ Time issue            │
│ 🤖 Auto-generated        │
└──────────────────────────┘
```

Tooltip becomes bottom sheet on tap:
```
┌──────────────────────────┐
│ Time Validation Issue    │
│                          │
│ Too early for most       │
│ attractions...           │
│                          │
│ [Fix to 9:00 AM]        │
│ [Dismiss]                │
└──────────────────────────┘
```
