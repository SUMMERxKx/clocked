import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './config';
import { logger } from './lib/logger';
import { WebSocketManager } from './lib/websocket';
import { errorHandler, requestLogger } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { groupRoutes } from './routes/groups';
import { sessionRoutes } from './routes/sessions';

export async function createApp() {
  const fastify = Fastify({
    logger: logger,
    trustProxy: true,
    bodyLimit: config.maxFileSize,
  });

  // Register plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  await fastify.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: config.jwtSecret,
    sign: {
      issuer: 'clocked',
      audience: 'clocked-users',
    },
    verify: {
      issuer: 'clocked',
      audience: 'clocked-users',
    },
  });

  await fastify.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
      },
    }),
  });

  await fastify.register(websocket, {
    options: {
      maxPayload: 1024 * 1024, // 1MB
    },
  });

  // Register middleware
  fastify.addHook('preHandler', requestLogger);
  fastify.setErrorHandler(errorHandler);

  // Health check
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // API routes
  await fastify.register(authRoutes, { prefix: '/v1/auth' });
  await fastify.register(groupRoutes, { prefix: '/v1/groups' });
  await fastify.register(sessionRoutes, { prefix: '/v1/sessions' });

  // WebSocket support
  let wsManager: WebSocketManager;

  fastify.ready().then(() => {
    wsManager = new WebSocketManager(fastify.server);
    
    // Make WebSocket manager available to routes
    fastify.decorate('wsManager', wsManager);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');
    
    try {
      if (wsManager) {
        wsManager.close();
      }
      
      await fastify.close();
      logger.info('Server closed gracefully');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return fastify;
}

// Declare WebSocket manager type for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    wsManager: WebSocketManager;
  }
}
