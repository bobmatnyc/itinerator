# Manual Test: Traveler Deduplication

## Test Objective

Verify that `add_traveler` tool prevents duplicate travelers and updates existing ones instead.

## Setup

1. Start Trip Designer with a new itinerary
2. Use Trip Designer chat to add travelers

## Test Cases

### Test 1: Basic Deduplication

**Steps:**
1. Add traveler: "John Doe, adult"
2. Add traveler: "John Doe, adult" (same name)
3. Check travelers list

**Expected:**
- Only 1 traveler named "John Doe"
- Second call returns `action: "updated"`

**Actual:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 2: Case-Insensitive Matching

**Steps:**
1. Add traveler: "jane smith, adult"
2. Add traveler: "Jane Smith, adult" (different case)
3. Add traveler: "JANE SMITH, adult" (uppercase)
4. Check travelers list

**Expected:**
- Only 1 traveler named "Jane Smith"
- Calls 2 and 3 return `action: "updated"`

**Actual:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 3: Update Existing Traveler Details

**Steps:**
1. Add traveler: "Alice Johnson, adult, relationship: self"
2. Add traveler: "Alice Johnson, adult, relationship: spouse, email: alice@example.com"
3. Check traveler details

**Expected:**
- Only 1 traveler named "Alice Johnson"
- Relationship updated to "spouse"
- Email set to "alice@example.com"

**Actual:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 4: Different Names Create Separate Travelers

**Steps:**
1. Add traveler: "Bob Wilson, adult"
2. Add traveler: "Bobby Wilson, adult"
3. Add traveler: "Bob Williams, adult"
4. Check travelers list

**Expected:**
- 3 separate travelers (different first name or last name)

**Actual:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 5: Maximum Travelers Limit

**Steps:**
1. Create a script to add 21 travelers with different names
2. Verify error is thrown at 21st traveler

**Expected:**
- First 20 travelers succeed
- 21st traveler throws error: "Maximum number of travelers (20) reached..."

**Actual:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 6: Whitespace Handling

**Steps:**
1. Add traveler: " John  Doe ", adult" (extra spaces)
2. Add traveler: "John Doe, adult" (no extra spaces)
3. Check travelers list

**Expected:**
- Only 1 traveler (whitespace trimmed during comparison)

**Actual:**
- [ ] Pass
- [ ] Fail (describe issue):

---

## Example Trip Designer Conversation

```
User: Let's plan a family trip to Hawaii

Trip Designer: Great! Let me help you plan that. Who's traveling?

User: My wife Sarah and I (Tom), and our two kids - Emma and Max

[Trip Designer calls add_traveler 4 times]

User: Actually, Emma is 12 years old and has a peanut allergy

[Trip Designer calls add_traveler for Emma again - should UPDATE, not duplicate]
```

**Expected Behavior:**
- After first round: 4 travelers total
- After update: Still 4 travelers (Emma updated with age and allergy info)

## Verification Queries

Check itinerary data directly:

```bash
# Get itinerary JSON
curl http://localhost:5176/api/v1/itineraries/{itineraryId}

# Count travelers
jq '.travelers | length' itinerary.json

# List traveler names
jq '.travelers[] | "\(.firstName) \(.lastName)"' itinerary.json

# Check for duplicates
jq '.travelers | group_by(.firstName + " " + .lastName) | map(select(length > 1))' itinerary.json
```

## Success Criteria

- [ ] All test cases pass
- [ ] No duplicate travelers created
- [ ] Existing travelers updated correctly
- [ ] Maximum travelers limit enforced
- [ ] Case-insensitive and whitespace-tolerant matching works
