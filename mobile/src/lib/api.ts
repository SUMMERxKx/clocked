import { config } from '../config';
import type { ApiResponse } from '@clocked/shared';

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json() as ApiResponse<T>;

    if (!response.ok) {
      throw new ApiError(
        data.error?.code || 'UNKNOWN_ERROR',
        data.error?.message || 'An error occurred',
        data.error?.details
      );
    }

    if (!data.success) {
      throw new ApiError(
        data.error?.code || 'API_ERROR',
        data.error?.message || 'API request failed',
        data.error?.details
      );
    }

    return data.data as T;
  }

  // Auth endpoints
  async requestMagicLink(email: string, redirectUrl?: string) {
    return this.request('/v1/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email, redirectUrl }),
    });
  }

  async verifyMagicLink(token: string) {
    return this.request('/v1/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async refreshToken(refreshToken: string) {
    return this.request('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(refreshToken: string) {
    return this.request('/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async getCurrentUser() {
    return this.request('/v1/auth/me');
  }

  async updateProfile(data: {
    handle?: string;
    photoUrl?: string;
    privacyMode?: boolean;
  }) {
    return this.request('/v1/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Group endpoints
  async getGroups() {
    return this.request('/v1/groups');
  }

  async getGroup(groupId: string) {
    return this.request(`/v1/groups/${groupId}`);
  }

  async createGroup(data: {
    name: string;
    icon?: string;
    visibility?: 'PRIVATE' | 'PUBLIC';
  }) {
    return this.request('/v1/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateGroup(groupId: string, data: {
    name?: string;
    icon?: string;
    visibility?: 'PRIVATE' | 'PUBLIC';
  }) {
    return this.request(`/v1/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteGroup(groupId: string) {
    return this.request(`/v1/groups/${groupId}`, {
      method: 'DELETE',
    });
  }

  async inviteMember(groupId: string, email: string, role: 'ADMIN' | 'MEMBER' = 'MEMBER') {
    return this.request(`/v1/groups/${groupId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async joinGroup(inviteToken: string) {
    return this.request('/v1/groups/join', {
      method: 'POST',
      body: JSON.stringify({ inviteToken }),
    });
  }

  async updateMemberRole(groupId: string, userId: string, role: 'ADMIN' | 'MEMBER') {
    return this.request(`/v1/groups/${groupId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async removeMember(groupId: string, userId: string) {
    return this.request(`/v1/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  // Session endpoints
  async startSession(data: {
    groupId: string;
    category: 'WORK' | 'STUDY' | 'EXERCISE' | 'HOBBY' | 'SOCIAL' | 'OTHER';
    targetMin: number;
    locationCoarse?: string;
    note?: string;
    visibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  }) {
    return this.request('/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getGroupSessions(groupId: string, params?: {
    active?: boolean;
    category?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const query = searchParams.toString();
    return this.request(`/v1/sessions/group/${groupId}${query ? `?${query}` : ''}`);
  }

  async getUserSessions(params?: {
    active?: boolean;
    category?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const query = searchParams.toString();
    return this.request(`/v1/sessions/me${query ? `?${query}` : ''}`);
  }

  async updateSession(sessionId: string, data: {
    endTs?: Date;
    note?: string;
    locationCoarse?: string;
  }) {
    return this.request(`/v1/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async addReaction(sessionId: string, type: 'LIKE' | 'JOIN' | 'ENCOURAGE') {
    return this.request(`/v1/sessions/${sessionId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  }

  async removeReaction(sessionId: string, reactionId: string) {
    return this.request(`/v1/sessions/${sessionId}/reactions/${reactionId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(config.apiUrl);
export { ApiError };
