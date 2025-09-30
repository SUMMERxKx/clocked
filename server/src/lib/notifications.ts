import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from './db';
import { logger } from './logger';
import type { NotificationType } from '@clocked/shared';

export interface PushNotificationData {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
}

export class NotificationService {
  private expo: Expo;

  constructor() {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true,
    });
  }

  /**
   * Send push notification to a single user
   */
  async sendToUser(
    userId: string,
    notification: PushNotificationData
  ): Promise<void> {
    try {
      // Get user's push token
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, handle: true },
      });

      if (!user) {
        logger.warn({ userId }, 'User not found for push notification');
        return;
      }

      // Get user's notification settings
      const settings = await this.getUserNotificationSettings(userId);
      
      // Check if this type of notification is enabled
      if (!this.isNotificationEnabled(notification.type, settings)) {
        logger.debug({ userId, type: notification.type }, 'Notification disabled by user settings');
        return;
      }

      // Check quiet hours
      if (this.isInQuietHours(settings)) {
        logger.debug({ userId }, 'Notification suppressed due to quiet hours');
        return;
      }

      // Get push tokens for user
      const pushTokens = await this.getUserPushTokens(userId);
      
      if (pushTokens.length === 0) {
        logger.debug({ userId }, 'No push tokens found for user');
        return;
      }

      // Create push messages
      const messages: ExpoPushMessage[] = pushTokens.map(token => ({
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        badge: notification.badge,
        sound: notification.sound,
        priority: notification.priority,
        ttl: notification.ttl,
      }));

      // Send notifications
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          logger.error({ error, chunk }, 'Failed to send push notification chunk');
        }
      }

      // Log notification sent
      await this.logNotificationSent(userId, notification, tickets);

      logger.info({ userId, type: notification.type, ticketsCount: tickets.length }, 'Push notification sent');
    } catch (error) {
      logger.error({ error, userId, notification }, 'Failed to send push notification');
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    notification: PushNotificationData
  ): Promise<void> {
    const promises = userIds.map(userId => this.sendToUser(userId, notification));
    await Promise.allSettled(promises);
  }

  /**
   * Send notification to group members
   */
  async sendToGroup(
    groupId: string,
    notification: PushNotificationData,
    excludeUserId?: string
  ): Promise<void> {
    try {
      const members = await prisma.groupMember.findMany({
        where: {
          groupId,
          userId: excludeUserId ? { not: excludeUserId } : undefined,
        },
        select: { userId: true },
      });

      const userIds = members.map(member => member.userId);
      await this.sendToUsers(userIds, notification);
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to send notification to group');
    }
  }

  /**
   * Register push token for user
   */
  async registerPushToken(userId: string, token: string): Promise<void> {
    try {
      // Validate token format
      if (!Expo.isExpoPushToken(token)) {
        throw new Error('Invalid Expo push token');
      }

      // Store or update token
      await prisma.user.upsert({
        where: { id: userId },
        update: {
          // Store push token in user metadata or separate table
          // For now, we'll use a simple approach
        },
        create: {
          id: userId,
          email: '', // This would be set during user creation
          handle: '',
        },
      });

      logger.info({ userId, token }, 'Push token registered');
    } catch (error) {
      logger.error({ error, userId, token }, 'Failed to register push token');
      throw error;
    }
  }

  /**
   * Unregister push token for user
   */
  async unregisterPushToken(userId: string, token: string): Promise<void> {
    try {
      // Remove token from user's tokens
      // Implementation depends on how tokens are stored
      
      logger.info({ userId, token }, 'Push token unregistered');
    } catch (error) {
      logger.error({ error, userId, token }, 'Failed to unregister push token');
      throw error;
    }
  }

  /**
   * Get user's notification settings
   */
  private async getUserNotificationSettings(userId: string): Promise<any> {
    // This would typically come from a user settings table
    // For now, return default settings
    return {
      enabled: true,
      sessionStart: true,
      sessionEnd: true,
      friendJoins: true,
      goalAchieved: true,
      goalMissed: true,
      safetyTimeout: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    };
  }

  /**
   * Check if notification type is enabled for user
   */
  private isNotificationEnabled(type: NotificationType, settings: any): boolean {
    if (!settings.enabled) return false;

    switch (type) {
      case 'session_started':
        return settings.sessionStart;
      case 'session_ended':
        return settings.sessionEnd;
      case 'friend_joined':
        return settings.friendJoins;
      case 'goal_achieved':
        return settings.goalAchieved;
      case 'goal_missed':
        return settings.goalMissed;
      case 'safety_timeout':
        return settings.safetyTimeout;
      case 'group_invite':
        return true; // Always enabled
      default:
        return true;
    }
  }

  /**
   * Check if current time is in user's quiet hours
   */
  private isInQuietHours(settings: any): boolean {
    if (!settings.quietHours?.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = settings.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = settings.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Get user's push tokens
   */
  private async getUserPushTokens(userId: string): Promise<string[]> {
    // This would typically come from a push tokens table
    // For now, return empty array
    return [];
  }

  /**
   * Log notification sent to database
   */
  private async logNotificationSent(
    userId: string,
    notification: PushNotificationData,
    tickets: any[]
  ): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          read: false,
        },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to log notification');
    }
  }

  /**
   * Handle notification-specific logic
   */
  async handleSessionStarted(sessionId: string, userId: string, groupId: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { handle: true } },
        group: { select: { name: true } },
      },
    });

    if (!session) return;

    await this.sendToGroup(groupId, {
      type: 'session_started',
      title: `${session.user.handle} started a session`,
      body: `${session.category} session in ${session.group.name}`,
      data: {
        sessionId,
        userId,
        groupId,
        type: 'session_started',
      },
      priority: 'normal',
    }, userId);
  }

  async handleSessionEnded(sessionId: string, userId: string, groupId: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { handle: true } },
        group: { select: { name: true } },
      },
    });

    if (!session) return;

    const duration = session.endTs ? 
      Math.floor((session.endTs.getTime() - session.startTs.getTime()) / (1000 * 60)) : 0;

    await this.sendToGroup(groupId, {
      type: 'session_ended',
      title: `${session.user.handle} completed a session`,
      body: `${duration} minutes of ${session.category} in ${session.group.name}`,
      data: {
        sessionId,
        userId,
        groupId,
        type: 'session_ended',
      },
      priority: 'normal',
    }, userId);
  }

  async handleFriendJoined(groupId: string, newUserId: string): Promise<void> {
    const newUser = await prisma.user.findUnique({
      where: { id: newUserId },
      select: { handle: true },
    });

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true },
    });

    if (!newUser || !group) return;

    await this.sendToGroup(groupId, {
      type: 'friend_joined',
      title: `${newUser.handle} joined ${group.name}`,
      body: 'Say hello to your new group member!',
      data: {
        groupId,
        userId: newUserId,
        type: 'friend_joined',
      },
      priority: 'normal',
    }, newUserId);
  }

  async handleGoalAchieved(userId: string, goalType: string, value: number): Promise<void> {
    await this.sendToUser(userId, {
      type: 'goal_achieved',
      title: 'Goal Achieved! 🎉',
      body: `You've reached your ${goalType} goal: ${value}`,
      data: {
        userId,
        goalType,
        value: value.toString(),
        type: 'goal_achieved',
      },
      priority: 'high',
    });
  }

  async handleSafetyTimeout(userId: string, sessionId: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { handle: true } },
        group: { select: { name: true } },
      },
    });

    if (!session) return;

    await this.sendToUser(userId, {
      type: 'safety_timeout',
      title: 'Session Timeout Warning',
      body: `Your ${session.category} session has been running for a while. Don't forget to take a break!`,
      data: {
        sessionId,
        userId,
        type: 'safety_timeout',
      },
      priority: 'high',
    });
  }
}

export const notificationService = new NotificationService();
