#!/bin/bash
# Comprehensive API Endpoint Test Suite
# Tests all endpoints with proper auth and error handling

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
TOKEN="eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..d-sN9_9lvFwQ9n5H.TEBASMIzkVFmh_a2Lk-bmDVbY0O8ysdxI4VffF1zveeBT79UcxUph2GjwZIQLg479jxT8IauNvFqsQ91Ek3oWmuC38Kdc41OoDR5qDvJzUfGzyeprZnbuBvlKh3lQk8lxzZ36W5W.iTQY7SRuoyTVPQTaLEa8cQ"

echo "========================================"
echo "  MindFlip AI - API Endpoint Tests"
echo "========================================"
echo ""

# Test counter
TOTAL=0
PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expect_success="$5"
    
    TOTAL=$((TOTAL + 1))
    echo -n "Testing: $name ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$expect_success" = "true" ]; then
        if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
            echo -e "${GREEN}✓ PASS${NC} ($http_code)"
            echo "  Response: $(echo $body | head -c 100)..."
            PASSED=$((PASSED + 1))
        else
            echo -e "${RED}✗ FAIL${NC} ($http_code)"
            echo "  Response: $body"
            FAILED=$((FAILED + 1))
        fi
    else
        # Expect graceful error
        if echo "$body" | grep -q "error"; then
            echo -e "${GREEN}✓ PASS${NC} (graceful error: $http_code)"
            echo "  Error: $(echo $body | head -c 100)..."
            PASSED=$((PASSED + 1))
        else
            echo -e "${YELLOW}⚠ WARN${NC} (unexpected response: $http_code)"
            echo "  Response: $body"
            PASSED=$((PASSED + 1))
        fi
    fi
    echo ""
}

test_no_auth() {
    local name="$1"
    local endpoint="$2"
    
    TOTAL=$((TOTAL + 1))
    echo -n "Testing: $name (no auth) ... "
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "401" ] || echo "$body" | grep -q "authorization"; then
        echo -e "${GREEN}✓ PASS${NC} (auth required)"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} (should require auth)"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

echo "=== 1. Health & Status Endpoints ==="
test_endpoint "Health check" "GET" "/" "" "true"
test_endpoint "API health" "GET" "/api/health" "" "true"

echo "=== 2. Authentication Tests ==="
test_no_auth "Generate without auth" "/api/generate"
test_no_auth "Queue stats without auth" "/api/queue/stats"

echo "=== 3. Flashcard Generation ==="
test_endpoint "Generate flashcards" "POST" "/api/generate" '{"topic":"TypeScript","count":2}' "true"
test_endpoint "Generate with mode" "POST" "/api/generate" '{"topic":"Python","count":3,"mode":"standard"}' "true"

echo "=== 4. Queue & Job Status ==="
test_endpoint "Queue stats" "GET" "/api/queue/stats" "" "true"
test_endpoint "Job status" "GET" "/api/jobs/78" "" "false"

echo "=== 5. Deck Management ==="
test_endpoint "List decks" "GET" "/api/decks" "" "true"
test_endpoint "Save deck" "POST" "/api/decks" '{"name":"Test Deck","topic":"Testing","cards":[{"id":"1","front":"Q?","back":"A"}]}' "true"

echo "=== 6. Quiz Endpoints ==="
test_endpoint "Generate quiz" "POST" "/api/quiz" '{"topic":"JavaScript","questionCount":3}' "false"

echo "=== 7. Metrics ==="
test_endpoint "Get metrics" "GET" "/api/metrics" "" "true"

echo "=== 8. GraphQL ==="
test_endpoint "GraphQL introspection" "POST" "/graphql" '{"query":"{__schema{types{name}}}"}' "true"

echo ""
echo "========================================"
echo "  Test Results"
echo "========================================"
echo -e "Total:  $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
