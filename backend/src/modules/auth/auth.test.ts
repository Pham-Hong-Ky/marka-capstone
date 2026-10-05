import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import app from '../../app.js';
import prisma from '../../config/db.js';
import { requireAuth, requireRoles, requireWorkspaceRole } from '../../middlewares/auth.js';

describe('Kiểm thử Module Authentication & Phân quyền (RBAC)', () => {
  const testUser = {
    email: `test_auth_ts_${Date.now()}@marka.vn`,
    password: 'password123',
    name: 'Nguyễn Văn TypeScript',
  };

  let accessToken = '';
  let refreshToken = '';
  let workspaceId = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  });

  describe('UC01 — Đăng ký tài khoản (POST /api/v1/auth/register)', () => {
    it('Báo lỗi 422 nếu dữ liệu đầu vào không hợp lệ', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: '123',
          name: '',
        });

      expect(res.status).toBe(422);
      expect(res.body.status).toBe('fail');
      expect(res.body.errors).toBeInstanceOf(Array);
    });

    it('Đăng ký thành công tài khoản mới, tự động đăng nhập (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.name).toBe(testUser.name);
      expect(res.body.data.user.workspaces).toBeInstanceOf(Array);
      expect(res.body.data.user.workspaces[0].role).toBe('OWNER');

      workspaceId = res.body.data.user.workspaces[0].id;

      // Auto-login: refreshToken nằm trong HttpOnly Cookie, không lộ trong JSON body
      expect(res.body.data.refreshToken).toBeUndefined();
      const cookies = (res.headers['set-cookie'] as unknown) as string[] | undefined;
      expect(cookies?.some((c: string) => c.includes('refreshToken='))).toBe(true);
    });

    it('Báo lỗi 409 Conflict nếu email đã tồn tại', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toContain('đã được đăng ký');
    });
  });

  describe('UC02 — Đăng nhập (POST /api/v1/auth/login)', () => {
    it('Báo lỗi 401 nếu email không tồn tại', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@marka.vn',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Email hoặc mật khẩu không chính xác');
    });

    it('Báo lỗi 401 nếu sai mật khẩu', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrong_password',
        });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Email hoặc mật khẩu không chính xác');
    });

    it('Đăng nhập thành công, ẩn refreshToken khỏi JSON và set HttpOnly Cookie (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.refreshToken).toBeUndefined(); // An toàn: đã ẩn khỏi JSON body

      accessToken = res.body.data.accessToken;

      // Lấy refresh token từ HttpOnly Cookie
      const cookies = (res.headers['set-cookie'] as unknown) as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies?.some((c: string) => c.includes('refreshToken='))).toBe(true);

      const refreshCookie = cookies?.find((c: string) => c.includes('refreshToken='));
      refreshToken = refreshCookie ? refreshCookie.split(';')[0].split('=')[1] : '';
    });
  });

  describe('Kiểm thử phân quyền RBAC (ADMIN, OWNER, CONTENT_CREATOR)', () => {
    const testApp = express();
    testApp.use(express.json());

    testApp.get('/test/admin', requireAuth, requireRoles('SYSTEM_ADMIN'), (_req, res) => {
      res.json({ message: 'Admin access granted' });
    });

    testApp.get('/test/workspace/owner', requireAuth, requireWorkspaceRole('OWNER'), (_req, res) => {
      res.json({ message: 'Owner access granted' });
    });

    testApp.get('/test/workspace/creator', requireAuth, requireWorkspaceRole('CONTENT_CREATOR'), (_req, res) => {
      res.json({ message: 'Creator access granted' });
    });

    it('Chặn người dùng thường truy cập API của SYSTEM_ADMIN (403 Forbidden)', async () => {
      const res = await request(testApp)
        .get('/test/admin')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });

    it('Cho phép OWNER truy cập tài nguyên của Workspace với header x-workspace-id', async () => {
      const res = await request(testApp)
        .get('/test/workspace/owner')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Owner access granted');
    });

    it('Từ chối nếu người dùng là OWNER nhưng API yêu cầu role CONTENT_CREATOR riêng', async () => {
      const res = await request(testApp)
        .get('/test/workspace/creator')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId);

      expect(res.status).toBe(403);
    });
  });

  describe('UC33 — Làm mới token qua Cookie (POST /api/v1/auth/refresh-token)', () => {
    it('Báo lỗi 401 nếu refresh token không hợp lệ', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: 'invalid_token' });

      expect(res.status).toBe(401);
    });

    it('Cấp lại access token mới qua HttpOnly Cookie thành công', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', [`refreshToken=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.refreshToken).toBeUndefined(); // An toàn

      accessToken = res.body.data.accessToken;

      const newCookies = (res.headers['set-cookie'] as unknown) as string[] | undefined;
      const newRefreshCookie = newCookies?.find((c: string) => c.includes('refreshToken='));
      if (newRefreshCookie) {
        refreshToken = newRefreshCookie.split(';')[0].split('=')[1];
      }
    });
  });

  describe('UC03 — Đăng xuất (POST /api/v1/auth/logout)', () => {
    it('Đăng xuất thành công, xóa cookie và vô hiệu hóa token cũ (200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Đăng xuất thành công');

      const meRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes.status).toBe(401);
    });
  });
});
