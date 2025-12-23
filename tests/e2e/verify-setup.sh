#!/bin/bash
# E2E Test Setup Verification Script
# Checks prerequisites before running E2E tests

set -e

echo "========================================="
echo "E2E Test Setup Verification"
echo "========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check API key
echo "1. Checking for API key..."
if [ -z "$ITINERIZER_TEST_API_KEY" ]; then
  echo -e "${RED}✗ ITINERIZER_TEST_API_KEY not set${NC}"
  echo "  Set it with: export ITINERIZER_TEST_API_KEY='sk-or-v1-...'"
  exit 1
else
  # Mask the key for display
  MASKED_KEY="${ITINERIZER_TEST_API_KEY:0:10}...${ITINERIZER_TEST_API_KEY: -4}"
  echo -e "${GREEN}✓ API key found: $MASKED_KEY${NC}"
fi

# Check API URL
echo ""
echo "2. Checking API URL..."
if [ -z "$VITE_API_URL" ]; then
  echo -e "${YELLOW}⚠ VITE_API_URL not set (will use default: http://localhost:5176)${NC}"
  VITE_API_URL="http://localhost:5176"
else
  echo -e "${GREEN}✓ API URL: $VITE_API_URL${NC}"
fi

# Check if API server is running
echo ""
echo "3. Checking if API server is running..."
if curl -s -f "$VITE_API_URL/api/v1/itineraries" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ API server is running at $VITE_API_URL${NC}"
else
  echo -e "${RED}✗ API server is not responding at $VITE_API_URL${NC}"
  echo "  Start the server with:"
  echo "    cd viewer-svelte"
  echo "    npm run dev"
  exit 1
fi

# Check if vitest is available
echo ""
echo "4. Checking for Vitest..."
if command -v npx vitest &> /dev/null; then
  echo -e "${GREEN}✓ Vitest is available${NC}"
else
  echo -e "${RED}✗ Vitest not found${NC}"
  echo "  Install dependencies with: npm install"
  exit 1
fi

# List available tests
echo ""
echo "5. Checking E2E test files..."
E2E_COUNT=$(find tests/e2e -name "*.e2e.test.ts" | wc -l | xargs)
if [ "$E2E_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Found $E2E_COUNT E2E test file(s)${NC}"
  find tests/e2e -name "*.e2e.test.ts" -exec basename {} \; | sed 's/^/  - /'
else
  echo -e "${RED}✗ No E2E test files found${NC}"
  exit 1
fi

# Count tests
echo ""
echo "6. Counting tests..."
TRIP_DESIGNER_TESTS=$(npx vitest --config vitest.config.e2e.ts --run tests/e2e/trip-designer.e2e.test.ts 2>&1 | grep -oE "[0-9]+ skipped" | grep -oE "[0-9]+" || echo "0")
HELP_AGENT_TESTS=$(npx vitest --config vitest.config.e2e.ts --run tests/e2e/help-agent.e2e.test.ts 2>&1 | grep -oE "[0-9]+ skipped" | grep -oE "[0-9]+" || echo "0")
VISUALIZATION_TESTS=$(npx vitest --config vitest.config.e2e.ts --run tests/e2e/visualization.e2e.test.ts 2>&1 | grep -oE "[0-9]+ skipped" | grep -oE "[0-9]+" || echo "0")

TOTAL_TESTS=$((TRIP_DESIGNER_TESTS + HELP_AGENT_TESTS + VISUALIZATION_TESTS))

echo -e "${GREEN}✓ Trip Designer: $TRIP_DESIGNER_TESTS tests${NC}"
echo -e "${GREEN}✓ Help Agent: $HELP_AGENT_TESTS tests${NC}"
echo -e "${GREEN}✓ Visualization: $VISUALIZATION_TESTS tests${NC}"
echo -e "${GREEN}✓ Total: $TOTAL_TESTS tests${NC}"

# Estimate cost
echo ""
echo "7. Estimating API costs..."
MIN_COST=$(echo "scale=2; $TOTAL_TESTS * 0.01" | bc)
MAX_COST=$(echo "scale=2; $TOTAL_TESTS * 0.05" | bc)
echo -e "${YELLOW}⚠ Estimated cost per run: \$${MIN_COST} - \$${MAX_COST}${NC}"
echo "  (Based on 1-3 LLM calls per test @ ~$0.01-0.05 per call)"

# Final summary
echo ""
echo "========================================="
echo -e "${GREEN}✓ Setup verified! Ready to run E2E tests.${NC}"
echo "========================================="
echo ""
echo "Run tests with:"
echo "  npm run test:e2e                        # All E2E tests"
echo "  npx vitest run tests/e2e/trip-designer.e2e.test.ts  # Specific file"
echo "  npx vitest run -t 'asks ONE'            # Single test"
echo ""
echo "Documentation:"
echo "  tests/e2e/README.md"
echo ""
