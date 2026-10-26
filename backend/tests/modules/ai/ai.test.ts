import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { enqueue } from '../../../src/workers/queue-manager.js';

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

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, outsider.email] } } });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
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
