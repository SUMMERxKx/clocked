import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../lib/db';
import type { User } from '@clocked/shared';

describe('Auth Routes', () => {
  let app: any;
  let testUser: User;

  beforeEach(async () => {
    app = await createApp();
    
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        handle: 'testuser',
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: 'test@example.com' },
    });
    await prisma.refreshToken.deleteMany();
    await prisma.magicLink.deleteMany();
  });

  describe('POST /v1/auth/magic-link', () => {
    it('should request magic link for existing user', async () => {
      const response = await request(app)
        .post('/v1/auth/magic-link')
        .send({
          email: 'test@example.com',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Magic link sent');
    });

    it('should return 404 for non-existing user', async () => {
      const response = await request(app)
        .post('/v1/auth/magic-link')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/v1/auth/magic-link')
        .send({
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /v1/auth/magic-link/verify', () => {
    it('should verify valid magic link and create user session', async () => {
      // Generate magic link token
      const magicLink = await prisma.magicLink.create({
        data: {
          token: 'test-token-123',
          email: 'test@example.com',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        },
      });

      const response = await request(app)
        .post('/v1/auth/magic-link/verify')
        .send({
          token: 'test-token-123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.id).toBe(testUser.id);
    });

    it('should create new user if not exists', async () => {
      const magicLink = await prisma.magicLink.create({
        data: {
          token: 'test-token-456',
          email: 'newuser@example.com',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      const response = await request(app)
        .post('/v1/auth/magic-link/verify')
        .send({
          token: 'test-token-456',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('newuser@example.com');
      
      // Check that user was created
      const createdUser = await prisma.user.findUnique({
        where: { email: 'newuser@example.com' },
      });
      expect(createdUser).toBeDefined();
    });

    it('should return 400 for invalid magic link', async () => {
      const response = await request(app)
        .post('/v1/auth/magic-link/verify')
        .send({
          token: 'invalid-token',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MAGIC_LINK');
    });

    it('should return 400 for expired magic link', async () => {
      const magicLink = await prisma.magicLink.create({
        data: {
          token: 'expired-token',
          email: 'test@example.com',
          expiresAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        },
      });

      const response = await request(app)
        .post('/v1/auth/magic-link/verify')
        .send({
          token: 'expired-token',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MAGIC_LINK');
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('should refresh valid refresh token', async () => {
      // Create refresh token
      const refreshToken = await prisma.refreshToken.create({
        data: {
          id: 'refresh-token-123',
          token: 'refresh-token-value',
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      const response = await request(app)
        .post('/v1/auth/refresh')
        .send({
          refreshToken: 'refresh-token-value',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return current user with valid token', async () => {
      // Generate access token
      const { AuthService } = await import('../../lib/auth');
      const accessToken = AuthService.generateAccessToken(testUser);

      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUser.id);
      expect(response.body.data.email).toBe(testUser.email);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('PATCH /v1/auth/me', () => {
    it('should update user profile with valid token', async () => {
      const { AuthService } = await import('../../lib/auth');
      const accessToken = AuthService.generateAccessToken(testUser);

      const response = await request(app)
        .patch('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          handle: 'newhandle',
          privacyMode: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.handle).toBe('newhandle');
      expect(response.body.data.privacyMode).toBe(true);
    });

    it('should return 409 for taken handle', async () => {
      // Create another user with a handle
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          handle: 'takenhandle',
        },
      });

      const { AuthService } = await import('../../lib/auth');
      const accessToken = AuthService.generateAccessToken(testUser);

      const response = await request(app)
        .patch('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          handle: 'takenhandle',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HANDLE_TAKEN');

      // Clean up
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });
});
