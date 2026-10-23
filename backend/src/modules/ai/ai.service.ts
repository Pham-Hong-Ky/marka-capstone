import type { Prisma, WorkspaceRole } from '@prisma/client';
import logger from '../../utils/logger.js';
import { withTransaction } from '../../utils/transaction.js';
import { NotFoundError, ServiceUnavailableError } from '../../utils/errors/index.js';
import { enqueue } from '../../workers/queue-manager.js';
import { QUEUE_NAMES } from '../../workers/types.js';
import brandVoiceRepository from '../brandvoice/brandvoice.repository.js';
import creditService from '../credit/credit.service.js';
import postRepository from '../post/post.repository.js';
import { assertCanModify, assertEditable } from '../post/post.service.js';
import { getGeminiModel, getImageModel, isImageAiConfigured, isTextAiConfigured } from './ai.config.js';
import { AI_IMAGE_COST, AI_IMAGE_PROVIDER, AI_TEXT_COST, AI_TEXT_PROVIDER } from './ai.constants.js';
import {
  AiGenerationFinalizedError,
  AiPostNotEditableError,
} from './ai.errors.js';
import aiRepository from './ai.repository.js';
import { buildImagePrompt, buildTextPrompt, contentToPlainText } from './ai.prompt.js';
import type { GenerateImageBody, GenerateTextBody } from './ai.validation.js';

