import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import prisma from '../../config/db.js';

const password = 'password123';

describe('Notification module — hộp thư trong ứng dụng', () => {
  const stamp = Date.now();
  const owner = { email: `test_notify_owner_${stamp}@marka.vn`, name: 'Owner Notify' };
  const other = { email: `test_notify_other_${stamp}@marka.vn`, name: 'Other Notify' };

  let ownerToken = '';
  let ownerId = '';
  let wsId = '';
  let otherId = '';
  let otherWorkspaceId = '';

  let unreadOneId = '';
  let unreadTwoId = '';
  let noWorkspaceId = '';
  let readId = '';
  let otherNotificationId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, other.email] } } });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
    ownerId = ownerRes.body.data.user.id;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const otherRes = await request(app).post('/api/v1/auth/register').send({ ...other, password });
    otherId = otherRes.body.data.user.id;
    otherWorkspaceId = otherRes.body.data.user.workspaces[0].id;

    const createNotification = (data: {
      userId: string;
      workspaceId: string | null;
      type: string;
      isRead?: boolean;
    }) => prisma.notification.create({ data: { ...data, payload: {} } });

    unreadOneId = (await createNotification({ userId: ownerId, workspaceId: wsId, type: 'POST_SUBMITTED' })).id;
    unreadTwoId = (await createNotification({ userId: ownerId, workspaceId: wsId, type: 'POST_APPROVED' })).id;
    noWorkspaceId = (await createNotification({ userId: ownerId, workspaceId: null, type: 'SYSTEM' })).id;
    readId = (
      await createNotification({ userId: ownerId, workspaceId: wsId, type: 'POST_REJECTED', isRead: true })
    ).id;
    otherNotificationId = (
      await createNotification({ userId: otherId, workspaceId: otherWorkspaceId, type: 'POST_SUBMITTED' })
    ).id;
  });

  afterAll(async () => {
    const workspaceIds = [wsId, otherWorkspaceId].filter(Boolean);
    if (workspaceIds.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, other.email] } } });
  });

  it('GET /users/me/notifications — chỉ trả thông báo của chính mình', async () => {
    const res = await request(app).get('/api/v1/users/me/notifications').set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 4 });
    const ids = res.body.data.notifications.map((item: { id: string }) => item.id);
    expect(ids).toEqual(expect.arrayContaining([unreadOneId, unreadTwoId, noWorkspaceId, readId]));
    expect(ids).not.toContain(otherNotificationId);
  });

  it('GET /users/me/notifications — lọc theo trạng thái chưa đọc', async () => {
    const res = await request(app)
      .get('/api/v1/users/me/notifications?isRead=false')
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(3);
    expect(
      res.body.data.notifications.every((item: { isRead: boolean }) => item.isRead === false)
    ).toBe(true);
  });

  it('GET /users/me/notifications/unread-count — đếm đúng số chưa đọc', async () => {
    const res = await request(app)
      .get('/api/v1/users/me/notifications/unread-count')
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(3);
  });

  it('PATCH .../:id/read — đánh dấu đã đọc và giảm số chưa đọc', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/me/notifications/${unreadOneId}/read`)
      .set(auth(ownerToken));

    expect(res.status).toBe(200);

    const saved = await prisma.notification.findUnique({ where: { id: unreadOneId } });
    expect(saved?.isRead).toBe(true);

    const countRes = await request(app)
      .get('/api/v1/users/me/notifications/unread-count')
      .set(auth(ownerToken));
    expect(countRes.body.data.unreadCount).toBe(2);
  });

  it('PATCH .../:id/read — không đánh dấu được thông báo của người khác (404)', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/me/notifications/${otherNotificationId}/read`)
      .set(auth(ownerToken));

    expect(res.status).toBe(404);
    const saved = await prisma.notification.findUnique({ where: { id: otherNotificationId } });
    expect(saved?.isRead).toBe(false);
  });

  it('GET ...?workspaceId — workspace không phải thành viên trả 403', async () => {
    const res = await request(app)
      .get(`/api/v1/users/me/notifications?workspaceId=${otherWorkspaceId}`)
      .set(auth(ownerToken));

    expect(res.status).toBe(403);
  });

  it('GET ...?workspaceId — lọc được theo workspace mình tham gia', async () => {
    const res = await request(app)
      .get(`/api/v1/users/me/notifications?workspaceId=${wsId}`)
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(3);
  });

  it('PATCH /users/me/notifications/read-all — đánh dấu tất cả đã đọc', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/notifications/read-all')
      .set(auth(ownerToken));

    expect(res.status).toBe(200);

    const countRes = await request(app)
      .get('/api/v1/users/me/notifications/unread-count')
      .set(auth(ownerToken));
    expect(countRes.body.data.unreadCount).toBe(0);
  });

  it('GET /users/me/notifications — limit vượt mức trả 422', async () => {
    const res = await request(app)
      .get('/api/v1/users/me/notifications?limit=99')
      .set(auth(ownerToken));

    expect(res.status).toBe(422);
  });

  it('GET /users/me/notifications — yêu cầu đăng nhập (401)', async () => {
    const res = await request(app).get('/api/v1/users/me/notifications');
    expect(res.status).toBe(401);
  });

  it('GET /users/me/notifications — page tràn số trả 422 (không 500)', async () => {
    const res = await request(app)
      .get('/api/v1/users/me/notifications?page=1000000000000000000000')
      .set(auth(ownerToken));

    expect(res.status).toBe(422);
  });
});
