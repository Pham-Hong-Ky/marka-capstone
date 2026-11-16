import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { mailerClient } from '../../../src/utils/mailer.client.js';

const password = 'password123';
const FACEBOOK_URL = 'https://facebook.com/tester.request';
const THREADS_URL = 'https://www.threads.net/@tester.request';

describe('Yêu cầu thêm Tester — người dùng gửi cho admin', () => {
  const stamp = Date.now();
  const user = { email: `test_tester_req_user_${stamp}@marka.vn`, name: 'Tester Request User' };
  const admin = { email: `test_tester_req_admin_${stamp}@marka.vn`, name: 'Tester Request Admin' };

  let userId = '';
  let userToken = '';
  const sendEmailSpy = vi.spyOn(mailerClient, 'sendEmail');

  const sendRequest = (platform: string) =>
    request(app)
      .post('/api/v1/users/me/tester-requests')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ platform });

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [user.email, admin.email] } } });

    const userRes = await request(app).post('/api/v1/auth/register').send({ ...user, password });
    userId = userRes.body.data.user.id;
    userToken = userRes.body.data.accessToken;

    await request(app).post('/api/v1/auth/register').send({ ...admin, password });
    await prisma.user.update({ where: { email: admin.email }, data: { systemRole: 'SYSTEM_ADMIN' } });
  });

  afterAll(async () => {
    sendEmailSpy.mockRestore();
    await prisma.user.deleteMany({ where: { email: { in: [user.email, admin.email] } } });
  });

  it('chưa đăng nhập bị từ chối', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/tester-requests')
      .send({ platform: 'THREADS' });

    expect(res.status).toBe(401);
  });

  it('platform không hợp lệ trả 422', async () => {
    const res = await sendRequest('TIKTOK');

    expect(res.status).toBe(422);
  });

  it('chưa điền link nền tảng thì bị từ chối và không gửi email', async () => {
    sendEmailSpy.mockClear();

    const res = await sendRequest('THREADS');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Threads');
    expect(sendEmailSpy).not.toHaveBeenCalled();
  });

  it('đã điền link thì gửi email cho admin và ghi audit', async () => {
    await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ threadsUrl: THREADS_URL, facebookUrl: FACEBOOK_URL });
    sendEmailSpy.mockClear();

    const res = await sendRequest('THREADS');

    expect(res.status).toBe(200);

    const recipients = sendEmailSpy.mock.calls.map(([input]) => input.to);
    expect(recipients).toContain(admin.email);
    const adminMail = sendEmailSpy.mock.calls.find(([input]) => input.to === admin.email)?.[0];
    expect(adminMail?.html).toContain(THREADS_URL);
    expect(adminMail?.html).toContain(user.email);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'USER_TESTER_REQUESTED', actorId: userId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.metadata).toMatchObject({ platform: 'THREADS', link: THREADS_URL });
  });

  it('gửi email thất bại thì trả 502 và không ghi audit', async () => {
    const before = await prisma.auditLog.count({
      where: { action: 'USER_TESTER_REQUESTED', actorId: userId },
    });
    sendEmailSpy.mockResolvedValue(false);

    const res = await sendRequest('FACEBOOK');
    sendEmailSpy.mockRestore();

    expect(res.status).toBe(502);
    const after = await prisma.auditLog.count({
      where: { action: 'USER_TESTER_REQUESTED', actorId: userId },
    });
    expect(after).toBe(before);
  });
});
