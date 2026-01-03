#!/bin/bash

# Extract key test results from traveler persona test output
OUTPUT_FILE="${1:-/tmp/claude/-Users-masa-Projects-itinerator/tasks/b52f32d.output}"

echo "=== TRAVELER PERSONA TEST RESULTS ==="
echo ""

# Count 403 errors for each persona
echo "1. 403 ERRORS (should be 0 for all personas):"
echo ""
for persona in "Alex the Backpacker" "Henderson" "Adventure Squad" "Sarah & Michael"; do
    count=$(grep -c "403" "$OUTPUT_FILE" | grep -i "$persona" || echo "0")
    echo "  - $persona: $count errors"
done
echo ""

# Check travelers created
echo "2. TRAVELERS CREATED:"
echo ""
grep -A 5 "add_traveler" "$OUTPUT_FILE" | grep -E "(firstName|lastName|age)" | head -n 20
echo ""

# Check segments created for each persona
echo "3. SEGMENTS CREATED:"
echo ""
for persona in "solo" "adventure" "senior" "couple" "family"; do
    echo "  === $persona ==="
    grep "Testing persona:" "$OUTPUT_FILE" -A 500 | grep -E "(add_hotel|add_flight|add_activity)" | head -n 10
done
echo ""

# Extract final scores
echo "4. FINAL SCORES:"
echo ""
grep -A 100 "FINAL SCORES" "$OUTPUT_FILE" || echo "Test still running or scores not yet calculated"
echo ""

# Count total API errors
echo "5. TOTAL API ERRORS:"
echo ""
grep -c "Response Status: 403" "$OUTPUT_FILE" || echo "0"
grep -c "Response Status: 500" "$OUTPUT_FILE" || echo "0"
echo ""
