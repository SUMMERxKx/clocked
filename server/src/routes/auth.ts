import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../lib/auth';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth';
import { createApiResponse, createApiErrorResponse } from '@clocked/shared';

// Validation schemas
const magicLinkRequestSchema = z.object({
  email: z.string().email(),
  redirectUrl: z.string().url().optional(),
});

const magicLinkVerifySchema = z.object({
  token: z.string().min(1),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Request magic link
  fastify.post('/magic-link', {
    schema: {
      body: magicLinkRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { email, redirectUrl } = request.body as z.infer<typeof magicLinkRequestSchema>;
      
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (!existingUser) {
        return reply.status(404).send(createApiErrorResponse(
          'USER_NOT_FOUND',
          'No account found with this email address'
        ));
      }

      // Generate magic link token
      const token = await AuthService.generateMagicLinkToken(email);
      
      // TODO: Send email with magic link
      // For now, just log the token in development
      if (process.env.NODE_ENV === 'development') {
        logger.info({ email, token }, 'Magic link generated (dev mode)');
      }

      return reply.send(createApiResponse({
        message: 'Magic link sent to your email',
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to send magic link');
      return reply.status(500).send(createApiErrorResponse(
        'MAGIC_LINK_FAILED',
        'Failed to send magic link'
      ));
    }
  });

  // Verify magic link
  fastify.post('/magic-link/verify', {
    schema: {
      body: magicLinkVerifySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    handle: { type: 'string' },
                    email: { type: 'string' },
                    photoUrl: { type: 'string' },
                    privacyMode: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { token } = request.body as z.infer<typeof magicLinkVerifySchema>;
      
      // Verify magic link token
      const email = await AuthService.verifyMagicLinkToken(token);
      
      // Get or create user
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Create new user
        const handle = email.split('@')[0] + Math.random().toString(36).substring(2, 8);
        
        user = await prisma.user.create({
          data: {
            email,
            handle,
          },
        });

        // Log user creation
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'USER_CREATED',
            subjectType: 'user',
            subjectId: user.id,
            metaJson: { email, handle },
          },
        });
      }

      // Generate tokens
      const accessToken = AuthService.generateAccessToken(user);
      const refreshToken = await AuthService.generateRefreshToken(user.id);

      // Log successful login
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'AUTH_LOGIN',
          subjectType: 'user',
          subjectId: user.id,
          metaJson: { method: 'magic_link' },
        },
      });

      return reply.send(createApiResponse({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          handle: user.handle,
          email: user.email,
          photoUrl: user.photoUrl,
          privacyMode: user.privacyMode,
        },
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to verify magic link');
      return reply.status(400).send(createApiErrorResponse(
        'INVALID_MAGIC_LINK',
        'Invalid or expired magic link'
      ));
    }
  });

  // Refresh token
  fastify.post('/refresh', {
    schema: {
      body: refreshTokenSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { refreshToken } = request.body as z.infer<typeof refreshTokenSchema>;
      
      // Verify refresh token
      const payload = await AuthService.verifyRefreshToken(refreshToken);
      
      // Get user
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        return reply.status(401).send(createApiErrorResponse(
          'USER_NOT_FOUND',
          'User not found'
        ));
      }

      // Revoke old refresh token
      await AuthService.revokeRefreshToken(payload.tokenId);

      // Generate new tokens
      const newAccessToken = AuthService.generateAccessToken(user);
      const newRefreshToken = await AuthService.generateRefreshToken(user.id);

      // Log token refresh
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'AUTH_TOKEN_REFRESH',
          subjectType: 'user',
          subjectId: user.id,
        },
      });

      return reply.send(createApiResponse({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to refresh token');
      return reply.status(401).send(createApiErrorResponse(
        'INVALID_REFRESH_TOKEN',
        'Invalid or expired refresh token'
      ));
    }
  });

  // Logout
  fastify.post('/logout', {
    preHandler: [authenticate],
    schema: {
      body: refreshTokenSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { refreshToken } = request.body as z.infer<typeof refreshTokenSchema>;
      
      // Verify and revoke refresh token
      const payload = await AuthService.verifyRefreshToken(refreshToken);
      await AuthService.revokeRefreshToken(payload.tokenId);

      // Log logout
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'AUTH_LOGOUT',
          subjectType: 'user',
          subjectId: authRequest.user.id,
        },
      });

      return reply.send(createApiResponse({
        message: 'Logged out successfully',
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to logout');
      return reply.status(400).send(createApiErrorResponse(
        'LOGOUT_FAILED',
        'Failed to logout'
      ));
    }
  });

  // Get current user
  fastify.get('/me', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                handle: { type: 'string' },
                email: { type: 'string' },
                photoUrl: { type: 'string' },
                privacyMode: { type: 'boolean' },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      
      const user = await prisma.user.findUnique({
        where: { id: authRequest.user.id },
        select: {
          id: true,
          handle: true,
          email: true,
          photoUrl: true,
          privacyMode: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send(createApiErrorResponse(
          'USER_NOT_FOUND',
          'User not found'
        ));
      }

      return reply.send(createApiResponse(user));
    } catch (error) {
      logger.error({ error }, 'Failed to get current user');
      return reply.status(500).send(createApiErrorResponse(
        'USER_FETCH_FAILED',
        'Failed to fetch user data'
      ));
    }
  });

  // Update user profile
  fastify.patch('/me', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          handle: { type: 'string', minLength: 1, maxLength: 50 },
          photoUrl: { type: 'string', format: 'uri' },
          privacyMode: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                handle: { type: 'string' },
                email: { type: 'string' },
                photoUrl: { type: 'string' },
                privacyMode: { type: 'boolean' },
                createdAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      const updateData = request.body as {
        handle?: string;
        photoUrl?: string;
        privacyMode?: boolean;
      };
      
      // Check if handle is already taken
      if (updateData.handle) {
        const existingUser = await prisma.user.findFirst({
          where: {
            handle: updateData.handle,
            id: { not: authRequest.user.id },
          },
        });

        if (existingUser) {
          return reply.status(409).send(createApiErrorResponse(
            'HANDLE_TAKEN',
            'This handle is already taken'
          ));
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: authRequest.user.id },
        data: updateData,
        select: {
          id: true,
          handle: true,
          email: true,
          photoUrl: true,
          privacyMode: true,
          createdAt: true,
        },
      });

      // Log profile update
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'USER_UPDATED',
          subjectType: 'user',
          subjectId: authRequest.user.id,
          metaJson: updateData,
        },
      });

      return reply.send(createApiResponse(updatedUser));
    } catch (error) {
      logger.error({ error }, 'Failed to update user profile');
      return reply.status(500).send(createApiErrorResponse(
        'PROFILE_UPDATE_FAILED',
        'Failed to update profile'
      ));
    }
  });
}
