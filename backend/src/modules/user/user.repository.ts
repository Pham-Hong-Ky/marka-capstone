import type { AuthProvider, Prisma } from '@prisma/client';
import prisma, { basePrisma } from '../../config/db.js';

export interface CreateUserData {
  email: string;
  name: string;
  authProvider: AuthProvider;
  passwordHash?: string;
  googleId?: string;
  avatar?: string | null;
  emailVerified?: boolean;
}

const WITH_WORKSPACES = {
  workspaceMembers: {
    where: { workspace: { deletedAt: null } },
    include: { workspace: true },
  },
} as const;

export interface UpdateUserData {
  name?: string;
  avatar?: string | null;
  passwordHash?: string;
  emailVerified?: boolean;
  isSuspended?: boolean;
}

export const findUserById = async (userId: string, tx?: Prisma.TransactionClient) => {
  const client = (tx ?? prisma) as Prisma.TransactionClient;
  return client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      passwordHash: true,
      systemRole: true,
      tokenVersion: true,
      isSuspended: true,
      emailVerified: true,
      workspaceMembers: {
        where: { workspace: { deletedAt: null } },
        include: {
          workspace: true,
        },
      },
    },
  });
};

export const findUserSummaryById = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
};

export const findUserSummaryByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
};

export const findUserSummariesByIds = async (userIds: string[]) => {
  return prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
};

export const findUserByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
    include: WITH_WORKSPACES,
  });
};

// Đăng ký cần biết email đã thuộc tài khoản đã xoá mềm hay chưa, để trả lỗi
// rõ ràng thay vì vi phạm ràng buộc unique của DB.
export const findUserByEmailIncludingDeleted = async (email: string) =>
  basePrisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });

export const createUser = async (data: CreateUserData, tx?: Prisma.TransactionClient) => {
  const client = (tx ?? prisma) as Prisma.TransactionClient;
  return client.user.create({ data: { ...data, systemRole: 'USER' } });
};

export const linkGoogleAccount = async (userId: string, data: { googleId: string; avatar: string | null }) => {
  return prisma.user.update({
    where: { id: userId },
    data: { ...data, emailVerified: true },
    include: WITH_WORKSPACES,
  });
};

export const updateUser = async (userId: string, data: UpdateUserData) => {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      systemRole: true,
      emailVerified: true,
      updatedAt: true,
    },
  });
};

export const incrementTokenVersion = async (userId: string) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      tokenVersion: {
        increment: 1,
      },
    },
  });
};

export const updatePasswordAndBumpTokenVersion = async (userId: string, passwordHash: string) => {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
    select: { id: true, updatedAt: true },
  });
};

export const findSoleOwnedWorkspaces = async (userId: string): Promise<string[]> => {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, role: 'OWNER', workspace: { deletedAt: null } },
    select: {
      workspace: {
        select: {
          name: true,
          _count: { select: { members: { where: { role: 'OWNER' } } } },
        },
      },
    },
  });

  return memberships
    .filter((membership) => membership.workspace._count.members === 1)
    .map((membership) => membership.workspace.name);
};

export const softDeleteUser = async (userId: string) =>
  prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), tokenVersion: { increment: 1 } },
    });
    await tx.workspaceMember.deleteMany({ where: { userId } });
  });

export default {
  findUserById,
  findUserSummaryById,
  findUserSummaryByEmail,
  findUserSummariesByIds,
  findUserByEmail,
  findUserByEmailIncludingDeleted,
  createUser,
  linkGoogleAccount,
  updateUser,
  incrementTokenVersion,
  updatePasswordAndBumpTokenVersion,
  findSoleOwnedWorkspaces,
  softDeleteUser,
};
