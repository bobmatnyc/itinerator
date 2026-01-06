# Time Validation - Quick Start

## What Was Added

A **time validation layer** that automatically detects and flags unrealistic segment times in itineraries.

## Files Created

### Core Utilities
- `src/utils/time-validator.ts` - Core validation logic (✅ 25 tests passing)
- `tests/unit/utils/time-validator.test.ts` - Comprehensive unit tests

### UI Components
- `viewer-svelte/src/lib/components/TimeValidationBadge.svelte` - Visual warning badge
- `viewer-svelte/src/lib/types/time-validator.ts` - Type re-exports

### API Routes
- `viewer-svelte/src/routes/api/v1/itineraries/[id]/validate-times/+server.ts` - Batch validation/fixing

### Documentation
- `TIME_VALIDATION.md` - Comprehensive guide (see this for full details)
- `TIME_VALIDATION_QUICKSTART.md` - This file

## How It Works

### 1. Automatic In-UI Validation

When you view an itinerary, each segment is automatically validated. If a time is unrealistic, you'll see a color-coded badge:

```
⚠️ Time issue  (Red = ERROR - very likely wrong)
⚡ Time issue  (Amber = WARNING - likely wrong)
ℹ️ Time issue  (Blue = INFO - unusual but possible)
```

**Example:**
```
4:00 AM ⚠️ Time issue
Imperial Palace Gardens

[Hover badge]
→ "Too early for most attractions (gardens, museums typically open 9 AM)"
→ [Fix to 9:00 AM] button
```

### 2. One-Click Fix

Click the "Fix to 9:00 AM" button in the tooltip to automatically correct the time. Duration is preserved (e.g., 4 AM - 6 AM becomes 9 AM - 11 AM).

### 3. Validation Rules Summary

| Segment Type | Valid Hours | Common Issues |
|--------------|-------------|---------------|
| **Activities (general)** | 8 AM - 10 PM | ⚠️ 4 AM (too early) → Fix: 9 AM |
| **Dining** | Breakfast: 7-10 AM<br>Lunch: 11 AM - 3 PM<br>Dinner: 5-11 PM | ⚠️ 2 AM (closed) → Fix: 8 AM<br>⚡ 6 AM (very early) → Fix: 8 AM |
| **Hotels** | Noon - 11 PM | ⚡ 8 AM (early check-in) → Fix: 3 PM |
| **Flights** | Any time | ℹ️ 2 AM (red-eye, verify) |
| **Transfers** | Any time | ℹ️ 3 AM (overnight, verify) |

## Integration Points

### Already Integrated
✅ **SegmentCard** - Shows badge automatically for invalid times
✅ **ItineraryDetail** - Passes fix handler to SegmentCard

### Can Be Added (Future)
- **Trip Designer** - Validate generated times before saving
- **Import Service** - Flag suspicious times when importing
- **Itinerary Header** - Show summary count (e.g., "3 time issues")
- **Bulk Fix UI** - "Fix All Issues" button

## Testing

```bash
# Run unit tests (25 tests)
npm test -- tests/unit/utils/time-validator.test.ts

# All tests passing ✅
```

## API Usage (Optional)

### Get validation issues
```typescript
GET /api/v1/itineraries/[id]/validate-times

Response:
{
  "issues": [
    {
      "segmentId": "seg_abc123",
      "segmentType": "ACTIVITY",
      "segmentName": "Imperial Palace Gardens",
      "currentTime": "2025-04-01T04:00:00Z",
      "validation": {
        "isValid": false,
        "severity": "error",
        "issue": "Too early for most attractions...",
        "suggestedTime": "09:00",
        "category": "too_early"
      }
    }
  ],
  "summary": {
    "total": 3,
    "bySeverity": { "error": 1, "warning": 2, "info": 0 },
    "byCategory": { "too_early": 1, "business_hours": 2 }
  }
}
```

### Fix all issues
```typescript
POST /api/v1/itineraries/[id]/validate-times
Body: { "applyAll": true }

Response:
{
  "message": "Fixed 3 segments",
  "fixed": 3,
  "total": 3
}
```

## Manual Testing Checklist

To test the feature:

1. ✅ Create/import itinerary with 4 AM activity
   - Badge should show: ⚠️ red badge
   - Tooltip: "Too early for most attractions..."
   - Fix button: "Fix to 9:00 AM"

2. ✅ Click fix button
   - Time updates to 9:00 AM
   - Duration preserved (2-hour activity stays 2 hours)
   - Badge disappears

3. ✅ Create dining at 2 AM
   - Badge should show: ⚠️ red badge
   - Suggests: 8:00 AM (breakfast)

4. ✅ Create red-eye flight at 2 AM
   - Badge should show: ℹ️ blue badge (info only)
   - Message: "Red-eye flight, verify time"
   - No fix button (flights operate 24/7)

## Known Limitations

1. **No timezone awareness** - Validates in local time, not destination timezone
2. **No venue-specific hours** - Uses general rules, not actual opening hours
3. **Manual updates required** - Changes don't trigger itinerary revalidation automatically

## Next Steps (Optional)

1. **Add to Trip Designer** - Validate times before creating segments
2. **Bulk operations** - Add "Fix All" button in itinerary header
3. **Smart context** - Use timezone and actual business hours from Google Places
4. **Learning system** - Track which fixes users accept/reject

## Questions?

See `TIME_VALIDATION.md` for full documentation including:
- Detailed validation rules for each segment type
- Architecture diagrams
- Integration examples
- Performance considerations
- Future enhancements

## LOC Delta

```
Added:
- time-validator.ts: ~420 lines
- TimeValidationBadge.svelte: ~150 lines
- validate-times API route: ~135 lines
- Tests: ~380 lines
- Documentation: ~850 lines

Total: ~1,935 lines added
Net change: +1,935 lines (new feature)
```

---

**Status:** ✅ Feature complete and tested
**Tests:** ✅ 25/25 passing
**Documentation:** ✅ Complete
