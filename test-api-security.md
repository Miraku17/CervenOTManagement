# API Security Testing Guide

## Overview
This guide shows how to test that your APIs are properly secured with authentication and authorization.

## Test Scenarios

### 1. Test Unauthenticated Access (Should Fail with 401)

**Test that APIs reject requests without authentication:**

```bash
# Test admin endpoint without auth - should return 401
curl -X DELETE http://localhost:3000/api/delete-employee \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "some-id"}' \
  -v

# Expected Response: 401 Unauthorized
# {"error":"Unauthorized: No authentication provided"}
```

```bash
# Test employee endpoint without auth - should return 401
curl -X GET http://localhost:3000/api/attendance/current-session \
  -v

# Expected Response: 401 Unauthorized
```

### 2. Test Authenticated Access (Should Succeed)

**First, get your authentication token:**

1. Login through the UI at `http://localhost:3000/auth/login`
2. Open browser DevTools (F12) → Application/Storage → Cookies
3. Find the cookie named `sb-<project-id>-auth-token` or similar
4. Copy the access token value

**Or get token programmatically:**

```bash
# Login and get token
curl -X POST https://your-supabase-url.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

**Test with authentication:**

```bash
# Replace YOUR_ACCESS_TOKEN with actual token
export TOKEN="YOUR_ACCESS_TOKEN"

# Test employee endpoint with auth - should succeed
curl -X GET http://localhost:3000/api/attendance/current-session \
  -H "Authorization: Bearer $TOKEN" \
  -v

# Expected Response: 200 OK with session data
```

### 3. Test Authorization (Employee trying to access Admin endpoint)

**Test that regular employees cannot access admin endpoints:**

```bash
# Login as regular employee, then try admin endpoint
curl -X DELETE http://localhost:3000/api/delete-employee \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "some-id"}' \
  -v

# Expected Response: 403 Forbidden
# {"error":"Forbidden: admin role required"}
```

```bash
# Try to update another user's password as employee
curl -X POST http://localhost:3000/api/admin/update-password \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "another-user-id",
    "newPassword": "hacked123"
  }' \
  -v

# Expected Response: 403 Forbidden
```

### 4. Test User ID Spoofing Prevention

**Test that users cannot access other users' data:**

```bash
# Before fix: Could pass any userId
# After fix: Uses req.user.id from token

# Try to clock in for another user (should use authenticated user's ID)
curl -X POST http://localhost:3000/api/attendance/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 14.5995,
    "longitude": 120.9842,
    "address": "Manila"
  }' \
  -v

# Expected: Clocks in the authenticated user only (from token)
# The endpoint no longer accepts userId from request body
```

### 5. Test Cookie-Based Authentication

**Your app also supports cookie-based auth (from browser):**

```bash
# Get cookies from browser after login
# Copy all cookies and use in request

curl -X GET http://localhost:3000/api/dashboard/stats \
  -H "Cookie: sb-access-token=YOUR_TOKEN_VALUE; other-cookies..." \
  -v

# Expected Response: 200 OK with dashboard stats
```

## Testing with JavaScript/Browser Console

Open browser console on your logged-in dashboard and test:

```javascript
// Test authenticated endpoint
fetch('/api/dashboard/stats')
  .then(r => r.json())
  .then(console.log);
// Expected: Dashboard stats

// Test admin endpoint as employee (should fail)
fetch('/api/delete-employee', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ employeeId: 'some-id' })
})
  .then(r => r.json())
  .then(console.log);
// Expected: {error: "Forbidden: admin role required"}
```

## Automated Testing Script

Create a test file to automate security testing:

```javascript
// test-security.js
const BASE_URL = 'http://localhost:3000';

async function testUnauthenticated() {
  console.log('\n🔒 Test 1: Unauthenticated Access (Should Fail)');

  const response = await fetch(`${BASE_URL}/api/delete-employee`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'test-id' })
  });

  console.log(`Status: ${response.status}`);
  console.log('Response:', await response.json());
  console.log(response.status === 401 ? '✅ PASS' : '❌ FAIL');
}

async function testAuthenticated(token) {
  console.log('\n🔓 Test 2: Authenticated Access (Should Succeed)');

  const response = await fetch(`${BASE_URL}/api/dashboard/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log(`Status: ${response.status}`);
  console.log('Response:', await response.json());
  console.log(response.status === 200 ? '✅ PASS' : '❌ FAIL');
}

async function testUnauthorized(employeeToken) {
  console.log('\n🚫 Test 3: Employee Accessing Admin Endpoint (Should Fail)');

  const response = await fetch(`${BASE_URL}/api/delete-employee`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${employeeToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ employeeId: 'test-id' })
  });

  console.log(`Status: ${response.status}`);
  console.log('Response:', await response.json());
  console.log(response.status === 403 ? '✅ PASS' : '❌ FAIL');
}

// Run tests
(async () => {
  await testUnauthenticated();

  // Replace with actual tokens
  const employeeToken = 'YOUR_EMPLOYEE_TOKEN';
  const adminToken = 'YOUR_ADMIN_TOKEN';

  await testAuthenticated(employeeToken);
  await testUnauthorized(employeeToken);
})();
```

Run with: `node test-security.js`

## Expected Results Summary

| Test | Expected Status | Expected Response |
|------|----------------|-------------------|
| No auth + any endpoint | 401 | `{"error":"Unauthorized: No authentication provided"}` |
| Valid auth + employee endpoint | 200 | Success with data |
| Valid auth + admin endpoint (as employee) | 403 | `{"error":"Forbidden: admin role required"}` |
| Valid auth + admin endpoint (as admin) | 200 | Success with data |
| Invalid/expired token | 401 | `{"error":"Unauthorized: Invalid token"}` |

## Security Checklist

- [ ] Unauthenticated requests return 401
- [ ] Authenticated requests return 200/success
- [ ] Employees cannot access admin endpoints (403)
- [ ] Admin can access admin endpoints (200)
- [ ] Users cannot spoof other user IDs
- [ ] Invalid tokens are rejected
- [ ] CORS is properly configured
- [ ] Rate limiting is in place (if configured)

## Common Issues

### Issue: "CORS error"
**Solution:** Ensure your frontend domain is allowed in CORS settings

### Issue: "Token expired"
**Solution:** Login again to get a fresh token

### Issue: "Cookie not found"
**Solution:** Ensure cookies are being set properly after login

## Next Steps

1. Test all critical endpoints manually
2. Set up automated security tests in CI/CD
3. Consider adding rate limiting
4. Set up monitoring for failed auth attempts
5. Regular security audits
