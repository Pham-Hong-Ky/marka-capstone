import { getErrorMessage } from '../../utils/errorMessage.js';
import type { AiGenType, WorkspaceRole } from '@prisma/client';
import logger from '../../utils/logger.js';
import { withTransaction } from '../../utils/transaction.js';
import { NotFoundError, ServiceUnavailableError } from '../../utils/errors/index.js';
import { enqueue } from '../../workers/queue-manager.js';
import { QUEUE_NAMES } from '../../workers/types.js';
import creditService from '../credit/credit.service.js';
import postRepository from '../post/post.repository.js';
import { isImageAiConfigured, isTextAiConfigured } from './ai.config.js';
import { AiGenerationFinalizedError } from './ai.errors.js';
import {
  assertPostAcceptsImages,
  createImageGeneration,
  createTextGeneration,
  getBrandVoice,
  normalizeImageRequest,
  parseGenerationResponse,
  toStartResult,
} from './ai.generation.js';
import aiRepository from './ai.repository.js';
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

const buildRefundReason = (type: AiGenType) =>
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
    const message = getErrorMessage(error);
    logger.error(`Không enqueue được job AI ${generationId}: ${message}`);

    try {
      await failGeneration(generationId, 'Không thể đưa yêu cầu vào hàng đợi xử lý');
    } catch (refundError) {
      const refundMessage =
        getErrorMessage(refundError);
      logger.error(`Không hoàn được credit cho generation ${generationId}: ${refundMessage}`);
    }

    throw new ServiceUnavailableError(failureMessage);
  }
};

const removeDraftQuietly = async (postId: string) => {
  await postRepository.softDeletePost(postId).catch((error: unknown) => {
    const message = getErrorMessage(error);
    logger.error(`Không xoá được bài nháp ${postId}: ${message}`);
  });
};

const enqueueImageGeneration = async (generationId: string, createdDraftId: string | null) => {
  try {
    await enqueueOrRefund(
      generationId,
      'ai:image',
      'Không thể đưa yêu cầu tạo ảnh vào hàng đợi. Vui lòng thử lại.'
    );
  } catch (error) {
    // Người dùng vẫn ở trang tạo bài mới → bỏ bài nháp tự tạo để thử lại không sinh bài trùng.
    if (createdDraftId) {
      await removeDraftQuietly(createdDraftId);
    }
    throw error;
  }
};

// --- Bắt đầu tạo nội dung/ảnh (luồng HTTP) ---

export const startTextGeneration = async ({
  workspaceId,
  userId,
  role,
  body,
}: StartTextGenerationParams) => {
  if (!isTextAiConfigured()) {
    throw new ServiceUnavailableError('Dịch vụ AI tạo nội dung chưa được cấu hình');
  }

  const brandVoice = await getBrandVoice(workspaceId);
  const context = { workspaceId, userId, role };

  const { generation, credit } = await withTransaction((tx) =>
    createTextGeneration(tx, body, context, brandVoice)
  );

  await enqueueOrRefund(
    generation.id,
    'ai:text',
    'Không thể đưa yêu cầu tạo nội dung vào hàng đợi. Vui lòng thử lại.'
  );

  return toStartResult(generation, credit.balanceAfter);
};

export const startImageGeneration = async ({
  workspaceId,
  userId,
  role,
  body,
}: StartImageGenerationParams) => {
  if (!isImageAiConfigured() || !isTextAiConfigured()) {
    throw new ServiceUnavailableError('Dịch vụ AI tạo ảnh chưa được cấu hình');
  }

  const request = normalizeImageRequest(body);
  const brandVoice = await getBrandVoice(workspaceId);
  const context = { workspaceId, userId, role };

  const { generation, credit, createdDraftId } = await withTransaction((tx) =>
    createImageGeneration(tx, request, context, brandVoice)
  );

  await enqueueImageGeneration(generation.id, createdDraftId);

  return toStartResult(generation, credit.balanceAfter);
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

  return {
    id: generation.id,
    type: generation.type,
    status: generation.status,
    provider: generation.provider,
    model: generation.model,
    postId: generation.postId,
    creditCost: generation.creditCost,
    result: parseGenerationResponse(generation),
    errorMessage: generation.errorMessage,
    createdAt: generation.createdAt,
    updatedAt: generation.updatedAt,
  };
};

// --- Worker cập nhật trạng thái generation ---

export const markProcessing = async (generationId: string) =>
  aiRepository.takeGenerationForProcessing(generationId);

export const completeTextGeneration = async (generationId: string, response: unknown) =>
  aiRepository.completeGeneration(generationId, response);

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
      const generation = await aiRepository.findGenerationStatus(tx, generationId);

      if (!generation || generation.status === 'SUCCESS' || generation.status === 'FAILED') {
        return null;
      }

      const post = assertPostAcceptsImages(
        await aiRepository.getPostForGenerationInTransaction(tx, postId, workspaceId)
      );

      const media = await aiRepository.createMediaAsset(tx, {
        workspaceId,
        postId: post.id,
        url,
        mimeType,
        size,
        createdById: userId,
      });

      const completed = await aiRepository.completeGenerationInTransaction(tx, generationId, {
        media: {
          id: media.id,
          url: media.url,
          mimeType: media.mimeType,
          size: media.size,
        },
      });

      if (!completed) {
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
    const { failed, generation } = await aiRepository.failActiveGeneration(
      tx,
      generationId,
      errorMessage
    );

    if (!failed || !generation) {
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
  assertPostAcceptsImages,
};
