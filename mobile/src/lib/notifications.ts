import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { storage } from './storage';
import { apiClient } from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationSettings {
  enabled: boolean;
  sessionStart: boolean;
  sessionEnd: boolean;
  friendJoins: boolean;
  goalAchieved: boolean;
  goalMissed: boolean;
  safetyTimeout: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export class NotificationManager {
  private pushToken: string | null = null;

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<void> {
    try {
      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions not granted');
        return;
      }

      // Get push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });

      this.pushToken = token.data;
      console.log('Push token:', this.pushToken);

      // Register token with server
      await this.registerPushToken(this.pushToken);

      // Configure notification channels (Android)
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      // Set up notification listeners
      this.setupNotificationListeners();

      // Load saved settings
      await this.loadNotificationSettings();
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

  /**
   * Register push token with server
   */
  private async registerPushToken(token: string): Promise<void> {
    try {
      // This would typically call your API to register the token
      // For now, we'll store it locally
      await storage.setItem('pushToken', token);
      console.log('Push token registered:', token);
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  /**
   * Setup Android notification channels
   */
  private async setupAndroidChannels(): Promise<void> {
    await Notifications.setNotificationChannelAsync('sessions', {
      name: 'Sessions',
      description: 'Notifications about session activities',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('social', {
      name: 'Social',
      description: 'Notifications about friends and groups',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('goals', {
      name: 'Goals',
      description: 'Notifications about goal achievements',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  /**
   * Setup notification event listeners
   */
  private setupNotificationListeners(): void {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      this.handleNotificationTapped(response);
    });
  }

  /**
   * Handle notification received
   */
  private handleNotificationReceived(notification: Notifications.Notification): void {
    const data = notification.request.content.data;
    
    // Update app state based on notification
    if (data?.type === 'session_started') {
      // Refresh active sessions
      this.refreshActiveSessions();
    } else if (data?.type === 'session_ended') {
      // Refresh session history
      this.refreshSessionHistory();
    }
  }

  /**
   * Handle notification tapped
   */
  private handleNotificationTapped(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data;
    
    if (!data) return;

    // Navigate based on notification type
    switch (data.type) {
      case 'session_started':
      case 'session_ended':
        if (data.sessionId) {
          this.navigateToSession(data.sessionId);
        }
        break;
      case 'friend_joined':
        if (data.groupId) {
          this.navigateToGroup(data.groupId);
        }
        break;
      case 'group_invite':
        if (data.groupId) {
          this.navigateToGroupInvite(data.groupId);
        }
        break;
      default:
        // Navigate to home screen
        this.navigateToHome();
    }
  }

  /**
   * Navigate to session details
   */
  private navigateToSession(sessionId: string): void {
    // This would use your navigation system
    console.log('Navigate to session:', sessionId);
  }

  /**
   * Navigate to group details
   */
  private navigateToGroup(groupId: string): void {
    // This would use your navigation system
    console.log('Navigate to group:', groupId);
  }

  /**
   * Navigate to group invite
   */
  private navigateToGroupInvite(groupId: string): void {
    // This would use your navigation system
    console.log('Navigate to group invite:', groupId);
  }

  /**
   * Navigate to home screen
   */
  private navigateToHome(): void {
    // This would use your navigation system
    console.log('Navigate to home');
  }

  /**
   * Refresh active sessions
   */
  private refreshActiveSessions(): void {
    // This would trigger a refresh of active sessions
    console.log('Refresh active sessions');
  }

  /**
   * Refresh session history
   */
  private refreshSessionHistory(): void {
    // This would trigger a refresh of session history
    console.log('Refresh session history');
  }

  /**
   * Load notification settings from storage
   */
  private async loadNotificationSettings(): Promise<void> {
    try {
      const settings = await storage.getNotificationSettings();
      if (settings) {
        console.log('Loaded notification settings:', settings);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(settings: NotificationSettings): Promise<void> {
    try {
      await storage.setNotificationSettings(settings);
      console.log('Notification settings updated:', settings);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  }

  /**
   * Get current notification settings
   */
  async getNotificationSettings(): Promise<NotificationSettings | null> {
    try {
      return await storage.getNotificationSettings();
    } catch (error) {
      console.error('Failed to get notification settings:', error);
      return null;
    }
  }

  /**
   * Schedule local notification
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: trigger || null,
      });

      console.log('Local notification scheduled:', identifier);
      return identifier;
    } catch (error) {
      console.error('Failed to schedule local notification:', error);
      throw error;
    }
  }

  /**
   * Cancel local notification
   */
  async cancelLocalNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log('Local notification cancelled:', identifier);
    } catch (error) {
      console.error('Failed to cancel local notification:', error);
    }
  }

  /**
   * Cancel all local notifications
   */
  async cancelAllLocalNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All local notifications cancelled');
    } catch (error) {
      console.error('Failed to cancel all local notifications:', error);
    }
  }

  /**
   * Get notification permissions status
   */
  async getPermissionsStatus(): Promise<Notifications.NotificationPermissionsStatus> {
    try {
      return await Notifications.getPermissionsAsync();
    } catch (error) {
      console.error('Failed to get notification permissions:', error);
      throw error;
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<Notifications.NotificationPermissionsStatus> {
    try {
      return await Notifications.requestPermissionsAsync();
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      throw error;
    }
  }

  /**
   * Get push token
   */
  getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      const permissions = await this.getPermissionsStatus();
      return permissions.status === 'granted';
    } catch (error) {
      console.error('Failed to check notification status:', error);
      return false;
    }
  }

  /**
   * Setup deep link handling for notifications
   */
  setupDeepLinkHandling(): void {
    // Handle deep links from notifications
    Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data?.deepLink) {
        // Handle deep link
        this.handleDeepLink(data.deepLink);
      }
    });
  }

  /**
   * Handle deep link from notification
   */
  private handleDeepLink(deepLink: string): void {
    console.log('Handle deep link:', deepLink);
    
    // Parse deep link and navigate accordingly
    // Example: clocked://session/123 or clocked://group/456
    const url = new URL(deepLink);
    
    switch (url.hostname) {
      case 'session':
        this.navigateToSession(url.pathname.substring(1));
        break;
      case 'group':
        this.navigateToGroup(url.pathname.substring(1));
        break;
      default:
        this.navigateToHome();
    }
  }
}

export const notificationManager = new NotificationManager();
