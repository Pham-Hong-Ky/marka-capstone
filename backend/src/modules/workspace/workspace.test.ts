import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import prisma from '../../config/db.js';

const password = 'password123';

describe('Workspace module (UC16–UC23, UC35, UC36)', () => {
  const stamp = Date.now();
  const owner = { email: `test_ws_owner_${stamp}@marka.vn`, name: 'Owner Test' };
  const member = { email: `test_ws_member_${stamp}@marka.vn`, name: 'Member Test' };
  const createdName = `WS Test ${stamp}`;

  let ownerToken = '';
  let memberToken = '';
  let ownerDefaultWorkspaceId = '';
  let memberDefaultWorkspaceId = '';
  let createdWorkspaceId = '';
  let inviteToken = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, member.email] } } });
  });

  afterAll(async () => {
    const workspaceIds = [ownerDefaultWorkspaceId, memberDefaultWorkspaceId, createdWorkspaceId].filter(Boolean);
    if (workspaceIds.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, member.email] } } });
  });

  it('UC35 — Đăng ký owner và tạo workspace mặc định', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...owner, password });

    expect(res.status).toBe(201);
    ownerToken = res.body.data.accessToken;
    ownerDefaultWorkspaceId = res.body.data.user.workspaces[0].id;
    expect(res.body.data.user.workspaces[0].role).toBe('OWNER');
  });

  it('UC16 — Tạo workspace mới thành công (201)', async () => {
    const res = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: createdName });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(createdName);
    expect(res.body.data.role).toBe('OWNER');
    createdWorkspaceId = res.body.data.id;
  });

  it('UC16 — Báo lỗi 409 khi tạo trùng tên workspace', async () => {
    const res = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: createdName });

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('fail');
  });

  it('UC16 — Báo lỗi 422 khi tên không hợp lệ', async () => {
    const res = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'x' });

    expect(res.status).toBe(422);
  });

  it('UC35 — Danh sách workspace chứa workspace vừa tạo', async () => {
    const res = await request(app).get('/api/v1/workspaces').set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.workspaces.map((w: { id: string }) => w.id);
    expect(ids).toContain(createdWorkspaceId);
    expect(ids).toContain(ownerDefaultWorkspaceId);
  });

  it('UC17 — Cập nhật tên workspace thành công (200)', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${createdWorkspaceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `${createdName} Updated` });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(`${createdName} Updated`);
  });

  it('UC19 — Xem thành viên: ban đầu chỉ có Owner', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${createdWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(1);
    expect(res.body.data.members[0].role).toBe('OWNER');
    expect(res.body.data.pendingInvites).toHaveLength(0);
  });

  it('UC20 — Mời thành viên thành công, trả invite token (201)', async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${createdWorkspaceId}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: member.email, role: 'CONTENT_CREATOR' });

    expect(res.status).toBe(201);
    expect(res.body.data.invite.email).toBe(member.email);
    expect(res.body.data.inviteUrl).toContain('/invites/');

    inviteToken = res.body.data.inviteUrl.split('/invites/')[1];
  });

  it('UC20 — Mời lại email đang chờ: cấp token mới, token cũ hết hiệu lực (201)', async () => {
    const previousToken = inviteToken;

    const res = await request(app)
      .post(`/api/v1/workspaces/${createdWorkspaceId}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: member.email, role: 'CONTENT_CREATOR' });

    expect(res.status).toBe(201);
    const newToken = res.body.data.inviteUrl.split('/invites/')[1];
    expect(newToken).not.toBe(previousToken);

    const oldRes = await request(app).get(`/api/v1/invites/${previousToken}`);
    expect(oldRes.status).toBe(404);

    inviteToken = newToken;
  });

  it('UC21 — Khách chưa đăng nhập xem lời mời cần đăng ký', async () => {
    const res = await request(app).get(`/api/v1/invites/${inviteToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.requiresRegistration).toBe(true);
    expect(res.body.data.email).toBe(member.email);
  });

  it('UC21 — Đăng ký member rồi chấp nhận lời mời thành công (200)', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...member, password });

    expect(registerRes.status).toBe(201);
    memberToken = registerRes.body.data.accessToken;
    memberDefaultWorkspaceId = registerRes.body.data.user.workspaces[0].id;

    const res = await request(app)
      .get(`/api/v1/invites/${inviteToken}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.workspaceId).toBe(createdWorkspaceId);
  });

  it('UC21 — Dùng lại token đã dùng báo lỗi 409', async () => {
    const res = await request(app)
      .get(`/api/v1/invites/${inviteToken}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(409);
  });

  it('UC19 — Sau khi tham gia có 2 thành viên', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${createdWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.members).toHaveLength(2);
    const roles = res.body.data.members.map((m: { role: string }) => m.role);
    expect(roles).toContain('CONTENT_CREATOR');
  });

  it('RBAC — Content Creator không được cập nhật workspace (403)', async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${createdWorkspaceId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Hack name' });

    expect(res.status).toBe(403);
  });

  it('UC36 — Owner đổi vai trò member thành OWNER (200)', async () => {
    const membersRes = await request(app)
      .get(`/api/v1/workspaces/${createdWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const memberRow = membersRes.body.data.members.find(
      (m: { email: string }) => m.email === member.email
    );

    const res = await request(app)
      .patch(`/api/v1/workspaces/${createdWorkspaceId}/members/${memberRow.userId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'OWNER' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('OWNER');
  });

  it('UC36 — Không thể hạ Owner duy nhất (409)', async () => {
    const membersRes = await request(app)
      .get(`/api/v1/workspaces/${ownerDefaultWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const ownerRow = membersRes.body.data.members[0];

    const res = await request(app)
      .patch(`/api/v1/workspaces/${ownerDefaultWorkspaceId}/members/${ownerRow.userId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'CONTENT_CREATOR' });

    expect(res.status).toBe(409);
  });

  it('UC23 — Owner xóa thành viên (200)', async () => {
    const membersRes = await request(app)
      .get(`/api/v1/workspaces/${createdWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const memberRow = membersRes.body.data.members.find(
      (m: { email: string }) => m.email === member.email
    );

    const res = await request(app)
      .delete(`/api/v1/workspaces/${createdWorkspaceId}/members/${memberRow.userId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.removedMemberId).toBe(memberRow.userId);
  });

  it('UC22 — Owner duy nhất không thể rời workspace (409)', async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${ownerDefaultWorkspaceId}/members/me`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(409);
  });

  it('UC18 — Xóa mềm workspace và ẩn khỏi danh sách (200)', async () => {
    const res = await request(app)
      .delete(`/api/v1/workspaces/${createdWorkspaceId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);

    const listRes = await request(app).get('/api/v1/workspaces').set('Authorization', `Bearer ${ownerToken}`);
    const ids = listRes.body.data.workspaces.map((w: { id: string }) => w.id);
    expect(ids).not.toContain(createdWorkspaceId);
  });

  it('UC18 — Workspace đã xóa trả 404 khi truy cập thành viên', async () => {
    const res = await request(app)
      .get(`/api/v1/workspaces/${createdWorkspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });
});