interface StartGenerationContext {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

interface StartTextGenerationParams extends StartGenerationContext {
  body: GenerateTextBody;
}

interface StartImageGenerationParams extends StartGenerationContext {
  body: GenerateImageBody;
}

const getBrandVoice = async (workspaceId: string) => {
  const workspace = await brandVoiceRepository.getBrandVoiceByWorkspaceId(workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace không tồn tại');
  }
  return workspace.brandVoice;
};

const buildRefundReason = (type: 'TEXT' | 'IMAGE' | 'VIRAL_SCORE' | 'REGENERATE') =>
  type === 'IMAGE'
    ? 'Hoàn credit do tạo ảnh AI thất bại'
    : 'Hoàn credit do tạo nội dung AI thất bại';

const enqueueOrRefund = async (
  generationId: string,
  jobName: 'ai:text' | 'ai:image',
  failureMessage: string
) => {
  try {
    await enqueue(QUEUE_NAMES.contentGeneration, jobName, { generationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Không enqueue được job AI ${generationId}: ${message}`);
    try {
      await failGeneration(generationId, 'Không thể đưa yêu cầu vào hàng đợi xử lý');
    } catch (refundError) {
      const refundMessage =
        refundError instanceof Error ? refundError.message : String(refundError);
      logger.error(`Không hoàn được credit cho generation ${generationId}: ${refundMessage}`);
    }
    throw new ServiceUnavailableError(failureMessage);
  }
};

export const startTextGeneration = async ({
  workspaceId,
  userId,
  role,
  body,
}: StartTextGenerationParams) => {
  if (!isTextAiConfigured()) {
    throw new ServiceUnavailableError('Dịch vụ AI tạo nội dung chưa được cấu hình');
  }

  if (body.postId) {
    const post = await postRepository.getPostById(body.postId, workspaceId);
    if (!post) {
      throw new NotFoundError('Bài viết không tồn tại');
    }
    assertCanModify(post, userId, role);
    assertEditable(post);
  }

  const brandVoice = await getBrandVoice(workspaceId);
  const { systemInstruction, userPrompt } = buildTextPrompt({
    topic: body.topic,
    instructions: body.instructions,
    brandVoice,
  });
  const prompt = JSON.stringify({ systemInstruction, userPrompt });
  const model = getGeminiModel();

  const { generation, credit } = await withTransaction(async (tx) => {
    const credit = await creditService.reserve(tx, {
      workspaceId,
      userId,
      cost: AI_TEXT_COST,
      action: 'GEN_TEXT',
      reason: 'Tạo nội dung bằng AI',
    });

    const generation = await aiRepository.createGeneration(tx, {
      workspaceId,
      userId,
      postId: body.postId ?? null,
      type: 'TEXT',
      provider: AI_TEXT_PROVIDER,
      model,
      prompt,
      creditCost: AI_TEXT_COST,
    });

    return { generation, credit };
  });

  await enqueueOrRefund(
    generation.id,
    'ai:text',
    'Không thể đưa yêu cầu tạo nội dung vào hàng đợi. Vui lòng thử lại.'
  );

  return {
    generationId: generation.id,
    status: 'PENDING' as const,
    postId: generation.postId,
    creditCost: generation.creditCost,
    remainingCredit: credit.balanceAfter,
  };
};

export const startImageGeneration = async ({
  workspaceId,
  userId,
  role,
  body,
}: StartImageGenerationParams) => {
  if (!isImageAiConfigured()) {
    throw new ServiceUnavailableError('Dịch vụ AI tạo ảnh chưa được cấu hình');
  }

  const existingPost =
    'postId' in body ? await postRepository.getPostById(body.postId, workspaceId) : null;

  if ('postId' in body) {
    if (!existingPost) {
      throw new NotFoundError('Bài viết không tồn tại');
    }
    assertCanModify(existingPost, userId, role);
    assertEditable(existingPost);
  }

  const brandVoice = await getBrandVoice(workspaceId);
  const title = existingPost?.title ?? ('title' in body ? body.title : undefined);
  const contentText = contentToPlainText(
    existingPost?.content ?? ('content' in body ? body.content : undefined)
  );
  const imagePrompt = buildImagePrompt({
    title,
    contentText,
    instructions: body.prompt,
    brandVoice,
  });
  const model = getImageModel();

  const { generation, credit, createdDraftId } = await withTransaction(async (tx) => {
    const credit = await creditService.reserve(tx, {
      workspaceId,
      userId,
      cost: AI_IMAGE_COST,
      action: 'GEN_IMAGE',
      reason: 'Tạo ảnh bằng AI',
    });

    let targetPostId = existingPost?.id ?? null;
    let createdDraftId: string | null = null;
    if (!targetPostId && 'title' in body) {
      const post = await aiRepository.createDraftPost(tx, {
        workspaceId,
        title: body.title,
        content: body.content as Prisma.InputJsonValue,
        createdById: userId,
      });
      targetPostId = post.id;
      createdDraftId = post.id;
    }

    if (!targetPostId) {
      throw new AiPostNotEditableError('Không xác định được bài viết để tạo ảnh');
    }

    const generation = await aiRepository.createGeneration(tx, {
      workspaceId,
      userId,
      postId: targetPostId,
      type: 'IMAGE',
      provider: AI_IMAGE_PROVIDER,
      model,
      prompt: JSON.stringify({ imagePrompt }),
      creditCost: AI_IMAGE_COST,
    });

    return { generation, credit, createdDraftId };
  });

  try {
    await enqueueOrRefund(
      generation.id,
      'ai:image',
      'Không thể đưa yêu cầu tạo ảnh vào hàng đợi. Vui lòng thử lại.'
    );
  } catch (error) {
    // Người dùng vẫn ở trang tạo bài mới → bỏ bài nháp tự tạo để thử lại không sinh bài trùng.
    if (createdDraftId) {
      await postRepository.softDeletePost(createdDraftId).catch((cleanupError: unknown) => {
        const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        logger.error(`Không xoá được bài nháp ${createdDraftId}: ${message}`);
      });
    }
    throw error;
  }

  return {
    generationId: generation.id,
    status: 'PENDING' as const,
    postId: generation.postId,
    creditCost: generation.creditCost,
    remainingCredit: credit.balanceAfter,
  };
};

export const getGeneration = async ({
  workspaceId,
  generationId,
}: {
  workspaceId: string;
  generationId: string;
}) => {
  const generation = await aiRepository.findGenerationByIdAndWorkspace(generationId, workspaceId);
  if (!generation) {
    throw new NotFoundError('Không tìm thấy tiến trình tạo nội dung AI');
  }

  let result: unknown = null;
  if (generation.status === 'SUCCESS' && generation.response) {
    try {
      result = JSON.parse(generation.response) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Response AI không phải JSON hợp lệ (${generationId}): ${message}`);
    }
  }

  return {
    id: generation.id,
    type: generation.type,
    status: generation.status,
    provider: generation.provider,
    model: generation.model,
    postId: generation.postId,
    creditCost: generation.creditCost,
    result,
    errorMessage: generation.errorMessage,
    createdAt: generation.createdAt,
    updatedAt: generation.updatedAt,
  };
};

export const markProcessing = async (generationId: string) => {
  const updated = await aiRepository.markProcessing(generationId);
  if (!updated) return null;
  return aiRepository.findGenerationById(generationId);
};

export const completeTextGeneration = async (generationId: string, response: unknown) =>
  aiRepository.completeTextGeneration(generationId, response);

export const completeImageGeneration = async ({
  generationId,
  workspaceId,
  postId,
  userId,
  url,
  size,
  mimeType,
}: {
  generationId: string;
  workspaceId: string;
  postId: string;
  userId: string | null;
  url: string;
  size: number;
  mimeType: string;
}) => {
  try {
    return await withTransaction(async (tx) => {
      const generation = await tx.aiGeneration.findUnique({
        where: { id: generationId },
        select: { status: true },
      });

      if (!generation || generation.status === 'SUCCESS' || generation.status === 'FAILED') {
        return null;
      }

      const post = await tx.post.findFirst({
        where: { id: postId, workspaceId, deletedAt: null },
        select: { id: true, status: true },
      });

      if (!post) {
        throw new AiPostNotEditableError('Bài viết không tồn tại hoặc đã bị xoá');
      }

      if (post.status !== 'DRAFT' && post.status !== 'REJECTED') {
        throw new AiPostNotEditableError('Bài viết đã được gửi duyệt nên không thể thêm ảnh');
      }

      const media = await aiRepository.createMediaAsset(tx, {
        workspaceId,
        postId,
        url,
        mimeType,
        size,
        createdById: userId,
      });

      const { count } = await tx.aiGeneration.updateMany({
        where: { id: generationId, status: { in: ['PENDING', 'PROCESSING'] } },
        data: {
          status: 'SUCCESS',
          response: JSON.stringify({
            media: {
              id: media.id,
              url: media.url,
              mimeType: media.mimeType,
              size: media.size,
            },
          }),
          errorMessage: null,
        },
      });

      if (count === 0) {
        throw new AiGenerationFinalizedError();
      }

      return media;
    });
  } catch (error) {
    if (error instanceof AiGenerationFinalizedError) {
      return null;
    }
    throw error;
  }
};

export const failGeneration = async (generationId: string, message: string) => {
  const errorMessage = message.trim().slice(0, 500) || 'Tạo nội dung AI thất bại';

  return withTransaction(async (tx) => {
    const { count, generation } = await aiRepository.failActiveGeneration(
      tx,
      generationId,
      errorMessage
    );

    if (count === 0 || !generation) {
      return false;
    }

    if (generation.creditCost > 0) {
      await creditService.refund(tx, {
        workspaceId: generation.workspaceId,
        userId: generation.userId,
        cost: generation.creditCost,
        reason: buildRefundReason(generation.type),
      });
    }

    return true;
  });
};

export default {
  startTextGeneration,
  startImageGeneration,
  getGeneration,
  markProcessing,
  completeTextGeneration,
  completeImageGeneration,
  failGeneration,
};
