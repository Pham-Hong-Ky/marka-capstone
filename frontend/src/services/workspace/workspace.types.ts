import type { WorkspacePlan, WorkspaceRole } from '@/services/auth';

export interface WorkspaceBase {
  id: string;
  name: string;
  logo: string | null;
  plan: WorkspacePlan;
  remainingCredit: number;
  monthlyQuota: number;
}

export interface WorkspaceSummary extends WorkspaceBase {
  role: WorkspaceRole;
}

export interface WorkspaceMember {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: WorkspaceRole;
  allowDirectPublish: boolean;
  status: 'ACTIVE';
  joinedAt: string;
}

export interface WorkspacePendingInvite {
  inviteId: string;
  email: string;
  role: WorkspaceRole;
  status: 'PENDING';
  invitedAt: string;
  expiresAt: string;
}

export interface WorkspaceMembersResponse {
  members: WorkspaceMember[];
  pendingInvites: WorkspacePendingInvite[];
}

export interface InviteMemberPayload {
  email: string;
  role: WorkspaceRole;
}

export interface InviteMemberResult {
  invite: {
    inviteId: string;
    email: string;
    role: WorkspaceRole;
    expiresAt: string;
  };
  inviteUrl: string;
}

export type AcceptInviteResult =
  | { requiresRegistration: true; email: string; workspaceName: string }
  | { workspaceId: string; workspaceName: string; alreadyMember?: boolean };
