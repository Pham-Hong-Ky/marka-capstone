import type { Workspace, WorkspaceRole } from '@prisma/client';

export interface WorkspaceSummary {
  id: string;
  name: string;
  logo: string | null;
  plan: string;
  role: WorkspaceRole;
  remainingCredit: number;
  monthlyQuota: number;
}

export const toWorkspaceSummary = (member: { role: WorkspaceRole; workspace: Workspace }): WorkspaceSummary => ({
  id: member.workspace.id,
  name: member.workspace.name,
  logo: member.workspace.logo,
  plan: member.workspace.plan,
  role: member.role,
  remainingCredit: member.workspace.remainingCredit,
  monthlyQuota: member.workspace.monthlyQuota,
});
