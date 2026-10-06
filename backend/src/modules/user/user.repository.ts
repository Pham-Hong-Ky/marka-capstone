import prisma from '../../config/db.js';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}

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
    include: {
      workspaceMembers: {
        include: {
          workspace: true,
        },
      },
    },
  });
};

export const createUser = async ({ email, passwordHash, name }: CreateUserData) => {
  return prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        authProvider: 'LOCAL',
        systemRole: 'USER',
      },
    });

    const defaultWorkspace = await tx.workspace.create({
      data: {
        name: `Workspace của ${name}`,
        plan: 'FREE',
        remainingCredit: 100,
        monthlyQuota: 100,
      },
    });

    await tx.workspaceMember.create({
      data: {
        userId: newUser.id,
        workspaceId: defaultWorkspace.id,
        role: 'OWNER',
        allowDirectPublish: true,
      },
    });

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      avatar: newUser.avatar,
      systemRole: newUser.systemRole,
      emailVerified: newUser.emailVerified,
      tokenVersion: newUser.tokenVersion,
      createdAt: newUser.createdAt,
      defaultWorkspace: {
        id: defaultWorkspace.id,
        name: defaultWorkspace.name,
        plan: defaultWorkspace.plan,
        remainingCredit: defaultWorkspace.remainingCredit,
      },
    };
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

export default {
  findUserById,
  findUserByEmail,
  createUser,
  updateUser,
  incrementTokenVersion,
};
