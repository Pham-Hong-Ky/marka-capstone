import type { User, Workspace, WorkspaceRole } from '@prisma/client';
import { toWorkspaceSummary } from '../workspace/workspace.mapper.js';

type UserWithWorkspaces = Pick<User, 'id' | 'email' | 'name' | 'avatar' | 'systemRole' | 'emailVerified'> & {
  workspaceMembers: Array<{ role: WorkspaceRole; workspace: Workspace }>;
};

export const toAuthUser = (user: UserWithWorkspaces) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatar: user.avatar,
  systemRole: user.systemRole,
  emailVerified: user.emailVerified,
  workspaces: user.workspaceMembers.map(toWorkspaceSummary),
});
