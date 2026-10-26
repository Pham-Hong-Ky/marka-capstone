import type { AuthProvider } from '@prisma/client';
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

const WITH_WORKSPACES = { workspaceMembers: { include: { workspace: true } } } as const;

export interface UpdateUserData {
  name?: string;
  avatar?: string | null;
  passwordHash?: string;
  emailVerified?: boolean;
  isSuspended?: boolean;
}

export const findUserById = async (userId: string) => {
  return prisma.user.findUnique({
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
        include: {
          workspace: true,
        },
      },
    },
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

// Mỗi tài khoản mới luôn có một workspace mặc định do chính họ làm Owner.
export const createUserWithDefaultWorkspace = async (data: CreateUserData) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { ...data, systemRole: 'USER' } });

    await tx.workspace.create({
      data: {
        name: `Workspace của ${user.name}`,
        plan: 'FREE',
        members: { create: { userId: user.id, role: 'OWNER', allowDirectPublish: true } },
      },
    });

    return tx.user.findUniqueOrThrow({ where: { id: user.id }, include: WITH_WORKSPACES });
  });
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
  findUserByEmail,
  findUserByEmailIncludingDeleted,
  createUserWithDefaultWorkspace,
  linkGoogleAccount,
  updateUser,
  incrementTokenVersion,
  findSoleOwnedWorkspaces,
  softDeleteUser,
};
