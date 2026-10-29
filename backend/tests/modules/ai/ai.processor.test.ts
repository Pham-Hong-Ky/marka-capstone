import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnrecoverableError } from 'bullmq';
import prisma from '../../../src/config/db.js';
import { enqueue } from '../../../src/workers/queue-manager.js';
import { cloudinaryClient } from '../../../src/utils/cloudinary.client.js';
import { cloudflareImageClient, geminiClient } from '../../../src/modules/ai/ai.providers.js';
import aiService from '../../../src/modules/ai/ai.service.js';
import { buildAiFailureMessage, executeAiGeneration } from '../../../src/modules/ai/ai.processor.js';

vi.mock('../../../src/modules/ai/ai.config.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/modules/ai/ai.config.js')>();
  return {
    ...actual,
    isTextAiConfigured: () => true,
    isImageAiConfigured: () => true,
    getGeminiModel: () => 'gemini-test',
    getImageModel: () => 'image-test',
  };
});

vi.mock('../../../src/workers/queue-manager.js', () => ({
  enqueue: vi.fn(),
}));

vi.mock('../../../src/modules/ai/ai.providers.js', () => ({
  geminiClient: { generateJson: vi.fn() },
  cloudflareImageClient: { generateImage: vi.fn() },
}));

vi.mock('../../../src/utils/cloudinary.client.js', () => ({
  cloudinaryClient: { uploadImageBuffer: vi.fn() },
}));

const enqueueMock = vi.mocked(enqueue);
const geminiMock = vi.mocked(geminiClient.generateJson);
const imageMock = vi.mocked(cloudflareImageClient.generateImage);
const cloudinaryMock = vi.mocked(cloudinaryClient.uploadImageBuffer);

const stamp = Date.now();
const content = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Nội dung bài viết hiện tại' }] },
  ],
};

const isUnrecoverable = (error: unknown) =>
  error instanceof Error && error.name === 'UnrecoverableError';

