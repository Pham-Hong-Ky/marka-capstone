import { getErrorMessage } from '../../utils/errorMessage.js';
import type { AiGeneration } from '@prisma/client';
import { UnrecoverableError, type Job } from 'bullmq';
import logger from '../../utils/logger.js';
import { contentGenerationQueue } from '../../workers/queues.js';
import { cloudinaryClient } from '../../utils/cloudinary.client.js';
import { getGeminiModel } from './ai.config.js';
import {
  AiContentPolicyError,
  AiOutputError,
  AiPostNotEditableError,
  AiProviderConfigError,
  AiProviderError,
} from './ai.errors.js';
import {
  buildImageArtPrompt,
  buildImagePrompt,
  parseImageArtOutput,
  parseImageSourcePayload,
  type ImageSourcePayload,
} from './ai.image-prompt.js';
import {
  aiTextResponseSchema,
  parseTextOutput,
  parseTextPromptPayload,
  toTiptapDoc,
} from './ai.prompt.js';
import { cloudflareImageClient, geminiClient } from './ai.providers.js';
import { assertPostAcceptsImages } from './ai.generation.js';
import aiRepository from './ai.repository.js';
import aiService from './ai.service.js';

interface AiJobData {
  generationId: string;
}

const resolveImagePrompt = async (source: ImageSourcePayload) => {
  if (typeof source.imagePrompt === 'string' && source.imagePrompt.trim() !== '') {
    return source.imagePrompt.trim();
  }

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

  return buildImagePrompt(parseImageArtOutput(raw));
};

const normalizeAiError = (error: unknown, attempt: number): unknown => {
  if (error instanceof UnrecoverableError) return error;

  if (
    error instanceof AiContentPolicyError ||
    error instanceof AiProviderConfigError ||
    error instanceof AiPostNotEditableError
  ) {
    return new UnrecoverableError(error.message);
  }

  if (error instanceof AiOutputError) {
    return attempt >= 1 ? new UnrecoverableError(error.message) : error;
  }

  if (error instanceof AiProviderError && !error.retryable) {
    return new UnrecoverableError(error.message);
  }

  return error;
};

const runTextGeneration = async (generation: AiGeneration) => {
  const { systemInstruction, userPrompt } = parseTextPromptPayload(generation.prompt);

  const raw = await geminiClient.generateJson({
    model: generation.model,
    systemInstruction,
    userPrompt,
    responseSchema: aiTextResponseSchema,
  });

  const output = parseTextOutput(raw);

  await aiService.completeTextGeneration(generation.id, {
    title: output.title,
    content: toTiptapDoc(output),
  });
};

const runImageGeneration = async (generation: AiGeneration) => {
  if (!generation.postId) {
    throw new AiPostNotEditableError('Generation ảnh không gắn với bài viết nào');
  }

  const post = await aiRepository.getPostForGeneration(generation.postId, generation.workspaceId);
  assertPostAcceptsImages(post);

  const imagePrompt = await resolveImagePrompt(parseImageSourcePayload(generation.prompt));
  const buffer = await cloudflareImageClient.generateImage({
    model: generation.model,
    prompt: imagePrompt,
  });

  const url = await cloudinaryClient.uploadImageBuffer(
    buffer,
    `marka/workspaces/${generation.workspaceId}/posts/${generation.postId}/ai`
  );

  await aiService.completeImageGeneration({
    generationId: generation.id,
    workspaceId: generation.workspaceId,
    postId: generation.postId,
    userId: generation.userId,
    url,
    size: buffer.length,
    mimeType: 'image/jpeg',
  });
};

export const executeAiGeneration = async (generationId: string, attempt: number): Promise<void> => {
  const generation = await aiService.markProcessing(generationId);
  if (!generation) {
    return;
  }

  try {
    if (generation.type === 'TEXT') {
      await runTextGeneration(generation);
      return;
    }

    if (generation.type === 'IMAGE') {
      await runImageGeneration(generation);
      return;
    }

    throw new AiProviderConfigError(`Loại generation ${generation.type} chưa được hỗ trợ`);
  } catch (error) {
    throw normalizeAiError(error, attempt);
  }
};

export const AI_RECOVERY_JOB = 'ai-recover-stale';

export const registerAiRecoveryScheduler = async (): Promise<void> => {
  await contentGenerationQueue.upsertJobScheduler(
    AI_RECOVERY_JOB,
    { every: 10 * 60 * 1000 },
    {
      name: AI_RECOVERY_JOB,
      data: {},
      opts: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    }
  );
};

export const processContentJob = async (job: Job): Promise<unknown> => {
  if (job.name === AI_RECOVERY_JOB) {
    return aiService.recoverStaleGenerations();
  }

  const { generationId } = job.data as Partial<AiJobData>;

  if (!generationId) {
    throw new UnrecoverableError('Job AI thiếu generationId');
  }

  try {
    await executeAiGeneration(generationId, job.attemptsMade);
    await job.updateProgress(100);
    return { success: true };
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error(`[AI] job ${job.id} (${generationId}) lỗi: ${message}`);
    throw error;
  }
};

const REFUND_SUFFIX = ' Credit đã được hoàn.';

const withRefundSuffix = (message: string): string =>
  `${message.replace(/[.!?]+$/, '')}.${REFUND_SUFFIX}`;

export const buildAiFailureMessage = (type: string, error: unknown): string => {
  if (error instanceof AiContentPolicyError) {
    return withRefundSuffix('Nội dung bị chặn bởi chính sách AI');
  }

  if (error instanceof AiProviderConfigError) {
    return withRefundSuffix('Dịch vụ AI chưa được cấu hình đầy đủ');
  }

  if (error instanceof AiPostNotEditableError) {
    return withRefundSuffix(error.message);
  }

  if (error instanceof AiOutputError) {
    return withRefundSuffix('AI trả về nội dung không hợp lệ');
  }

  if (
    error instanceof UnrecoverableError ||
    (error instanceof Error && error.name === 'UnrecoverableError')
  ) {
    const message = error.message.trim();
    if (message) return withRefundSuffix(message);
  }

  return withRefundSuffix(type === 'IMAGE' ? 'Tạo ảnh AI thất bại' : 'Tạo nội dung AI thất bại');
};

export default {
  registerAiRecoveryScheduler,
  processContentJob,
  executeAiGeneration,
  buildAiFailureMessage,
};
