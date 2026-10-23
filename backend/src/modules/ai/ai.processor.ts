import { UnrecoverableError, type Job } from 'bullmq';
import logger from '../../utils/logger.js';
import { cloudinaryClient } from '../../utils/cloudinary.client.js';
import aiRepository from './ai.repository.js';
import aiService from './ai.service.js';
import {
  AiContentPolicyError,
  AiOutputError,
  AiPostNotEditableError,
  AiProviderConfigError,
  AiProviderError,
} from './ai.errors.js';
import { cloudflareImageClient, geminiClient } from './ai.providers.js';
import { aiTextResponseSchema, parseTextOutput, toTiptapDoc } from './ai.prompt.js';

interface AiJobData {
  generationId: string;
}

interface TextPromptPayload {
  systemInstruction: string;
  userPrompt: string;
}

interface ImagePromptPayload {
  imagePrompt: string;
}

const parseTextPrompt = (prompt: string): TextPromptPayload => {
  try {
    const parsed = JSON.parse(prompt) as Partial<TextPromptPayload>;
    if (typeof parsed.systemInstruction !== 'string' || typeof parsed.userPrompt !== 'string') {
      throw new Error('Thiếu systemInstruction hoặc userPrompt');
    }
    return { systemInstruction: parsed.systemInstruction, userPrompt: parsed.userPrompt };
  } catch {
    throw new AiProviderConfigError('Dữ liệu prompt của generation không hợp lệ');
  }
};

const parseImagePrompt = (prompt: string): string => {
  try {
    const parsed = JSON.parse(prompt) as Partial<ImagePromptPayload>;
    if (typeof parsed.imagePrompt !== 'string' || parsed.imagePrompt.trim() === '') {
      throw new Error('Thiếu imagePrompt');
    }
    return parsed.imagePrompt;
  } catch {
    throw new AiProviderConfigError('Dữ liệu prompt của generation không hợp lệ');
  }
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

const runTextGeneration = async (generation: NonNullable<Awaited<ReturnType<typeof aiService.markProcessing>>>) => {
  const { systemInstruction, userPrompt } = parseTextPrompt(generation.prompt);

  const raw = await geminiClient.generateJson({
    model: generation.model,
    systemInstruction,
    userPrompt,
    responseSchema: aiTextResponseSchema,
  });

  const output = parseTextOutput(raw);
  const content = toTiptapDoc(output);

  await aiService.completeTextGeneration(generation.id, {
    title: output.title,
    content,
  });
};

const runImageGeneration = async (
  generation: NonNullable<Awaited<ReturnType<typeof aiService.markProcessing>>>
) => {
  if (!generation.postId) {
    throw new AiPostNotEditableError('Generation ảnh không gắn với bài viết nào');
  }

  const post = await aiRepository.getPostForGeneration(generation.postId, generation.workspaceId);

  if (!post) {
    throw new AiPostNotEditableError('Bài viết không tồn tại hoặc đã bị xoá');
  }

  if (post.status !== 'DRAFT' && post.status !== 'REJECTED') {
    throw new AiPostNotEditableError('Bài viết đã được gửi duyệt nên không thể thêm ảnh');
  }

  const imagePrompt = parseImagePrompt(generation.prompt);
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

export const processContentJob = async (job: Job): Promise<{ success: boolean }> => {
  const { generationId } = job.data as Partial<AiJobData>;

  if (!generationId) {
    throw new UnrecoverableError('Job AI thiếu generationId');
  }

  try {
    await executeAiGeneration(generationId, job.attemptsMade);
    await job.updateProgress(100);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[AI] job ${job.id} (${generationId}) lỗi: ${message}`);
    throw error;
  }
};

export const buildAiFailureMessage = (type: string, error: unknown): string => {
  const suffix = ' Credit đã được hoàn.';

  if (error instanceof AiContentPolicyError) {
    return `Nội dung bị chặn bởi chính sách AI.${suffix}`;
  }

  if (error instanceof AiProviderConfigError) {
    return `Dịch vụ AI chưa được cấu hình đầy đủ.${suffix}`;
  }

  if (error instanceof AiPostNotEditableError) {
    return `${error.message}.${suffix}`;
  }

  if (error instanceof AiOutputError) {
    return `AI trả về nội dung không hợp lệ.${suffix}`;
  }

  if (error instanceof UnrecoverableError || (error instanceof Error && error.name === 'UnrecoverableError')) {
    const message = error.message.trim();
    if (message) {
      return `${message.replace(/[.!?]+$/, '')}.${suffix}`;
    }
  }

  return type === 'IMAGE'
    ? `Tạo ảnh AI thất bại.${suffix}`
    : `Tạo nội dung AI thất bại.${suffix}`;
};

export default {
  processContentJob,
  executeAiGeneration,
  buildAiFailureMessage,
};
