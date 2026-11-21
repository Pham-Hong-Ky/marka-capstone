import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { enqueue } from '../../../src/workers/queue-manager.js';
import { geminiClient } from '../../../src/modules/ai/providers/ai.providers.js';

vi.mock('../../../src/modules/ai/providers/ai.config.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/modules/ai/providers/ai.config.js')>();
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

const enqueueMock = vi.mocked(enqueue);
const password = 'password123';
const stamp = Date.now();

const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nội dung bài viết' }] }],
};

describe('AI routes', () => {
  const owner = { email: `test_ai_routes_owner_${stamp}@marka.vn`, name: 'AI Owner' };
  const outsider = { email: `test_ai_routes_out_${stamp}@marka.vn`, name: 'AI Outsider' };

  let ownerToken = '';
  let outsiderToken = '';
  let workspaceId = '';
  let outsiderWorkspaceId = '';
  let ownerId = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, outsider.email] } } });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
    ownerId = ownerRes.body.data.user.id;
    workspaceId = ownerRes.body.data.user.workspaces[0].id;

    const outsiderRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...outsider, password });
    outsiderToken = outsiderRes.body.data.accessToken;
    outsiderWorkspaceId = outsiderRes.body.data.user.workspaces[0].id;
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
    await prisma.workspace.deleteMany({ where: { id: { in: [workspaceId, outsiderWorkspaceId] } } });
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, outsider.email] } } });
  });

  it('POST text trả 202 và generationId', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/ai/text`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ topic: 'Ra mắt bộ sưu tập mùa thu', instructions: 'Nhấn mạnh chất liệu' });

    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({
      status: 'PENDING',
      creditCost: 10,
      remainingCredit: 90,
    });
    expect(res.body.data.generationId).toBeTruthy();
  });

  it('POST image cho bài mới trả 202 kèm postId', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/ai/images`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Bài mới có ảnh AI', content, prompt: 'Ảnh tối giản' });

    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ status: 'PENDING', creditCost: 20 });
    expect(res.body.data.postId).toBeTruthy();

    const post = await prisma.post.findUniqueOrThrow({ where: { id: res.body.data.postId } });
    expect(post.status).toBe('DRAFT');
  });

  describe('POST ai/post — tạo chữ và nhiều ảnh cùng lúc', () => {
    const postUrl = () => `/api/v1/workspaces/${workspaceId}/ai/post`;
    const send = (body: object) =>
      request(app).post(postUrl()).set('Authorization', `Bearer ${ownerToken}`).send(body);

    beforeEach(() => {
      vi.spyOn(geminiClient, 'generateJson').mockResolvedValue({
        prompt: 'A cozy autumn coat displayed in a bright studio',
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('chữ + 2 ảnh cho bài mới: 1 bài nháp, 3 generation, 1 lần gọi Gemini, prompt ảnh khác nhau', async () => {
      const res = await send({ topic: 'Ra mắt áo khoác thu đông', imageCount: 2 });

      expect(res.status).toBe(202);
      expect(res.body.data).toMatchObject({ createdDraft: true, creditCost: 50, remainingCredit: 50 });
      expect(res.body.data.generations.map((item: { type: string }) => item.type)).toEqual([
        'TEXT',
        'IMAGE',
        'IMAGE',
      ]);
      expect(enqueueMock).toHaveBeenCalledTimes(3);
      expect(geminiClient.generateJson).toHaveBeenCalledTimes(1);

      const post = await prisma.post.findUniqueOrThrow({ where: { id: res.body.data.postId } });
      expect(post.status).toBe('DRAFT');

      const images = await prisma.aiGeneration.findMany({
        where: { workspaceId, type: 'IMAGE' },
        select: { postId: true, prompt: true },
      });
      const prompts = images.map((image) => (JSON.parse(image.prompt) as { imagePrompt: string }).imagePrompt);
      expect(images.every((image) => image.postId === post.id)).toBe(true);
      expect(new Set(prompts).size).toBe(2);
    });

    it('chỉ ảnh cho bài đã có: không tạo chữ, không tạo bài mới', async () => {
      const existing = await prisma.post.create({
        data: { workspaceId, title: 'Bài có sẵn', content, status: 'DRAFT', createdById: ownerId },
      });

      const res = await send({ withText: false, imageCount: 2, postId: existing.id });

      expect(res.status).toBe(202);
      expect(res.body.data).toMatchObject({ postId: existing.id, createdDraft: false, creditCost: 40 });
      expect(res.body.data.generations.every((item: { type: string }) => item.type === 'IMAGE')).toBe(true);
    });

    it('chỉ chữ: không gọi Gemini viết prompt ảnh và không tạo bài nháp', async () => {
      const res = await send({ topic: 'Chỉ cần nội dung bài viết' });

      expect(res.status).toBe(202);
      expect(res.body.data).toMatchObject({ createdDraft: false, postId: null, creditCost: 10 });
      expect(geminiClient.generateJson).not.toHaveBeenCalled();
    });

    it('không đủ credit cho cả lô: 402, không tạo generation hay bài nháp nào', async () => {
      await prisma.workspace.update({ where: { id: workspaceId }, data: { remainingCredit: 30 } });
      const before = await prisma.post.count({ where: { workspaceId } });

      const res = await send({ topic: 'Không đủ credit cho ảnh', imageCount: 2 });

      expect(res.status).toBe(402);
      expect(await prisma.aiGeneration.count({ where: { workspaceId } })).toBe(0);
      expect(await prisma.post.count({ where: { workspaceId } })).toBe(before);
    });

    it('body sai trả 422: quá 4 ảnh, không chọn gì, thiếu chủ đề', async () => {
      const tooMany = await send({ topic: 'Chủ đề hợp lệ', imageCount: 5 });
      const nothing = await send({ withText: false, imageCount: 0, postId: '00000000-0000-0000-0000-000000000000' });
      const noTopic = await send({ imageCount: 1 });

      expect(tooMany.status).toBe(422);
      expect(nothing.status).toBe(422);
      expect(noTopic.status).toBe(422);
    });

    it('Gemini lỗi khi viết prompt ảnh: 503 và không trừ credit', async () => {
      vi.spyOn(geminiClient, 'generateJson').mockRejectedValue(new Error('gemini down'));

      const res = await send({ topic: 'Chủ đề gặp lỗi Gemini', imageCount: 1 });

      expect(res.status).toBe(503);
      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      expect(workspace.remainingCredit).toBe(100);
    });

    it('enqueue lỗi toàn bộ: 503, hoàn credit và bỏ bài nháp vừa tạo', async () => {
      enqueueMock.mockReset();
      enqueueMock.mockRejectedValue(new Error('redis down'));
      const before = await prisma.post.count({ where: { workspaceId, deletedAt: null } });

      const res = await send({ topic: 'Chủ đề lỗi hàng đợi', imageCount: 1 });

      expect(res.status).toBe(503);
      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      expect(workspace.remainingCredit).toBe(100);
      expect(await prisma.post.count({ where: { workspaceId, deletedAt: null } })).toBe(before);
    });

    it('enqueue lỗi một phần: trả các job đã vào hàng đợi, job lỗi bị FAILED và hoàn credit', async () => {
      enqueueMock.mockReset();
      enqueueMock
        .mockResolvedValueOnce({ id: 'j1', name: 'ai:text', queue: 'content-generation-queue' })
        .mockRejectedValueOnce(new Error('redis blip'))
        .mockResolvedValueOnce({ id: 'j3', name: 'ai:image', queue: 'content-generation-queue' });

      const res = await send({ topic: 'Chủ đề lỗi một phần', imageCount: 2 });

      expect(res.status).toBe(202);
      expect(res.body.data.generations).toHaveLength(2);
      const failed = await prisma.aiGeneration.findMany({ where: { workspaceId, status: 'FAILED' } });
      expect(failed).toHaveLength(1);
      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      expect(workspace.remainingCredit).toBe(100 - 50 + 20);
    });
  });

  it('GET generations (nhiều id) trả trạng thái trong một request và chặn workspace khác', async () => {
    const first = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/ai/text`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ topic: 'Chủ đề polling nhiều id một' });
    const second = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/ai/text`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ topic: 'Chủ đề polling nhiều id hai' });
    const ids = [first.body.data.generationId, second.body.data.generationId] as string[];

    const ok = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/ai/generations`)
      .query({ ids: ids.join(',') })
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.generations.map((item: { id: string }) => item.id).sort()).toEqual([...ids].sort());

    const denied = await request(app)
      .get(`/api/v1/workspaces/${outsiderWorkspaceId}/ai/generations`)
      .query({ ids: ids.join(',') })
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(denied.status).toBe(200);
    expect(denied.body.data.generations).toEqual([]);

    const invalid = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/ai/generations`)
      .query({ ids: 'khong-phai-uuid' })
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(invalid.status).toBe(422);
  });

  it('GET generation trả trạng thái và chặn workspace khác', async () => {
    const created = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/ai/text`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ topic: 'Chủ đề kiểm tra polling' });

    const generationId = created.body.data.generationId as string;

    const ok = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/ai/generations/${generationId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ id: generationId, status: 'PENDING' });

    const denied = await request(app)
      .get(`/api/v1/workspaces/${outsiderWorkspaceId}/ai/generations/${generationId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(denied.status).toBe(404);
  });

  it('không đủ credit trả 402', async () => {
    await prisma.workspace.update({ where: { id: workspaceId }, data: { remainingCredit: 5 } });

    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/ai/text`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ topic: 'Chủ đề không đủ credit' });

    expect(res.status).toBe(402);
    expect(res.body.message).toContain('còn 5');
  });

  it('body sai trả 422', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/ai/text`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ topic: 'ngắn' });

    expect(res.status).toBe(422);
  });

  it('người ngoài workspace trả 403', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/ai/text`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ topic: 'Chủ đề không có quyền' });

    expect(res.status).toBe(403);
  });
});
