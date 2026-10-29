import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import taskRepository from '../../../src/modules/task/task.repository.js';

const password = 'password123';

describe('Task board (UC42, UC43)', () => {
  const stamp = Date.now();
  const owner = { email: `test_task_owner_${stamp}@marka.vn`, name: 'Owner Task' };
  const creatorA = { email: `test_task_creator_a_${stamp}@marka.vn`, name: 'Creator Task A' };
  const creatorB = { email: `test_task_creator_b_${stamp}@marka.vn`, name: 'Creator Task B' };

  let ownerToken = '';
  let ownerId = '';
  let wsId = '';
  let creatorAToken = '';
  let creatorAId = '';
  let creatorAOwnWorkspaceId = '';
  let creatorBId = '';
  let creatorBOwnWorkspaceId = '';

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

  const createTask = async (
    token: string,
    body: Record<string, unknown>
  ) =>
    request(app)
      .post(`/api/v1/workspaces/${wsId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const getBoard = async (token: string, query = '') =>
    request(app)
      .get(`/api/v1/workspaces/${wsId}/tasks/board${query}`)
      .set('Authorization', `Bearer ${token}`);

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
    creatorBId = b.userId;
    creatorBOwnWorkspaceId = b.defaultWorkspaceId;
  });

  beforeEach(async () => {
    await prisma.task.deleteMany({ where: { workspaceId: wsId } });
    await prisma.notification.deleteMany({ where: { workspaceId: wsId } });
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

  it('Owner tạo việc không giao ai → 201, priority mặc định 3, nằm cột Chưa giao', async () => {
    const res = await createTask(ownerToken, { title: 'Viết brief chiến dịch' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('TODO');
    expect(res.body.data.priority).toBe(3);
    expect(res.body.data.assignee).toBeNull();

    const board = await getBoard(ownerToken);
    expect(board.status).toBe(200);
    expect(board.body.data.unassigned.map((task: { id: string }) => task.id)).toContain(
      res.body.data.id
    );
    expect(board.body.data.counts.unassigned).toBe(1);

    const audit = await prisma.auditLog.findFirst({
      where: { workspaceId: wsId, action: 'TASK_CREATED' },
    });
    expect(audit).not.toBeNull();
  });

  it('tạo việc có người nhận → notification TASK_ASSIGNED cho người nhận', async () => {
    const res = await createTask(ownerToken, {
      title: 'Việc giao ngay',
      assigneeId: creatorAId,
      priority: 2,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.assignee.id).toBe(creatorAId);
    expect(res.body.data.assignedAt).not.toBeNull();

    const count = await prisma.notification.count({
      where: { userId: creatorAId, type: 'TASK_ASSIGNED' },
    });
    expect(count).toBe(1);
  });

  it('priority ngoài 1–5 → 422', async () => {
    const high = await createTask(ownerToken, { title: 'Việc sai ưu tiên', priority: 6 });
    const low = await createTask(ownerToken, { title: 'Việc sai ưu tiên', priority: 0 });

    expect(high.status).toBe(422);
    expect(low.status).toBe(422);
  });

  it('thành viên tạo việc → 403', async () => {
    const res = await createTask(creatorAToken, { title: 'Việc của member' });
    expect(res.status).toBe(403);
  });

  it('member chỉ thấy việc của mình, không có cột Chưa giao', async () => {
    await prisma.task.create({
      data: { workspaceId: wsId, title: 'Việc của A', assigneeId: creatorAId, priority: 1 },
    });
    await prisma.task.create({ data: { workspaceId: wsId, title: 'Việc chưa giao' } });
    await prisma.task.create({
      data: { workspaceId: wsId, title: 'Việc của B', assigneeId: creatorBId },
    });

    const res = await getBoard(creatorAToken);

    expect(res.status).toBe(200);
    expect(res.body.data.unassigned).toEqual([]);
    expect(res.body.data.counts.unassigned).toBe(0);
    expect(res.body.data.todo).toHaveLength(1);
    expect(res.body.data.todo[0].assignee.id).toBe(creatorAId);
  });

  it('sắp xếp ưu tiên tăng dần rồi hạn chót, null cuối', async () => {
    const dueTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const p5 = await prisma.task.create({
      data: { workspaceId: wsId, title: 'P5', priority: 5 },
    });
    const p3NoDue = await prisma.task.create({
      data: { workspaceId: wsId, title: 'P3 không hạn', priority: 3 },
    });
    const p3Due = await prisma.task.create({
      data: { workspaceId: wsId, title: 'P3 có hạn', priority: 3, dueAt: dueTomorrow },
    });
    const p1 = await prisma.task.create({
      data: { workspaceId: wsId, title: 'P1', priority: 1 },
    });

    const res = await getBoard(ownerToken);
    const ids = res.body.data.unassigned.map((task: { id: string }) => task.id);

    expect(ids).toEqual([p1.id, p3Due.id, p3NoDue.id, p5.id]);
  });

  it('lọc mine, priority và search đúng', async () => {
    await prisma.task.create({
      data: {
        workspaceId: wsId,
        title: 'Brief owner',
        assigneeId: ownerId,
        assignedById: ownerId,
        assignedAt: new Date(),
        priority: 1,
      },
    });
    await prisma.task.create({
      data: {
        workspaceId: wsId,
        title: 'Brief A',
        assigneeId: creatorAId,
        assignedById: ownerId,
        assignedAt: new Date(),
        priority: 1,
      },
    });
    await prisma.task.create({
      data: {
        workspaceId: wsId,
        title: 'Brief B',
        assigneeId: creatorBId,
        assignedById: ownerId,
        assignedAt: new Date(),
        priority: 5,
      },
    });

    const ownerMine = await getBoard(ownerToken, '?mine=true&priority=1&search=Brief');
    expect(ownerMine.body.data.todo.map((task: { title: string }) => task.title)).toEqual([
      'Brief owner',
    ]);

    const memberFiltered = await getBoard(creatorAToken, '?priority=1&search=Brief');
    expect(memberFiltered.body.data.todo.map((task: { title: string }) => task.title)).toEqual([
      'Brief A',
    ]);

    const ownerAll = await getBoard(ownerToken);
    expect(ownerAll.body.data.todo).toHaveLength(3);
    expect(ownerAll.body.data.unassigned).toHaveLength(0);
  });

  it('mỗi cột tối đa 100 card nhưng counts là số thật', async () => {
    await prisma.task.createMany({
      data: Array.from({ length: 101 }, (_, index) => ({
        workspaceId: wsId,
        title: `Việc ${index + 1}`,
      })),
    });

    const board = await taskRepository.findBoardTasks({
      workspaceId: wsId,
      includeUnassigned: true,
      limit: 100,
    });
    const counts = await taskRepository.countBoardTasks({
      workspaceId: wsId,
      includeUnassigned: true,
    });

    expect(board.unassigned).toHaveLength(100);
    expect(counts.unassigned).toBe(101);
  });
});
