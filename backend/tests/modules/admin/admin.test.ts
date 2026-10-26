import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';

const password = 'password123';

describe('Admin module — quản trị hệ thống & audit log (UC32)', () => {
  const stamp = Date.now();
  const admin = { email: `test_admin_${stamp}@marka.vn`, name: 'System Admin' };
  const owner = { email: `test_admin_owner_${stamp}@marka.vn`, name: 'Owner Admin Test' };
  const creator = { email: `test_admin_creator_${stamp}@marka.vn`, name: 'Creator Admin Test' };

  let adminToken = '';
  let adminId = '';
  let ownerToken = '';
  let ownerId = '';
  let ownerWorkspaceId = '';
  let creatorToken = '';
  let creatorId = '';
  let tempWorkspaceId = '';
  let postId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [admin.email, owner.email, creator.email] } },
    });

    const adminRes = await request(app).post('/api/v1/auth/register').send({ ...admin, password });
    adminToken = adminRes.body.data.accessToken;
    adminId = adminRes.body.data.user.id;

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
    ownerId = ownerRes.body.data.user.id;
    ownerWorkspaceId = ownerRes.body.data.user.workspaces[0].id;

    const creatorRes = await request(app).post('/api/v1/auth/register').send({ ...creator, password });
    creatorToken = creatorRes.body.data.accessToken;
    creatorId = creatorRes.body.data.user.id;

    await prisma.user.update({ where: { id: adminId }, data: { systemRole: 'SYSTEM_ADMIN' } });
    await prisma.workspaceMember.create({
      data: {
        workspaceId: ownerWorkspaceId,
        userId: creatorId,
        role: 'CONTENT_CREATOR',
      },
    });

    const post = await prisma.post.create({
      data: {
        workspaceId: ownerWorkspaceId,
        title: 'Bài cho admin stats',
        content: {},
        createdById: ownerId,
      },
    });
    postId = post.id;

    await prisma.order.create({
      data: {
        orderCode: `ADMIN_ORDER_${stamp}`,
        workspaceId: ownerWorkspaceId,
        amount: 50_000,
        status: 'PAID',
        paidAt: new Date(),
        createdById: ownerId,
      },
    });

    await prisma.auditLog.createMany({
      data: [
        {
          workspaceId: ownerWorkspaceId,
          actorId: ownerId,
          action: 'TEST_AUDIT_OWNER',
          targetType: 'Post',
          targetId: postId,
        },
        {
          workspaceId: ownerWorkspaceId,
          actorId: adminId,
          action: 'TEST_AUDIT_ADMIN',
          targetType: 'Workspace',
          targetId: ownerWorkspaceId,
        },
      ],
    });
  });

  afterAll(async () => {
    const userIds = [adminId, ownerId, creatorId].filter(Boolean);
    const workspaceIds = [ownerWorkspaceId, tempWorkspaceId].filter(Boolean);

    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ actorId: { in: userIds } }, { workspaceId: { in: workspaceIds } }],
      },
    });
    await prisma.order.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
    await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('chặn người chưa đăng nhập (401)', async () => {
    const res = await request(app).get('/api/v1/admin/stats');
    expect(res.status).toBe(401);
  });

  it('chặn USER thường truy cập API admin (403)', async () => {
    const res = await request(app).get('/api/v1/admin/stats').set(auth(ownerToken));
    expect(res.status).toBe(403);
  });

  it('GET /admin/stats — trả số liệu tổng hợp', async () => {
    const res = await request(app).get('/api/v1/admin/stats').set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.users.total).toBeGreaterThanOrEqual(3);
    expect(res.body.data.users.admins).toBeGreaterThanOrEqual(1);
    expect(res.body.data.workspaces.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.posts.byStatus).toMatchObject({
      DRAFT: expect.any(Number),
      PENDING: expect.any(Number),
      APPROVED: expect.any(Number),
    });
    expect(res.body.data.posts.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.billing.revenueLast30Days).toBeGreaterThanOrEqual(50_000);
  });

  it('GET /admin/users — tìm theo email, không lộ passwordHash', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users?search=${encodeURIComponent(owner.email)}`)
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0]).toMatchObject({
      id: ownerId,
      email: owner.email,
      systemRole: 'USER',
    });
    expect(res.body.data.users[0]).not.toHaveProperty('passwordHash');
  });

  it('GET /admin/users — lọc theo systemRole', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users?systemRole=SYSTEM_ADMIN')
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(
      res.body.data.users.every((user: { systemRole: string }) => user.systemRole === 'SYSTEM_ADMIN')
    ).toBe(true);
  });

  it('PATCH /admin/users/:id/suspend — khoá tài khoản, đá phiên và ghi audit', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${ownerId}/suspend`)
      .set(auth(adminToken))
      .send({ suspended: true, reason: 'Vi phạm điều khoản' });

    expect(res.status).toBe(200);
    expect(res.body.data.isSuspended).toBe(true);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
    expect(after.isSuspended).toBe(true);
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);

    const blocked = await request(app).get('/api/v1/users/me').set(auth(ownerToken));
    expect(blocked.status).toBe(403);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ADMIN_USER_SUSPENDED', targetId: ownerId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.reason).toBe('Vi phạm điều khoản');
  });

  it('PATCH /admin/users/:id/suspend — mở khoá để đăng nhập lại', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${ownerId}/suspend`)
      .set(auth(adminToken))
      .send({ suspended: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isSuspended).toBe(false);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password });
    expect(login.status).toBe(200);
    ownerToken = login.body.data.accessToken;

    const me = await request(app)
      .get('/api/v1/users/me')
      .set(auth(login.body.data.accessToken));
    expect(me.status).toBe(200);
  });

  it('PATCH /admin/users/:id/suspend — không cho tự khoá mình (400)', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${adminId}/suspend`)
      .set(auth(adminToken))
      .send({ suspended: true });

    expect(res.status).toBe(400);
  });

  it('PATCH /admin/users/:id/suspend — user không tồn tại trả 404', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/suspend')
      .set(auth(adminToken))
      .send({ suspended: true });

    expect(res.status).toBe(404);
  });

  it('GET /admin/workspaces — trả số thành viên/bài viết', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/workspaces?search=${encodeURIComponent(owner.name)}`)
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    const workspace = res.body.data.workspaces.find(
      (item: { id: string }) => item.id === ownerWorkspaceId
    );
    expect(workspace).toMatchObject({ plan: 'FREE' });
    expect(workspace.memberCount).toBeGreaterThanOrEqual(2);
    expect(workspace.postCount).toBeGreaterThanOrEqual(1);
  });

  it('GET /admin/workspaces — includeDeleted hiển thị workspace đã xoá mềm', async () => {
    const created = await request(app)
      .post('/api/v1/workspaces')
      .set(auth(ownerToken))
      .send({ name: `WS tạm admin ${stamp}` });
    tempWorkspaceId = created.body.data.id;

    await request(app)
      .delete(`/api/v1/workspaces/${tempWorkspaceId}`)
      .set(auth(ownerToken));

    const search = encodeURIComponent(`WS tạm admin ${stamp}`);
    const withoutDeleted = await request(app)
      .get(`/api/v1/admin/workspaces?search=${search}`)
      .set(auth(adminToken));
    const withDeleted = await request(app)
      .get(`/api/v1/admin/workspaces?search=${search}&includeDeleted=true`)
      .set(auth(adminToken));

    expect(withoutDeleted.body.data.workspaces).toHaveLength(0);
    expect(withDeleted.body.data.workspaces).toHaveLength(1);
    expect(withDeleted.body.data.workspaces[0].deletedAt).toBeTruthy();
  });

  it('GET /admin/audit-logs — lọc theo action', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs?action=TEST_AUDIT_OWNER')
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.auditLogs).toHaveLength(1);
    expect(res.body.data.auditLogs[0]).toMatchObject({
      action: 'TEST_AUDIT_OWNER',
      targetType: 'Post',
      targetId: postId,
    });
    expect(res.body.data.auditLogs[0].actor).toMatchObject({ id: ownerId });
  });

  it('GET /workspaces/:id/audit-logs — Owner xem log workspace mình', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${ownerWorkspaceId}/audit-logs`)
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.auditLogs.length).toBeGreaterThanOrEqual(2);
    expect(
      res.body.data.auditLogs.every(
        (log: { workspace: { id: string } | null }) => log.workspace?.id === ownerWorkspaceId
      )
    ).toBe(true);
  });

  it('GET /workspaces/:id/audit-logs — Creator không có quyền (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${ownerWorkspaceId}/audit-logs`)
      .set(auth(creatorToken));

    expect(res.status).toBe(403);
  });

  it('GET /admin/audit-logs — query sai trả 422', async () => {
    const badLimit = await request(app)
      .get('/api/v1/admin/audit-logs?limit=99')
      .set(auth(adminToken));
    const badRange = await request(app)
      .get('/api/v1/admin/audit-logs?dateFrom=2026-02-01&dateTo=2026-01-01')
      .set(auth(adminToken));

    expect(badLimit.status).toBe(422);
    expect(badRange.status).toBe(422);
  });
});
