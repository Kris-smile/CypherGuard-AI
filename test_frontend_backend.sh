#!/bin/bash

# Frontend-Backend Integration Test Script
# 测试前后端连接

echo "=========================================="
echo "CypherGuard AI - Frontend-Backend Test"
echo "=========================================="
echo ""

BASE_URL="http://localhost"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=$4
    
    echo -n "Testing $name... "
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        ((FAILED++))
        return 1
    fi
}

echo "1. Testing Infrastructure Services"
echo "-----------------------------------"
test_endpoint "Gateway Health" "$BASE_URL/healthz"
test_endpoint "Auth Service Health" "$BASE_URL/auth/me" # Will fail without token, but service is up
test_endpoint "KB Service Health" "$BASE_URL/kb/documents" # Will fail without token
test_endpoint "Chat Service Health" "$BASE_URL/chat/modes"
echo ""

echo "2. Testing User Registration"
echo "----------------------------"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test${TIMESTAMP}@example.com"
TEST_USERNAME="testuser${TIMESTAMP}"
TEST_PASSWORD="TestPass123!"

REGISTER_DATA="{\"email\":\"$TEST_EMAIL\",\"username\":\"$TEST_USERNAME\",\"password\":\"$TEST_PASSWORD\"}"

if test_endpoint "User Registration" "$BASE_URL/auth/register" "POST" "$REGISTER_DATA"; then
    # Extract token from response
    TOKEN=$(echo "$body" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$TOKEN" ]; then
        echo -e "${GREEN}✓ Token received${NC}"
        
        echo ""
        echo "3. Testing Authenticated Endpoints"
        echo "-----------------------------------"
        
        # Test with token
        echo -n "Testing Get User Info... "
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL/auth/me" \
            -H "Authorization: Bearer $TOKEN" 2>/dev/null)
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "200" ]; then
            echo -e "${GREEN}✓ PASSED${NC}"
            ((PASSED++))
        else
            echo -e "${RED}✗ FAILED${NC}"
            ((FAILED++))
        fi
        
        echo -n "Testing List Documents... "
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL/kb/documents" \
            -H "Authorization: Bearer $TOKEN" 2>/dev/null)
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "200" ]; then
            echo -e "${GREEN}✓ PASSED${NC}"
            ((PASSED++))
        else
            echo -e "${RED}✗ FAILED${NC}"
            ((FAILED++))
        fi
        
        echo -n "Testing List Conversations... "
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL/chat/conversations" \
            -H "Authorization: Bearer $TOKEN" 2>/dev/null)
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "200" ]; then
            echo -e "${GREEN}✓ PASSED${NC}"
            ((PASSED++))
        else
            echo -e "${RED}✗ FAILED${NC}"
            ((FAILED++))
        fi
    else
        echo -e "${RED}✗ Failed to extract token${NC}"
        ((FAILED++))
    fi
fi

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    echo ""
    echo "Frontend-Backend integration is working correctly!"
    echo "You can now:"
    echo "  1. Open http://localhost in your browser"
    echo "  2. Register a new account"
    echo "  3. Upload documents in Knowledge Core"
    echo "  4. Start chatting in Neural Chat"
    exit 0
else
    echo -e "${RED}Some tests failed. Please check the services.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if all services are running: docker-compose ps"
    echo "  2. Check service logs: docker-compose logs [service-name]"
    echo "  3. Restart services: docker-compose restart"
    exit 1
fi
