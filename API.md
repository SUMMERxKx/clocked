# API Documentation

This document provides comprehensive API documentation for the Clocked application.

## 🌐 Base URLs

- **Production**: `https://api.clocked.app`
- **Staging**: `https://staging-api.clocked.app`
- **Development**: `http://localhost:3000`

## 🔐 Authentication

### Authentication Methods

#### Magic Link Authentication
1. Request magic link: `POST /v1/auth/magic-link`
2. Check email and click link
3. Verify token: `POST /v1/auth/magic-link/verify`
4. Receive access and refresh tokens

#### OAuth Authentication
1. Redirect to OAuth provider
2. Handle callback with authorization code
3. Exchange code for tokens
4. Receive access and refresh tokens

### Token Management

#### Access Tokens
- **Type**: JWT (JSON Web Token)
- **Expiration**: 15 minutes
- **Usage**: Include in `Authorization` header
- **Format**: `Bearer <token>`

#### Refresh Tokens
- **Type**: JWT with database validation
- **Expiration**: 7 days
- **Usage**: Refresh access tokens
- **Rotation**: New refresh token issued on each refresh

### Headers
```http
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

## 📝 Common Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error details
    }
  }
}
```

### Pagination
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "hasMore": true
    }
  }
}
```

## 🔑 Authentication Endpoints

### Request Magic Link
```http
POST /v1/auth/magic-link
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "redirectUrl": "https://app.clocked.app/auth/callback"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Magic link sent to your email"
  }
}
```

**Error Codes:**
- `USER_NOT_FOUND`: No account found with this email
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INVALID_EMAIL`: Invalid email format

### Verify Magic Link
```http
POST /v1/auth/magic-link/verify
```

**Request Body:**
```json
{
  "token": "abc123def456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123",
      "handle": "johndoe",
      "email": "user@example.com",
      "photoUrl": "https://example.com/photo.jpg",
      "privacyMode": false
    }
  }
}
```

**Error Codes:**
- `INVALID_MAGIC_LINK`: Invalid or expired token
- `TOKEN_EXPIRED`: Magic link has expired
- `TOKEN_USED`: Magic link has already been used

### Refresh Token
```http
POST /v1/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Codes:**
- `INVALID_REFRESH_TOKEN`: Invalid or expired refresh token
- `TOKEN_FAMILY_REVOKED`: Token family has been revoked

### Logout
```http
POST /v1/auth/logout
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### Get Current User
```http
GET /v1/auth/me
```

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "handle": "johndoe",
    "email": "user@example.com",
    "photoUrl": "https://example.com/photo.jpg",
    "privacyMode": false,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### Update User Profile
```http
PATCH /v1/auth/me
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "handle": "newhandle",
  "photoUrl": "https://example.com/new-photo.jpg",
  "privacyMode": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "handle": "newhandle",
    "email": "user@example.com",
    "photoUrl": "https://example.com/new-photo.jpg",
    "privacyMode": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

**Error Codes:**
- `HANDLE_TAKEN`: Handle is already taken
- `INVALID_HANDLE`: Handle format is invalid

## 👥 Group Endpoints

### List User's Groups
```http
GET /v1/groups
```

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "group_123",
      "name": "Work Team",
      "icon": "💼",
      "visibility": "PRIVATE",
      "ownerId": "user_123",
      "createdAt": "2024-01-01T00:00:00Z",
      "role": "OWNER",
      "memberCount": 5
    }
  ]
}
```

### Create Group
```http
POST /v1/groups
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "name": "Study Group",
  "icon": "📚",
  "visibility": "PRIVATE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "group_456",
    "name": "Study Group",
    "icon": "📚",
    "visibility": "PRIVATE",
    "ownerId": "user_123",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### Get Group Details
```http
GET /v1/groups/{groupId}
```

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "group_123",
    "name": "Work Team",
    "icon": "💼",
    "visibility": "PRIVATE",
    "ownerId": "user_123",
    "createdAt": "2024-01-01T00:00:00Z",
    "members": [
      {
        "userId": "user_123",
        "role": "OWNER",
        "joinedAt": "2024-01-01T00:00:00Z",
        "user": {
          "id": "user_123",
          "handle": "johndoe",
          "photoUrl": "https://example.com/photo.jpg",
          "privacyMode": false
        }
      }
    ]
  }
}
```

**Error Codes:**
- `GROUP_NOT_FOUND`: Group does not exist
- `NOT_GROUP_MEMBER`: User is not a member of the group

