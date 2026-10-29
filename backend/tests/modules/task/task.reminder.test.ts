import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { runTaskReminders } from '../../../src/modules/task/task.reminder.js';

const password = 'password123';

const NOW = new Date('2026-11-10T01:00:00.000Z'); // 08:00 giờ VN
const TOMORROW = new Date('2026-11-11T10:00:00.000Z'); // 17:00 VN ngày mai
const OVERDUE = new Date('2026-11-09T10:00:00.000Z'); // 17:00 VN hôm trước
const DAY_AFTER = new Date('2026-11-12T10:00:00.000Z');
const TODAY_LATER = new Date('2026-11-10T03:00:00.000Z'); // 10:00 VN hôm nay

describe('Task reminders', () => {
  const stamp = Date.now();
  const owner = { email: `test_task_remind_owner_${stamp}@marka.vn`, name: 'Owner Remind' };
  const creatorA = { email: `test_task_remind_a_${stamp}@marka.vn`, name: 'Creator Remind A' };

  let wsId = '';
  let ownerId = '';
  let creatorAId = '';
  let creatorAOwnWorkspaceId = '';

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

    return { defaultWorkspaceId, userId: registerRes.body.data.user.id as string };
  };

  const seedTask = async (data: Record<string, unknown>) =>
    prisma.task.create({
      data: {
        workspaceId: wsId,
        title: 'Việc nhắc hạn',
        assigneeId: creatorAId,
        ...data,
      },
    });

  const countNotifications = async (type: string, userId = creatorAId) =>
    prisma.notification.count({ where: { userId, type, workspaceId: wsId } });

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, creatorA.email] } } });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    const ownerToken = ownerRes.body.data.accessToken;
    ownerId = ownerRes.body.data.user.id;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const a = await joinWorkspace(ownerToken, wsId, creatorA);
    creatorAId = a.userId;
    creatorAOwnWorkspaceId = a.defaultWorkspaceId;
  });

  beforeEach(async () => {
    await prisma.task.deleteMany({ where: { workspaceId: wsId } });
    await prisma.notification.deleteMany({ where: { workspaceId: wsId } });
  });

  afterAll(async () => {
    const workspaceIds = [wsId, creatorAOwnWorkspaceId].filter(Boolean);
    await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, creatorA.email] } } });
  });

  it('gửi TASK_DUE_SOON cho việc hạn ngày mai và không trùng khi chạy lại', async () => {
    await seedTask({ dueAt: TOMORROW });

    const first = await runTaskReminders(NOW, wsId);
    expect(first).toMatchObject({ skipped: false, dueSoon: 1, overdue: 0 });
    expect(await countNotifications('TASK_DUE_SOON')).toBe(1);

    const second = await runTaskReminders(NOW, wsId);
    expect(second).toMatchObject({ skipped: false, dueSoon: 0, overdue: 0 });
    expect(await countNotifications('TASK_DUE_SOON')).toBe(1);
  });

  it('gửi TASK_OVERDUE một lần cho việc quá hạn', async () => {
    await seedTask({ dueAt: OVERDUE });

    const first = await runTaskReminders(NOW, wsId);
    expect(first).toMatchObject({ skipped: false, dueSoon: 0, overdue: 1 });
    expect(await countNotifications('TASK_OVERDUE')).toBe(1);

    await runTaskReminders(NOW, wsId);
    expect(await countNotifications('TASK_OVERDUE')).toBe(1);
  });

  it('bỏ qua việc DONE, CANCELLED và chưa giao', async () => {
    await seedTask({ dueAt: TOMORROW, status: 'DONE' });
    await seedTask({ dueAt: TOMORROW, status: 'CANCELLED' });
    await prisma.task.create({
      data: { workspaceId: wsId, title: 'Chưa giao', dueAt: TOMORROW },
    });

    const result = await runTaskReminders(NOW, wsId);

    expect(result).toMatchObject({ skipped: false, dueSoon: 0, overdue: 0 });
  });

  it('không chạy ngoài 08:00 giờ VN', async () => {
    await seedTask({ dueAt: TOMORROW });
    const nineAm = new Date('2026-11-10T02:00:00.000Z'); // 09:00 VN

    const result = await runTaskReminders(nineAm, wsId);

    expect(result).toMatchObject({ skipped: true, dueSoon: 0, overdue: 0 });
    expect(await countNotifications('TASK_DUE_SOON')).toBe(0);
  });

  it('không nhắc việc hạn ngày kia và không coi việc hạn hôm nay là quá hạn', async () => {
    await seedTask({ dueAt: DAY_AFTER });
    await seedTask({ dueAt: TODAY_LATER });

    const result = await runTaskReminders(NOW, wsId);

    expect(result).toMatchObject({ skipped: false, dueSoon: 0, overdue: 0 });
  });

  it('chỉ gửi cho người nhận việc, không gửi Owner', async () => {
    await seedTask({ dueAt: TOMORROW });

    await runTaskReminders(NOW, wsId);

    expect(await countNotifications('TASK_DUE_SOON', creatorAId)).toBe(1);
    expect(await countNotifications('TASK_DUE_SOON', ownerId)).toBe(0);
  });

  it('đổi hạn chót sang mốc mới → nhắc lại với mốc mới', async () => {
    const task = await seedTask({ dueAt: TOMORROW });
    await runTaskReminders(NOW, wsId);
    expect(await countNotifications('TASK_DUE_SOON')).toBe(1);

    await prisma.task.update({
      where: { id: task.id },
      data: { dueAt: new Date('2026-11-11T15:00:00.000Z') },
    });

    const result = await runTaskReminders(NOW, wsId);

    expect(result.dueSoon).toBe(1);
    expect(await countNotifications('TASK_DUE_SOON')).toBe(2);
  });
});
