#!/bin/bash

echo "=== TEST STATUS CHECK ==="
echo ""

# Check Adventure Squad
echo "1. ADVENTURE SQUAD (b3be117):"
ADV_FILE="/tmp/claude/-Users-masa-Projects-itinerator/tasks/b3be117.output"
if [ -f "$ADV_FILE" ]; then
    echo "  - 403 errors: $(grep -c 'Response Status: 403' "$ADV_FILE" 2>/dev/null || echo '0')"
    echo "  - Travelers added: $(grep -c 'add_traveler' "$ADV_FILE" 2>/dev/null || echo '0')"
    echo "  - Hotels added: $(grep -c 'add_hotel' "$ADV_FILE" 2>/dev/null || echo '0')"
    echo "  - Activities added: $(grep -c 'add_activity' "$ADV_FILE" 2>/dev/null || echo '0')"
    echo "  - Flights added: $(grep -c 'add_flight' "$ADV_FILE" 2>/dev/null || echo '0')"
    echo "  - Status: $(tail -n 5 "$ADV_FILE" | grep -E "(✅|❌|FINAL|Turn)" | tail -n 1 || echo 'Running...')"
else
    echo "  - File not found"
fi
echo ""

# Check Hendersons
echo "2. THE HENDERSONS (bcd6c1c):"
HEN_FILE="/tmp/claude/-Users-masa-Projects-itinerator/tasks/bcd6c1c.output"
if [ -f "$HEN_FILE" ]; then
    echo "  - 403 errors: $(grep -c 'Response Status: 403' "$HEN_FILE" 2>/dev/null || echo '0')"
    echo "  - Travelers added: $(grep -c 'add_traveler' "$HEN_FILE" 2>/dev/null || echo '0')"
    echo "  - Hotels added: $(grep -c 'add_hotel' "$HEN_FILE" 2>/dev/null || echo '0')"
    echo "  - Activities added: $(grep -c 'add_activity' "$HEN_FILE" 2>/dev/null || echo '0')"
    echo "  - Cruises added: $(grep -c 'add_cruise' "$HEN_FILE" 2>/dev/null || echo '0')"
    echo "  - Status: $(tail -n 5 "$HEN_FILE" | grep -E "(✅|❌|FINAL|Turn)" | tail -n 1 || echo 'Running...')"
else
    echo "  - File not found"
fi
echo ""

# Check if tests are still running
echo "3. PROCESS STATUS:"
ps aux | grep "traveler-persona-agent.ts" | grep -v grep | wc -l | xargs -I {} echo "  - Active test processes: {}"
echo ""
