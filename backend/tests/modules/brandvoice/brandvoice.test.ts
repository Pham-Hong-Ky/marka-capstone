import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';

const password = 'password123';

const baseBrandVoice = {
  industry: 'Thời trang nữ',
  targetAudience: 'Nữ 22-30 tuổi tại Hà Nội, quan tâm phong cách tối giản',
  writingStyle: 'Thân thiện, gần gũi, hạn chế thuật ngữ chuyên ngành',
  keywordsShouldUse: ['thanh lịch', 'tối giản'],
  keywordsAvoid: ['hàng chợ'],
  fewShotExamples: [
    {
      title: 'Mẫu áo sơ mi',
      content: 'Chỉ một chiếc sơ mi trắng cũng đủ cho cả tuần đi làm của bạn.',
    },
  ],
};

describe('Brand Voice (UC24, UC25, UC26)', () => {
  const stamp = Date.now();
  const owner = { email: `test_bv_owner_${stamp}@marka.vn`, name: 'Owner Brand Voice' };
  const creator = { email: `test_bv_creator_${stamp}@marka.vn`, name: 'Creator Brand Voice' };
  const outsider = { email: `test_bv_outsider_${stamp}@marka.vn`, name: 'Outsider Brand Voice' };

  let ownerId = '';
  let ownerToken = '';
  let wsId = '';
  let creatorToken = '';
  let outsiderToken = '';
  let outsiderWorkspaceId = '';
  let creatorId = '';

  const url = () => `/api/v1/workspaces/${wsId}/brand-voice`;

  beforeAll(async () => {
    const emails = [owner.email, creator.email, outsider.email];
    await prisma.user.deleteMany({ where: { email: { in: emails } } });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
    ownerId = ownerRes.body.data.user.id;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const creatorRes = await request(app).post('/api/v1/auth/register').send({ ...creator, password });
    creatorToken = creatorRes.body.data.accessToken;
    creatorId = creatorRes.body.data.user.id;
    await prisma.workspaceMember.create({
      data: { workspaceId: wsId, userId: creatorId, role: 'CONTENT_CREATOR' },
    });

    const outsiderRes = await request(app).post('/api/v1/auth/register').send({ ...outsider, password });
    outsiderToken = outsiderRes.body.data.accessToken;
    outsiderWorkspaceId = outsiderRes.body.data.user.workspaces[0].id;
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({
      where: { id: { in: [wsId, outsiderWorkspaceId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creator.email, outsider.email] } },
    });
  });

  it('UC26 — Creator xem Brand Voice khi chưa cấu hình (200, chưa thiết lập)', async () => {
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.brandVoice).toBeNull();
    expect(res.body.data.isConfigured).toBe(false);
  });

  it('UC24 — Owner tạo Brand Voice lần đầu (200)', async () => {
    const res = await request(app)
      .put(url())
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(baseBrandVoice);

    expect(res.status).toBe(200);
    expect(res.body.data.isConfigured).toBe(true);
    expect(res.body.data.brandVoice).toEqual(baseBrandVoice);
  });

  it('UC26 — Creator xem đúng cấu hình Owner vừa lưu', async () => {
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.brandVoice).toEqual(baseBrandVoice);
  });

  it('UC25 — Owner cập nhật Brand Voice: dữ liệu cũ bị thay thế, không nhân bản', async () => {
    const updated = {
      industry: 'Mỹ phẩm thiên nhiên',
      targetAudience: 'Nữ 18-25 tuổi',
      writingStyle: 'Trẻ trung, dí dỏm',
      keywordsShouldUse: ['lành tính'],
      keywordsAvoid: [],
      fewShotExamples: [],
    };

    const res = await request(app)
      .put(url())
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(updated);

    expect(res.status).toBe(200);
    expect(res.body.data.brandVoice).toEqual(updated);

    const stored = await prisma.workspace.findUnique({ where: { id: wsId } });
    expect(stored?.brandVoice).toEqual(updated);
  });

  it('UC24 — Từ khoá trùng lặp được khử trùng lặp', async () => {
    const res = await request(app)
      .put(url())
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...baseBrandVoice, keywordsShouldUse: ['ưu đãi', 'ưu đãi', 'sale'] });

    expect(res.status).toBe(200);
    expect(res.body.data.brandVoice.keywordsShouldUse).toEqual(['ưu đãi', 'sale']);
  });

  it('UC25 — Ghi audit log khi cập nhật Brand Voice', async () => {
    const log = await prisma.auditLog.findFirst({
      where: { workspaceId: wsId, action: 'BRAND_VOICE_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });

    expect(log).not.toBeNull();
    expect(log?.actorId).toBe(ownerId);
    expect(log?.targetType).toBe('Workspace');
    expect(log?.targetId).toBe(wsId);
  });

  it('RBAC — Content Creator không được cập nhật Brand Voice (403)', async () => {
    const res = await request(app)
      .put(url())
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(baseBrandVoice);

    expect(res.status).toBe(403);
  });

  it('RBAC — Người ngoài workspace không xem được Brand Voice (403)', async () => {
    const res = await request(app)
      .get(url())
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });

  it('RBAC — Người ngoài workspace không cập nhật được Brand Voice (403)', async () => {
    const res = await request(app)
      .put(url())
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send(baseBrandVoice);

    expect(res.status).toBe(403);
  });

  it('Validate — Thiếu ngành hàng trả 422', async () => {
    const res = await request(app)
      .put(url())
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetAudience: 'Nữ 18-25 tuổi' });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('industry');
  });

  it('Validate — Quá 3 bài viết mẫu trả 422', async () => {
    const examples = Array.from({ length: 4 }, (_, index) => ({
      title: `Mẫu ${index + 1}`,
      content: 'Nội dung mẫu đủ dài để vượt qua kiểm tra độ dài tối thiểu.',
    }));

    const res = await request(app)
      .put(url())
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...baseBrandVoice, fewShotExamples: examples });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('fewShotExamples');
  });

  it('Validate — Quá 30 từ khoá trả 422', async () => {
    const keywords = Array.from({ length: 31 }, (_, index) => `từ khoá ${index + 1}`);

    const res = await request(app)
      .put(url())
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...baseBrandVoice, keywordsAvoid: keywords });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('keywordsAvoid');
  });
});
