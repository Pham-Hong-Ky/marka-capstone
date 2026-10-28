import type {
  AdminAuditLogsQuery,
  AdminUsersQuery,
  AdminWorkspacesQuery,
} from '@/services/admin';
import type { AnalyticsFilters } from '@/services/analytics';
import type { PostListParams } from '@/services/post';
import type { ScheduleListParams } from '@/services/schedule';

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  workspace: {
    members: (workspaceId: string) => ['workspace', workspaceId, 'members'] as const,
    invite: (token: string, viewerId: string) => ['invite', token, viewerId] as const,
  },
  post: {
    workspace: (workspaceId: string) => ['posts', workspaceId] as const,
    list: (workspaceId: string, params: PostListParams) =>
      ['posts', workspaceId, params] as const,
    detailWorkspace: (workspaceId: string) => ['post', workspaceId] as const,
    detail: (workspaceId: string, postId: string) =>
      ['post', workspaceId, postId] as const,
  },
  schedule: {
    workspace: (workspaceId: string) => ['schedules', workspaceId] as const,
    list: (workspaceId: string, params: ScheduleListParams) =>
      ['schedules', workspaceId, params] as const,
  },
  channel: {
    list: (workspaceId: string) => ['channels', workspaceId] as const,
    detail: (workspaceId: string, channelId: string) =>
      ['channel', workspaceId, channelId] as const,
    pendingAccounts: (platform: string, sessionId: string) =>
      ['channels', platform, 'pending', sessionId] as const,
  },
  billing: {
    overview: (workspaceId: string) => ['billing', workspaceId] as const,
    transactions: (workspaceId: string, page: number, limit: number) =>
      ['billing', workspaceId, 'transactions', page, limit] as const,
    transactionsRoot: (workspaceId: string) =>
      ['billing', workspaceId, 'transactions'] as const,
    order: (workspaceId: string, orderId: string) =>
      ['billing', workspaceId, 'order', orderId] as const,
  },
  admin: {
    stats: () => ['admin', 'stats'] as const,
    users: (query: AdminUsersQuery) => ['admin', 'users', query] as const,
    usersRoot: () => ['admin', 'users'] as const,
    workspaces: (query: AdminWorkspacesQuery) => ['admin', 'workspaces', query] as const,
    auditLogs: (query: AdminAuditLogsQuery) => ['admin', 'audit-logs', query] as const,
  },
  analytics: {
    overview: (workspaceId: string | null, filters: AnalyticsFilters) =>
      ['analytics', 'overview', workspaceId, filters] as const,
    suggestions: (workspaceId: string | null, channelId?: string) =>
      ['analytics', 'suggestions', workspaceId, channelId ?? 'all'] as const,
    suggestionsRoot: ['analytics', 'suggestions'] as const,
  },
  notification: {
    list: (workspaceId: string | null) =>
      ['notifications', workspaceId ?? 'all', 'list'] as const,
    unread: (workspaceId: string | null) =>
      ['notifications', workspaceId ?? 'all', 'unread'] as const,
  },
  brandVoice: {
    detail: (workspaceId: string) => ['brand-voice', workspaceId] as const,
  },
  ai: {
    generation: (workspaceId: string, generationId: string) =>
      ['ai-generation', workspaceId, generationId] as const,
  },
};

export default queryKeys;
