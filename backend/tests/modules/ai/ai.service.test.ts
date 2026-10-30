import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma, { basePrisma } from '../../../src/config/db.js';
import { enqueue } from '../../../src/workers/queue-manager.js';
import { QUEUE_NAMES } from '../../../src/workers/types.js';
import {
  ConflictError,
  NotFoundError,
  PaymentRequiredError,
  ServiceUnavailableError,
} from '../../../src/utils/errors/index.js';
import * as aiConfig from '../../../src/modules/ai/ai.config.js';
import aiService from '../../../src/modules/ai/ai.service.js';

vi.mock('../../../src/modules/ai/ai.config.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/modules/ai/ai.config.js')>();
  return {
    ...actual,
    isTextAiConfigured: vi.fn(() => true),
    isImageAiConfigured: vi.fn(() => true),
    getGeminiModel: () => 'gemini-test',
    getImageModel: () => 'image-test',
  };
});

vi.mock('../../../src/workers/queue-manager.js', () => ({
  enqueue: vi.fn(),
}));

const enqueueMock = vi.mocked(enqueue);

const stamp = Date.now();
const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nội dung hiện tại' }] }],
};

describe('AI service', () => {
  let userId = '';
  let workspaceId = '';
  let otherWorkspaceId = '';
  let postId = '';

  const createWorkspace = async (name: string, remainingCredit = 100) =>
    prisma.workspace.create({
      data: {
        name,
        remainingCredit,
        monthlyQuota: 100,
        brandVoice: {
          industry: 'Thời trang',
          targetAudience: 'Nữ 22-30',
          writingStyle: 'Thân thiện',
        },
        members: { create: { userId, role: 'OWNER' } },
      },
    });

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `test_ai_service_${stamp}@marka.vn`, name: 'AI Service Test' },
    });
    userId = user.id;

    const workspace = await createWorkspace(`AI Workspace ${stamp}`);
    workspaceId = workspace.id;

    const other = await createWorkspace(`AI Other ${stamp}`);
    otherWorkspaceId = other.id;

    const post = await prisma.post.create({
      data: {
        workspaceId,
        title: 'Bài hiện tại',
        content,
        status: 'DRAFT',
        createdById: userId,
      },
    });
    postId = post.id;
  });

  beforeEach(async () => {
    enqueueMock.mockReset();
    enqueueMock.mockResolvedValue({ id: 'job-1', name: 'ai:text', queue: 'content-generation-queue' });
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { remainingCredit: 100 },
    });
    await prisma.aiGeneration.deleteMany({ where: { workspaceId } });
    await prisma.creditTransaction.deleteMany({ where: { workspaceId } });
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: [workspaceId, otherWorkspaceId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('tạo text generation PENDING, trừ 10 credit và enqueue job', async () => {
    const result = await aiService.startTextGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { topic: 'Ra mắt bộ sưu tập mùa thu', instructions: 'Nhấn mạnh chất liệu' },
    });

    expect(result).toMatchObject({
      status: 'PENDING',
      creditCost: 10,
      remainingCredit: 90,
      postId: null,
    });

    const generation = await prisma.aiGeneration.findUniqueOrThrow({
      where: { id: result.generationId },
    });
    expect(generation).toMatchObject({
      type: 'TEXT',
      provider: 'gemini',
      model: 'gemini-test',
      status: 'PENDING',
      creditCost: 10,
      postId: null,
    });
    expect(generation.prompt).toContain('Ra mắt bộ sưu tập mùa thu');

    expect(enqueueMock).toHaveBeenCalledWith(QUEUE_NAMES.contentGeneration, 'ai:text', {
      generationId: result.generationId,
    });
  });

  it('không đủ credit thì trả 402, không tạo generation', async () => {
    await prisma.workspace.update({ where: { id: workspaceId }, data: { remainingCredit: 5 } });

    await expect(
      aiService.startTextGeneration({
        workspaceId,
        userId,
        role: 'OWNER',
        body: { topic: 'Chủ đề hợp lệ cho bài viết' },
      })
    ).rejects.toBeInstanceOf(PaymentRequiredError);

    expect(await prisma.aiGeneration.count({ where: { workspaceId } })).toBe(0);
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(workspace.remainingCredit).toBe(5);
  });

  it('tạo ảnh cần Gemini để viết prompt, thiếu cấu hình thì trả 503 và không trừ credit', async () => {
    const textConfigured = vi.mocked(aiConfig.isTextAiConfigured).mockReturnValue(false);

    try {
      await expect(
        aiService.startImageGeneration({
          workspaceId,
          userId,
          role: 'OWNER',
          body: { title: 'Bài thiếu cấu hình Gemini', content },
        })
      ).rejects.toBeInstanceOf(ServiceUnavailableError);
    } finally {
      textConfigured.mockReturnValue(true);
    }

    expect(await prisma.aiGeneration.count({ where: { workspaceId } })).toBe(0);
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(workspace.remainingCredit).toBe(100);
  });

  it('ảnh cho bài mới tạo Post nháp + generation trong cùng transaction', async () => {
    const result = await aiService.startImageGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { title: 'Bài mới từ AI', content, prompt: 'Ảnh tối giản' },
    });

    expect(result).toMatchObject({ status: 'PENDING', creditCost: 20, remainingCredit: 80 });
    expect(result.postId).toBeTruthy();

    const post = await prisma.post.findUniqueOrThrow({ where: { id: result.postId as string } });
    expect(post).toMatchObject({
      workspaceId,
      title: 'Bài mới từ AI',
      status: 'DRAFT',
      createdById: userId,
    });

    const generation = await prisma.aiGeneration.findUniqueOrThrow({
      where: { id: result.generationId },
    });
    expect(generation).toMatchObject({ type: 'IMAGE', postId: post.id, creditCost: 20 });

    expect(enqueueMock).toHaveBeenCalledWith(QUEUE_NAMES.contentGeneration, 'ai:image', {
      generationId: result.generationId,
    });
  });

  it('ảnh cho bài mới không đủ credit thì rollback, không tạo Post mồ côi', async () => {
    await prisma.workspace.update({ where: { id: workspaceId }, data: { remainingCredit: 5 } });
    const before = await prisma.post.count({ where: { workspaceId } });

    await expect(
      aiService.startImageGeneration({
        workspaceId,
        userId,
        role: 'OWNER',
        body: { title: 'Bài mồ côi', content },
      })
    ).rejects.toBeInstanceOf(PaymentRequiredError);

    expect(await prisma.post.count({ where: { workspaceId } })).toBe(before);
    expect(await prisma.aiGeneration.count({ where: { workspaceId } })).toBe(0);
  });

  it('ảnh cho post của workspace khác trả 404 và không trừ credit', async () => {
    await expect(
      aiService.startImageGeneration({
        workspaceId: otherWorkspaceId,
        userId,
        role: 'OWNER',
        body: { postId, prompt: 'Ảnh' },
      })
    ).rejects.toBeInstanceOf(NotFoundError);

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: otherWorkspaceId } });
    expect(workspace.remainingCredit).toBe(100);
  });

  it('ảnh cho post đã rời DRAFT/REJECTED bị chặn trước khi giữ credit', async () => {
    await prisma.post.update({ where: { id: postId }, data: { status: 'PENDING' } });

    try {
      await expect(
        aiService.startImageGeneration({
          workspaceId,
          userId,
          role: 'OWNER',
          body: { postId, prompt: 'Ảnh' },
        })
      ).rejects.toBeInstanceOf(ConflictError);

      expect(await prisma.aiGeneration.count({ where: { workspaceId } })).toBe(0);
      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      expect(workspace.remainingCredit).toBe(100);
    } finally {
      await prisma.post.update({ where: { id: postId }, data: { status: 'DRAFT' } });
    }
  });

  it('text cho post đã rời DRAFT/REJECTED bị chặn trước khi giữ credit', async () => {
    await prisma.post.update({ where: { id: postId }, data: { status: 'APPROVED' } });

    try {
      await expect(
        aiService.startTextGeneration({
          workspaceId,
          userId,
          role: 'OWNER',
          body: { topic: 'Chủ đề kiểm tra trạng thái bài', postId },
        })
      ).rejects.toBeInstanceOf(ConflictError);

      expect(await prisma.aiGeneration.count({ where: { workspaceId } })).toBe(0);
      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      expect(workspace.remainingCredit).toBe(100);
    } finally {
      await prisma.post.update({ where: { id: postId }, data: { status: 'DRAFT' } });
    }
  });

  it('enqueue lỗi thì hoàn credit và đánh dấu generation FAILED', async () => {
    enqueueMock.mockRejectedValueOnce(new Error('redis down'));

    await expect(
      aiService.startTextGeneration({
        workspaceId,
        userId,
        role: 'OWNER',
        body: { topic: 'Chủ đề làm enqueue lỗi' },
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableError);

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(workspace.remainingCredit).toBe(100);

    const generation = await prisma.aiGeneration.findFirstOrThrow({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    expect(generation).toMatchObject({ status: 'FAILED', creditCost: 0 });

    const transactions = await prisma.creditTransaction.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
    expect(transactions.map((item) => item.action)).toEqual(['GEN_TEXT', 'REFUND']);
  });

  it('enqueue lỗi khi tạo ảnh cho bài mới thì xoá bài nháp vừa tạo', async () => {
    enqueueMock.mockRejectedValueOnce(new Error('redis down'));

    await expect(
      aiService.startImageGeneration({
        workspaceId,
        userId,
        role: 'OWNER',
        body: { title: 'Bài nháp enqueue lỗi', content },
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableError);

    const draft = await basePrisma.post.findFirstOrThrow({
      where: { workspaceId, title: 'Bài nháp enqueue lỗi' },
    });
    expect(draft.deletedAt).not.toBeNull();

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(workspace.remainingCredit).toBe(100);
  });

  it('GET generation chỉ trả trong đúng workspace', async () => {
    const result = await aiService.startTextGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { topic: 'Chủ đề kiểm tra tenant' },
    });

    await expect(
      aiService.getGeneration({ workspaceId: otherWorkspaceId, generationId: result.generationId })
    ).rejects.toBeInstanceOf(NotFoundError);

    const detail = await aiService.getGeneration({
      workspaceId,
      generationId: result.generationId,
    });
    expect(detail).toMatchObject({ id: result.generationId, status: 'PENDING', result: null });
  });

  it('dọn generation treo quá 30 phút: FAILED và hoàn credit, generation mới không bị đụng', async () => {
    const stale = await aiService.startTextGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { topic: 'Generation bị treo' },
    });
    const fresh = await aiService.startTextGeneration({
      workspaceId,
      userId,
      role: 'OWNER',
      body: { topic: 'Generation vừa tạo' },
    });
    await prisma.$executeRaw`UPDATE ai_generations SET "status" = 'PROCESSING', "updatedAt" = (NOW() AT TIME ZONE 'UTC') - INTERVAL '31 minutes' WHERE id = ${stale.generationId}`;

    await aiService.recoverStaleGenerations();

    const [staleRow, freshRow, workspace] = await Promise.all([
      prisma.aiGeneration.findUniqueOrThrow({ where: { id: stale.generationId } }),
      prisma.aiGeneration.findUniqueOrThrow({ where: { id: fresh.generationId } }),
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    ]);
    expect(staleRow.status).toBe('FAILED');
    expect(staleRow.errorMessage).toContain('Credit đã được hoàn');
    expect(freshRow.status).toBe('PENDING');
    expect(workspace.remainingCredit).toBe(100 - fresh.creditCost);
  });
});