### Update Group
```http
PATCH /v1/groups/{groupId}
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "name": "Updated Group Name",
  "icon": "🎯",
  "visibility": "PUBLIC"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "group_123",
    "name": "Updated Group Name",
    "icon": "🎯",
    "visibility": "PUBLIC",
    "ownerId": "user_123",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

**Error Codes:**
- `INSUFFICIENT_PERMISSIONS`: Requires ADMIN or OWNER role
- `GROUP_NOT_FOUND`: Group does not exist

### Delete Group
```http
DELETE /v1/groups/{groupId}
```

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Group deleted successfully"
  }
}
```

**Error Codes:**
- `INSUFFICIENT_PERMISSIONS`: Requires OWNER role
- `GROUP_NOT_FOUND`: Group does not exist

### Invite Member
```http
POST /v1/groups/{groupId}/invite
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "role": "MEMBER"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "User invited successfully",
    "inviteToken": "ABC123DEF456"
  }
}
```

**Error Codes:**
- `USER_NOT_FOUND`: No user found with this email
- `USER_ALREADY_MEMBER`: User is already a member
- `INSUFFICIENT_PERMISSIONS`: Requires ADMIN or OWNER role

### Join Group
```http
POST /v1/groups/join
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "inviteToken": "ABC123DEF456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Successfully joined group",
    "group": {
      "id": "group_123",
      "name": "Work Team",
      "icon": "💼",
      "visibility": "PRIVATE"
    }
  }
}
```

**Error Codes:**
- `INVALID_INVITE_TOKEN`: Invalid or expired invite token
- `ALREADY_MEMBER`: User is already a member of the group

### Update Member Role
```http
PATCH /v1/groups/{groupId}/members/{userId}
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "role": "ADMIN"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Member role updated successfully"
  }
}
```

**Error Codes:**
- `MEMBER_NOT_FOUND`: User is not a member of the group
- `INSUFFICIENT_PERMISSIONS`: Requires ADMIN or OWNER role

### Remove Member
```http
DELETE /v1/groups/{groupId}/members/{userId}
```

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Member removed successfully"
  }
}
```

**Error Codes:**
- `MEMBER_NOT_FOUND`: User is not a member of the group
- `INSUFFICIENT_PERMISSIONS`: Requires ADMIN or OWNER role

## ⏱️ Session Endpoints

### Start Session
```http
POST /v1/sessions
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "groupId": "group_123",
  "category": "WORK",
  "targetMin": 60,
  "locationCoarse": "San Francisco, CA",
  "note": "Working on project documentation",
  "visibility": "PUBLIC"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session_789",
    "userId": "user_123",
    "groupId": "group_123",
    "category": "WORK",
    "startTs": "2024-01-01T12:00:00Z",
    "endTs": null,
    "targetMin": 60,
    "locationCoarse": "San Francisco, CA",
    "note": "Working on project documentation",
    "visibility": "PUBLIC"
  }
}
```

**Error Codes:**
- `NOT_GROUP_MEMBER`: User is not a member of the group
- `ACTIVE_SESSION_EXISTS`: User already has an active session
- `INVALID_CATEGORY`: Invalid session category

### Get Group Sessions
```http
GET /v1/sessions/group/{groupId}
```

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**
- `active` (boolean): Filter for active sessions only
- `category` (string): Filter by session category
- `from` (date): Start date filter (ISO 8601)
- `to` (date): End date filter (ISO 8601)
- `limit` (number): Number of results (default: 50, max: 100)
- `offset` (number): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_789",
        "userId": "user_123",
        "groupId": "group_123",
        "category": "WORK",
        "startTs": "2024-01-01T12:00:00Z",
        "endTs": null,
        "targetMin": 60,
        "locationCoarse": "San Francisco, CA",
        "note": "Working on project documentation",
        "visibility": "PUBLIC",
        "user": {
          "id": "user_123",
          "handle": "johndoe",
          "photoUrl": "https://example.com/photo.jpg",
          "privacyMode": false
        },
        "reactions": [
          {
            "id": "reaction_123",
            "type": "LIKE",
            "userId": "user_456",
            "ts": "2024-01-01T12:05:00Z"
          }
        ]
      }
    ],
    "total": 25,
    "hasMore": false
  }
}
```

