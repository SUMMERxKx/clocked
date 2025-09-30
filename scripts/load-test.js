import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate must be below 10%
    errors: ['rate<0.1'],             // Custom error rate must be below 10%
  },
};

// Base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testUsers = [
  { email: 'user1@test.com', handle: 'user1' },
  { email: 'user2@test.com', handle: 'user2' },
  { email: 'user3@test.com', handle: 'user3' },
];

let authTokens = {};
let groupIds = [];

export function setup() {
  console.log('Setting up load test...');
  
  // Create test users and get auth tokens
  for (const user of testUsers) {
    try {
      // Request magic link
      const magicLinkResponse = http.post(`${BASE_URL}/v1/auth/magic-link`, JSON.stringify({
        email: user.email,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (magicLinkResponse.status === 200) {
        // In a real test, you'd need to handle the magic link flow
        // For this example, we'll simulate having a valid token
        authTokens[user.email] = 'simulated-token';
      }
    } catch (error) {
      console.error(`Failed to setup user ${user.email}:`, error);
    }
  }
  
  return { authTokens, groupIds };
}

export default function (data) {
  const userIndex = Math.floor(Math.random() * testUsers.length);
  const user = testUsers[userIndex];
  const token = data.authTokens[user.email];
  
  if (!token) {
    console.error(`No token for user ${user.email}`);
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Test 1: Health check
  const healthResponse = http.get(`${BASE_URL}/health`);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);
  
  sleep(0.1);
  
  // Test 2: Get current user
  const meResponse = http.get(`${BASE_URL}/v1/auth/me`, { headers });
  check(meResponse, {
    'get user status is 200': (r) => r.status === 200,
    'get user response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);
  
  sleep(0.1);
  
  // Test 3: Get groups
  const groupsResponse = http.get(`${BASE_URL}/v1/groups`, { headers });
  check(groupsResponse, {
    'get groups status is 200': (r) => r.status === 200,
    'get groups response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);
  
  sleep(0.1);
  
  // Test 4: Create group (occasionally)
  if (Math.random() < 0.1) { // 10% chance
    const groupData = {
      name: `Test Group ${Date.now()}`,
      icon: '🧪',
      visibility: 'PRIVATE',
    };
    
    const createGroupResponse = http.post(`${BASE_URL}/v1/groups`, JSON.stringify(groupData), { headers });
    check(createGroupResponse, {
      'create group status is 201': (r) => r.status === 201,
      'create group response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);
    
    if (createGroupResponse.status === 201) {
      const group = JSON.parse(createGroupResponse.body);
      data.groupIds.push(group.data.id);
    }
  }
  
  sleep(0.1);
  
  // Test 5: Get group sessions (if we have groups)
  if (data.groupIds.length > 0) {
    const randomGroupId = data.groupIds[Math.floor(Math.random() * data.groupIds.length)];
    const sessionsResponse = http.get(`${BASE_URL}/v1/sessions/group/${randomGroupId}`, { headers });
    check(sessionsResponse, {
      'get sessions status is 200': (r) => r.status === 200,
      'get sessions response time < 400ms': (r) => r.timings.duration < 400,
    }) || errorRate.add(1);
  }
  
  sleep(0.1);
  
  // Test 6: Start session (occasionally)
  if (Math.random() < 0.05 && data.groupIds.length > 0) { // 5% chance
    const randomGroupId = data.groupIds[Math.floor(Math.random() * data.groupIds.length)];
    const sessionData = {
      groupId: randomGroupId,
      category: 'WORK',
      targetMin: 60,
      note: 'Load test session',
      visibility: 'PUBLIC',
    };
    
    const startSessionResponse = http.post(`${BASE_URL}/v1/sessions`, JSON.stringify(sessionData), { headers });
    check(startSessionResponse, {
      'start session status is 201': (r) => r.status === 201,
      'start session response time < 600ms': (r) => r.timings.duration < 600,
    }) || errorRate.add(1);
  }
  
  sleep(0.1);
}

export function teardown(data) {
  console.log('Tearing down load test...');
  console.log(`Created ${data.groupIds.length} groups during test`);
}
