import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, extractToken } from '../lib/auth';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import type { UserRole } from '@clocked/shared';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    handle: string;
  };
}

/**
 * Authentication middleware
 */
export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = extractToken(request.headers.authorization);
    
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authentication token provided',
        },
      });
    }

    const payload = AuthService.verifyAccessToken(token);
    
    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        handle: true,
        privacyMode: true,
      },
    });

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Attach user to request
    (request as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      handle: user.handle,
    };

    logger.debug({ userId: user.id }, 'User authenticated');
  } catch (error) {
    logger.warn({ error }, 'Authentication failed');
    
    return reply.status(401).send({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  try {
    const token = extractToken(request.headers.authorization);
    
    if (!token) {
      return; // No token provided, continue without authentication
    }

    const payload = AuthService.verifyAccessToken(token);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        handle: true,
        privacyMode: true,
      },
    });

    if (user) {
      (request as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email,
        handle: user.handle,
      };
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
    logger.debug({ error }, 'Optional authentication failed');
  }
};

/**
 * Group permission middleware
 */
export const requireGroupPermission = (requiredRole: UserRole = 'MEMBER') => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const authRequest = request as AuthenticatedRequest;
    
    if (!authRequest.user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const groupId = (request.params as { groupId: string }).groupId;
    
    if (!groupId) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_GROUP_ID',
          message: 'Group ID is required',
        },
      });
    }

    try {
      const hasPermission = await AuthService.checkGroupPermission(
        authRequest.user.id,
        groupId,
        requiredRole
      );

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Requires ${requiredRole} role or higher`,
          },
        });
      }
    } catch (error) {
      logger.error({ error, groupId, userId: authRequest.user.id }, 'Permission check failed');
      
      return reply.status(500).send({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_FAILED',
          message: 'Failed to verify permissions',
        },
      });
    }
  };
};

/**
 * Rate limiting middleware
 */
export const rateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, number[]>();
  
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const key = request.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const userRequests = requests.get(key)!;
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => time > windowStart);
    
    if (validRequests.length >= maxRequests) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: {
            limit: maxRequests,
            window: windowMs,
            retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000),
          },
        },
      });
    }
    
    validRequests.push(now);
    requests.set(key, validRequests);
  };
};

/**
 * Request logging middleware
 */
export const requestLogger = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const start = Date.now();
  
  request.addHook('onResponse', (request, reply) => {
    const duration = Date.now() - start;
    
    logger.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    }, 'Request completed');
  });
};

/**
 * Error handling middleware
 */
export const errorHandler = async (
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
    },
  }, 'Unhandled error');

  const statusCode = error.name === 'ValidationError' ? 400 : 500;
  
  reply.status(statusCode).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'Internal server error' : error.message,
    },
  });
};
