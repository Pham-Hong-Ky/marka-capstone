import { getErrorMessage } from '../../utils/errorMessage.js';
import type {
  AiGenStatus,
  AiGenType,
  PostStatus,
  Prisma,
  WorkspaceRole,
} from '@prisma/client';
import { NotFoundError } from '../../utils/errors/index.js';
import logger from '../../utils/logger.js';
import brandVoiceService from '../brandvoice/brandvoice.service.js';
import creditService from '../credit/credit.service.js';
import { assertCanModify, assertEditable } from '../post/post.service.js';
import {
  AI_IMAGE_COST,
  AI_IMAGE_PROVIDER,
  AI_TEXT_COST,
  AI_TEXT_PROVIDER,
  getGeminiModel,
  getImageModel,
} from './ai.config.js';
import { AiPostNotEditableError } from './ai.errors.js';
import { serializeImageSource, type ImageSourcePayload } from './ai.image-prompt.js';
import { buildTextPrompt, contentToPlainText, serializeTextPrompt } from './ai.prompt.js';
import aiRepository from './ai.repository.js';
import type { GenerateImageBody, GenerateTextBody } from './ai.validation.js';

export interface StartGenerationContext {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

interface PendingGenerationParams {
  workspaceId: string;
  userId: string;
  postId: string | null;
  type: AiGenType;
  provider: string;
  model: string;
  prompt: string;
  creditCost: number;
}

export type ImageRequest =
  | { kind: 'existing'; postId: string; prompt?: string }
  | {
      kind: 'new';
      title: string;
      content: Prisma.InputJsonValue;
      prompt?: string;
    };

interface ImageTargetPost {
  id: string;
  title: string | null;
  content: Prisma.JsonValue;
}

export interface StartGenerationResult {
  generationId: string;
  status: 'PENDING';
  postId: string | null;
  creditCost: number;
  remainingCredit: number;
}

export const getBrandVoice = async (workspaceId: string) => {
  const { brandVoice } = await brandVoiceService.getBrandVoice(workspaceId);
  return brandVoice;
};

export const normalizeImageRequest = (body: GenerateImageBody): ImageRequest =>
  'postId' in body
    ? { kind: 'existing', postId: body.postId, prompt: body.prompt }
    : {
        kind: 'new',
        title: body.title,
        content: body.content as Prisma.InputJsonValue,
        prompt: body.prompt,
      };

const assertPostEditable = async (
  tx: Prisma.TransactionClient,
  postId: string,
  { workspaceId, userId, role }: StartGenerationContext
) => {
  const post = await aiRepository.getPostForGenerationInTransaction(tx, postId, workspaceId);

  if (!post) {
    throw new NotFoundError('Bài viết không tồn tại');
  }

  assertCanModify(post, userId, role);
  assertEditable(post);

  return post;
};

/** Quy tắc chung: chỉ bài DRAFT/REJECTED mới được nhận ảnh AI. */
export const assertPostAcceptsImages = <T extends { status: PostStatus }>(post: T | null): T => {
  if (!post) {
    throw new AiPostNotEditableError('Bài viết không tồn tại hoặc đã bị xoá');
  }

  if (post.status !== 'DRAFT' && post.status !== 'REJECTED') {
    throw new AiPostNotEditableError('Bài viết đã được gửi duyệt nên không thể thêm ảnh');
  }

  return post;
};

const createPendingGeneration = async (
  tx: Prisma.TransactionClient,
  params: PendingGenerationParams
) => {
  const credit = await creditService.reserve(tx, {
    workspaceId: params.workspaceId,
    userId: params.userId,
    cost: params.creditCost,
    action: params.type === 'TEXT' ? 'GEN_TEXT' : 'GEN_IMAGE',
    reason: params.type === 'TEXT' ? 'Tạo nội dung bằng AI' : 'Tạo ảnh bằng AI',
  });

  const generation = await aiRepository.createGeneration(tx, {
    workspaceId: params.workspaceId,
    userId: params.userId,
    postId: params.postId,
    type: params.type,
    provider: params.provider,
    model: params.model,
    prompt: params.prompt,
    creditCost: params.creditCost,
  });

  return { generation, credit };
};

export const toStartResult = (
  generation: { id: string; postId: string | null; creditCost: number },
  remainingCredit: number
): StartGenerationResult => ({
  generationId: generation.id,
  status: 'PENDING',
  postId: generation.postId,
  creditCost: generation.creditCost,
  remainingCredit,
});

export const parseGenerationResponse = (generation: {
  id: string;
  status: AiGenStatus;
  response: string | null;
}): unknown => {
  if (generation.status !== 'SUCCESS' || !generation.response) return null;

  try {
    return JSON.parse(generation.response) as unknown;
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`Response AI không phải JSON hợp lệ (${generation.id}): ${message}`);
    return null;
  }
};

