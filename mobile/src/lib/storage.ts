import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  NOTIFICATION_SETTINGS: 'notification_settings',
  PRIVACY_SETTINGS: 'privacy_settings',
} as const;

class StorageService {
  // Secure storage for sensitive data
  async setSecureItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Failed to store secure item:', error);
      throw error;
    }
  }

  async getSecureItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Failed to get secure item:', error);
      return null;
    }
  }

  async deleteSecureItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Failed to delete secure item:', error);
    }
  }

  // Regular storage for non-sensitive data
  async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('Failed to store item:', error);
      throw error;
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Failed to get item:', error);
      return null;
    }
  }

  async deleteItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
      // Note: SecureStore doesn't have a clear method, so we need to delete items individually
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }

  // Auth token methods
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      this.setSecureItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
      this.setSecureItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
    ]);
  }

  async getAccessToken(): Promise<string | null> {
    return this.getSecureItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  async getRefreshToken(): Promise<string | null> {
    return this.getSecureItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  async clearTokens(): Promise<void> {
    await Promise.all([
      this.deleteSecureItem(STORAGE_KEYS.ACCESS_TOKEN),
      this.deleteSecureItem(STORAGE_KEYS.REFRESH_TOKEN),
    ]);
  }

  // User data methods
  async setUserData(userData: any): Promise<void> {
    await this.setItem(STORAGE_KEYS.USER_DATA, userData);
  }

  async getUserData(): Promise<any | null> {
    return this.getItem(STORAGE_KEYS.USER_DATA);
  }

  async clearUserData(): Promise<void> {
    await this.deleteItem(STORAGE_KEYS.USER_DATA);
  }

  // Onboarding
  async setOnboardingComplete(): Promise<void> {
    await this.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, true);
  }

  async isOnboardingComplete(): Promise<boolean> {
    const complete = await this.getItem<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETE);
    return complete === true;
  }

  // Notification settings
  async setNotificationSettings(settings: {
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
  }): Promise<void> {
    await this.setItem(STORAGE_KEYS.NOTIFICATION_SETTINGS, settings);
  }

  async getNotificationSettings(): Promise<{
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
  } | null> {
    return this.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
  }

  // Privacy settings
  async setPrivacySettings(settings: {
    showLocation: boolean;
    showCategory: boolean;
    showTargetTime: boolean;
    allowFriendRequests: boolean;
    showInLeaderboard: boolean;
  }): Promise<void> {
    await this.setItem(STORAGE_KEYS.PRIVACY_SETTINGS, settings);
  }

  async getPrivacySettings(): Promise<{
    showLocation: boolean;
    showCategory: boolean;
    showTargetTime: boolean;
    allowFriendRequests: boolean;
    showInLeaderboard: boolean;
  } | null> {
    return this.getItem(STORAGE_KEYS.PRIVACY_SETTINGS);
  }

  // Utility methods
  async getAllKeys(): Promise<string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Failed to get all keys:', error);
      return [];
    }
  }

  async getMultiple(keys: string[]): Promise<Record<string, any>> {
    try {
      const values = await AsyncStorage.multiGet(keys);
      const result: Record<string, any> = {};
      values.forEach(([key, value]) => {
        if (value) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        }
      });
      return result;
    } catch (error) {
      console.error('Failed to get multiple items:', error);
      return {};
    }
  }

  async setMultiple(keyValuePairs: [string, any][]): Promise<void> {
    try {
      const serializedPairs = keyValuePairs.map(([key, value]) => [
        key,
        JSON.stringify(value),
      ]);
      await AsyncStorage.multiSet(serializedPairs);
    } catch (error) {
      console.error('Failed to set multiple items:', error);
      throw error;
    }
  }
}

export const storage = new StorageService();
export { STORAGE_KEYS };
