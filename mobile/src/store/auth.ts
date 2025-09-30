import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient, ApiError } from '../lib/api';
import { storage } from '../lib/storage';
import type { User } from '@clocked/shared';

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthToken: () => Promise<boolean>;
  setUser: (user: User) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (accessToken: string, refreshToken: string, user: User) => {
        try {
          set({ isLoading: true, error: null });

          // Store tokens securely
          await storage.setTokens(accessToken, refreshToken);
          await storage.setUserData(user);

          // Set API client token
          apiClient.setToken(accessToken);

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error('Login failed:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          set({ isLoading: true });

          const { refreshToken } = get();

          // Call logout API if we have a refresh token
          if (refreshToken) {
            try {
              await apiClient.logout(refreshToken);
            } catch (error) {
              // Ignore logout API errors, still clear local state
              console.warn('Logout API call failed:', error);
            }
          }

          // Clear tokens and user data
          await storage.clearTokens();
          await storage.clearUserData();

          // Clear API client token
          apiClient.setToken(null);

          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error('Logout failed:', error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Logout failed',
          });
        }
      },

      refreshAuthToken: async () => {
        try {
          const { refreshToken } = get();

          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          const response = await apiClient.refreshToken(refreshToken);

          // Store new tokens
          await storage.setTokens(response.accessToken, response.refreshToken);

          // Update API client token
          apiClient.setToken(response.accessToken);

          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            error: null,
          });

          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          
          // If refresh fails, logout the user
          await get().logout();
          
          set({
            error: error instanceof Error ? error.message : 'Session expired',
          });

          return false;
        }
      },

      setUser: (user: User) => {
        set({ user });
        storage.setUserData(user);
      },

      setError: (error: string | null) => {
        set({ error });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => ({
        getItem: async (name: string) => {
          const value = await storage.getItem(name);
          return value ? JSON.stringify(value) : null;
        },
        setItem: async (name: string, value: string) => {
          await storage.setItem(name, JSON.parse(value));
        },
        removeItem: async (name: string) => {
          await storage.deleteItem(name);
        },
      })),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Initialize auth state from storage
export const initializeAuth = async () => {
  try {
    const [accessToken, refreshToken, userData] = await Promise.all([
      storage.getAccessToken(),
      storage.getRefreshToken(),
      storage.getUserData(),
    ]);

    if (accessToken && userData) {
      // Set API client token
      apiClient.setToken(accessToken);

      // Update store state
      useAuthStore.setState({
        user: userData,
        accessToken,
        refreshToken,
        isAuthenticated: true,
      });

      // Verify token is still valid by fetching current user
      try {
        const currentUser = await apiClient.getCurrentUser();
        useAuthStore.getState().setUser(currentUser);
      } catch (error) {
        // Token might be expired, try to refresh
        if (refreshToken) {
          const refreshed = await useAuthStore.getState().refreshAuthToken();
          if (!refreshed) {
            // Refresh failed, user needs to login again
            await useAuthStore.getState().logout();
          }
        } else {
          // No refresh token, logout
          await useAuthStore.getState().logout();
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize auth:', error);
    // Clear any corrupted auth state
    await useAuthStore.getState().logout();
  }
};