export const createTextGeneration = async (
  tx: Prisma.TransactionClient,
  body: GenerateTextBody,
  context: StartGenerationContext,
  brandVoice: unknown
) => {
  if (body.postId) {
    await assertPostEditable(tx, body.postId, context);
  }

  const { systemInstruction, userPrompt } = buildTextPrompt({
    topic: body.topic,
    instructions: body.instructions,
    brandVoice,
  });

  return createPendingGeneration(tx, {
    workspaceId: context.workspaceId,
    userId: context.userId,
    postId: body.postId ?? null,
    type: 'TEXT',
    provider: AI_TEXT_PROVIDER,
    model: getGeminiModel(),
    prompt: serializeTextPrompt({ systemInstruction, userPrompt }),
    creditCost: AI_TEXT_COST,
  });
};

const loadImageTargetPost = async (
  tx: Prisma.TransactionClient,
  request: ImageRequest,
  context: StartGenerationContext
): Promise<ImageTargetPost | null> => {
  if (request.kind !== 'existing') return null;

  return assertPostEditable(tx, request.postId, context);
};

const buildImageSource = (
  request: ImageRequest,
  existingPost: ImageTargetPost | null,
  brandVoice: unknown
): ImageSourcePayload => ({
  title: existingPost?.title ?? (request.kind === 'new' ? request.title : null),
  contentText: contentToPlainText(
    existingPost?.content ?? (request.kind === 'new' ? request.content : undefined)
  ),
  instructions: request.prompt ?? null,
  brandVoice,
});

const resolveImageTarget = async (
  tx: Prisma.TransactionClient,
  request: ImageRequest,
  existingPost: ImageTargetPost | null,
  context: StartGenerationContext
): Promise<{ postId: string; createdDraftId: string | null }> => {
  if (existingPost) {
    return { postId: existingPost.id, createdDraftId: null };
  }

  if (request.kind !== 'new') {
    throw new AiPostNotEditableError('Không xác định được bài viết để tạo ảnh');
  }

  const draft = await aiRepository.createDraftPost(tx, {
    workspaceId: context.workspaceId,
    title: request.title,
    content: request.content,
    createdById: context.userId,
  });

  return { postId: draft.id, createdDraftId: draft.id };
};

export const createImageGeneration = async (
  tx: Prisma.TransactionClient,
  request: ImageRequest,
  context: StartGenerationContext,
  brandVoice: unknown
) => {
  const existingPost = await loadImageTargetPost(tx, request, context);
  const { postId, createdDraftId } = await resolveImageTarget(tx, request, existingPost, context);

  const pending = await createPendingGeneration(tx, {
    workspaceId: context.workspaceId,
    userId: context.userId,
    postId,
    type: 'IMAGE',
    provider: AI_IMAGE_PROVIDER,
    model: getImageModel(),
    prompt: serializeImageSource(buildImageSource(request, existingPost, brandVoice)),
    creditCost: AI_IMAGE_COST,
  });

  return { ...pending, createdDraftId };
};

export default {
  getBrandVoice,
  normalizeImageRequest,
  assertPostAcceptsImages,
  createTextGeneration,
  createImageGeneration,
  toStartResult,
  parseGenerationResponse,
};
