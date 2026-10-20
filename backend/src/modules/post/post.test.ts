import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import prisma from '../../config/db.js';

vi.mock('../../utils/cloudinary.js', () => ({
  uploadImageBuffer: vi.fn().mockResolvedValue('https://res.cloudinary.com/demo/image/upload/fake.png'),
}));

const password = 'password123';

describe('Post module (UC05, UC07, UC08, UC09, UC10, UC37)', () => {
  const stamp = Date.now();
  const owner = { email: `test_post_owner_${stamp}@marka.vn`, name: 'Owner Post' };
  const creatorA = { email: `test_post_creator_a_${stamp}@marka.vn`, name: 'Creator A' };
  const creatorB = { email: `test_post_creator_b_${stamp}@marka.vn`, name: 'Creator B' };

  let ownerToken = '';
  let ownerId = '';
  let wsId = '';
  let creatorAToken = '';
  let creatorAId = '';
  let creatorAOwnWorkspaceId = '';
  let creatorBToken = '';
  let creatorBOwnWorkspaceId = '';
  let postId = '';
  let creatorAPostId = '';
  let toDeletePostId = '';
  let ownerDeleteTargetId = '';
  let mediaId = '';
  let mediaId2 = '';

  const joinWorkspace = async (
    inviterToken: string,
    workspaceId: string,
    user: { email: string; name: string }
  ) => {
    const inviteRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .set('Authorization', `Bearer ${inviterToken}`)
      .send({ email: user.email, role: 'CONTENT_CREATOR' });
    const token = inviteRes.body.data.inviteUrl.split('/invites/')[1];

    const registerRes = await request(app).post('/api/v1/auth/register').send({ ...user, password });
    const userToken = registerRes.body.data.accessToken;
    const defaultWorkspaceId = registerRes.body.data.user.workspaces[0].id;

    await request(app).get(`/api/v1/invites/${token}`).set('Authorization', `Bearer ${userToken}`);

    return { userToken, defaultWorkspaceId, userId: registerRes.body.data.user.id as string };
  };

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creatorA.email, creatorB.email] } },
    });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
    ownerId = ownerRes.body.data.user.id;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const a = await joinWorkspace(ownerToken, wsId, creatorA);
    creatorAToken = a.userToken;
    creatorAId = a.userId;
    creatorAOwnWorkspaceId = a.defaultWorkspaceId;

    const b = await joinWorkspace(ownerToken, wsId, creatorB);
    creatorBToken = b.userToken;
    creatorBOwnWorkspaceId = b.defaultWorkspaceId;
  });

  afterAll(async () => {
    const workspaceIds = [wsId, creatorAOwnWorkspaceId, creatorBOwnWorkspaceId].filter(Boolean);
    if (workspaceIds.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creatorA.email, creatorB.email] } },
    });
  });

  it('UC05 — Tạo bản nháp thành công (201)', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Nháp đầu tiên', content: { type: 'doc', content: [] } });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Nháp đầu tiên');
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.createdById).toBe(ownerId);
    postId = res.body.data.id;
  });

  it('UC05 — Thiếu title trả 422', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: { type: 'doc', content: [] } });

    expect(res.status).toBe(422);
  });

  it('UC08 — Xem chi tiết bản nháp (200), kèm mediaAssets rỗng', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts/${postId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(postId);
    expect(res.body.data.mediaAssets).toEqual([]);
  });

  it('UC08 — Bài thuộc workspace khác trả 404 khi đổi workspaceId', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${creatorAOwnWorkspaceId}/posts/${postId}`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    expect(res.status).toBe(404);
  });

  it('UC09 — Danh sách trả posts + meta phân trang', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts?page=1&limit=10`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.posts)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10 });
    expect(typeof res.body.meta.total).toBe('number');
  });

  it('UC09 — Tìm theo tiêu đề (không phân biệt hoa/thường)', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts?search=NHÁP`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts.some((p: { id: string }) => p.id === postId)).toBe(true);
  });

  it('UC09 — Lọc theo người tạo', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts?createdById=${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts.every((p: { createdById: string }) => p.createdById === ownerId)).toBe(true);
  });

  it('UC09 — Lọc theo trạng thái', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts?status=DRAFT`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts.every((p: { status: string }) => p.status === 'DRAFT')).toBe(true);
    expect(res.body.data.posts.some((p: { id: string }) => p.id === postId)).toBe(true);
  });

  it('UC09 — Trạng thái không hợp lệ trả 422', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts?status=KHONGCO`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(422);
  });

  it('UC09 — Query sai trả 422 (page=0, limit=99, dateTo<dateFrom)', async () => {
    const bad1 = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts?page=0`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const bad2 = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts?limit=99`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const bad3 = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts?dateFrom=2026-02-01&dateTo=2026-01-01`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(bad1.status).toBe(422);
    expect(bad2.status).toBe(422);
    expect(bad3.status).toBe(422);
  });

  it('UC09 — Không lộ bài viết của workspace khác', async () => {
    await request(app)
      .post(`/api/v1/workspaces/${creatorAOwnWorkspaceId}/posts`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({ title: 'Bài workspace riêng A', content: { type: 'doc', content: [] } });

    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.posts.some((p: { title: string }) => p.title === 'Bài workspace riêng A')).toBe(false);
  });

  it('setup — Creator A tạo bản nháp của mình', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({ title: 'Nháp của A', content: { type: 'doc', content: [] } });

    expect(res.status).toBe(201);
    creatorAPostId = res.body.data.id;
  });

  it('UC07 — Chủ bài (Creator) sửa bản nháp của mình (200)', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({ title: 'Đã sửa' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Đã sửa');
  });

  it('UC07 — Creator khác sửa bài người khác trả 403', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}`)
      .set('Authorization', `Bearer ${creatorBToken}`)
      .send({ title: 'Hack' });

    expect(res.status).toBe(403);
  });

  it('UC07 — Owner sửa được bài của Creator (200)', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: { type: 'doc', content: [{ type: 'paragraph' }] } });

    expect(res.status).toBe(200);
  });

  it('UC07 — PATCH rỗng trả 422', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it('UC07 — Sửa bài không phải DRAFT trả 409', async () => {
    const pending = await prisma.post.create({
      data: { workspaceId: wsId, title: 'Bài chờ duyệt', content: {}, status: 'PENDING', createdById: ownerId },
    });

    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${pending.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Đổi trạng thái' });

    expect(res.status).toBe(409);
  });

  it('setup — Creator A tạo 2 bản nháp để xóa', async () => {
    const res1 = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({ title: 'Sẽ tự xóa', content: { type: 'doc', content: [] } });
    const res2 = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({ title: 'Owner sẽ xóa', content: { type: 'doc', content: [] } });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    toDeletePostId = res1.body.data.id;
    ownerDeleteTargetId = res2.body.data.id;
  });

  it('UC10 — Chủ bài xóa bản nháp của mình (200)', async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/posts/${toDeletePostId}`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    expect(res.status).toBe(200);
  });

  it('UC10 — Sau khi xóa, chi tiết trả 404', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts/${toDeletePostId}`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    expect(res.status).toBe(404);
  });

  it('UC10 — Creator khác xóa bài người khác trả 403', async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}`)
      .set('Authorization', `Bearer ${creatorBToken}`);

    expect(res.status).toBe(403);
  });

  it('UC10 — Owner xóa được bài của Creator (200)', async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/posts/${ownerDeleteTargetId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
  });

  it('UC37 — Upload ảnh vào bài của mình (201)', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}/media`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data.url).toContain('res.cloudinary.com');
    expect(res.body.data.type).toBe('IMAGE');
    mediaId = res.body.data.id;
  });

  it('UC37 — Chi tiết bài chứa ảnh vừa upload', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    expect(res.body.data.mediaAssets.length).toBeGreaterThan(0);
  });

  it('UC37 — Upload sai định dạng trả 400', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}/media`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });

  it('UC37 — Upload ảnh vượt 10MB trả 400', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}/media`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
  });

  it('UC37 — Creator khác upload vào bài người khác trả 403', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}/media`)
      .set('Authorization', `Bearer ${creatorBToken}`)
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
  });

  it('setup — Upload thêm 1 ảnh để test quyền gỡ', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}/media`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'b.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    mediaId2 = res.body.data.id;
  });

  it('UC37 — Gỡ ảnh khỏi bài của mình (200)', async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}/media/${mediaId}`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    expect(res.status).toBe(200);
  });

  it('UC37 — Gỡ ảnh không thuộc bài trả 404', async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}/media/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    expect(res.status).toBe(404);
  });

  it('UC37 — Creator khác gỡ ảnh bài người khác trả 403', async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/posts/${creatorAPostId}/media/${mediaId2}`)
      .set('Authorization', `Bearer ${creatorBToken}`);

    expect(res.status).toBe(403);
  });

  it('RBAC — Chặn lệch workspace giữa header và URL (403, không lộ dữ liệu)', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${creatorAOwnWorkspaceId}/posts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId);

    expect(res.status).toBe(403);
  });

  it('RBAC — Không tạo được bài chéo workspace qua header (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${creatorAOwnWorkspaceId}/posts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-workspace-id', wsId)
      .send({ title: 'Chéo workspace', content: { type: 'doc', content: [] } });

    expect(res.status).toBe(403);
  });

  it('UC09 — page tràn số trả 422 (không 500)', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts?page=1000000000000000000000`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(422);
  });

  // ---- UC11 (Gửi duyệt) & UC14 (Duyệt/Từ chối) ----

  let approvalPostId = '';

  it('setup — Creator A tạo bài để gửi duyệt', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({ title: 'Bài chờ gửi duyệt', content: { type: 'doc', content: [] } });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    approvalPostId = res.body.data.id;
  });

  it('UC11 — Creator khác gửi duyệt bài của người khác trả 403', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${approvalPostId}/submit`)
      .set('Authorization', `Bearer ${creatorBToken}`);

    expect(res.status).toBe(403);
  });

  it('UC11 — Gửi duyệt bài của workspace khác trả 404', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${creatorAOwnWorkspaceId}/posts/${postId}/submit`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    expect(res.status).toBe(404);
  });

  it('UC11 — Tác giả gửi duyệt bài của mình (200) → PENDING', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${approvalPostId}/submit`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.submittedById).toBe(creatorAId);
    expect(res.body.data.submittedAt).toBeTruthy();
  });

  it('UC11 — Gửi duyệt thông báo cho Owner', async () => {
    const count = await prisma.notification.count({
      where: { workspaceId: wsId, userId: ownerId, type: 'POST_SUBMITTED' },
    });

    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('UC11 — Gửi duyệt lại khi bài đang PENDING trả 409', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${approvalPostId}/submit`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    expect(res.status).toBe(409);
  });

  it('UC14 — Creator gọi duyệt bài trả 403', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${approvalPostId}/review`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({ decision: 'APPROVED' });

    expect(res.status).toBe(403);
  });

  it('UC14 — Từ chối thiếu lý do trả 422', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${approvalPostId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ decision: 'REJECTED' });

    expect(res.status).toBe(422);
  });

  it('UC14 — Owner từ chối kèm lý do (200) → REJECTED', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${approvalPostId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ decision: 'REJECTED', rejectReason: 'Thiếu thông tin sản phẩm' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.rejectReason).toBe('Thiếu thông tin sản phẩm');
    expect(res.body.data.reviewedById).toBe(ownerId);
    expect(res.body.data.reviewedAt).toBeTruthy();
  });

  it('UC14 — Từ chối thông báo cho tác giả', async () => {
    const count = await prisma.notification.count({
      where: { workspaceId: wsId, userId: creatorAId, type: 'POST_REJECTED' },
    });

    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('UC07 — Sửa được bài đã bị từ chối (200)', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${approvalPostId}`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({ title: 'Đã bổ sung thông tin' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Đã bổ sung thông tin');
  });

  it('UC11 — Gửi lại bài bị từ chối (200) → PENDING, xoá lý do cũ', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${approvalPostId}/submit`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.rejectReason).toBeNull();
  });

  it('UC14 — Owner duyệt bài (200) → APPROVED', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${approvalPostId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ decision: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.reviewedById).toBe(ownerId);
  });

  it('UC14 — Duyệt thông báo cho tác giả', async () => {
    const count = await prisma.notification.count({
      where: { workspaceId: wsId, userId: creatorAId, type: 'POST_APPROVED' },
    });

    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('UC14 — Duyệt lại bài đã APPROVED trả 409', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${wsId}/posts/${approvalPostId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ decision: 'APPROVED' });

    expect(res.status).toBe(409);
  });

  it('UC14 — Hai lượt duyệt đồng thời chỉ một lượt thành công', async () => {
    const created = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({ title: 'Bài duyệt đồng thời', content: { type: 'doc', content: [] } });
    const id = created.body.data.id;
    await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${id}/submit`)
      .set('Authorization', `Bearer ${creatorAToken}`);

    const review = (decision: 'APPROVED' | 'REJECTED') =>
      request(app)
        .patch(`/api/v1/workspaces/${wsId}/posts/${id}/review`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(decision === 'REJECTED' ? { decision, rejectReason: 'Chưa đạt yêu cầu' } : { decision });

    const results = await Promise.all([review('APPROVED'), review('REJECTED')]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    const auditCount = await prisma.auditLog.count({
      where: { targetId: id, action: { in: ['POST_APPROVED', 'POST_REJECTED'] } },
    });
    expect(auditCount).toBe(1);
  });

  it('UC11 — Owner gửi duyệt bài của Creator (200)', async () => {
    const created = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts`)
      .set('Authorization', `Bearer ${creatorAToken}`)
      .send({ title: 'Bài để Owner gửi duyệt', content: { type: 'doc', content: [] } });

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${created.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING');
  });
});
