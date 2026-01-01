#!/bin/bash
# Test JetBlue PDF import via web API

set -e

PDF_FILE="$HOME/Downloads/JetBlue - Print confirmation.pdf"

if [ ! -f "$PDF_FILE" ]; then
    echo "❌ PDF file not found: $PDF_FILE"
    exit 1
fi

echo "🔍 Testing JetBlue PDF Import via Web API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the dev server in background if not running
if ! curl -s http://localhost:5176/api/v1/health > /dev/null 2>&1; then
    echo "🚀 Starting SvelteKit dev server..."
    cd viewer-svelte
    npm run dev &
    SERVER_PID=$!
    cd ..

    # Wait for server to be ready
    echo "⏳ Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:5176/api/v1/health > /dev/null 2>&1; then
            echo "✅ Server is ready!"
            break
        fi
        sleep 1
        if [ $i -eq 30 ]; then
            echo "❌ Server failed to start"
            kill $SERVER_PID 2>/dev/null || true
            exit 1
        fi
    done
else
    echo "✅ Server already running"
    SERVER_PID=""
fi

echo ""
echo "📤 Uploading PDF to /api/v1/import/upload..."
echo ""

# Make the API request with auth cookies
RESPONSE=$(curl -s -X POST \
  http://localhost:5176/api/v1/import/upload \
  -F "file=@$PDF_FILE" \
  -H "Accept: application/json" \
  -H "Cookie: itinerator_session=authenticated; itinerator_user_email=test@example.com")

# Save response to file for inspection
echo "$RESPONSE" > test-jetblue-response.json

echo "📊 IMPORT RESULT:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RESPONSE" | jq '.'
echo ""

# Extract key fields
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
FORMAT=$(echo "$RESPONSE" | jq -r '.format // "unknown"')
SEGMENT_COUNT=$(echo "$RESPONSE" | jq -r '.segments | length')
CONFIDENCE=$(echo "$RESPONSE" | jq -r '.confidence // 0')
SUMMARY=$(echo "$RESPONSE" | jq -r '.summary // "No summary"')

echo "📋 SUMMARY:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Success: $SUCCESS"
echo "Format: $FORMAT"
echo "Segments found: $SEGMENT_COUNT"
echo "Confidence: $CONFIDENCE"
echo "Summary: $SUMMARY"
echo ""

if [ "$SEGMENT_COUNT" -gt 0 ]; then
    echo "✈️  EXTRACTED SEGMENTS:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$RESPONSE" | jq -r '.segments[] | "Type: \(.type)\nFlight: \(.airline.name // "N/A") \(.flightNumber // "N/A")\nRoute: \(.origin.code // "N/A") → \(.destination.code // "N/A")\nDeparture: \(.startDatetime)\nConfirmation: \(.confirmationNumber // "N/A")\n"'
else
    echo "⚠️  NO SEGMENTS FOUND!"
    echo ""

    # Show errors if any
    ERRORS=$(echo "$RESPONSE" | jq -r '.errors // []')
    if [ "$ERRORS" != "[]" ]; then
        echo "❌ ERRORS:"
        echo "$RESPONSE" | jq -r '.errors[] | "  - \(.)"'
        echo ""
    fi

    # Show raw text sample if available
    RAW_TEXT=$(echo "$RESPONSE" | jq -r '.rawText // ""')
    if [ -n "$RAW_TEXT" ] && [ "$RAW_TEXT" != "null" ]; then
        echo "📝 RAW TEXT SAMPLE (first 300 chars):"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "$RAW_TEXT" | head -c 300
        echo "..."
        echo ""
    fi
fi

echo "💾 Full response saved to: test-jetblue-response.json"
echo ""

# Cleanup
if [ -n "$SERVER_PID" ]; then
    echo "🛑 Stopping dev server..."
    kill $SERVER_PID 2>/dev/null || true
fi

# Exit with appropriate code
if [ "$SUCCESS" == "true" ] && [ "$SEGMENT_COUNT" -gt 0 ]; then
    echo "✅ Test PASSED - Segments successfully extracted"
    exit 0
else
    echo "❌ Test FAILED - No segments found"
    exit 1
fi