describe('AI processor', () => {
  let userId = '';
  let workspaceId = '';

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `test_ai_processor_${stamp}@marka.vn`, name: 'AI Processor Test' },
    });
    userId = user.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: `AI Processor Workspace ${stamp}`,
        remainingCredit: 100,
        monthlyQuota: 100,
        brandVoice: {
          industry: 'Thời trang',
          targetAudience: 'Nữ 22-30',
          writingStyle: 'Thân thiện',
        },
        members: { create: { userId, role: 'OWNER' } },
      },
    });
    workspaceId = workspace.id;
  });

  beforeEach(async () => {
    enqueueMock.mockReset();
    enqueueMock.mockResolvedValue({ id: 'job-1', name: 'ai:text', queue: 'content-generation-queue' });
    geminiMock.mockReset();
    imageMock.mockReset();
    cloudinaryMock.mockReset();

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { remainingCredit: 100 },
    });
    await prisma.mediaAsset.deleteMany({ where: { workspaceId } });
    await prisma.aiGeneration.deleteMany({ where: { workspaceId } });
    await prisma.creditTransaction.deleteMany({ where: { workspaceId } });
    await prisma.post.deleteMany({ where: { workspaceId } });
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('sinh text thành công thì lưu Tiptap JSON và giữ credit đã trừ', async () => {
    const started = await aiService.startTextGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { topic: 'Ra mắt bộ sưu tập mùa thu' },
    });

    geminiMock.mockResolvedValue({
      title: 'Bộ sưu tập mùa thu',
      blocks: [
        { type: 'heading', text: 'Điểm nổi bật' },
        { type: 'paragraph', text: 'Chất liệu nhẹ, dễ phối.' },
        { type: 'bulletList', items: ['Thanh lịch', 'Dễ mặc'] },
      ],
    });

    await executeAiGeneration(started.generationId, 0);

    const generation = await prisma.aiGeneration.findUniqueOrThrow({
      where: { id: started.generationId },
    });
    expect(generation.status).toBe('SUCCESS');
    expect(generation.errorMessage).toBeNull();

    const response = JSON.parse(generation.response ?? '{}');
    expect(response.title).toBe('Bộ sưu tập mùa thu');
    expect(response.content.type).toBe('doc');
    expect(response.content.content[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(workspace.remainingCredit).toBe(90);
  });

  it('sinh ảnh thành công thì upload Cloudinary, tạo MediaAsset AI_GENERATED và lưu response', async () => {
    const started = await aiService.startImageGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { title: 'Bài có ảnh AI', content, prompt: 'Ảnh tối giản' },
    });

    const bytes = Buffer.from('fake-jpeg');
    geminiMock.mockResolvedValue({
      prompt: 'minimalist autumn fashion flat lay, soft natural light, warm tones',
    });
    imageMock.mockResolvedValue(bytes);
    cloudinaryMock.mockResolvedValue('https://res.cloudinary.com/demo/image/upload/ai.jpg');

    await executeAiGeneration(started.generationId, 0);

    expect(geminiMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-test', responseSchema: expect.any(Object) })
    );
    expect(imageMock).toHaveBeenCalledWith({
      model: 'image-test',
      prompt: expect.stringContaining('minimalist autumn fashion flat lay'),
    });
    expect(imageMock.mock.calls[0]?.[0].prompt).toContain('No text');

    const media = await prisma.mediaAsset.findFirstOrThrow({
      where: { workspaceId, postId: started.postId as string },
    });
    expect(media).toMatchObject({
      source: 'AI_GENERATED',
      type: 'IMAGE',
      mimeType: 'image/jpeg',
      size: bytes.length,
      url: 'https://res.cloudinary.com/demo/image/upload/ai.jpg',
    });

    const generation = await prisma.aiGeneration.findUniqueOrThrow({
      where: { id: started.generationId },
    });
    expect(generation.status).toBe('SUCCESS');
    expect(JSON.parse(generation.response ?? '{}')).toMatchObject({
      media: { id: media.id, url: media.url },
    });

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(workspace.remainingCredit).toBe(80);
  });

  it('text output sai schema thì retry lần đầu, lần hai là UnrecoverableError', async () => {
    const started = await aiService.startTextGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { topic: 'Chủ đề kiểm tra output sai' },
    });

    geminiMock.mockResolvedValue({ unexpected: true });

    await expect(executeAiGeneration(started.generationId, 0)).rejects.toSatisfy(
      (error) => !isUnrecoverable(error)
    );
    await expect(executeAiGeneration(started.generationId, 1)).rejects.toSatisfy(isUnrecoverable);
  });

  it('bài đã rời DRAFT/REJECTED thì ảnh fail, không tạo media và hoàn credit', async () => {
    const started = await aiService.startImageGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { title: 'Bài đã gửi duyệt', content },
    });

    await prisma.post.update({
      where: { id: started.postId as string },
      data: { status: 'PENDING' },
    });

    await expect(executeAiGeneration(started.generationId, 0)).rejects.toSatisfy(isUnrecoverable);
    expect(await prisma.mediaAsset.count({ where: { workspaceId } })).toBe(0);

    await aiService.failGeneration(started.generationId, 'Bài viết đã được gửi duyệt');

    const generation = await prisma.aiGeneration.findUniqueOrThrow({
      where: { id: started.generationId },
    });
    expect(generation).toMatchObject({ status: 'FAILED', creditCost: 0 });

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(workspace.remainingCredit).toBe(100);
  });

  it('bài đã bị xoá thì không gọi AI tạo ảnh', async () => {
    const started = await aiService.startImageGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { title: 'Bài bị xoá', content },
    });

    await prisma.post.update({
      where: { id: started.postId as string },
      data: { deletedAt: new Date() },
    });

    await expect(executeAiGeneration(started.generationId, 0)).rejects.toSatisfy(isUnrecoverable);
    expect(imageMock).not.toHaveBeenCalled();
    expect(cloudinaryMock).not.toHaveBeenCalled();
  });

  it('chạy lại generation đã SUCCESS không tạo media trùng', async () => {
    const started = await aiService.startImageGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { title: 'Bài ảnh chạy lại', content },
    });

    imageMock.mockResolvedValue(Buffer.from('fake-jpeg'));
    geminiMock.mockResolvedValue({ prompt: 'a clean studio product shot, soft lighting' });
    cloudinaryMock.mockResolvedValue('https://res.cloudinary.com/demo/image/upload/ai-1.jpg');

    await executeAiGeneration(started.generationId, 0);
    await executeAiGeneration(started.generationId, 0);

    expect(await prisma.mediaAsset.count({ where: { workspaceId } })).toBe(1);
    expect(imageMock).toHaveBeenCalledTimes(1);
  });

  it('prompt ảnh do AI trả về sai schema thì retry, không gọi tạo ảnh', async () => {
    const started = await aiService.startImageGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { title: 'Bài prompt lỗi', content },
    });

    geminiMock.mockResolvedValue({ unexpected: true });

    await expect(executeAiGeneration(started.generationId, 0)).rejects.toSatisfy(
      (error) => !isUnrecoverable(error)
    );
    await expect(executeAiGeneration(started.generationId, 1)).rejects.toSatisfy(isUnrecoverable);
    expect(imageMock).not.toHaveBeenCalled();
  });

  it('generation ảnh cũ chỉ có imagePrompt vẫn tạo ảnh không cần gọi lại AI', async () => {
    const started = await aiService.startImageGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { title: 'Bài generation cũ', content },
    });

    await prisma.aiGeneration.update({
      where: { id: started.generationId },
      data: { prompt: JSON.stringify({ imagePrompt: 'legacy english prompt' }) },
    });
    imageMock.mockResolvedValue(Buffer.from('fake-jpeg'));
    cloudinaryMock.mockResolvedValue('https://res.cloudinary.com/demo/image/upload/ai-legacy.jpg');

    await executeAiGeneration(started.generationId, 0);

    expect(geminiMock).not.toHaveBeenCalled();
    expect(imageMock).toHaveBeenCalledWith({
      model: 'image-test',
      prompt: 'legacy english prompt',
    });
  });

  it('failGeneration idempotent: chỉ hoàn credit một lần', async () => {
    const started = await aiService.startTextGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { topic: 'Chủ đề hoàn credit một lần' },
    });

    const first = await aiService.failGeneration(started.generationId, 'Lỗi thử nghiệm');
    const second = await aiService.failGeneration(started.generationId, 'Lỗi thử nghiệm');

    expect(first).toBe(true);
    expect(second).toBe(false);

    const refunds = await prisma.creditTransaction.count({
      where: { workspaceId, action: 'REFUND' },
    });
    expect(refunds).toBe(1);

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(workspace.remainingCredit).toBe(100);
  });

  it('buildAiFailureMessage giữ thông báo nghiệp vụ của UnrecoverableError', () => {
    const message = buildAiFailureMessage(
      'IMAGE',
      new UnrecoverableError('Bài viết đã được gửi duyệt nên không thể thêm ảnh')
    );

    expect(message).toBe(
      'Bài viết đã được gửi duyệt nên không thể thêm ảnh. Credit đã được hoàn.'
    );
  });
});
