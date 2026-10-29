import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';

const password = 'password123';

describe('Task assignment & status (UC42, UC43)', () => {
  const stamp = Date.now();
  const owner = { email: `test_task_assign_owner_${stamp}@marka.vn`, name: 'Owner Assign' };
  const creatorA = {
    email: `test_task_assign_a_${stamp}@marka.vn`,
    name: 'Creator Assign A',
  };
  const creatorB = {
    email: `test_task_assign_b_${stamp}@marka.vn`,
    name: 'Creator Assign B',
  };
  const outsider = {
    email: `test_task_assign_out_${stamp}@marka.vn`,
    name: 'Outsider Assign',
  };

  let ownerToken = '';
  let wsId = '';
  let creatorAToken = '';
  let creatorAId = '';
  let creatorAOwnWorkspaceId = '';
  let creatorBToken = '';
  let creatorBOwnWorkspaceId = '';
  let outsiderId = '';
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

  const assign = async (taskId: string, assigneeId: string | null) =>
    request(app)
      .patch(`/api/v1/workspaces/${wsId}/tasks/${taskId}/assign`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ assigneeId });

  const updateStatus = async (taskId: string, status: string, token = creatorAToken) =>
    request(app)
      .patch(`/api/v1/workspaces/${wsId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status });

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
    creatorBToken = b.userToken;
    creatorBOwnWorkspaceId = b.defaultWorkspaceId;

    const outRes = await request(app).post('/api/v1/auth/register').send({ ...outsider, password });
    outsiderId = outRes.body.data.user.id;
    outsiderWorkspaceId = outRes.body.data.user.workspaces[0].id;
  });

  beforeEach(async () => {
    await prisma.task.deleteMany({ where: { workspaceId: wsId } });
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

  it('giao việc cho người ngoài workspace → 400', async () => {
    const task = await createTask();
    const res = await assign(task.id, outsiderId);

    expect(res.status).toBe(400);
  });

  it('giao việc cho thành viên → notification và audit', async () => {
    const task = await createTask();

    const res = await assign(task.id, creatorAId);

    expect(res.status).toBe(200);
    expect(res.body.data.assignee.id).toBe(creatorAId);
    expect(res.body.data.assignedAt).not.toBeNull();

    const notification = await prisma.notification.findFirst({
      where: { userId: creatorAId, type: 'TASK_ASSIGNED' },
    });
    expect(notification).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { workspaceId: wsId, action: 'TASK_ASSIGNED', targetId: task.id },
    });
    expect(audit).not.toBeNull();

    const board = await getBoard(creatorAToken);
    expect(board.body.data.todo.map((item: { id: string }) => item.id)).toContain(task.id);
  });

  it('bỏ giao việc → xoá người nhận, hạn chót và đưa về TODO', async () => {
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const task = await createTask({ assigneeId: creatorAId, dueAt });
    await updateStatus(task.id, 'IN_PROGRESS');

    const res = await assign(task.id, null);

    expect(res.status).toBe(200);
    expect(res.body.data.assignee).toBeNull();
    expect(res.body.data.dueAt).toBeNull();
    expect(res.body.data.status).toBe('TODO');

    const board = await getBoard();
    expect(board.body.data.unassigned.map((item: { id: string }) => item.id)).toContain(task.id);
  });

  it('member đổi trạng thái việc của mình → audit và báo Owner', async () => {
    const task = await createTask({ assigneeId: creatorAId });

    const res = await updateStatus(task.id, 'IN_PROGRESS');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');

    const audit = await prisma.auditLog.findFirst({
      where: { workspaceId: wsId, action: 'TASK_STATUS_CHANGED', targetId: task.id },
    });
    expect(audit).not.toBeNull();

    const ownerNotification = await prisma.notification.findFirst({
      where: { type: 'TASK_STATUS_CHANGED', workspaceId: wsId, userId: { not: creatorAId } },
    });
    expect(ownerNotification).not.toBeNull();
  });

  it('member đổi trạng thái việc người khác → 403', async () => {
    const task = await createTask({ assigneeId: creatorAId });

    const res = await updateStatus(task.id, 'IN_PROGRESS', creatorBToken);

    expect(res.status).toBe(403);
  });

  it('đổi trạng thái việc chưa giao → 409', async () => {
    const task = await createTask();

    const res = await updateStatus(task.id, 'IN_PROGRESS');

    expect(res.status).toBe(409);
  });

  it('việc CANCELLED không còn trên board', async () => {
    const task = await createTask({ assigneeId: creatorAId });

    const cancel = await updateStatus(task.id, 'CANCELLED');
    expect(cancel.status).toBe(200);

    const board = await getBoard();
    const allIds = [
      ...board.body.data.unassigned,
      ...board.body.data.todo,
      ...board.body.data.inProgress,
      ...board.body.data.done,
    ].map((item: { id: string }) => item.id);
    expect(allIds).not.toContain(task.id);
  });

  it('Owner đổi trạng thái → người nhận nhận thông báo', async () => {
    const task = await createTask({ assigneeId: creatorAId });

    const res = await updateStatus(task.id, 'DONE', ownerToken);

    expect(res.status).toBe(200);
    const notification = await prisma.notification.findFirst({
      where: { userId: creatorAId, type: 'TASK_STATUS_CHANGED' },
    });
    expect(notification).not.toBeNull();
  });
});
