import { getErrorMessage } from '../../utils/errorMessage.js';
import type {
  AiGenStatus,
  AiGenType,
  PostStatus,
  Prisma,
  SocialPlatform,
  WorkspaceRole,
} from '@prisma/client';
import { NotFoundError } from '../../utils/errors/index.js';
import logger from '../../utils/logger.js';
import brandVoiceService from '../brandvoice/brandvoice.service.js';
import creditService from '../credit/credit.service.js';
import { assertCanEdit } from '../post/post.service.js';
import {
  AI_IMAGE_COST,
  AI_IMAGE_PROVIDER,
  AI_TEXT_COST,
  AI_TEXT_PROVIDER,
  getGeminiModel,
  getImageModel,
} from './providers/ai.config.js';
import { AiPostNotEditableError } from './providers/ai.errors.js';
import { geminiClient } from './providers/ai.providers.js';
import {
  buildImageArtPrompt,
  parseImageArtOutput,
  serializeImageSource,
  type ImageSourcePayload,
} from './prompts/ai.image-prompt.js';
import { buildTextPrompt, contentToPlainText, serializeTextPrompt } from './prompts/ai.prompt.js';
import aiRepository from './ai.repository.js';
import type { GenerateImageBody, GeneratePostBody, GenerateTextBody } from './ai.validation.js';

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

  assertCanEdit(post, userId, role);

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
  brandVoice: unknown,
  platforms: SocialPlatform[] = []
) => {
  if (body.postId) {
    await assertPostEditable(tx, body.postId, context);
  }

  const { systemInstruction, userPrompt } = buildTextPrompt({
    topic: body.topic,
    instructions: body.instructions,
    brandVoice,
    platforms,
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

export const buildImageSource = (
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

export const generateArtPrompt = async (source: ImageSourcePayload): Promise<string> => {
  const { systemInstruction, userPrompt, responseSchema } = buildImageArtPrompt({
    title: source.title ?? undefined,
    contentText: source.contentText ?? undefined,
    instructions: source.instructions ?? undefined,
    brandVoice: source.brandVoice,
  });

  const raw = await geminiClient.generateJson({
    model: getGeminiModel(),
    systemInstruction,
    userPrompt,
    responseSchema,
  });

  return parseImageArtOutput(raw);
};

/** Nguồn để viết prompt ảnh: chủ đề khi có tạo chữ, ngược lại là nội dung bài đã có. */
export const resolveBatchImageSource = async (
  body: GeneratePostBody,
  { workspaceId, userId, role }: StartGenerationContext,
  brandVoice: unknown
): Promise<ImageSourcePayload> => {
  if (body.withText) {
    return {
      title: null,
      contentText: body.topic,
      instructions: body.instructions ?? null,
      brandVoice,
    };
  }

  if (body.postId) {
    const post = await aiRepository.getPostForGeneration(body.postId, workspaceId);
    if (!post) {
      throw new NotFoundError('Bài viết không tồn tại');
    }
    assertCanEdit(post, userId, role);

    return buildImageSource(
      { kind: 'existing', postId: post.id, prompt: body.instructions },
      post,
      brandVoice
    );
  }

  return buildImageSource(
    {
      kind: 'new',
      title: body.title as string,
      content: body.content as Prisma.InputJsonValue,
      prompt: body.instructions,
    },
    null,
    brandVoice
  );
};

const EMPTY_DOC = { type: 'doc', content: [] } satisfies Prisma.InputJsonValue;

export interface PostBatchParams {
  body: GeneratePostBody;
  context: StartGenerationContext;
  brandVoice: unknown;
  platforms: SocialPlatform[];
  imageSource: ImageSourcePayload | null;
  imagePrompts: string[];
}

export interface PostBatchItem {
  generationId: string;
  type: AiGenType;
}

/** Tạo (trong một giao dịch) bài nháp nếu cần, 1 generation chữ và N generation ảnh. */
export const createPostBatch = async (tx: Prisma.TransactionClient, params: PostBatchParams) => {
  const { body, context, imageSource, imagePrompts } = params;
  let postId = body.postId ?? null;
  let createdDraftId: string | null = null;

  if (postId) {
    await assertPostEditable(tx, postId, context);
  } else if (imagePrompts.length > 0) {
    const draft = await aiRepository.createDraftPost(tx, {
      workspaceId: context.workspaceId,
      title: (body.withText ? body.topic : body.title) as string,
      content: body.withText ? EMPTY_DOC : (body.content as Prisma.InputJsonValue),
      createdById: context.userId,
    });
    postId = draft.id;
    createdDraftId = draft.id;
  }

  const items: PostBatchItem[] = [];
  let creditCost = 0;
  let remainingCredit = 0;
  const track = (
    generation: { id: string; creditCost: number },
    type: AiGenType,
    balanceAfter: number
  ) => {
    items.push({ generationId: generation.id, type });
    creditCost += generation.creditCost;
    remainingCredit = balanceAfter;
  };

  if (body.withText) {
    const { generation, credit } = await createTextGeneration(
      tx,
      {
        topic: body.topic as string,
        instructions: body.instructions,
        postId: postId ?? undefined,
        channelIds: body.channelIds,
      },
      context,
      params.brandVoice,
      params.platforms
    );
    track(generation, 'TEXT', credit.balanceAfter);
  }

  for (const imagePrompt of imagePrompts) {
    const { generation, credit } = await createPendingGeneration(tx, {
      workspaceId: context.workspaceId,
      userId: context.userId,
      postId,
      type: 'IMAGE',
      provider: AI_IMAGE_PROVIDER,
      model: getImageModel(),
      prompt: serializeImageSource({ ...(imageSource as ImageSourcePayload), imagePrompt }),
      creditCost: AI_IMAGE_COST,
    });
    track(generation, 'IMAGE', credit.balanceAfter);
  }

  return { postId, createdDraftId, items, creditCost, remainingCredit };
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
