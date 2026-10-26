import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma, { basePrisma } from '../../../src/config/db.js';
import { cloudinaryClient } from '../../../src/utils/cloudinary.client.js';

vi.mock('../../../src/utils/cloudinary.client.js', () => ({
  cloudinaryClient: { uploadImageBuffer: vi.fn() },
}));

const password = 'password123';

describe('Hồ sơ cá nhân — avatar, phiên đăng nhập, xoá tài khoản', () => {
  const stamp = Date.now();
  const owner = { email: `test_profile_owner_${stamp}@marka.vn`, name: 'Owner Profile' };
  const partner = { email: `test_profile_partner_${stamp}@marka.vn`, name: 'Partner Profile' };

  let ownerId = '';
  let ownerToken = '';
  let ownerWorkspaceId = '';

  const login = async () =>
    request(app).post('/api/v1/auth/login').send({ email: owner.email, password });

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, partner.email] } } });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerId = ownerRes.body.data.user.id;
    ownerToken = ownerRes.body.data.accessToken;
    ownerWorkspaceId = ownerRes.body.data.user.workspaces[0].id;

    const partnerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...partner, password });

    await prisma.workspaceMember.create({
      data: { workspaceId: ownerWorkspaceId, userId: partnerRes.body.data.user.id, role: 'OWNER' },
    });
  });

  it('tải ảnh đại diện lên Cloudinary và lưu URL', async () => {
    vi.mocked(cloudinaryClient.uploadImageBuffer).mockResolvedValue(
      'https://res.cloudinary.com/demo/image/upload/avatar.png'
    );

    const res = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', Buffer.from('fake-image'), { filename: 'avatar.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.data.avatar).toBe('https://res.cloudinary.com/demo/image/upload/avatar.png');
    expect(cloudinaryClient.uploadImageBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      `marka/users/${ownerId}/avatar`
    );
  });

  it('từ chối khi không có file ảnh', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
  });

  it('đăng xuất mọi thiết bị làm token cũ mất hiệu lực', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/logout-all')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);

    const me = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(me.status).toBe(401);

    const relogin = await login();
    ownerToken = relogin.body.data.accessToken;
    expect(relogin.status).toBe(200);
  });

  it('không cho xoá tài khoản khi còn là Owner duy nhất của workspace', async () => {
    await prisma.workspaceMember.updateMany({
      where: { workspaceId: ownerWorkspaceId, userId: { not: ownerId } },
      data: { role: 'CONTENT_CREATOR' },
    });

    const res = await request(app)
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ password, confirm: 'XOA' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Owner duy nhất');
  });

  it('từ chối xoá khi sai mật khẩu', async () => {
    await prisma.workspaceMember.updateMany({
      where: { workspaceId: ownerWorkspaceId, userId: { not: ownerId } },
      data: { role: 'OWNER' },
    });

    const res = await request(app)
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ password: 'sai-mat-khau', confirm: 'XOA' });

    expect(res.status).toBe(401);
  });

  it('xoá mềm tài khoản, chặn đăng nhập và giữ email không cho đăng ký lại', async () => {
    const res = await request(app)
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ password, confirm: 'XOA' });

    expect(res.status).toBe(200);

    const stored = await basePrisma.user.findUnique({ where: { id: ownerId } });
    expect(stored?.deletedAt).toBeInstanceOf(Date);

    expect((await login()).status).toBe(401);

    const me = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(me.status).toBe(401);

    const reRegister = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...owner, password });
    expect(reRegister.status).toBe(409);
    expect(reRegister.body.message).toContain('đã xoá');
  });
});
