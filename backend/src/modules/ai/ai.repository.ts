import type { AiGenType, Prisma } from '@prisma/client';
import prisma from '../../config/db.js';

type DbClient = Prisma.TransactionClient;

interface CreateGenerationData {
  workspaceId: string;
  userId: string | null;
  postId: string | null;
  type: AiGenType;
  provider: string;
  model: string;
  prompt: string;
  creditCost: number;
}

interface CreateDraftPostData {
  workspaceId: string;
  title: string;
  content: Prisma.InputJsonValue;
  createdById: string;
}

interface CreateMediaData {
  workspaceId: string;
  postId: string;
  url: string;
  mimeType: string;
  size: number;
  createdById: string | null;
}

export const findGenerationByIdAndWorkspace = async (
  generationId: string,
  workspaceId: string
) => {
  return prisma.aiGeneration.findFirst({
    where: { id: generationId, workspaceId },
  });
};

export const findGenerationById = async (generationId: string) => {
  return prisma.aiGeneration.findUnique({ where: { id: generationId } });
};

export const createGeneration = async (db: DbClient, data: CreateGenerationData) => {
  return db.aiGeneration.create({
    data: { ...data, status: 'PENDING' },
  });
};

export const createDraftPost = async (db: DbClient, data: CreateDraftPostData) => {
  return db.post.create({
    data: { ...data, status: 'DRAFT' },
  });
};

export const createMediaAsset = async (db: DbClient, data: CreateMediaData) => {
  return db.mediaAsset.create({
    data: { ...data, type: 'IMAGE', source: 'AI_GENERATED' },
  });
};

export const markProcessing = async (generationId: string): Promise<boolean> => {
  const { count } = await prisma.aiGeneration.updateMany({
    where: { id: generationId, status: { in: ['PENDING', 'PROCESSING'] } },
    data: { status: 'PROCESSING' },
  });
  return count > 0;
};

export const completeTextGeneration = async (
  generationId: string,
  response: unknown
): Promise<boolean> => {
  const { count } = await prisma.aiGeneration.updateMany({
    where: { id: generationId, status: { in: ['PENDING', 'PROCESSING'] } },
    data: {
      status: 'SUCCESS',
      response: JSON.stringify(response),
      errorMessage: null,
    },
  });
  return count > 0;
};

export const failActiveGeneration = async (
  db: DbClient,
  generationId: string,
  errorMessage: string
): Promise<{ count: number; generation: { workspaceId: string; userId: string | null; creditCost: number; type: AiGenType } | null }> => {
  const generation = await db.aiGeneration.findUnique({
    where: { id: generationId },
    select: { workspaceId: true, userId: true, creditCost: true, type: true, status: true },
  });

  if (!generation || generation.status === 'SUCCESS' || generation.status === 'FAILED') {
    return { count: 0, generation: null };
  }

  const { count } = await db.aiGeneration.updateMany({
    where: { id: generationId, status: { in: ['PENDING', 'PROCESSING'] } },
    data: {
      status: 'FAILED',
      creditCost: 0,
      errorMessage,
      response: null,
    },
  });

  return { count, generation: count === 1 ? generation : null };
};

export const getPostForGeneration = async (postId: string, workspaceId: string) => {
  return prisma.post.findFirst({
    where: { id: postId, workspaceId },
    select: { id: true, title: true, content: true, status: true, workspaceId: true },
  });
};

export default {
  findGenerationByIdAndWorkspace,
  findGenerationById,
  createGeneration,
  createDraftPost,
  createMediaAsset,
  markProcessing,
  completeTextGeneration,
  failActiveGeneration,
  getPostForGeneration,
};
