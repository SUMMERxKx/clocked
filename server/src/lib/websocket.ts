import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { AuthService, extractToken } from './auth';
import { prisma } from './db';
import { logger } from './logger';

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  groupIds?: Set<string>;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();

  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private async handleConnection(ws: AuthenticatedWebSocket, request: IncomingMessage) {
    try {
      // Extract token from query params or headers
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token') || extractToken(request.headers.authorization);

      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify token
      const payload = AuthService.verifyAccessToken(token);
      
      // Get user and their groups
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          handle: true,
        },
      });

      if (!user) {
        ws.close(1008, 'User not found');
        return;
      }

      // Get user's groups
      const memberships = await prisma.groupMember.findMany({
        where: { userId: user.id },
        select: { groupId: true },
      });

      const groupIds = new Set(memberships.map(m => m.groupId));

      // Store client info
      ws.userId = user.id;
      ws.groupIds = groupIds;
      this.clients.set(user.id, ws);

      logger.info({ userId: user.id, groupCount: groupIds.size }, 'WebSocket client connected');

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        data: {
          userId: user.id,
          handle: user.handle,
          groupIds: Array.from(groupIds),
        },
        timestamp: new Date(),
      }));

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          logger.warn({ error }, 'Invalid WebSocket message');
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid message format' },
            timestamp: new Date(),
          }));
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        if (ws.userId) {
          this.clients.delete(ws.userId);
          logger.info({ userId: ws.userId }, 'WebSocket client disconnected');
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error({ error, userId: ws.userId }, 'WebSocket error');
      });

    } catch (error) {
      logger.error({ error }, 'WebSocket connection failed');
      ws.close(1008, 'Authentication failed');
    }
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: any) {
    if (!ws.userId) {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Not authenticated' },
        timestamp: new Date(),
      }));
      return;
    }

    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date(),
        }));
        break;

      case 'join_group':
        await this.handleJoinGroup(ws, message.data);
        break;

      case 'leave_group':
        await this.handleLeaveGroup(ws, message.data);
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Unknown message type' },
          timestamp: new Date(),
        }));
    }
  }

  private async handleJoinGroup(ws: AuthenticatedWebSocket, data: any) {
    const { groupId } = data;
    
    if (!groupId || !ws.groupIds?.has(groupId)) {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Not a member of this group' },
        timestamp: new Date(),
      }));
      return;
    }

    // Send current active sessions for this group
    const activeSessions = await prisma.session.findMany({
      where: {
        groupId,
        endTs: null,
      },
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
    });

    ws.send(JSON.stringify({
      type: 'group_joined',
      data: {
        groupId,
        activeSessions,
      },
      timestamp: new Date(),
    }));
  }

  private async handleLeaveGroup(ws: AuthenticatedWebSocket, data: any) {
    const { groupId } = data;
    
    ws.send(JSON.stringify({
      type: 'group_left',
      data: { groupId },
      timestamp: new Date(),
    }));
  }

  /**
   * Broadcast message to all clients in a group
   */
  public broadcastToGroup(groupId: string, message: any) {
    let sentCount = 0;
    
    this.wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedWebSocket;
      if (authClient.readyState === client.OPEN && authClient.groupIds?.has(groupId)) {
        client.send(JSON.stringify(message));
        sentCount++;
      }
    });

    logger.debug({ groupId, sentCount }, 'Broadcasted message to group');
  }

  /**
   * Send message to specific user
   */
  public sendToUser(userId: string, message: any) {
    const client = this.clients.get(userId);
    if (client && client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Get connected clients count
   */
  public getConnectedCount(): number {
    return this.clients.size;
  }

  /**
   * Get connected clients for a group
   */
  public getGroupClients(groupId: string): string[] {
    const userIds: string[] = [];
    
    this.wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedWebSocket;
      if (authClient.readyState === client.OPEN && 
          authClient.userId && 
          authClient.groupIds?.has(groupId)) {
        userIds.push(authClient.userId);
      }
    });

    return userIds;
  }

  /**
   * Close all connections
   */
  public close() {
    this.wss.close();
  }
}
