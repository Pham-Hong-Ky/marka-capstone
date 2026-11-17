import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { MAX_VERSIONS_PER_POST } from '../../../src/modules/post-version/post-version.repository.js';

const password = 'password123';

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('Post version — lịch sử phiên bản bài viết', () => {
  const stamp = Date.now();
  const owner = { email: `test_pver_owner_${stamp}@marka.vn`, name: 'Owner Version' };
  const outsider = { email: `test_pver_outsider_${stamp}@marka.vn`, name: 'Outsider Version' };

  let ownerToken = '';
  let outsiderToken = '';
  let wsId = '';
  let outsiderWsId = '';
  let postId = '';

  const postsUrl = () => `/api/v1/workspaces/${wsId}/posts`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const savePost = (title: string, text: string) =>
    request(app)
      .patch(`${postsUrl()}/${postId}`)
      .set(auth(ownerToken))
      .send({ title, content: doc(text) });

  const listVersions = (token = ownerToken, workspaceId = wsId) =>
    request(app)
      .get(`/api/v1/workspaces/${workspaceId}/posts/${postId}/versions`)
      .set(auth(token));

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, outsider.email] } } });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const outsiderRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...outsider, password });
    outsiderToken = outsiderRes.body.data.accessToken;
    outsiderWsId = outsiderRes.body.data.user.workspaces[0].id;

    const created = await request(app)
      .post(postsUrl())
      .set(auth(ownerToken))
      .send({ title: 'Bản gốc', content: doc('nội dung gốc') });
    postId = created.body.data.id;
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: [wsId, outsiderWsId] } } });
    await prisma.user.deleteMany({ where: { email: { in: [owner.email, outsider.email] } } });
  });

  it('tạo bài mới sinh ngay phiên bản 1', async () => {
    const res = await listVersions();

    expect(res.status).toBe(200);
    expect(res.body.data.versions).toHaveLength(1);
    expect(res.body.data.versions[0]).toMatchObject({
      version: 1,
      title: 'Bản gốc',
      source: 'MANUAL',
    });
    expect(res.body.data.versions[0].content).toBeUndefined();
  });

  it('mỗi lần lưu có thay đổi tạo thêm một phiên bản, mới nhất đứng đầu', async () => {
    await savePost('Bản hai', 'nội dung hai');
    await savePost('Bản ba', 'nội dung ba');

    const res = await listVersions();

    expect(res.body.data.versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);
    expect(res.body.data.versions[0].title).toBe('Bản ba');
  });

  it('lưu lại đúng nội dung hiện tại không sinh phiên bản mới', async () => {
    await savePost('Bản ba', 'nội dung ba');

    const res = await listVersions();

    expect(res.body.data.versions).toHaveLength(3);
  });

  it('xem chi tiết một phiên bản trả đủ nội dung', async () => {
    const res = await request(app)
      .get(`${postsUrl()}/${postId}/versions/2`)
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Bản hai');
    expect(res.body.data.content).toEqual(doc('nội dung hai'));
  });

  it('phiên bản không tồn tại trả 404, số phiên bản sai trả 422', async () => {
    const missing = await request(app)
      .get(`${postsUrl()}/${postId}/versions/999`)
      .set(auth(ownerToken));
    const invalid = await request(app)
      .get(`${postsUrl()}/${postId}/versions/0`)
      .set(auth(ownerToken));

    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(422);
  });

  it('khôi phục phiên bản cũ ghi đè bài và tạo phiên bản RESTORE mới, không xoá lịch sử', async () => {
    const res = await request(app)
      .post(`${postsUrl()}/${postId}/versions/1/restore`)
      .set(auth(ownerToken));

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Bản gốc');
    expect(res.body.data.content).toEqual(doc('nội dung gốc'));

    const versions = (await listVersions()).body.data.versions;
    expect(versions).toHaveLength(4);
    expect(versions[0]).toMatchObject({ version: 4, source: 'RESTORE', title: 'Bản gốc' });
  });

  it('người ngoài workspace không đọc hay khôi phục được phiên bản', async () => {
    const list = await listVersions(outsiderToken, outsiderWsId);
    const restore = await request(app)
      .post(`/api/v1/workspaces/${outsiderWsId}/posts/${postId}/versions/1/restore`)
      .set(auth(outsiderToken));
    const forbidden = await listVersions(outsiderToken, wsId);

    expect(list.status).toBe(404);
    expect(restore.status).toBe(404);
    expect(forbidden.status).toBe(403);
  });

  it(`chỉ giữ ${MAX_VERSIONS_PER_POST} phiên bản gần nhất, bản cũ nhất bị xoá`, async () => {
    for (let i = 0; i < MAX_VERSIONS_PER_POST; i += 1) {
      await savePost(`Lần lưu ${i}`, `nội dung ${i}`);
    }

    const versions = (await listVersions()).body.data.versions as Array<{ version: number }>;

    expect(versions).toHaveLength(MAX_VERSIONS_PER_POST);
    expect(versions[0].version).toBe(4 + MAX_VERSIONS_PER_POST);
    expect(versions[versions.length - 1].version).toBe(5);
  });

  it('bài đã gửi duyệt không được khôi phục phiên bản (409)', async () => {
    await request(app).post(`${postsUrl()}/${postId}/submit`).set(auth(ownerToken));

    const res = await request(app)
      .post(`${postsUrl()}/${postId}/versions/10/restore`)
      .set(auth(ownerToken));

    expect(res.status).toBe(409);
  });
});
