import type { WorkspaceRole } from '@prisma/client';
import prisma from '../../config/db.js';

export interface CreateWorkspaceData {
  name: string;
  logo?: string | null;
}

export interface CreateInviteData {
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: Date;
  invitedById: string;
}

// ---- Workspaces ----

export const findWorkspacesByUserId = async (userId: string) => {
  return prisma.workspaceMember.findMany({
    where: { userId, workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  });
};

export const findWorkspaceByNameAndOwner = async (userId: string, name: string) => {
  return prisma.workspace.findFirst({
    where: {
      name,
      members: { some: { userId, role: 'OWNER' } },
    },
  });
};

export const findWorkspaceById = async (workspaceId: string) => {
  return prisma.workspace.findUnique({ where: { id: workspaceId } });
};

export const createWorkspaceWithOwner = async (
  { name, logo }: CreateWorkspaceData,
  ownerId: string
) => {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name, logo: logo ?? null },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: ownerId,
        role: 'OWNER',
        allowDirectPublish: true,
      },
    });

    return workspace;
  });
};

export const updateWorkspace = async (
  workspaceId: string,
  data: { name?: string; logo?: string | null }
) => {
  return prisma.workspace.update({ where: { id: workspaceId }, data });
};

export const softDeleteWorkspace = async (workspaceId: string) => {
  return prisma.$transaction(async (tx) => {
    await tx.channelConnection.updateMany({
      where: { workspaceId, status: { not: 'EXPIRED' } },
      data: { status: 'EXPIRED' },
    });

    await tx.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
  });
};

// ---- Members ----

export const findMembersByWorkspace = async (workspaceId: string) => {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
};

export const findMember = async (workspaceId: string, userId: string) => {
  return prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
};

export const countOwners = async (workspaceId: string) => {
  return prisma.workspaceMember.count({ where: { workspaceId, role: 'OWNER' } });
};

export const findOwnerIds = async (workspaceId: string) => {
  const owners = await prisma.workspaceMember.findMany({
    where: { workspaceId, role: 'OWNER' },
    select: { userId: true },
  });
  return owners.map((owner) => owner.userId);
};

export const createMember = async (
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
) => {
  return prisma.workspaceMember.create({
    data: { workspaceId, userId, role, allowDirectPublish: role === 'OWNER' },
  });
};

export const deleteMember = async (workspaceId: string, userId: string) => {
  return prisma.workspaceMember.delete({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
};

export const updateMemberRole = async (
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
) => {
  return prisma.workspaceMember.update({
    where: { userId_workspaceId: { userId, workspaceId } },
    data: { role },
  });
};

// ---- Invites ----

export const findInviteByToken = async (token: string) => {
  return prisma.workspaceInvite.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true, deletedAt: true } },
    },
  });
};

export const findPendingInvitesByWorkspace = async (workspaceId: string) => {
  return prisma.workspaceInvite.findMany({
    where: { workspaceId, isUsed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
};

export const findActiveInviteByEmail = async (workspaceId: string, email: string) => {
  return prisma.workspaceInvite.findFirst({
    where: { workspaceId, email, isUsed: false, expiresAt: { gt: new Date() } },
  });
};

export const createInvite = async (data: CreateInviteData) => {
  return prisma.workspaceInvite.create({ data });
};

export const refreshInvite = async (
  inviteId: string,
  data: { token: string; expiresAt: Date; role: WorkspaceRole }
) => {
  return prisma.workspaceInvite.update({
    where: { id: inviteId },
    data: { token: data.token, expiresAt: data.expiresAt, role: data.role },
  });
};

export const markInviteUsed = async (inviteId: string) => {
  return prisma.workspaceInvite.update({
    where: { id: inviteId },
    data: { isUsed: true },
  });
};

// ---- Cross-entity lookups ----

export const findUserByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
};

export const findUserById = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
};

export const createNotification = async (data: {
  userId: string;
  workspaceId?: string | null;
  type: string;
  payload: Record<string, unknown>;
}) => {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      workspaceId: data.workspaceId ?? null,
      type: data.type,
      payload: data.payload,
    },
  });
};

export default {
  findWorkspacesByUserId,
  findWorkspaceByNameAndOwner,
  findWorkspaceById,
  createWorkspaceWithOwner,
  updateWorkspace,
  softDeleteWorkspace,
  findMembersByWorkspace,
  findMember,
  countOwners,
  findOwnerIds,
  createMember,
  deleteMember,
  updateMemberRole,
  findInviteByToken,
  findPendingInvitesByWorkspace,
  findActiveInviteByEmail,
  createInvite,
  refreshInvite,
  markInviteUsed,
  findUserByEmail,
  findUserById,
  createNotification,
};