### Get User Sessions
```http
GET /v1/sessions/me
```

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:** Same as group sessions

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_789",
        "userId": "user_123",
        "groupId": "group_123",
        "category": "WORK",
        "startTs": "2024-01-01T12:00:00Z",
        "endTs": "2024-01-01T13:00:00Z",
        "targetMin": 60,
        "locationCoarse": "San Francisco, CA",
        "note": "Working on project documentation",
        "visibility": "PUBLIC",
        "group": {
          "id": "group_123",
          "name": "Work Team",
          "icon": "💼"
        }
      }
    ],
    "total": 10,
    "hasMore": false
  }
}
```

### Update Session
```http
PATCH /v1/sessions/{sessionId}
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "endTs": "2024-01-01T13:00:00Z",
  "note": "Completed project documentation",
  "locationCoarse": "San Francisco, CA"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session_789",
    "userId": "user_123",
    "groupId": "group_123",
    "category": "WORK",
    "startTs": "2024-01-01T12:00:00Z",
    "endTs": "2024-01-01T13:00:00Z",
    "targetMin": 60,
    "locationCoarse": "San Francisco, CA",
    "note": "Completed project documentation",
    "visibility": "PUBLIC"
  }
}
```

**Error Codes:**
- `SESSION_NOT_FOUND`: Session does not exist or doesn't belong to user
- `SESSION_ALREADY_ENDED`: Session has already been ended

### Add Reaction
```http
POST /v1/sessions/{sessionId}/reactions
```

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "type": "LIKE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "reaction_123",
    "sessionId": "session_789",
    "userId": "user_123",
    "type": "LIKE",
    "ts": "2024-01-01T12:05:00Z"
  }
}
```

**Error Codes:**
- `SESSION_NOT_FOUND`: Session does not exist
- `REACTION_EXISTS`: User has already reacted with this type
- `NOT_GROUP_MEMBER`: User is not a member of the session's group

