// API Security Testing Script
// Run this in browser console while on your dashboard or use Node.js with fetch

const BASE_URL = 'http://localhost:3000';

async function testApiSecurity() {
  console.log('🔐 API Security Testing\n');
  console.log('=======================\n');

  // Test 1: Unauthenticated access to admin endpoint
  console.log('Test 1: Delete employee without auth (should fail with 401)');
  try {
    const res = await fetch(`${BASE_URL}/api/delete-employee`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'test-id' })
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', data);
    console.log(res.status === 401 ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 2: Unauthenticated access to employee endpoint
  console.log('Test 2: Get current session without auth (should fail with 401)');
  try {
    const res = await fetch(`${BASE_URL}/api/attendance/current-session`);
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', data);
    console.log(res.status === 401 ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 3: Clock-in without auth
  console.log('Test 3: Clock-in without auth (should fail with 401)');
  try {
    const res = await fetch(`${BASE_URL}/api/attendance/clock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 14.5995, longitude: 120.9842 })
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', data);
    console.log(res.status === 401 ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 4: Dashboard stats without auth
  console.log('Test 4: Dashboard stats without auth (should fail with 401)');
  try {
    const res = await fetch(`${BASE_URL}/api/dashboard/stats`);
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', data);
    console.log(res.status === 401 ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 5: Password update without auth (CRITICAL)
  console.log('Test 5: Update password without auth (should fail with 401)');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/update-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'any-user', newPassword: 'hacked123' })
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', data);
    console.log(res.status === 401 ? '✅ PASS (Password change blocked!)\n' : '❌ FAIL (CRITICAL SECURITY ISSUE!)\n');
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 6: Export attendance without auth
  console.log('Test 6: Export attendance without auth (should fail with 401)');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/export-attendance?startDate=2024-01-01&endDate=2024-12-31`);
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', data);
    console.log(res.status === 401 ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n=======================');
  console.log('Basic security tests complete!');
  console.log('\nTo test authenticated endpoints:');
  console.log('1. Login to your dashboard');
  console.log('2. Run: testWithAuth()');
}

// Test authenticated endpoints (run this after logging in)
async function testWithAuth() {
  console.log('\n🔓 Testing Authenticated Endpoints\n');
  console.log('=======================\n');

  // Test 1: Dashboard stats with auth (should succeed)
  console.log('Test 1: Dashboard stats with auth (should succeed with 200)');
  try {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', data);
    console.log(res.status === 200 ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 2: Current session with auth (should succeed)
  console.log('Test 2: Get current session with auth (should succeed)');
  try {
    const res = await fetch('/api/attendance/current-session');
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', data);
    console.log(res.status === 200 ? '✅ PASS\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 3: Try admin endpoint as employee (should fail with 403)
  console.log('Test 3: Delete employee as non-admin (should fail with 403)');
  try {
    const res = await fetch('/api/delete-employee', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'test-id' })
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', data);
    console.log(res.status === 403 ? '✅ PASS (Authorization working!)\n' :
                 res.status === 200 ? '⚠️  You are an admin, this is expected\n' : '❌ FAIL\n');
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n=======================');
  console.log('Authenticated tests complete!');
}

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testApiSecurity, testWithAuth };
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  console.log('Copy and paste these commands to run tests:\n');
  console.log('testApiSecurity()  - Test unauthenticated access');
  console.log('testWithAuth()     - Test authenticated access (login first)\n');
}

// Run immediately if called with node
if (typeof require !== 'undefined' && require.main === module) {
  testApiSecurity();
}
