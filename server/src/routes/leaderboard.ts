import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { authenticate, requireGroupPermission, type AuthenticatedRequest } from '../middleware/auth';
import { createApiResponse, createApiErrorResponse } from '@clocked/shared';

// Validation schemas
const getLeaderboardQuerySchema = z.object({
  week: z.string().regex(/^\d{4}-W\d{2}$/).optional(),
  category: z.enum(['WORK', 'STUDY', 'EXERCISE', 'HOBBY', 'SOCIAL', 'OTHER']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function leaderboardRoutes(fastify: FastifyInstance) {
  // Get group leaderboard
  fastify.get('/:groupId/leaderboard', {
    preHandler: [authenticate, requireGroupPermission('MEMBER')],
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
        },
        required: ['groupId'],
      },
      querystring: getLeaderboardQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                leaderboard: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      userId: { type: 'string' },
                      handle: { type: 'string' },
                      photoUrl: { type: 'string' },
                      totalMinutes: { type: 'number' },
                      sessionCount: { type: 'number' },
                      rank: { type: 'number' },
                      privacyMode: { type: 'boolean' },
                    },
                  },
                },
                week: { type: 'string' },
                category: { type: 'string' },
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
      const { groupId } = request.params as { groupId: string };
      const query = request.query as z.infer<typeof getLeaderboardQuerySchema>;
      
      // Calculate date range for the week
      let startDate: Date;
      let endDate: Date;
      
      if (query.week) {
        const [year, week] = query.week.split('-W').map(Number);
        startDate = getWeekStartDate(year, week);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      } else {
        // Default to current week
        const now = new Date();
        startDate = getWeekStartDate(now.getFullYear(), getWeekNumber(now));
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      }

      // Build query conditions
      const whereConditions: any = {
        groupId,
        startTs: {
          gte: startDate,
          lte: endDate,
        },
        endTs: { not: null }, // Only completed sessions
      };

      if (query.category) {
        whereConditions.category = query.category;
      }

      // Get leaderboard data
      const leaderboardData = await prisma.session.groupBy({
        by: ['userId'],
        where: whereConditions,
        _sum: {
          targetMin: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            targetMin: 'desc',
          },
        },
        take: query.limit,
        skip: query.offset,
      });

      // Get user details for leaderboard entries
      const userIds = leaderboardData.map(entry => entry.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          handle: true,
          photoUrl: true,
          privacyMode: true,
        },
      });

      // Create user lookup map
      const userMap = new Map(users.map(user => [user.id, user]));

      // Build leaderboard entries
      const leaderboard = leaderboardData.map((entry, index) => {
        const user = userMap.get(entry.userId);
        const totalMinutes = entry._sum.targetMin || 0;
        const sessionCount = entry._count.id || 0;
        const rank = query.offset + index + 1;

        return {
          userId: entry.userId,
          handle: user?.handle || 'Unknown User',
          photoUrl: user?.photoUrl || null,
          totalMinutes,
          sessionCount,
          rank,
          privacyMode: user?.privacyMode || false,
        };
      });

      // Apply privacy mode filtering
      const filteredLeaderboard = leaderboard.map(entry => {
        if (entry.privacyMode) {
          return {
            ...entry,
            handle: 'Active User',
            photoUrl: null,
            totalMinutes: 0,
            sessionCount: 0,
          };
        }
        return entry;
      });

      // Get total count for pagination
      const totalCount = await prisma.session.groupBy({
        by: ['userId'],
        where: whereConditions,
        _sum: {
          targetMin: true,
        },
      });

      return reply.send(createApiResponse({
        leaderboard: filteredLeaderboard,
        week: query.week || `${new Date().getFullYear()}-W${getWeekNumber(new Date()).toString().padStart(2, '0')}`,
        category: query.category || 'all',
        total: totalCount.length,
        hasMore: query.offset + query.limit < totalCount.length,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get group leaderboard');
      return reply.status(500).send(createApiErrorResponse(
        'LEADERBOARD_FETCH_FAILED',
        'Failed to fetch leaderboard'
      ));
    }
  });

  // Get user's personal stats
  fastify.get('/:groupId/stats/:userId', {
    preHandler: [authenticate, requireGroupPermission('MEMBER')],
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
          userId: { type: 'string' },
        },
        required: ['groupId', 'userId'],
      },
      querystring: z.object({
        week: z.string().regex(/^\d{4}-W\d{2}$/).optional(),
        category: z.enum(['WORK', 'STUDY', 'EXERCISE', 'HOBBY', 'SOCIAL', 'OTHER']).optional(),
      }),
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                handle: { type: 'string' },
                photoUrl: { type: 'string' },
                totalMinutes: { type: 'number' },
                sessionCount: { type: 'number' },
                averageSessionLength: { type: 'number' },
                longestSession: { type: 'number' },
                categoryBreakdown: {
                  type: 'object',
                  additionalProperties: { type: 'number' },
                },
                weeklyProgress: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: { type: 'string' },
                      minutes: { type: 'number' },
                    },
                  },
                },
                rank: { type: 'number' },
                privacyMode: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { groupId, userId } = request.params as { groupId: string; userId: string };
      const query = request.query as z.infer<typeof z.object({
        week: z.string().regex(/^\d{4}-W\d{2}$/).optional(),
        category: z.enum(['WORK', 'STUDY', 'EXERCISE', 'HOBBY', 'SOCIAL', 'OTHER']).optional(),
      })>;
      
      // Check if user is requesting their own stats or if they have permission
      if (userId !== authRequest.user.id) {
        // Check if the target user is in the same group
        const targetUserMembership = await prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId,
            },
          },
        });

        if (!targetUserMembership) {
          return reply.status(404).send(createApiErrorResponse(
            'USER_NOT_IN_GROUP',
            'User is not a member of this group'
          ));
        }
      }

      // Calculate date range
      let startDate: Date;
      let endDate: Date;
      
      if (query.week) {
        const [year, week] = query.week.split('-W').map(Number);
        startDate = getWeekStartDate(year, week);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      } else {
        // Default to current week
        const now = new Date();
        startDate = getWeekStartDate(now.getFullYear(), getWeekNumber(now));
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      }

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          handle: true,
          photoUrl: true,
          privacyMode: true,
        },
      });

      if (!user) {
        return reply.status(404).send(createApiErrorResponse(
          'USER_NOT_FOUND',
          'User not found'
        ));
      }

      // If user is in privacy mode and requesting someone else's stats, return limited data
      if (user.privacyMode && userId !== authRequest.user.id) {
        return reply.send(createApiResponse({
          userId: user.id,
          handle: 'Active User',
          photoUrl: null,
          totalMinutes: 0,
          sessionCount: 0,
          averageSessionLength: 0,
          longestSession: 0,
          categoryBreakdown: {},
          weeklyProgress: [],
          rank: 0,
          privacyMode: true,
        }));
      }

      // Build query conditions
      const whereConditions: any = {
        groupId,
        userId,
        startTs: {
          gte: startDate,
          lte: endDate,
        },
        endTs: { not: null },
      };

      if (query.category) {
        whereConditions.category = query.category;
      }

      // Get session statistics
      const sessions = await prisma.session.findMany({
        where: whereConditions,
        select: {
          targetMin: true,
          startTs: true,
          endTs: true,
          category: true,
        },
      });

      // Calculate statistics
      const totalMinutes = sessions.reduce((sum, session) => sum + session.targetMin, 0);
      const sessionCount = sessions.length;
      const averageSessionLength = sessionCount > 0 ? totalMinutes / sessionCount : 0;
      const longestSession = Math.max(...sessions.map(s => s.targetMin), 0);

      // Category breakdown
      const categoryBreakdown = sessions.reduce((acc, session) => {
        acc[session.category] = (acc[session.category] || 0) + session.targetMin;
        return acc;
      }, {} as Record<string, number>);

      // Weekly progress (daily breakdown)
      const weeklyProgress = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        const daySessions = sessions.filter(session => 
          session.startTs >= dayStart && session.startTs <= dayEnd
        );
        
        const dayMinutes = daySessions.reduce((sum, session) => sum + session.targetMin, 0);
        
        weeklyProgress.push({
          date: dayStart.toISOString().split('T')[0],
          minutes: dayMinutes,
        });
      }

      // Calculate rank
      const rank = await calculateUserRank(groupId, userId, startDate, endDate, query.category);

      return reply.send(createApiResponse({
        userId: user.id,
        handle: user.handle,
        photoUrl: user.photoUrl,
        totalMinutes,
        sessionCount,
        averageSessionLength: Math.round(averageSessionLength),
        longestSession,
        categoryBreakdown,
        weeklyProgress,
        rank,
        privacyMode: user.privacyMode,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get user stats');
      return reply.status(500).send(createApiErrorResponse(
        'STATS_FETCH_FAILED',
        'Failed to fetch user stats'
      ));
    }
  });
}

// Helper functions
function getWeekStartDate(year: number, week: number): Date {
  const date = new Date(year, 0, 1);
  const dayOfWeek = date.getDay();
  const daysToAdd = (week - 1) * 7 - dayOfWeek + 1;
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

async function calculateUserRank(
  groupId: string,
  userId: string,
  startDate: Date,
  endDate: Date,
  category?: string
): Promise<number> {
  const whereConditions: any = {
    groupId,
    startTs: {
      gte: startDate,
      lte: endDate,
    },
    endTs: { not: null },
  };

  if (category) {
    whereConditions.category = category;
  }

  const leaderboardData = await prisma.session.groupBy({
    by: ['userId'],
    where: whereConditions,
    _sum: {
      targetMin: true,
    },
    orderBy: {
      _sum: {
        targetMin: 'desc',
      },
    },
  });

  const userIndex = leaderboardData.findIndex(entry => entry.userId === userId);
  return userIndex >= 0 ? userIndex + 1 : 0;
}
