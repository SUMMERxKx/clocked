import Fastify from 'fastify';
import { config } from './config';

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Health check route
  fastify.get('/health', async (request, reply) => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'Clocked API is running!'
    };
  });

  // API routes
  fastify.get('/api/status', async (request, reply) => {
    return { 
      message: 'Clocked API is running!',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV
    };
  });

  // Error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    console.error('Request error:', error, request.url);
    
    reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred',
      },
    });
  });

  return fastify;
}