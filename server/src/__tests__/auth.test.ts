import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AuthService } from '../lib/auth';
import { prisma } from '../lib/db';
import type { User } from '@clocked/shared';

describe('AuthService', () => {
  let testUser: User;

  beforeEach(async () => {
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

  describe('generateAccessToken', () => {
    it('should generate a valid JWT token', () => {
      const token = AuthService.generateAccessToken(testUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include user information in token payload', () => {
      const token = AuthService.generateAccessToken(testUser);
      const payload = AuthService.verifyAccessToken(token);
      
      expect(payload.userId).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
      expect(payload.handle).toBe(testUser.handle);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', () => {
      const token = AuthService.generateAccessToken(testUser);
      const payload = AuthService.verifyAccessToken(token);
      
      expect(payload.userId).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
      expect(payload.handle).toBe(testUser.handle);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        AuthService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid access token');
    });

    it('should throw error for expired token', () => {
      // Create a token with past expiration
      const expiredToken = AuthService.generateAccessToken(testUser);
      
      // Mock Date.now to return a time in the future
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 20 * 60 * 1000); // 20 minutes later
      
      expect(() => {
        AuthService.verifyAccessToken(expiredToken);
      }).toThrow('Invalid access token');
      
      Date.now = originalNow;
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate and store refresh token', async () => {
      const refreshToken = await AuthService.generateRefreshToken(testUser.id);
      
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
      
      // Check that token is stored in database
      const storedTokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      });
      
      expect(storedTokens).toHaveLength(1);
      expect(storedTokens[0].userId).toBe(testUser.id);
      expect(storedTokens[0].revoked).toBe(false);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', async () => {
      const refreshToken = await AuthService.generateRefreshToken(testUser.id);
      const payload = await AuthService.verifyRefreshToken(refreshToken);
      
      expect(payload.userId).toBe(testUser.id);
      expect(payload.tokenId).toBeDefined();
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(
        AuthService.verifyRefreshToken('invalid-token')
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for revoked refresh token', async () => {
      const refreshToken = await AuthService.generateRefreshToken(testUser.id);
      
      // Revoke the token
      const payload = AuthService.verifyAccessToken(refreshToken);
      await AuthService.revokeRefreshToken(payload.tokenId);
      
      await expect(
        AuthService.verifyRefreshToken(refreshToken)
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke a refresh token', async () => {
      const refreshToken = await AuthService.generateRefreshToken(testUser.id);
      const payload = await AuthService.verifyRefreshToken(refreshToken);
      
      await AuthService.revokeRefreshToken(payload.tokenId);
      
      const storedToken = await prisma.refreshToken.findUnique({
        where: { id: payload.tokenId },
      });
      
      expect(storedToken?.revoked).toBe(true);
    });
  });

  describe('generateMagicLinkToken', () => {
    it('should generate and store magic link token', async () => {
      const token = await AuthService.generateMagicLinkToken('test@example.com');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Check that token is stored in database
      const storedLink = await prisma.magicLink.findUnique({
        where: { token },
      });
      
      expect(storedLink).toBeDefined();
      expect(storedLink?.email).toBe('test@example.com');
      expect(storedLink?.used).toBe(false);
    });
  });

  describe('verifyMagicLinkToken', () => {
    it('should verify a valid magic link token', async () => {
      const token = await AuthService.generateMagicLinkToken('test@example.com');
      const email = await AuthService.verifyMagicLinkToken(token);
      
      expect(email).toBe('test@example.com');
      
      // Check that token is marked as used
      const storedLink = await prisma.magicLink.findUnique({
        where: { token },
      });
      
      expect(storedLink?.used).toBe(true);
    });

    it('should throw error for invalid magic link token', async () => {
      await expect(
        AuthService.verifyMagicLinkToken('invalid-token')
      ).rejects.toThrow('Magic link is invalid or expired');
    });

    it('should throw error for used magic link token', async () => {
      const token = await AuthService.generateMagicLinkToken('test@example.com');
      
      // Use the token once
      await AuthService.verifyMagicLinkToken(token);
      
      // Try to use it again
      await expect(
        AuthService.verifyMagicLinkToken(token)
      ).rejects.toThrow('Magic link is invalid or expired');
    });
  });

  describe('checkGroupPermission', () => {
    let testGroup: any;

    beforeEach(async () => {
      testGroup = await prisma.group.create({
        data: {
          name: 'Test Group',
          ownerId: testUser.id,
        },
      });

      await prisma.groupMember.create({
        data: {
          groupId: testGroup.id,
          userId: testUser.id,
          role: 'OWNER',
        },
      });
    });

    afterEach(async () => {
      await prisma.groupMember.deleteMany();
      await prisma.group.deleteMany();
    });

    it('should return true for user with required permission', async () => {
      const hasPermission = await AuthService.checkGroupPermission(
        testUser.id,
        testGroup.id,
        'MEMBER'
      );
      
      expect(hasPermission).toBe(true);
    });

    it('should return false for user without permission', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          handle: 'otheruser',
        },
      });

      const hasPermission = await AuthService.checkGroupPermission(
        otherUser.id,
        testGroup.id,
        'MEMBER'
      );
      
      expect(hasPermission).toBe(false);
    });

    it('should return true for user with higher permission', async () => {
      const hasPermission = await AuthService.checkGroupPermission(
        testUser.id,
        testGroup.id,
        'ADMIN'
      );
      
      expect(hasPermission).toBe(true);
    });
  });
});
