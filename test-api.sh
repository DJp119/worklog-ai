#!/bin/bash

echo "=========================================="
echo "Worklog AI Auth API - Quick Test Script"
echo "=========================================="

BASE_URL="http://localhost:3001"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo ""
echo "1. Health Check"
echo "---------------"
HEALTH=$(curl -s "$BASE_URL/health")
echo $HEALTH
if echo $HEALTH | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
fi

# Test 2: Signup
echo ""
echo "2. Signup"
echo "---------"
# Clean up any existing user
curl -s -X DELETE "http://localhost:3001/ Cleanup if needed" 2>/dev/null

SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test'$(date +%s)'@example.com",
    "password": "password123",
    "name": "Test User",
    "company_name": "Acme Corp",
    "job_title": "Developer"
  }')

echo $SIGNUP_RESPONSE
if echo $SIGNUP_RESPONSE | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Signup successful${NC}"
    USER_ID=$(echo $SIGNUP_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "User ID: $USER_ID"
else
    echo -e "${RED}✗ Signup failed${NC}"
fi

# Test 3: Login (should fail - email not verified)
echo ""
echo "3. Login (before verification - should fail)"
echo "---------------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test'$(date +%s)'@example.com",
    "password": "password123"
  }')

echo $LOGIN_RESPONSE
if echo $LOGIN_RESPONSE | grep -q '"error":"Please verify'; then
    echo -e "${GREEN}✓ Correctly requires email verification${NC}"
else
    echo -e "${RED}✗ Unexpected response${NC}"
fi

echo ""
echo "=========================================="
echo "Manual Steps Required:"
echo "=========================================="
echo "1. Check server logs for the verification email link"
echo "2. Or query the database for the verification token:"
echo "   SELECT * FROM email_verifications ORDER BY created_at DESC LIMIT 1;"
echo "3. Use the token to verify email via POST /api/auth/verify-email"
echo "4. Then retry login"
echo ""
echo "After verification, test these endpoints:"
echo "  POST /api/auth/login"
echo "  GET  /api/users/profile (with Authorization header)"
echo "  POST /api/auth/refresh"
echo "  POST /api/auth/logout"
echo "=========================================="
