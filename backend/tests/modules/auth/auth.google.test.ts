import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';

const googlePayload = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    async verifyIdToken() {
      return { getPayload: () => googlePayload.current };
    }
  },
}));

describe('Google login', () => {
  const stamp = Date.now();
  const localEmail = `test_google_local_${stamp}@marka.vn`;
  const newEmail = `test_google_new_${stamp}@marka.vn`;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [localEmail, newEmail] } } });
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: localEmail, password: 'password123', name: 'Local User' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [localEmail, newEmail] } } });
  });

  it('Từ chối email Google chưa xác minh (401), không liên kết tài khoản có sẵn', async () => {
    googlePayload.current = { email: localEmail, email_verified: false, sub: `g-${stamp}` };

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake-token' });

    expect(res.status).toBe(401);
    const user = await prisma.user.findUnique({ where: { email: localEmail } });
    expect(user?.googleId).toBeNull();
  });

  it('Chuẩn hóa email Google về chữ thường khi tìm tài khoản', async () => {
    googlePayload.current = {
      email: localEmail.toUpperCase(),
      email_verified: true,
      sub: `g-${stamp}`,
    };

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake-token' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(localEmail);
  });

  it('Tạo tài khoản mới kèm workspace mặc định', async () => {
    googlePayload.current = {
      email: newEmail,
      email_verified: true,
      name: 'Google New',
      sub: `g-new-${stamp}`,
    };

    const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'fake-token' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.workspaces).toHaveLength(1);
    expect(res.body.data.user.workspaces[0].role).toBe('OWNER');
  });
});
