import adminRepository from './admin.repository.js';
import auditService from '../audit/audit.service.js';
import type { ListUsersQuery, ListWorkspacesQuery, SuspendUserBody } from './admin.validation.js';
import { BadRequestError, NotFoundError } from '../../utils/errors/index.js';

type AdminUser = Awaited<ReturnType<typeof adminRepository.listUsersAndCount>>[0][number];
type AdminWorkspace = Awaited<
  ReturnType<typeof adminRepository.listWorkspacesAndCount>
>[0][number];

const mapUser = ({ _count, ...user }: AdminUser) => ({
  ...user,
  workspaceCount: _count.workspaceMembers,
});

const mapWorkspace = ({ _count, ...workspace }: AdminWorkspace) => ({
  ...workspace,
  memberCount: _count.members,
  postCount: _count.posts,
});

export const getStats = () => adminRepository.getStats();

export const listUsers = async (query: ListUsersQuery) => {
  const [users, total] = await adminRepository.listUsersAndCount({
    search: query.search,
    systemRole: query.systemRole,
    isSuspended: query.isSuspended,
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });

  return {
    users: users.map(mapUser),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const setUserSuspension = async (
  actorId: string,
  targetUserId: string,
  data: SuspendUserBody
) => {
  if (actorId === targetUserId) {
    throw new BadRequestError('Bạn không thể tự khoá tài khoản của mình');
  }

  const target = await adminRepository.findUserForAdmin(targetUserId);
  if (!target) {
    throw new NotFoundError('Người dùng không tồn tại');
  }

  const updated = await adminRepository.updateUserSuspension(targetUserId, data.suspended);

  await auditService.recordAuditLog({
    actorId,
    action: data.suspended ? 'ADMIN_USER_SUSPENDED' : 'ADMIN_USER_REACTIVATED',
    targetType: 'User',
    targetId: targetUserId,
    reason: data.reason ?? null,
    metadata: { email: target.email },
  });

  return mapUser(updated);
};

export const listWorkspaces = async (query: ListWorkspacesQuery) => {
  const [workspaces, total] = await adminRepository.listWorkspacesAndCount({
    search: query.search,
    plan: query.plan,
    includeDeleted: query.includeDeleted,
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });

  return {
    workspaces: workspaces.map(mapWorkspace),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export default {
  getStats,
  listUsers,
  setUserSuspension,
  listWorkspaces,
};
