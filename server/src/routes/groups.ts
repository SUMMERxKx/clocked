import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { authenticate, requireGroupPermission, type AuthenticatedRequest } from '../middleware/auth';
import { createApiResponse, createApiErrorResponse, generateInviteCode } from '@clocked/shared';
import type { UserRole } from '@clocked/shared';

// Validation schemas
const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(10).optional(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']).default('PRIVATE'),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(10).optional(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

const joinGroupSchema = z.object({
  inviteToken: z.string().min(1),
});

export async function groupRoutes(fastify: FastifyInstance) {
  // Create group
  fastify.post('/', {
    preHandler: [authenticate],
    schema: {
      body: createGroupSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                icon: { type: 'string' },
                visibility: { type: 'string' },
                ownerId: { type: 'string' },
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
      const { name, icon, visibility } = request.body as z.infer<typeof createGroupSchema>;
      
      const group = await prisma.group.create({
        data: {
          name,
          icon,
          visibility,
          ownerId: authRequest.user.id,
        },
        select: {
          id: true,
          name: true,
          icon: true,
          visibility: true,
          ownerId: true,
          createdAt: true,
        },
      });

      // Add owner as member
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: authRequest.user.id,
          role: 'OWNER',
        },
      });

      // Log group creation
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'GROUP_CREATED',
          subjectType: 'group',
          subjectId: group.id,
          metaJson: { name, visibility },
        },
      });

      return reply.status(201).send(createApiResponse(group));
    } catch (error) {
      logger.error({ error }, 'Failed to create group');
      return reply.status(500).send(createApiErrorResponse(
        'GROUP_CREATION_FAILED',
        'Failed to create group'
      ));
    }
  });

  // Get user's groups
  fastify.get('/', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  icon: { type: 'string' },
                  visibility: { type: 'string' },
                  ownerId: { type: 'string' },
                  createdAt: { type: 'string' },
                  role: { type: 'string' },
                  memberCount: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      
      const groups = await prisma.group.findMany({
        where: {
          members: {
            some: {
              userId: authRequest.user.id,
            },
          },
        },
        include: {
          members: {
            select: {
              role: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const groupsWithRole = groups.map(group => ({
        id: group.id,
        name: group.name,
        icon: group.icon,
        visibility: group.visibility,
        ownerId: group.ownerId,
        createdAt: group.createdAt,
        role: group.members.find(m => m.userId === authRequest.user.id)?.role,
        memberCount: group._count.members,
      }));

      return reply.send(createApiResponse(groupsWithRole));
    } catch (error) {
      logger.error({ error }, 'Failed to get user groups');
      return reply.status(500).send(createApiErrorResponse(
        'GROUPS_FETCH_FAILED',
        'Failed to fetch groups'
      ));
    }
  });

  // Get group details
  fastify.get('/:groupId', {
    preHandler: [authenticate, requireGroupPermission('MEMBER')],
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
        },
        required: ['groupId'],
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
                name: { type: 'string' },
                icon: { type: 'string' },
                visibility: { type: 'string' },
                ownerId: { type: 'string' },
                createdAt: { type: 'string' },
                members: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      userId: { type: 'string' },
                      role: { type: 'string' },
                      joinedAt: { type: 'string' },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          handle: { type: 'string' },
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
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { groupId } = request.params as { groupId: string };
      
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  handle: true,
                  photoUrl: true,
                  privacyMode: true,
                },
              },
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      });

      if (!group) {
        return reply.status(404).send(createApiErrorResponse(
          'GROUP_NOT_FOUND',
          'Group not found'
        ));
      }

      return reply.send(createApiResponse(group));
    } catch (error) {
      logger.error({ error }, 'Failed to get group details');
      return reply.status(500).send(createApiErrorResponse(
        'GROUP_FETCH_FAILED',
        'Failed to fetch group details'
      ));
    }
  });

  // Update group
  fastify.patch('/:groupId', {
    preHandler: [authenticate, requireGroupPermission('ADMIN')],
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
        },
        required: ['groupId'],
      },
      body: updateGroupSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                icon: { type: 'string' },
                visibility: { type: 'string' },
                ownerId: { type: 'string' },
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
      const { groupId } = request.params as { groupId: string };
      const updateData = request.body as z.infer<typeof updateGroupSchema>;
      
      const group = await prisma.group.update({
        where: { id: groupId },
        data: updateData,
        select: {
          id: true,
          name: true,
          icon: true,
          visibility: true,
          ownerId: true,
          createdAt: true,
        },
      });

      // Log group update
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'GROUP_UPDATED',
          subjectType: 'group',
          subjectId: groupId,
          metaJson: updateData,
        },
      });

      return reply.send(createApiResponse(group));
    } catch (error) {
      logger.error({ error }, 'Failed to update group');
      return reply.status(500).send(createApiErrorResponse(
        'GROUP_UPDATE_FAILED',
        'Failed to update group'
      ));
    }
  });

  // Delete group
  fastify.delete('/:groupId', {
    preHandler: [authenticate, requireGroupPermission('OWNER')],
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
        },
        required: ['groupId'],
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
      const { groupId } = request.params as { groupId: string };
      
      await prisma.group.delete({
        where: { id: groupId },
      });

      // Log group deletion
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'GROUP_DELETED',
          subjectType: 'group',
          subjectId: groupId,
        },
      });

      return reply.send(createApiResponse({
        message: 'Group deleted successfully',
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to delete group');
      return reply.status(500).send(createApiErrorResponse(
        'GROUP_DELETION_FAILED',
        'Failed to delete group'
      ));
    }
  });

  // Invite member
  fastify.post('/:groupId/invite', {
    preHandler: [authenticate, requireGroupPermission('ADMIN')],
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
        },
        required: ['groupId'],
      },
      body: inviteMemberSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                inviteToken: { type: 'string' },
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
      const { email, role } = request.body as z.infer<typeof inviteMemberSchema>;
      
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.status(404).send(createApiErrorResponse(
          'USER_NOT_FOUND',
          'No user found with this email address'
        ));
      }

      // Check if user is already a member
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: user.id,
          },
        },
      });

      if (existingMember) {
        return reply.status(409).send(createApiErrorResponse(
          'USER_ALREADY_MEMBER',
          'User is already a member of this group'
        ));
      }

      // Generate invite token
      const inviteToken = generateInviteCode();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.inviteToken.create({
        data: {
          token: inviteToken,
          groupId,
          expiresAt,
          maxUses: 1,
        },
      });

      // Add user as member
      await prisma.groupMember.create({
        data: {
          groupId,
          userId: user.id,
          role,
        },
      });

      // Log member addition
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'MEMBER_ADDED',
          subjectType: 'group',
          subjectId: groupId,
          metaJson: { userId: user.id, email, role },
        },
      });

      return reply.status(201).send(createApiResponse({
        message: 'User invited successfully',
        inviteToken,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to invite member');
      return reply.status(500).send(createApiErrorResponse(
        'MEMBER_INVITE_FAILED',
        'Failed to invite member'
      ));
    }
  });

  // Join group with invite token
  fastify.post('/join', {
    preHandler: [authenticate],
    schema: {
      body: joinGroupSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                group: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    icon: { type: 'string' },
                    visibility: { type: 'string' },
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
      const authRequest = request as AuthenticatedRequest;
      const { inviteToken } = request.body as z.infer<typeof joinGroupSchema>;
      
      // Find and validate invite token
      const invite = await prisma.inviteToken.findUnique({
        where: { token: inviteToken },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              icon: true,
              visibility: true,
            },
          },
        },
      });

      if (!invite || invite.expiresAt < new Date()) {
        return reply.status(400).send(createApiErrorResponse(
          'INVALID_INVITE_TOKEN',
          'Invalid or expired invite token'
        ));
      }

      if (invite.maxUses && invite.usedCount >= invite.maxUses) {
        return reply.status(400).send(createApiErrorResponse(
          'INVITE_TOKEN_EXHAUSTED',
          'Invite token has been used up'
        ));
      }

      // Check if user is already a member
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: invite.groupId,
            userId: authRequest.user.id,
          },
        },
      });

      if (existingMember) {
        return reply.status(409).send(createApiErrorResponse(
          'ALREADY_MEMBER',
          'You are already a member of this group'
        ));
      }

      // Add user as member
      await prisma.groupMember.create({
        data: {
          groupId: invite.groupId,
          userId: authRequest.user.id,
          role: 'MEMBER',
        },
      });

      // Update invite token usage
      await prisma.inviteToken.update({
        where: { id: invite.id },
        data: {
          usedCount: invite.usedCount + 1,
        },
      });

      // Log member addition
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'MEMBER_ADDED',
          subjectType: 'group',
          subjectId: invite.groupId,
          metaJson: { method: 'invite_token' },
        },
      });

      return reply.send(createApiResponse({
        message: 'Successfully joined group',
        group: invite.group,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to join group');
      return reply.status(500).send(createApiErrorResponse(
        'JOIN_GROUP_FAILED',
        'Failed to join group'
      ));
    }
  });

  // Update member role
  fastify.patch('/:groupId/members/:userId', {
    preHandler: [authenticate, requireGroupPermission('ADMIN')],
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
          userId: { type: 'string' },
        },
        required: ['groupId', 'userId'],
      },
      body: updateMemberRoleSchema,
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
      const { groupId, userId } = request.params as { groupId: string; userId: string };
      const { role } = request.body as z.infer<typeof updateMemberRoleSchema>;
      
      // Check if user is a member
      const member = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (!member) {
        return reply.status(404).send(createApiErrorResponse(
          'MEMBER_NOT_FOUND',
          'User is not a member of this group'
        ));
      }

      // Update member role
      await prisma.groupMember.update({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
        data: { role },
      });

      // Log role change
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'MEMBER_ROLE_CHANGED',
          subjectType: 'group',
          subjectId: groupId,
          metaJson: { userId, oldRole: member.role, newRole: role },
        },
      });

      return reply.send(createApiResponse({
        message: 'Member role updated successfully',
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to update member role');
      return reply.status(500).send(createApiErrorResponse(
        'ROLE_UPDATE_FAILED',
        'Failed to update member role'
      ));
    }
  });

  // Remove member
  fastify.delete('/:groupId/members/:userId', {
    preHandler: [authenticate, requireGroupPermission('ADMIN')],
    schema: {
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
          userId: { type: 'string' },
        },
        required: ['groupId', 'userId'],
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
      const { groupId, userId } = request.params as { groupId: string; userId: string };
      
      // Check if user is a member
      const member = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (!member) {
        return reply.status(404).send(createApiErrorResponse(
          'MEMBER_NOT_FOUND',
          'User is not a member of this group'
        ));
      }

      // Remove member
      await prisma.groupMember.delete({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      // Log member removal
      await prisma.auditLog.create({
        data: {
          actorId: authRequest.user.id,
          action: 'MEMBER_REMOVED',
          subjectType: 'group',
          subjectId: groupId,
          metaJson: { userId, role: member.role },
        },
      });

      return reply.send(createApiResponse({
        message: 'Member removed successfully',
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to remove member');
      return reply.status(500).send(createApiErrorResponse(
        'MEMBER_REMOVAL_FAILED',
        'Failed to remove member'
      ));
    }
  });
}
