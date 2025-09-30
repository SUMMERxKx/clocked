import { create } from 'zustand';
import { apiClient } from '../lib/api';
import type { Session, SessionCategory } from '@clocked/shared';

interface SessionState {
  // State
  activeSession: Session | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;

  // Actions
  startSession: (data: {
    groupId: string;
    category: SessionCategory;
    targetMin: number;
    locationCoarse?: string;
    note?: string;
    visibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  }) => Promise<Session>;
  endSession: (sessionId: string, note?: string) => Promise<void>;
  updateSession: (sessionId: string, data: {
    note?: string;
    locationCoarse?: string;
  }) => Promise<void>;
  getGroupSessions: (groupId: string, params?: {
    active?: boolean;
    category?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) => Promise<{ sessions: Session[]; total: number; hasMore: boolean }>;
  getUserSessions: (params?: {
    active?: boolean;
    category?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) => Promise<{ sessions: Session[]; total: number; hasMore: boolean }>;
  addReaction: (sessionId: string, type: 'LIKE' | 'JOIN' | 'ENCOURAGE') => Promise<void>;
  removeReaction: (sessionId: string, reactionId: string) => Promise<void>;
  setActiveSession: (session: Session | null) => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSessionInList: (sessionId: string, updates: Partial<Session>) => void;
  removeSession: (sessionId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  activeSession: null,
  sessions: [],
  isLoading: false,
  error: null,

  // Actions
  startSession: async (data) => {
    try {
      set({ isLoading: true, error: null });

      const session = await apiClient.startSession(data);

      set((state) => ({
        activeSession: session,
        sessions: [session, ...state.sessions],
        isLoading: false,
      }));

      return session;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start session';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  endSession: async (sessionId: string, note?: string) => {
    try {
      set({ isLoading: true, error: null });

      const updatedSession = await apiClient.updateSession(sessionId, {
        endTs: new Date(),
        note,
      });

      set((state) => ({
        activeSession: null,
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? updatedSession : session
        ),
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to end session';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  updateSession: async (sessionId: string, data) => {
    try {
      set({ isLoading: true, error: null });

      const updatedSession = await apiClient.updateSession(sessionId, data);

      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? updatedSession : session
        ),
        activeSession: state.activeSession?.id === sessionId ? updatedSession : state.activeSession,
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update session';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  getGroupSessions: async (groupId: string, params) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiClient.getGroupSessions(groupId, params);

      set({ isLoading: false });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch group sessions';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  getUserSessions: async (params) => {
    try {
      set({ isLoading: true, error: null });

      const response = await apiClient.getUserSessions(params);

      set({ isLoading: false });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch user sessions';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  addReaction: async (sessionId: string, type) => {
    try {
      set({ isLoading: true, error: null });

      await apiClient.addReaction(sessionId, type);

      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add reaction';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  removeReaction: async (sessionId: string, reactionId: string) => {
    try {
      set({ isLoading: true, error: null });

      await apiClient.removeReaction(sessionId, reactionId);

      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove reaction';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  setActiveSession: (session) => {
    set({ activeSession: session });
  },

  setSessions: (sessions) => {
    set({ sessions });
  },

  addSession: (session) => {
    set((state) => ({
      sessions: [session, ...state.sessions],
    }));
  },

  updateSessionInList: (sessionId: string, updates) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId ? { ...session, ...updates } : session
      ),
      activeSession: state.activeSession?.id === sessionId 
        ? { ...state.activeSession, ...updates }
        : state.activeSession,
    }));
  },

  removeSession: (sessionId: string) => {
    set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== sessionId),
      activeSession: state.activeSession?.id === sessionId ? null : state.activeSession,
    }));
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },
}));
