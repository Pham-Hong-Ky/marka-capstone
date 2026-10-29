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

interface GenerationSnapshot {
  workspaceId: string;
  userId: string | null;
  creditCost: number;
  type: AiGenType;
}

export interface FailGenerationResult {
  failed: boolean;
  generation: GenerationSnapshot | null;
}

export const findGenerationByIdAndWorkspace = async (
  generationId: string,
  workspaceId: string
) => {
  return prisma.aiGeneration.findFirst({
    where: { id: generationId, workspaceId },
  });
};

export const findGenerationStatus = async (db: DbClient, generationId: string) => {
  return db.aiGeneration.findUnique({
    where: { id: generationId },
    select: { status: true },
  });
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

/**
 * Chuyển generation sang PROCESSING và trả về bản ghi mới.
 * Trả null khi generation đã kết thúc hoặc không tồn tại — worker bỏ qua job.
 */
export const takeGenerationForProcessing = async (generationId: string) => {
  const { count } = await prisma.aiGeneration.updateMany({
    where: { id: generationId, status: { in: ['PENDING', 'PROCESSING'] } },
    data: { status: 'PROCESSING' },
  });

  if (count === 0) return null;

  return prisma.aiGeneration.findUnique({ where: { id: generationId } });
};

const COMPLETABLE_STATUSES = ['PENDING', 'PROCESSING'] as const;

const buildCompletionData = (response: unknown) => ({
  status: 'SUCCESS' as const,
  response: JSON.stringify(response),
  errorMessage: null,
});

export const completeGeneration = async (
  generationId: string,
  response: unknown
): Promise<boolean> => {
  const { count } = await prisma.aiGeneration.updateMany({
    where: { id: generationId, status: { in: [...COMPLETABLE_STATUSES] } },
    data: buildCompletionData(response),
  });

  return count > 0;
};

export const completeGenerationInTransaction = async (
  db: DbClient,
  generationId: string,
  response: unknown
): Promise<boolean> => {
  const { count } = await db.aiGeneration.updateMany({
    where: { id: generationId, status: { in: [...COMPLETABLE_STATUSES] } },
    data: buildCompletionData(response),
  });

  return count > 0;
};

export const failActiveGeneration = async (
  db: DbClient,
  generationId: string,
  errorMessage: string
): Promise<FailGenerationResult> => {
  const generation = await db.aiGeneration.findUnique({
    where: { id: generationId },
    select: { workspaceId: true, userId: true, creditCost: true, type: true, status: true },
  });

  if (!generation || generation.status === 'SUCCESS' || generation.status === 'FAILED') {
    return { failed: false, generation: null };
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

  return { failed: count === 1, generation: count === 1 ? generation : null };
};

export const findStaleGenerationIds = async (updatedBefore: Date, take: number) => {
  const rows = await prisma.aiGeneration.findMany({
    where: { status: { in: ['PENDING', 'PROCESSING'] }, updatedAt: { lt: updatedBefore } },
    orderBy: { updatedAt: 'asc' },
    take,
    select: { id: true },
  });
  return rows.map((row) => row.id);
};

const buildPostForGenerationWhere =(postId: string, workspaceId: string) => ({
  id: postId,
  workspaceId,
});

const POST_FOR_GENERATION_SELECT = {
  id: true,
  title: true,
  content: true,
  status: true,
  workspaceId: true,
  createdById: true,
} satisfies Prisma.PostSelect;

export const getPostForGeneration = async (postId: string, workspaceId: string) => {
  return prisma.post.findFirst({
    where: buildPostForGenerationWhere(postId, workspaceId),
    select: POST_FOR_GENERATION_SELECT,
  });
};

export const getPostForGenerationInTransaction = async (
  db: DbClient,
  postId: string,
  workspaceId: string
) => {
  return db.post.findFirst({
    where: buildPostForGenerationWhere(postId, workspaceId),
    select: POST_FOR_GENERATION_SELECT,
  });
};

export default {
  findGenerationByIdAndWorkspace,
  findGenerationStatus,
  createGeneration,
  createDraftPost,
  createMediaAsset,
  takeGenerationForProcessing,
  completeGeneration,
  completeGenerationInTransaction,
  failActiveGeneration,
  findStaleGenerationIds,
  getPostForGeneration,
  getPostForGenerationInTransaction,
};
