import { PostStatus, Prisma, type SystemRole, type WorkspacePlan } from '@prisma/client';
import prisma, { basePrisma } from '../../config/db.js';

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  authProvider: true,
  systemRole: true,
  emailVerified: true,
  isSuspended: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { workspaceMembers: true } },
} as const;

const WORKSPACE_ADMIN_SELECT = {
  id: true,
  name: true,
  plan: true,
  remainingCredit: true,
  deletedAt: true,
  createdAt: true,
  _count: {
    select: {
      members: true,
      posts: { where: { deletedAt: null } },
    },
  },
} as const;

export const getStats = async () => {
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    usersSuspended,
    usersAdmins,
    usersCreatedLast30Days,
    workspacesTotal,
    workspacesCreatedLast30Days,
    postsTotal,
    postsByStatus,
    channelsByStatus,
    paidOrders,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isSuspended: true } }),
    prisma.user.count({ where: { systemRole: 'SYSTEM_ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.workspace.count(),
    prisma.workspace.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.post.count(),
    prisma.post.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.channelConnection.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.aggregate({
      where: { status: 'PAID', paidAt: { gte: last30Days } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const byStatus = Object.values(PostStatus).reduce<Record<string, number>>((result, status) => {
    result[status] = 0;
    return result;
  }, {});

  for (const group of postsByStatus) {
    byStatus[group.status] = group._count._all;
  }

  const channels = { ACTIVE: 0, EXPIRED: 0 };
  for (const group of channelsByStatus) {
    channels[group.status] = group._count._all;
  }

  return {
    users: {
      total: usersTotal,
      active: usersTotal - usersSuspended,
      suspended: usersSuspended,
      admins: usersAdmins,
      createdLast30Days: usersCreatedLast30Days,
    },
    workspaces: {
      total: workspacesTotal,
      createdLast30Days: workspacesCreatedLast30Days,
    },
    posts: {
      total: postsTotal,
      byStatus,
    },
    channels,
    billing: {
      paidOrdersLast30Days: paidOrders._count._all,
      revenueLast30Days: paidOrders._sum.amount ?? 0,
    },
  };
};

export interface ListUsersParams {
  search?: string;
  systemRole?: SystemRole;
  isSuspended?: boolean;
  skip: number;
  take: number;
}

export const listUsersAndCount = async (params: ListUsersParams) => {
  const where: Prisma.UserWhereInput = {
    ...(params.search
      ? {
          OR: [
            { email: { contains: params.search, mode: 'insensitive' } },
            { name: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(params.systemRole ? { systemRole: params.systemRole } : {}),
    ...(params.isSuspended !== undefined ? { isSuspended: params.isSuspended } : {}),
  };

  return prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
      select: USER_PUBLIC_SELECT,
    }),
    prisma.user.count({ where }),
  ]);
};

export const findUserForAdmin = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, systemRole: true, isSuspended: true },
  });
};

export const updateUserSuspension = async (userId: string, suspended: boolean) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: suspended,
      // Đổi trạng thái khoá phải đá mọi phiên cũ, kể cả khi mở khoá.
      tokenVersion: { increment: 1 },
    },
    select: USER_PUBLIC_SELECT,
  });
};

export interface ListWorkspacesParams {
  search?: string;
  plan?: WorkspacePlan;
  includeDeleted: boolean;
  skip: number;
  take: number;
}

export const listWorkspacesAndCount = async (params: ListWorkspacesParams) => {
  const where: Prisma.WorkspaceWhereInput = {
    ...(params.search ? { name: { contains: params.search, mode: 'insensitive' } } : {}),
    ...(params.plan ? { plan: params.plan } : {}),
  };

  const findArgs = {
    where,
    orderBy: { createdAt: 'desc' as const },
    skip: params.skip,
    take: params.take,
    select: WORKSPACE_ADMIN_SELECT,
  };

  if (params.includeDeleted) {
    return Promise.all([
      basePrisma.workspace.findMany(findArgs),
      basePrisma.workspace.count({ where }),
    ]);
  }

  return Promise.all([prisma.workspace.findMany(findArgs), prisma.workspace.count({ where })]);
};

export default {
  getStats,
  listUsersAndCount,
  findUserForAdmin,
  updateUserSuspension,
  listWorkspacesAndCount,
};
