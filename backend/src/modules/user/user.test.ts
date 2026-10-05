import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import prisma from '../../config/db.js';
import { generateAccessToken } from '../../utils/jwt.js';
import { hashPassword } from './user.service.js';

describe('Kiểm thử Module User (Profile & Password)', () => {
  const testUser = {
    email: `test_user_mod_${Date.now()}@marka.vn`,
    password: 'password123',
    name: 'Nguyễn Văn User Test',
  };

  let userId = '';
  let token = '';

  beforeAll(async () => {
    const passwordHash = await hashPassword(testUser.password);
    const created = await prisma.user.create({
      data: {
        email: testUser.email,
        passwordHash,
        name: testUser.name,
      },
    });
    userId = created.id;
    token = generateAccessToken({
      id: created.id,
      email: created.email,
      systemRole: created.systemRole,
      tokenVersion: created.tokenVersion,
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  });

  it('GET /api/v1/users/me - Lấy thông tin tài khoản hiện tại', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.email).toBe(testUser.email);
    expect(res.body.data.name).toBe(testUser.name);
  });

  it('PATCH /api/v1/users/me - Cập nhật thông tin profile', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nguyễn Văn Đã Đổi Tên' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Nguyễn Văn Đã Đổi Tên');
  });

  it('PATCH /api/v1/users/me/password - Báo lỗi nếu sai mật khẩu cũ', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        oldPassword: 'wrong_password',
        newPassword: 'newPassword456',
      });

    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/users/me/password - Đổi mật khẩu thành công', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        oldPassword: testUser.password,
        newPassword: 'newPassword456',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Đổi mật khẩu thành công');
  });
});
