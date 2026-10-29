import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';

const password = 'password123';

describe('Gỡ giao việc khi thành viên rời workspace', () => {
  const stamp = Date.now();
  const owner = { email: `test_member_removal_owner_${stamp}@marka.vn`, name: 'Owner Removal' };
  const members = ['removed', 'left', 'deleted'].map((key) => ({
    email: `test_member_removal_${key}_${stamp}@marka.vn`,
    name: `Member ${key}`,
  }));
  const allEmails = [owner.email, ...members.map((member) => member.email)];

  let ownerToken = '';
  let ownerId = '';
  let wsId = '';
  const memberIds: string[] = [];
  const memberTokens: string[] = [];
  const memberWorkspaceIds: string[] = [];
  const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const seedWork = async (assigneeId: string) => {
    const [open, inProgress, done] = await Promise.all(
      (['TODO', 'IN_PROGRESS', 'DONE'] as const).map((status) =>
        prisma.task.create({
          data: {
            workspaceId: wsId,
            title: `Việc ${status}`,
            status,
            assigneeId,
            assignedById: ownerId,
            assignedAt: new Date(),
            dueAt,
            createdById: ownerId,
          },
        })
      )
    );
    const post = await prisma.post.create({
      data: {
        workspaceId: wsId,
        title: 'Bài được giao',
        content: { type: 'doc', content: [] },
        assigneeId,
        assignedById: ownerId,
        taskStatus: 'IN_PROGRESS',
        createdById: ownerId,
      },
    });
    return { open, inProgress, done, post };
  };

  const expectUnassigned = async (work: Awaited<ReturnType<typeof seedWork>>, assigneeId: string) => {
    const tasks = await prisma.task.findMany({
      where: { id: { in: [work.open.id, work.inProgress.id, work.done.id] } },
    });
    const byId = new Map(tasks.map((task) => [task.id, task]));

    for (const id of [work.open.id, work.inProgress.id]) {
      expect(byId.get(id)).toMatchObject({ assigneeId: null, status: 'TODO' });
      expect(byId.get(id)?.dueAt?.getTime()).toBe(dueAt.getTime());
    }
    expect(byId.get(work.done.id)).toMatchObject({ assigneeId, status: 'DONE' });

    const post = await prisma.post.findUnique({ where: { id: work.post.id } });
    expect(post).toMatchObject({ assigneeId: null, taskStatus: 'TODO' });
  };

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: allEmails } } });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
    ownerId = ownerRes.body.data.user.id;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    for (const member of members) {
      const res = await request(app).post('/api/v1/auth/register').send({ ...member, password });
      memberIds.push(res.body.data.user.id);
      memberTokens.push(res.body.data.accessToken);
      memberWorkspaceIds.push(res.body.data.user.workspaces[0].id);
      await prisma.workspaceMember.create({
        data: { workspaceId: wsId, userId: res.body.data.user.id, role: 'CONTENT_CREATOR' },
      });
    }
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: [wsId, ...memberWorkspaceIds] } } });
    await prisma.user.deleteMany({ where: { email: { in: allEmails } } });
  });

  it('Owner xoá thành viên → việc đang mở về "chưa giao", giữ hạn chót và ghi audit', async () => {
    const work = await seedWork(memberIds[0]);

    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/members/${memberIds[0]}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    await expectUnassigned(work, memberIds[0]);

    const audit = await prisma.auditLog.findFirst({
      where: { workspaceId: wsId, action: 'MEMBER_REMOVED', targetId: memberIds[0] },
    });
    expect(audit?.metadata).toMatchObject({ unassignedTasks: 2 });
  });

  it('Thành viên tự rời workspace → việc đang mở về "chưa giao"', async () => {
    const work = await seedWork(memberIds[1]);

    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/members/me`)
      .set('Authorization', `Bearer ${memberTokens[1]}`);

    expect(res.status).toBe(200);
    await expectUnassigned(work, memberIds[1]);
  });

  it('Xoá tài khoản → việc đang mở về "chưa giao"', async () => {
    const work = await seedWork(memberIds[2]);
    // Workspace mặc định của thành viên phải xoá trước, nếu không họ là Owner duy nhất.
    await prisma.workspace.update({
      where: { id: memberWorkspaceIds[2] },
      data: { deletedAt: new Date() },
    });

    const res = await request(app)
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${memberTokens[2]}`)
      .send({ password, confirm: 'XOA' });

    expect(res.status).toBe(200);
    await expectUnassigned(work, memberIds[2]);
  });
});
