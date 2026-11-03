import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';

const password = 'password123';

describe('Hồ sơ cá nhân — liên kết Facebook/Threads', () => {
  const stamp = Date.now();
  const owner = { email: `test_social_${stamp}@marka.vn`, name: 'Social Profile' };
  const facebookUrl = 'https://facebook.com/nguyenvana';
  const threadsUrl = 'https://www.threads.net/@nguyenvana';

  let token = '';
  let userId = '';
  let workspaceId = '';

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: owner.email } });

    const res = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    token = res.body.data.accessToken;
    userId = res.body.data.user.id;
    workspaceId = res.body.data.user.workspaces[0].id;
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('lưu và trả về link Facebook/Threads khi cập nhật hồ sơ', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(auth())
      .send({ facebookUrl, threadsUrl });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ facebookUrl, threadsUrl });

    const me = await request(app).get('/api/v1/users/me').set(auth());
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ facebookUrl, threadsUrl });
  });

  it('cho phép xoá link bằng null', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(auth())
      .send({ facebookUrl: null, threadsUrl: null });

    expect(res.status).toBe(200);
    expect(res.body.data.facebookUrl).toBeNull();
    expect(res.body.data.threadsUrl).toBeNull();
  });

  it('từ chối URL không hợp lệ (422)', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(auth())
      .send({ facebookUrl: 'khong-phai-url' });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('facebookUrl');
  });

  it('từ chối URL không dùng http/https (422)', async () => {
    const invalidUrls = [
      { field: 'facebookUrl', value: 'javascript:alert(1)' },
      { field: 'threadsUrl', value: 'data:text/html,<script>alert(1)</script>' },
      { field: 'facebookUrl', value: 'ftp://facebook.com/nguyenvana' },
    ];

    for (const { field, value } of invalidUrls) {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set(auth())
        .send({ [field]: value });

      expect(res.status, `${field}: ${value}`).toBe(422);
      expect(res.body.errors[0].field).toBe(field);
    }
  });

  it('admin thấy link liên hệ trong danh sách người dùng', async () => {
    await request(app).patch('/api/v1/users/me').set(auth()).send({ facebookUrl, threadsUrl });
    await prisma.user.update({ where: { id: userId }, data: { systemRole: 'SYSTEM_ADMIN' } });

    const res = await request(app)
      .get(`/api/v1/admin/users?search=${encodeURIComponent(owner.email)}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.users[0]).toMatchObject({ facebookUrl, threadsUrl });
  });
});
