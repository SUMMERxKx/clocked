import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { prisma } from './db';
import { logger } from './logger';
import type { User, UserRole } from '@clocked/shared';

export interface JWTPayload {
  userId: string;
  email: string;
  handle: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat: number;
  exp: number;
}

export class AuthService {
  /**
   * Generate access token
   */
  static generateAccessToken(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      handle: user.handle,
    };

    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
      issuer: 'clocked',
      audience: 'clocked-users',
    });
  }

  /**
   * Generate refresh token and store in database
   */
  static async generateRefreshToken(userId: string): Promise<string> {
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.parseExpiresIn(config.refreshTokenExpiresIn));

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        token: crypto.randomUUID(),
        userId,
        expiresAt,
      },
    });

    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      userId,
      tokenId,
    };

    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.refreshTokenExpiresIn,
      issuer: 'clocked',
      audience: 'clocked-refresh',
    });
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        issuer: 'clocked',
        audience: 'clocked-users',
      }) as JWTPayload;

      return payload;
    } catch (error) {
      logger.warn({ error }, 'Invalid access token');
      throw new Error('Invalid access token');
    }
  }

  /**
   * Verify refresh token and check database
   */
  static async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = jwt.verify(token, config.jwtSecret, {
        issuer: 'clocked',
        audience: 'clocked-refresh',
      }) as RefreshTokenPayload;

      // Check if token exists in database and is not revoked
      const refreshToken = await prisma.refreshToken.findUnique({
        where: { id: payload.tokenId },
      });

      if (!refreshToken || refreshToken.revoked || refreshToken.expiresAt < new Date()) {
        throw new Error('Refresh token is invalid or expired');
      }

      return payload;
    } catch (error) {
      logger.warn({ error }, 'Invalid refresh token');
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Revoke refresh token
   */
  static async revokeRefreshToken(tokenId: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revoked: true },
    });
  }

  /**
   * Revoke all refresh tokens for a user (token family rotation)
   */
  static async revokeAllRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }

  /**
   * Hash password
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.bcryptRounds);
  }

  /**
   * Verify password
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate magic link token
   */
  static async generateMagicLinkToken(email: string): Promise<string> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store magic link in database
    await prisma.magicLink.create({
      data: {
        token,
        email,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Verify magic link token
   */
  static async verifyMagicLinkToken(token: string): Promise<string> {
    const magicLink = await prisma.magicLink.findUnique({
      where: { token },
    });

    if (!magicLink || magicLink.used || magicLink.expiresAt < new Date()) {
      throw new Error('Magic link is invalid or expired');
    }

    // Mark as used
    await prisma.magicLink.update({
      where: { token },
      data: { used: true },
    });

    return magicLink.email;
  }

  /**
   * Check if user has permission for group action
   */
  static async checkGroupPermission(
    userId: string,
    groupId: string,
    requiredRole: UserRole = 'MEMBER'
  ): Promise<boolean> {
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      return false;
    }

    const roleHierarchy = { MEMBER: 1, ADMIN: 2, OWNER: 3 };
    return roleHierarchy[membership.role] >= roleHierarchy[requiredRole];
  }

  /**
   * Get user's role in group
   */
  static async getUserGroupRole(userId: string, groupId: string): Promise<UserRole | null> {
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    return membership?.role || null;
  }

  /**
   * Parse expires in string to milliseconds
   */
  private static parseExpiresIn(expiresIn: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expires in format: ${expiresIn}`);
    }

    const [, value, unit] = match;
    return parseInt(value, 10) * units[unit];
  }
}

/**
 * Extract token from Authorization header
 */
export const extractToken = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

/**
 * Generate secure random string
 */
export const generateSecureToken = (length = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  
  return result;
};
