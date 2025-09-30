import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { authenticate, requireGroupPermission, type AuthenticatedRequest } from '../middleware/auth';
import { createApiResponse, createApiErrorResponse } from '@clocked/shared';
import type { SessionCategory, SessionVisibility } from '@clocked/shared';

// Validation schemas
const startSessionSchema = z.object({
  groupId: z.string().uuid(),
  category: z.enum(['WORK', 'STUDY', 'EXERCISE', 'HOBBY', 'SOCIAL', 'OTHER']),
  targetMin: z.number().int().min(1).max(1440), // Max 24 hours
  locationCoarse: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
});

const updateSessionSchema = z.object({
  endTs: z.date().optional(),
  note: z.string().max(500).optional(),
  locationCoarse: z.string().max(100).optional(),
});

const addReactionSchema = z.object({
  type: z.enum(['LIKE', 'JOIN', 'ENCOURAGE']),
});

const getSessionsQuerySchema = z.object({
  active: z.coerce.boolean().optional(),
  category: z.enum(['WORK', 'STUDY', 'EXERCISE', 'HOBBY', 'SOCIAL', 'OTHER']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function sessionRoutes(fastify: FastifyInstance) {
  // Start session
  fastify.post('/', {
    preHandler: [authenticate],
    schema: {
      body: startSessionSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
                groupId: { type: 'string' },
                category: { type: 'string' },
                startTs: { type: 'string' },
                endTs: { type: 'string' },
                targetMin: { type: 'number' },
                locationCoarse: { type: 'string' },
                note: { type: 'string' },
                visibility: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      const sessionData = request.body as z.infer<typeof startSessionSchema>;
      
      // Check if user is a member of the group
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: sessionData.groupId,
            userId: authRequest.user.id,
          },
        },
      });

      if (!membership) {
        return reply.status(403).send(createApiErrorResponse(
          'NOT_GROUP_MEMBER',
          'You are not a member of this group'
        ));
      }

      // Check if user has an active session
      const activeSession = await prisma.session.findFirst({
        where: {
          userId: authRequest.user.id,
          endTs: null,
        },
      });

      if (activeSession) {
        return reply.status(409).send(createApiErrorResponse(
          'ACTIVE_SESSION_EXISTS',
          'You already have an active session'
        ));
      }

      const session = await prisma.session.create({
        data: {
          userId: authRequest.user.id,
          groupId: sessionData.groupId,
          category: sessionData.category,
          startTs: new Date(),
          targetMin: sessionData.targetMin,
          locationCoarse: sessionData.locationCoarse,
          note: sessionData.note,
          visibility: sessionData.visibility,
        },
      });

      // Log session start
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'SESSION_STARTED',
          subjectType: 'session',
          subjectId: session.id,
          metaJson: {
            groupId: sessionData.groupId,
            category: sessionData.category,
            targetMin: sessionData.targetMin,
          },
        },
      });

      // Broadcast session started event
      fastify.websocketServer?.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({
            type: 'session_started',
            groupId: sessionData.groupId,
            data: {
              session: {
                id: session.id,
                userId: session.userId,
                category: session.category,
                startTs: session.startTs,
                targetMin: session.targetMin,
                locationCoarse: session.locationCoarse,
                note: session.note,
                visibility: session.visibility,
              },
              user: {
                id: authRequest.user.id,
                handle: authRequest.user.handle,
              },
            },
            timestamp: new Date(),
          }));
        }
      });

      return reply.status(201).send(createApiResponse(session));
    } catch (error) {
      logger.error({ error }, 'Failed to start session');
      return reply.status(500).send(createApiErrorResponse(
        'SESSION_START_FAILED',
        'Failed to start session'
      ));
    }
  });

  // Get sessions for a group
  fastify.get('/group/:groupId', {
    preHandler: [authenticate, requireGroupPermission('MEMBER')],
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
        },
        required: ['groupId'],
      },
      querystring: getSessionsQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                sessions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      userId: { type: 'string' },
                      groupId: { type: 'string' },
                      category: { type: 'string' },
                      startTs: { type: 'string' },
                      endTs: { type: 'string' },
                      targetMin: { type: 'number' },
                      locationCoarse: { type: 'string' },
                      note: { type: 'string' },
                      visibility: { type: 'string' },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          handle: { type: 'string' },
                          photoUrl: { type: 'string' },
                          privacyMode: { type: 'boolean' },
                        },
                      },
                      reactions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            type: { type: 'string' },
                            userId: { type: 'string' },
                            ts: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
                total: { type: 'number' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { groupId } = request.params as { groupId: string };
      const query = request.query as z.infer<typeof getSessionsQuerySchema>;
      
      const where: any = {
        groupId,
      };

      if (query.active !== undefined) {
        where.endTs = query.active ? null : { not: null };
      }

      if (query.category) {
        where.category = query.category;
      }

      if (query.from || query.to) {
        where.startTs = {};
        if (query.from) {
          where.startTs.gte = query.from;
        }
        if (query.to) {
          where.startTs.lte = query.to;
        }
      }

      const [sessions, total] = await Promise.all([
        prisma.session.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                photoUrl: true,
                privacyMode: true,
              },
            },
            reactions: {
              select: {
                id: true,
                type: true,
                userId: true,
                ts: true,
              },
            },
          },
          orderBy: {
            startTs: 'desc',
          },
          take: query.limit,
          skip: query.offset,
        }),
        prisma.session.count({ where }),
      ]);

      return reply.send(createApiResponse({
        sessions,
        total,
        hasMore: query.offset + query.limit < total,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get group sessions');
      return reply.status(500).send(createApiErrorResponse(
        'SESSIONS_FETCH_FAILED',
        'Failed to fetch sessions'
      ));
    }
  });

  // Get user's sessions
  fastify.get('/me', {
    preHandler: [authenticate],
    schema: {
      querystring: getSessionsQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                sessions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      userId: { type: 'string' },
                      groupId: { type: 'string' },
                      category: { type: 'string' },
                      startTs: { type: 'string' },
                      endTs: { type: 'string' },
                      targetMin: { type: 'number' },
                      locationCoarse: { type: 'string' },
                      note: { type: 'string' },
                      visibility: { type: 'string' },
                      group: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          icon: { type: 'string' },
                        },
                      },
                    },
                  },
                },
                total: { type: 'number' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      const query = request.query as z.infer<typeof getSessionsQuerySchema>;
      
      const where: any = {
        userId: authRequest.user.id,
      };

      if (query.active !== undefined) {
        where.endTs = query.active ? null : { not: null };
      }

      if (query.category) {
        where.category = query.category;
      }

      if (query.from || query.to) {
        where.startTs = {};
        if (query.from) {
          where.startTs.gte = query.from;
        }
        if (query.to) {
          where.startTs.lte = query.to;
        }
      }

      const [sessions, total] = await Promise.all([
        prisma.session.findMany({
          where,
          include: {
            group: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
          orderBy: {
            startTs: 'desc',
          },
          take: query.limit,
          skip: query.offset,
        }),
        prisma.session.count({ where }),
      ]);

      return reply.send(createApiResponse({
        sessions,
        total,
        hasMore: query.offset + query.limit < total,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get user sessions');
      return reply.status(500).send(createApiErrorResponse(
        'SESSIONS_FETCH_FAILED',
        'Failed to fetch sessions'
      ));
    }
  });

  // Update session
  fastify.patch('/:sessionId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
      },
      body: updateSessionSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
                groupId: { type: 'string' },
                category: { type: 'string' },
                startTs: { type: 'string' },
                endTs: { type: 'string' },
                targetMin: { type: 'number' },
                locationCoarse: { type: 'string' },
                note: { type: 'string' },
                visibility: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { sessionId } = request.params as { sessionId: string };
      const updateData = request.body as z.infer<typeof updateSessionSchema>;
      
      // Check if session exists and belongs to user
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId: authRequest.user.id,
        },
      });

      if (!session) {
        return reply.status(404).send(createApiErrorResponse(
          'SESSION_NOT_FOUND',
          'Session not found'
        ));
      }

      const updatedSession = await prisma.session.update({
        where: { id: sessionId },
        data: updateData,
      });

      // Log session update
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'SESSION_UPDATED',
          subjectType: 'session',
          subjectId: sessionId,
          metaJson: updateData,
        },
      });

      // Broadcast session update if it was ended
      if (updateData.endTs && !session.endTs) {
        fastify.websocketServer?.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
              type: 'session_ended',
              groupId: session.groupId,
              data: {
                session: {
                  id: updatedSession.id,
                  userId: updatedSession.userId,
                  category: updatedSession.category,
                  startTs: updatedSession.startTs,
                  endTs: updatedSession.endTs,
                  targetMin: updatedSession.targetMin,
                  locationCoarse: updatedSession.locationCoarse,
                  note: updatedSession.note,
                  visibility: updatedSession.visibility,
                },
                user: {
                  id: authRequest.user.id,
                  handle: authRequest.user.handle,
                },
              },
              timestamp: new Date(),
            }));
          }
        });
      }

      return reply.send(createApiResponse(updatedSession));
    } catch (error) {
      logger.error({ error }, 'Failed to update session');
      return reply.status(500).send(createApiErrorResponse(
        'SESSION_UPDATE_FAILED',
        'Failed to update session'
      ));
    }
  });

  // Add reaction to session
  fastify.post('/:sessionId/reactions', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
      },
      body: addReactionSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                sessionId: { type: 'string' },
                userId: { type: 'string' },
                type: { type: 'string' },
                ts: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { sessionId } = request.params as { sessionId: string };
      const { type } = request.body as z.infer<typeof addReactionSchema>;
      
      // Check if session exists and user can access it
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          group: {
            members: {
              some: {
                userId: authRequest.user.id,
              },
            },
          },
        },
        include: {
          group: true,
        },
      });

      if (!session) {
        return reply.status(404).send(createApiErrorResponse(
          'SESSION_NOT_FOUND',
          'Session not found'
        ));
      }

      // Check if reaction already exists
      const existingReaction = await prisma.reaction.findUnique({
        where: {
          sessionId_userId_type: {
            sessionId,
            userId: authRequest.user.id,
            type,
          },
        },
      });

      if (existingReaction) {
        return reply.status(409).send(createApiErrorResponse(
          'REACTION_EXISTS',
          'You have already reacted to this session'
        ));
      }

      const reaction = await prisma.reaction.create({
        data: {
          sessionId,
          userId: authRequest.user.id,
          type,
        },
      });

      // Log reaction addition
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'REACTION_ADDED',
          subjectType: 'session',
          subjectId: sessionId,
          metaJson: { type },
        },
      });

      // Broadcast reaction added event
      fastify.websocketServer?.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({
            type: 'reaction_added',
            groupId: session.groupId,
            data: {
              reaction: {
                id: reaction.id,
                sessionId: reaction.sessionId,
                userId: reaction.userId,
                type: reaction.type,
                ts: reaction.ts,
              },
              user: {
                id: authRequest.user.id,
                handle: authRequest.user.handle,
              },
            },
            timestamp: new Date(),
          }));
        }
      });

      return reply.status(201).send(createApiResponse(reaction));
    } catch (error) {
      logger.error({ error }, 'Failed to add reaction');
      return reply.status(500).send(createApiErrorResponse(
        'REACTION_ADD_FAILED',
        'Failed to add reaction'
      ));
    }
  });

  // Remove reaction from session
  fastify.delete('/:sessionId/reactions/:reactionId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          reactionId: { type: 'string' },
        },
        required: ['sessionId', 'reactionId'],
      },
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
      const { sessionId, reactionId } = request.params as { sessionId: string; reactionId: string };
      
      // Check if reaction exists and belongs to user
      const reaction = await prisma.reaction.findFirst({
        where: {
          id: reactionId,
          sessionId,
          userId: authRequest.user.id,
        },
        include: {
          session: {
            include: {
              group: true,
            },
          },
        },
      });

      if (!reaction) {
        return reply.status(404).send(createApiErrorResponse(
          'REACTION_NOT_FOUND',
          'Reaction not found'
        ));
      }

      await prisma.reaction.delete({
        where: { id: reactionId },
      });

      // Log reaction removal
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'REACTION_REMOVED',
          subjectType: 'session',
          subjectId: sessionId,
          metaJson: { type: reaction.type },
        },
      });

      return reply.send(createApiResponse({
        message: 'Reaction removed successfully',
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to remove reaction');
      return reply.status(500).send(createApiErrorResponse(
        'REACTION_REMOVE_FAILED',
        'Failed to remove reaction'
      ));
    }
  });
}
