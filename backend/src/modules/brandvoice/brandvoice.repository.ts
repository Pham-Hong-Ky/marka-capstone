import type { Prisma } from '@prisma/client';
import prisma from '../../config/db.js';

export const findWorkspaceById = async (workspaceId: string) => {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
};

export const getWorkspaceBrandVoice = async (workspaceId: string) => {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { brandVoice: true },
  });
};

export const updateWorkspaceBrandVoice = async (
  workspaceId: string,
  brandVoice: Prisma.InputJsonValue
) => {
  return prisma.workspace.update({
    where: { id: workspaceId },
    data: { brandVoice },
    select: { brandVoice: true },
  });
};

export default {
  findWorkspaceById,
  getWorkspaceBrandVoice,
  updateWorkspaceBrandVoice,
};
