import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';

const password = 'password123';

describe('Task manage: update, delete, link post', () => {
  const stamp = Date.now();
  const owner = { email: `test_task_manage_owner_${stamp}@marka.vn`, name: 'Owner Manage' };
  const creatorA = { email: `test_task_manage_a_${stamp}@marka.vn`, name: 'Creator Manage A' };
  const creatorB = { email: `test_task_manage_b_${stamp}@marka.vn`, name: 'Creator Manage B' };
  const outsider = { email: `test_task_manage_out_${stamp}@marka.vn`, name: 'Outsider Manage' };

  let ownerToken = '';
  let wsId = '';
  let creatorAToken = '';
  let creatorAId = '';
  let creatorAOwnWorkspaceId = '';
  let creatorBId = '';
  let creatorBOwnWorkspaceId = '';
  let outsiderToken = '';
  let outsiderWorkspaceId = '';

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

  const createTask = async (body: Record<string, unknown> = {}) => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Việc kiểm thử', ...body });
    return res.body.data;
  };

  const createPost = async (title: string, token = ownerToken, workspaceId = wsId) => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/posts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title, content: { type: 'doc', content: [] } });
    return res.body.data;
  };

  const updateTask = async (taskId: string, body: Record<string, unknown>, token = ownerToken) =>
    request(app)
      .patch(`/api/v1/workspaces/${wsId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const linkPost = async (taskId: string, postId: string | null, token = ownerToken) =>
    request(app)
      .patch(`/api/v1/workspaces/${wsId}/tasks/${taskId}/post`)
      .set('Authorization', `Bearer ${token}`)
      .send({ postId });

  const deleteTask = async (taskId: string) =>
    request(app)
      .delete(`/api/v1/workspaces/${wsId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

  const getBoard = async (token = ownerToken) =>
    request(app)
      .get(`/api/v1/workspaces/${wsId}/tasks/board`)
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creatorA.email, creatorB.email, outsider.email] } },
    });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const a = await joinWorkspace(ownerToken, wsId, creatorA);
    creatorAToken = a.userToken;
    creatorAId = a.userId;
    creatorAOwnWorkspaceId = a.defaultWorkspaceId;

    const b = await joinWorkspace(ownerToken, wsId, creatorB);
    creatorBId = b.userId;
    creatorBOwnWorkspaceId = b.defaultWorkspaceId;

    const outRes = await request(app).post('/api/v1/auth/register').send({ ...outsider, password });
    outsiderToken = outRes.body.data.accessToken;
    outsiderWorkspaceId = outRes.body.data.user.workspaces[0].id;
  });

  beforeEach(async () => {
    await prisma.task.deleteMany({ where: { workspaceId: wsId } });
    await prisma.post.deleteMany({ where: { workspaceId: wsId } });
    await prisma.notification.deleteMany({ where: { workspaceId: wsId } });
    await prisma.auditLog.deleteMany({ where: { workspaceId: wsId } });
  });

  afterAll(async () => {
    const workspaceIds = [
      wsId,
      creatorAOwnWorkspaceId,
      creatorBOwnWorkspaceId,
      outsiderWorkspaceId,
    ].filter(Boolean);
    if (workspaceIds.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creatorA.email, creatorB.email, outsider.email] } },
    });
  });

  it('Owner sửa tiêu đề, ưu tiên, hạn chót → audit TASK_UPDATED', async () => {
    const task = await createTask();
    const dueAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const res = await updateTask(task.id, { title: 'Tiêu đề mới', priority: 1, dueAt });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Tiêu đề mới');
    expect(res.body.data.priority).toBe(1);
    expect(res.body.data.dueAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { workspaceId: wsId, action: 'TASK_UPDATED', targetId: task.id },
    });
    expect(audit).not.toBeNull();
  });

  it('hạn chót quá khứ hoặc quá 1 năm → 400', async () => {
    const task = await createTask();
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const tooFar = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();

    const pastRes = await updateTask(task.id, { dueAt: past });
    const farRes = await updateTask(task.id, { dueAt: tooFar });

    expect(pastRes.status).toBe(400);
    expect(farRes.status).toBe(400);
  });

  it('member sửa việc → 403', async () => {
    const task = await createTask({ assigneeId: creatorAId });

    const res = await updateTask(task.id, { priority: 1 }, creatorAToken);

    expect(res.status).toBe(403);
  });

  it('gắn bài cùng workspace → board trả post', async () => {
    const task = await createTask({ assigneeId: creatorAId });
    const post = await createPost('Bài nháp');

    const res = await linkPost(task.id, post.id);
    expect(res.status).toBe(200);
    expect(res.body.data.post.id).toBe(post.id);

    const board = await getBoard(creatorAToken);
    expect(board.body.data.todo[0].post.id).toBe(post.id);
  });

  it('gắn bài đã thuộc việc khác → 409', async () => {
    const first = await createTask({ assigneeId: creatorAId });
    const second = await createTask({ assigneeId: creatorAId });
    const post = await createPost('Bài đã gắn');

    await linkPost(first.id, post.id);
    const res = await linkPost(second.id, post.id);

    expect(res.status).toBe(409);
  });

  it('gắn bài ARCHIVED → 400; bài workspace khác → 404', async () => {
    const task = await createTask();
    const archived = await createPost('Bài lưu trữ');
    await prisma.post.update({ where: { id: archived.id }, data: { status: 'ARCHIVED' } });

    const archivedRes = await linkPost(task.id, archived.id);
    expect(archivedRes.status).toBe(400);

    const otherPost = await createPost('Bài workspace khác', outsiderToken, outsiderWorkspaceId);
    const otherRes = await linkPost(task.id, otherPost.id);
    expect(otherRes.status).toBe(404);
  });

  it('member gắn bài vào việc của mình → 200; việc người khác → 403', async () => {
    const own = await createTask({ assigneeId: creatorAId });
    const other = await createTask({ assigneeId: creatorBId });
    const post = await createPost('Bài của A', creatorAToken);

    const ownRes = await linkPost(own.id, post.id, creatorAToken);
    expect(ownRes.status).toBe(200);

    const otherRes = await linkPost(other.id, post.id, creatorAToken);
    expect(otherRes.status).toBe(403);
  });

  it('xoá mềm việc → board ẩn, giải phóng postId để gắn lại', async () => {
    const task = await createTask({ assigneeId: creatorAId });
    const post = await createPost('Bài sẽ gắn lại');
    await linkPost(task.id, post.id);

    const del = await deleteTask(task.id);
    expect(del.status).toBe(200);

    const board = await getBoard();
    const allIds = [
      ...board.body.data.unassigned,
      ...board.body.data.todo,
      ...board.body.data.inProgress,
      ...board.body.data.done,
    ].map((item: { id: string }) => item.id);
    expect(allIds).not.toContain(task.id);

    const [deleted] = await prisma.$queryRaw<Array<{ postId: string | null }>>`
      SELECT "postId" FROM tasks WHERE id = ${task.id}
    `;
    expect(deleted.postId).toBeNull();

    const next = await createTask();
    const relink = await linkPost(next.id, post.id);
    expect(relink.status).toBe(200);
  }, 15_000);

  it('chi tiết bài viết trả kèm công việc đã gắn', async () => {
    const task = await createTask({ assigneeId: creatorAId, priority: 2 });
    const post = await createPost('Bài có công việc');
    await linkPost(task.id, post.id);

    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts/${post.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.task.id).toBe(task.id);
    expect(res.body.data.task.priority).toBe(2);
    expect(res.body.data.task.assignee.id).toBe(creatorAId);
  });
});
