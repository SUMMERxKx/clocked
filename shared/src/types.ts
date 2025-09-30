import { z } from 'zod';

// User types
export const UserRoleSchema = z.enum(['owner', 'admin', 'member']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  handle: z.string().min(1).max(50),
  email: z.string().email(),
  photoUrl: z.string().url().optional(),
  createdAt: z.date(),
  privacyMode: z.boolean().default(false),
});

export type User = z.infer<typeof UserSchema>;

// Group types
export const GroupVisibilitySchema = z.enum(['private', 'public']);
export type GroupVisibility = z.infer<typeof GroupVisibilitySchema>;

export const GroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  icon: z.string().max(10).optional(),
  visibility: GroupVisibilitySchema.default('private'),
  ownerId: z.string().uuid(),
  createdAt: z.date(),
});

export type Group = z.infer<typeof GroupSchema>;

export const GroupMemberSchema = z.object({
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
  role: UserRoleSchema,
  joinedAt: z.date(),
});

export type GroupMember = z.infer<typeof GroupMemberSchema>;

// Session types
export const SessionCategorySchema = z.enum([
  'work',
  'study',
  'exercise',
  'hobby',
  'social',
  'other',
]);
export type SessionCategory = z.infer<typeof SessionCategorySchema>;

export const SessionVisibilitySchema = z.enum(['public', 'friends', 'private']);
export type SessionVisibility = z.infer<typeof SessionVisibilitySchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  groupId: z.string().uuid(),
  category: SessionCategorySchema,
  startTs: z.date(),
  endTs: z.date().nullable(),
  targetMin: z.number().int().min(1).max(1440), // Max 24 hours
  locationCoarse: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
  visibility: SessionVisibilitySchema.default('public'),
});

export type Session = z.infer<typeof SessionSchema>;

// Reaction types
export const ReactionTypeSchema = z.enum(['like', 'join', 'encourage']);
export type ReactionType = z.infer<typeof ReactionTypeSchema>;

export const ReactionSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  type: ReactionTypeSchema,
  ts: z.date(),
});

export type Reaction = z.infer<typeof ReactionSchema>;

// Event types
export const EventSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  title: z.string().min(1).max(200),
  startTs: z.date(),
  durationMin: z.number().int().min(1).max(1440),
  autoClockIn: z.boolean().default(false),
});

export type Event = z.infer<typeof EventSchema>;

// Audit log types
export const AuditActionSchema = z.enum([
  'user_created',
  'user_updated',
  'group_created',
  'group_updated',
  'group_deleted',
  'member_added',
  'member_removed',
  'member_role_changed',
  'session_started',
  'session_ended',
  'session_updated',
  'reaction_added',
  'reaction_removed',
  'event_created',
  'event_updated',
  'event_deleted',
  'auth_login',
  'auth_logout',
  'auth_token_refresh',
  'auth_token_revoked',
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid(),
  action: AuditActionSchema,
  subjectType: z.string().max(50),
  subjectId: z.string().uuid(),
  ts: z.date(),
  metaJson: z.record(z.unknown()).optional(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// API Response types
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: ApiErrorSchema.optional(),
});

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: ApiError;
};

// WebSocket event types
export const WebSocketEventTypeSchema = z.enum([
  'session_started',
  'session_updated',
  'session_ended',
  'reaction_added',
  'member_joined',
  'member_left',
  'group_updated',
]);

export type WebSocketEventType = z.infer<typeof WebSocketEventTypeSchema>;

export const WebSocketEventSchema = z.object({
  type: WebSocketEventTypeSchema,
  groupId: z.string().uuid(),
  data: z.record(z.unknown()),
  timestamp: z.date(),
});

export type WebSocketEvent = z.infer<typeof WebSocketEventSchema>;

// Location types
export const LocationCoarseSchema = z.object({
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
});

export type LocationCoarse = z.infer<typeof LocationCoarseSchema>;

// Leaderboard types
export const LeaderboardEntrySchema = z.object({
  userId: z.string().uuid(),
  handle: z.string(),
  photoUrl: z.string().url().optional(),
  totalMinutes: z.number().int().min(0),
  sessionCount: z.number().int().min(0),
  rank: z.number().int().min(1),
  privacyMode: z.boolean(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

// Invite types
export const InviteTokenSchema = z.object({
  token: z.string().min(1),
  groupId: z.string().uuid(),
  expiresAt: z.date(),
  maxUses: z.number().int().min(1).optional(),
  usedCount: z.number().int().min(0).default(0),
});

export type InviteToken = z.infer<typeof InviteTokenSchema>;

// Auth types
export const AuthTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.date(),
  tokenType: z.literal('Bearer'),
});

export type AuthToken = z.infer<typeof AuthTokenSchema>;

export const MagicLinkRequestSchema = z.object({
  email: z.string().email(),
  redirectUrl: z.string().url().optional(),
});

export type MagicLinkRequest = z.infer<typeof MagicLinkRequestSchema>;

export const OAuthProviderSchema = z.enum(['google', 'apple']);
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

// Notification types
export const NotificationTypeSchema = z.enum([
  'session_started',
  'session_ended',
  'friend_joined',
  'goal_achieved',
  'goal_missed',
  'safety_timeout',
  'group_invite',
]);

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  data: z.record(z.string()).optional(),
  read: z.boolean().default(false),
  createdAt: z.date(),
});

export type Notification = z.infer<typeof NotificationSchema>;

// Privacy settings
export const PrivacySettingsSchema = z.object({
  showLocation: z.boolean().default(false),
  showCategory: z.boolean().default(true),
  showTargetTime: z.boolean().default(true),
  allowFriendRequests: z.boolean().default(true),
  showInLeaderboard: z.boolean().default(true),
});

export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>;

// Time and duration utilities
export const DurationSchema = z.object({
  hours: z.number().int().min(0).max(23),
  minutes: z.number().int().min(0).max(59),
  seconds: z.number().int().min(0).max(59),
});

export type Duration = z.infer<typeof DurationSchema>;

// Streak types
export const StreakSchema = z.object({
  userId: z.string().uuid(),
  category: SessionCategorySchema,
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  lastActivityDate: z.date().optional(),
});

export type Streak = z.infer<typeof StreakSchema>;
