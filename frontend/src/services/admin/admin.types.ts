import type { WorkspacePlan } from '@/services/auth';

export interface AdminStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    admins: number;
    createdLast30Days: number;
  };
  workspaces: { total: number; createdLast30Days: number };
  posts: { total: number; byStatus: Record<string, number> };
  channels: { ACTIVE: number; EXPIRED: number };
  billing: { paidOrdersLast30Days: number; revenueLast30Days: number };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  authProvider: string;
  systemRole: 'SYSTEM_ADMIN' | 'USER';
  emailVerified: boolean;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
  workspaceCount: number;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  plan: WorkspacePlan;
  remainingCredit: number;
  deletedAt: string | null;
  createdAt: string;
  memberCount: number;
  postCount: number;
}

export interface AdminAuditLog {
  id: string;
  workspaceId: string | null;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
  workspace: { id: string; name: string } | null;
}

export interface AdminPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  meta: AdminPaginationMeta;
}

export interface AdminWorkspacesResponse {
  workspaces: AdminWorkspace[];
  meta: AdminPaginationMeta;
}

export interface AdminAuditLogsResponse {
  auditLogs: AdminAuditLog[];
  meta: AdminPaginationMeta;
}

export interface AdminUsersQuery {
  page: number;
  limit: number;
  search?: string;
  systemRole?: 'SYSTEM_ADMIN' | 'USER';
  isSuspended?: boolean;
}

export interface AdminWorkspacesQuery {
  page: number;
  limit: number;
  search?: string;
  plan?: WorkspacePlan;
  includeDeleted?: boolean;
}

export interface AdminAuditLogsQuery {
  page: number;
  limit: number;
  action?: string;
  targetType?: string;
  dateFrom?: string;
  dateTo?: string;
}