### Remove Reaction
```http
DELETE /v1/sessions/{sessionId}/reactions/{reactionId}
```

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Reaction removed successfully"
  }
}
```

**Error Codes:**
- `REACTION_NOT_FOUND`: Reaction does not exist or doesn't belong to user

## 🔌 WebSocket Events

### Connection
```javascript
const ws = new WebSocket('wss://api.clocked.app/ws?token=<access_token>');
```

### Event Types

#### Session Started
```json
{
  "type": "session_started",
  "groupId": "group_123",
  "data": {
    "session": {
      "id": "session_789",
      "userId": "user_123",
      "category": "WORK",
      "startTs": "2024-01-01T12:00:00Z",
      "targetMin": 60,
      "locationCoarse": "San Francisco, CA",
      "note": "Working on project documentation",
      "visibility": "PUBLIC"
    },
    "user": {
      "id": "user_123",
      "handle": "johndoe"
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### Session Ended
```json
{
  "type": "session_ended",
  "groupId": "group_123",
  "data": {
    "session": {
      "id": "session_789",
      "userId": "user_123",
      "category": "WORK",
      "startTs": "2024-01-01T12:00:00Z",
      "endTs": "2024-01-01T13:00:00Z",
      "targetMin": 60,
      "locationCoarse": "San Francisco, CA",
      "note": "Completed project documentation",
      "visibility": "PUBLIC"
    },
    "user": {
      "id": "user_123",
      "handle": "johndoe"
    }
  },
  "timestamp": "2024-01-01T13:00:00Z"
}
```

#### Reaction Added
```json
{
  "type": "reaction_added",
  "groupId": "group_123",
  "data": {
    "reaction": {
      "id": "reaction_123",
      "sessionId": "session_789",
      "userId": "user_456",
      "type": "LIKE",
      "ts": "2024-01-01T12:05:00Z"
    },
    "user": {
      "id": "user_456",
      "handle": "janedoe"
    }
  },
  "timestamp": "2024-01-01T12:05:00Z"
}
```

#### Member Joined
```json
{
  "type": "member_joined",
  "groupId": "group_123",
  "data": {
    "member": {
      "userId": "user_789",
      "role": "MEMBER",
      "joinedAt": "2024-01-01T12:00:00Z"
    },
    "user": {
      "id": "user_789",
      "handle": "newuser"
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 📊 Data Models

### User
```typescript
interface User {
  id: string;
  handle: string;
  email: string;
  photoUrl?: string;
  createdAt: Date;
  privacyMode: boolean;
}
```

### Group
```typescript
interface Group {
  id: string;
  name: string;
  icon?: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  ownerId: string;
  createdAt: Date;
}
```

### Group Member
```typescript
interface GroupMember {
  groupId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: Date;
}
```

### Session
```typescript
interface Session {
  id: string;
  userId: string;
  groupId: string;
  category: 'WORK' | 'STUDY' | 'EXERCISE' | 'HOBBY' | 'SOCIAL' | 'OTHER';
  startTs: Date;
  endTs?: Date;
  targetMin: number;
  locationCoarse?: string;
  note?: string;
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
}
```

### Reaction
```typescript
interface Reaction {
  id: string;
  sessionId: string;
  userId: string;
  type: 'LIKE' | 'JOIN' | 'ENCOURAGE';
  ts: Date;
}
```

## 🚨 Error Codes

### Authentication Errors
- `UNAUTHORIZED`: No authentication token provided
- `INVALID_TOKEN`: Invalid or expired token
- `USER_NOT_FOUND`: User not found
- `TOKEN_EXPIRED`: Token has expired
- `TOKEN_FAMILY_REVOKED`: Token family has been revoked

### Authorization Errors
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `NOT_GROUP_MEMBER`: User is not a member of the group
- `FORBIDDEN`: Access denied

### Validation Errors
- `VALIDATION_ERROR`: Request validation failed
- `INVALID_EMAIL`: Invalid email format
- `INVALID_HANDLE`: Invalid handle format
- `HANDLE_TAKEN`: Handle is already taken
- `INVALID_CATEGORY`: Invalid session category

### Resource Errors
- `GROUP_NOT_FOUND`: Group does not exist
- `SESSION_NOT_FOUND`: Session does not exist
- `USER_NOT_FOUND`: User does not exist
- `REACTION_NOT_FOUND`: Reaction does not exist

### Business Logic Errors
- `ACTIVE_SESSION_EXISTS`: User already has an active session
- `SESSION_ALREADY_ENDED`: Session has already been ended
- `REACTION_EXISTS`: User has already reacted with this type
- `ALREADY_MEMBER`: User is already a member of the group
- `USER_ALREADY_MEMBER`: User is already a member of the group

### Rate Limiting
- `RATE_LIMIT_EXCEEDED`: Too many requests

### Server Errors
- `INTERNAL_ERROR`: Internal server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable
- `DATABASE_ERROR`: Database operation failed

## 🔧 SDK Examples

### JavaScript/TypeScript
```typescript
import { ClockedAPI } from '@clocked/api-client';

const api = new ClockedAPI({
  baseURL: 'https://api.clocked.app',
  accessToken: 'your-access-token'
});

// Start a session
const session = await api.sessions.start({
  groupId: 'group_123',
  category: 'WORK',
  targetMin: 60,
  note: 'Working on project'
});

// Get group sessions
const sessions = await api.sessions.getGroupSessions('group_123', {
  active: true,
  limit: 10
});
```

### React Native
```typescript
import { useAuthStore } from './store/auth';
import { apiClient } from './lib/api';

function useSessions() {
  const { accessToken } = useAuthStore();
  
  const startSession = async (data: StartSessionData) => {
    apiClient.setToken(accessToken);
    return apiClient.startSession(data);
  };
  
  return { startSession };
}
```

## 📈 Rate Limits

### Authentication Endpoints
- **Magic Link Request**: 5 requests per hour per IP
- **Token Refresh**: 10 requests per hour per user
- **Login Attempts**: 5 failed attempts per hour per IP

### API Endpoints
- **General API**: 100 requests per 15 minutes per user
- **Session Creation**: 10 sessions per hour per user
- **Group Operations**: 20 operations per hour per user

### WebSocket
- **Connections**: 5 concurrent connections per user
- **Messages**: 100 messages per minute per connection

## 🔄 Webhooks

### Available Webhooks
- `session.started`: When a user starts a session
- `session.ended`: When a user ends a session
- `member.joined`: When a user joins a group
- `member.left`: When a user leaves a group

### Webhook Payload
```json
{
  "id": "webhook_123",
  "type": "session.started",
  "data": {
    "session": { /* session object */ },
    "user": { /* user object */ },
    "group": { /* group object */ }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Webhook Security
- **Signature**: HMAC-SHA256 signature in `X-Webhook-Signature` header
- **Retry**: Automatic retry with exponential backoff
- **Timeout**: 30-second timeout for webhook delivery

---

*This API documentation is updated regularly. Last updated: January 2024*
