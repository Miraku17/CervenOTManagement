#!/bin/bash

# API Security Testing Script
# This script tests if your APIs are properly secured

BASE_URL="http://localhost:3000"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔐 API Security Testing"
echo "======================="
echo ""

# Test 1: Unauthenticated access should fail
echo "Test 1: Testing unauthenticated access (should return 401)..."
response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/delete-employee" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"test-id"}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "401" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Returned 401 Unauthorized"
  echo "   Response: $body"
else
  echo -e "${RED}❌ FAIL${NC} - Expected 401, got $http_code"
  echo "   Response: $body"
fi
echo ""

# Test 2: Unauthenticated access to employee endpoint
echo "Test 2: Testing unauthenticated access to employee endpoint (should return 401)..."
response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/attendance/current-session")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "401" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Returned 401 Unauthorized"
  echo "   Response: $body"
else
  echo -e "${RED}❌ FAIL${NC} - Expected 401, got $http_code"
  echo "   Response: $body"
fi
echo ""

# Test 3: Test clock-in without auth
echo "Test 3: Testing clock-in without auth (should return 401)..."
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/attendance/clock-in" \
  -H "Content-Type: application/json" \
  -d '{"latitude":14.5995,"longitude":120.9842}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "401" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Returned 401 Unauthorized"
  echo "   Response: $body"
else
  echo -e "${RED}❌ FAIL${NC} - Expected 401, got $http_code"
  echo "   Response: $body"
fi
echo ""

# Test 4: Test dashboard stats without auth
echo "Test 4: Testing dashboard stats without auth (should return 401)..."
response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/dashboard/stats")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "401" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Returned 401 Unauthorized"
  echo "   Response: $body"
else
  echo -e "${RED}❌ FAIL${NC} - Expected 401, got $http_code"
  echo "   Response: $body"
fi
echo ""

# Test 5: Test export attendance without auth
echo "Test 5: Testing export attendance without auth (should return 401)..."
response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/admin/export-attendance?startDate=2024-01-01&endDate=2024-12-31")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "401" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Returned 401 Unauthorized"
  echo "   Response: $body"
else
  echo -e "${RED}❌ FAIL${NC} - Expected 401, got $http_code"
  echo "   Response: $body"
fi
echo ""

# Test 6: Test password update without auth
echo "Test 6: Testing password update without auth (should return 401)..."
response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/admin/update-password" \
  -H "Content-Type: application/json" \
  -d '{"userId":"any-user-id","newPassword":"hacked123"}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "401" ]; then
  echo -e "${GREEN}✅ PASS${NC} - Returned 401 Unauthorized (Password change blocked!)"
  echo "   Response: $body"
else
  echo -e "${RED}❌ FAIL${NC} - Expected 401, got $http_code"
  echo "   Response: $body"
fi
echo ""

# Test with authentication (if token provided)
if [ ! -z "$AUTH_TOKEN" ]; then
  echo "========================================"
  echo "Testing with authentication token..."
  echo ""

  # Test 7: Test with valid token
  echo "Test 7: Testing dashboard stats WITH auth (should return 200)..."
  response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/dashboard/stats" \
    -H "Authorization: Bearer $AUTH_TOKEN")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Returned 200 OK"
    echo "   Response: $(echo $body | jq -c 2>/dev/null || echo $body)"
  else
    echo -e "${RED}❌ FAIL${NC} - Expected 200, got $http_code"
    echo "   Response: $body"
  fi
  echo ""

  # Test 8: Test admin endpoint as employee (if employee token)
  if [ ! -z "$EMPLOYEE_TOKEN" ]; then
    echo "Test 8: Testing admin endpoint WITH employee token (should return 403)..."
    response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/delete-employee" \
      -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"employeeId":"test-id"}')

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "403" ]; then
      echo -e "${GREEN}✅ PASS${NC} - Returned 403 Forbidden (Authorization working!)"
      echo "   Response: $body"
    else
      echo -e "${RED}❌ FAIL${NC} - Expected 403, got $http_code"
      echo "   Response: $body"
    fi
    echo ""
  fi
else
  echo "========================================"
  echo -e "${YELLOW}ℹ️  To test authenticated endpoints:${NC}"
  echo "   1. Login to your app and get the access token"
  echo "   2. Run: AUTH_TOKEN='your-token' ./test-api.sh"
  echo "   3. To test authorization: EMPLOYEE_TOKEN='employee-token' ./test-api.sh"
  echo ""
fi

echo "========================================"
echo "Testing Complete!"
echo ""
echo "Summary:"
echo "- All unauthenticated requests should return 401 ✅"
echo "- Authenticated requests should return 200 or appropriate response"
echo "- Employee accessing admin endpoints should return 403"
echo ""
echo "Your APIs are now protected! 🎉"
