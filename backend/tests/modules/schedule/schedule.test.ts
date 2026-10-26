import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { encrypt } from '../../../src/utils/encryption.js';
import {
  FacebookTokenExpiredError,
  FacebookTransientError,
  facebookClient,
} from '../../../src/modules/channel/facebook.client.js';
import scheduleService from '../../../src/modules/schedule/schedule.service.js';

const password = 'password123';

const content = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Nội dung bài đăng' }] },
  ],
};

describe('Schedule — đăng bài Facebook', () => {
  const stamp = Date.now();
  const owner = { email: `test_schedule_owner_${stamp}@marka.vn`, name: 'Owner Schedule' };
  const creator = { email: `test_schedule_creator_${stamp}@marka.vn`, name: 'Creator Schedule' };
  const outsider = { email: `test_schedule_outsider_${stamp}@marka.vn`, name: 'Outsider Schedule' };

  let creatorToken = '';
  let outsiderToken = '';
  let wsId = '';
  let outsiderWorkspaceId = '';
  let ownerId = '';
  let channelAId = '';
  let channelBId = '';
  let outsiderChannelId = '';

  const createPost = async (
    status: 'APPROVED' | 'PENDING' | 'FAILED' | 'PUBLISHED' = 'APPROVED',
    media: Array<'IMAGE' | 'VIDEO'> = []
  ) => {
    const post = await prisma.post.create({
      data: {
        workspaceId: wsId,
        title: `Bài ${Date.now()}`,
        content,
        status,
        createdById: ownerId,
      },
    });

    if (media.length > 0) {
      await prisma.mediaAsset.createMany({
        data: media.map((type, index) => ({
          workspaceId: wsId,
          postId: post.id,
          url: `https://res.cloudinary.com/demo/image/upload/${post.id}-${index}.png`,
          type,
          mimeType: 'image/png',
          size: 1024,
          createdById: ownerId,
        })),
      });
    }

    return post.id;
  };

  const createChannel = async (workspaceId: string, pageId: string, name: string) =>
    prisma.channelConnection.create({
      data: {
        workspaceId,
        platform: 'FACEBOOK',
        type: 'REAL',
        name,
        externalAccountId: pageId,
        accessToken: encrypt('page-token') as string,
        status: 'ACTIVE',
      },
    });

  const schedulePayload = (channelIds: string[], scheduledAt?: string | null) => ({
    channelIds,
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
  });

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creator.email, outsider.email] } },
    });

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerId = ownerRes.body.data.user.id;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const creatorRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...creator, password });
    creatorToken = creatorRes.body.data.accessToken;
    await prisma.workspaceMember.create({
      data: { workspaceId: wsId, userId: creatorRes.body.data.user.id, role: 'CONTENT_CREATOR' },
    });

    const outsiderRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...outsider, password });
    outsiderToken = outsiderRes.body.data.accessToken;
    outsiderWorkspaceId = outsiderRes.body.data.user.workspaces[0].id;

    const channelA = await createChannel(wsId, `page-a-${stamp}`, 'Page A');
    const channelB = await createChannel(wsId, `page-b-${stamp}`, 'Page B');
    const outsiderChannel = await createChannel(outsiderWorkspaceId, `page-out-${stamp}`, 'Page Out');
    channelAId = channelA.id;
    channelBId = channelB.id;
    outsiderChannelId = outsiderChannel.id;
  });

  beforeEach(async () => {
    await prisma.scheduledPost.deleteMany({ where: { channel: { workspaceId: wsId } } });
    await prisma.channelConnection.updateMany({
      where: { id: { in: [channelAId, channelBId] } },
      data: { status: 'ACTIVE', accessToken: encrypt('page-token') as string },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({
      where: { id: { in: [wsId, outsiderWorkspaceId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creator.email, outsider.email] } },
    });
  });

  it('Creator tạo lịch cho nhiều Page, bài chuyển SCHEDULED', async () => {
    const postId = await createPost();
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId, channelBId], scheduledAt));

    expect(res.status).toBe(201);
    expect(res.body.data.schedules).toHaveLength(2);
    expect(res.body.data.schedules[0].accessToken).toBeUndefined();

    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(post?.status).toBe('SCHEDULED');

    const schedules = await prisma.scheduledPost.findMany({ where: { postId } });
    expect(schedules).toHaveLength(2);
    expect(schedules.every((schedule) => schedule.status === 'SCHEDULED')).toBe(true);
  });

  it('Đăng ngay tạo lịch scheduledAt null', async () => {
    const postId = await createPost();

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId]));

    expect(res.status).toBe(201);
    expect(res.body.data.schedules[0].scheduledAt).toBeNull();
  });

  it('Bài đăng lỗi được đăng lại trên Page bị lỗi', async () => {
    const postId = await createPost('FAILED');
    const failed = await prisma.scheduledPost.create({
      data: {
        postId,
        channelId: channelAId,
        status: 'FAILED',
        errorMessage: 'mất mạng',
        retryCount: 3,
      },
    });

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId]));

    expect(res.status).toBe(201);
    const schedule = await prisma.scheduledPost.findUnique({ where: { id: failed.id } });
    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(schedule?.status).toBe('SCHEDULED');
    expect(schedule?.retryCount).toBe(0);
    expect(schedule?.errorMessage).toBeNull();
    expect(post?.status).toBe('SCHEDULED');
  });

  it('Bài đã đăng chỉ được đăng thêm Page mới, không đăng trùng Page cũ', async () => {
    const postId = await createPost('PUBLISHED');
    await prisma.scheduledPost.create({
      data: {
        postId,
        channelId: channelAId,
        status: 'PUBLISHED',
        externalPostId: 'page_post',
        publishedAt: new Date(),
      },
    });

    const duplicate = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId]));

    expect(duplicate.status).toBe(409);
    expect((await prisma.post.findUnique({ where: { id: postId } }))?.status).toBe('PUBLISHED');

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelBId], new Date(Date.now() + 60 * 60 * 1000).toISOString()));

    expect(res.status).toBe(201);
    const published = await prisma.scheduledPost.findFirst({
      where: { postId, channelId: channelAId },
    });
    expect(published?.status).toBe('PUBLISHED');
    expect((await prisma.post.findUnique({ where: { id: postId } }))?.status).toBe('SCHEDULED');
  });

  it('Từ chối bài chưa duyệt', async () => {
    const postId = await createPost('PENDING');

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId]));

    expect(res.status).toBe(409);
  });

  it('Từ chối Page của workspace khác', async () => {
    const postId = await createPost();

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([outsiderChannelId]));

    expect(res.status).toBe(400);
  });

  it('Từ chối Page đã hết hạn', async () => {
    const postId = await createPost();
    await prisma.channelConnection.update({
      where: { id: channelAId },
      data: { status: 'EXPIRED' },
    });

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId]));

    expect(res.status).toBe(400);
  });

  it('Từ chối quá 10 ảnh và video', async () => {
    const manyImages = await createPost('APPROVED', Array.from({ length: 11 }, () => 'IMAGE' as const));
    const videoPost = await createPost('APPROVED', ['VIDEO']);

    const manyImagesRes = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${manyImages}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId]));
    const videoRes = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${videoPost}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId]));

    expect(manyImagesRes.status).toBe(400);
    expect(videoRes.status).toBe(400);
  });

  it('Từ chối giờ hẹn trong quá khứ', async () => {
    const postId = await createPost();

    const res = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId], new Date(Date.now() + 10_000).toISOString()));

    expect(res.status).toBe(400);
  });

  it('Danh sách lịch lọc theo trạng thái và không lộ token', async () => {
    const postId = await createPost();
    const created = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId], new Date(Date.now() + 60 * 60 * 1000).toISOString()));

    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/schedules?status=SCHEDULED`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.schedules).toHaveLength(1);
    expect(res.body.data.schedules[0].id).toBe(created.body.data.schedules[0].id);
    expect(JSON.stringify(res.body)).not.toContain('page-token');
  });

  it('Lọc theo khoảng ngày gồm cả lịch đăng ngay (theo thời điểm tạo)', async () => {
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const scheduled = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${await createPost()}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId], scheduledAt.toISOString()));
    const immediate = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${await createPost()}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelBId], null));

    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/schedules`)
      .query({ from, to, limit: 200 })
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.schedules.map((item: { id: string }) => item.id);
    expect(ids).toContain(scheduled.body.data.schedules[0].id);
    expect(ids).toContain(immediate.body.data.schedules[0].id);

    const outside = await request(app)
      .get(`/api/v1/workspaces/${wsId}/schedules`)
      .query({ from: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(outside.status).toBe(200);
    const outsideIds = outside.body.data.schedules.map((item: { id: string }) => item.id);
    expect(outsideIds).not.toContain(immediate.body.data.schedules[0].id);
  });

  it('Huỷ lịch đang chờ, bài quay về APPROVED', async () => {
    const postId = await createPost();
    const created = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId], new Date(Date.now() + 60 * 60 * 1000).toISOString()));

    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/schedules/${created.body.data.schedules[0].id}`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    const schedule = await prisma.scheduledPost.findUnique({
      where: { id: created.body.data.schedules[0].id },
    });
    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(schedule?.status).toBe('CANCELLED');
    expect(post?.status).toBe('APPROVED');
  });

  it('Không cho người ngoài workspace huỷ lịch', async () => {
    const postId = await createPost();
    const created = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId], new Date(Date.now() + 60 * 60 * 1000).toISOString()));

    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/schedules/${created.body.data.schedules[0].id}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });

  it('Worker đăng thành công nhiều ảnh và lưu externalPostId', async () => {
    const postId = await createPost('APPROVED', ['IMAGE', 'IMAGE']);
    const schedule = await prisma.scheduledPost.create({
      data: {
        postId,
        channelId: channelAId,
        scheduledAt: new Date(Date.now() - 1000),
        status: 'SCHEDULED',
      },
    });

    const uploadSpy = vi
      .spyOn(facebookClient, 'uploadPagePhoto')
      .mockResolvedValueOnce('photo-1')
      .mockResolvedValueOnce('photo-2');
    const feedSpy = vi
      .spyOn(facebookClient, 'createPageFeedPost')
      .mockResolvedValue('page_post_1');

    const result = await scheduleService.publishSchedule(schedule.id);

    expect(result.outcome).toBe('published');
    expect(uploadSpy).toHaveBeenCalledTimes(2);
    expect(feedSpy).toHaveBeenCalledWith(
      expect.any(String),
      'page-token',
      'Nội dung bài đăng',
      ['photo-1', 'photo-2']
    );

    const saved = await prisma.scheduledPost.findUnique({ where: { id: schedule.id } });
    expect(saved?.status).toBe('PUBLISHED');
    expect(saved?.externalPostId).toBe('page_post_1');
    expect(saved?.publishedAt).not.toBeNull();

    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(post?.status).toBe('PUBLISHED');
  });

  it('Worker đăng bài không có ảnh chỉ gọi feed', async () => {
    const postId = await createPost();
    const schedule = await prisma.scheduledPost.create({
      data: { postId, channelId: channelAId, scheduledAt: null, status: 'SCHEDULED' },
    });

    const uploadSpy = vi.spyOn(facebookClient, 'uploadPagePhoto');
    const feedSpy = vi
      .spyOn(facebookClient, 'createPageFeedPost')
      .mockResolvedValue('page_post_no_image');

    const result = await scheduleService.publishSchedule(schedule.id);

    expect(result.outcome).toBe('published');
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(feedSpy).toHaveBeenCalledWith(expect.any(String), 'page-token', 'Nội dung bài đăng', []);
  });

  it('Hết lượt retry thì lịch FAILED', async () => {
    const postId = await createPost('APPROVED', ['IMAGE']);
    const schedule = await prisma.scheduledPost.create({
      data: {
        postId,
        channelId: channelAId,
        scheduledAt: null,
        status: 'SCHEDULED',
        retryCount: 3,
      },
    });

    vi.spyOn(facebookClient, 'uploadPagePhoto').mockRejectedValue(
      new FacebookTransientError('vẫn lỗi mạng')
    );

    const result = await scheduleService.publishSchedule(schedule.id);

    expect(result.outcome).toBe('failed');
    const saved = await prisma.scheduledPost.findUnique({ where: { id: schedule.id } });
    expect(saved?.status).toBe('FAILED');
  });

  it('Không huỷ được lịch đang PROCESSING', async () => {
    const postId = await createPost();
    const schedule = await prisma.scheduledPost.create({
      data: {
        postId,
        channelId: channelAId,
        scheduledAt: null,
        status: 'PROCESSING',
        processingStartedAt: new Date(),
      },
    });

    const res = await request(app)
      .delete(`/api/v1/workspaces/${wsId}/schedules/${schedule.id}`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(409);
  });

  it('Token hết hạn đánh dấu Page EXPIRED và lịch FAILED', async () => {
    const postId = await createPost('APPROVED', ['IMAGE']);
    const schedule = await prisma.scheduledPost.create({
      data: { postId, channelId: channelAId, scheduledAt: null, status: 'SCHEDULED' },
    });

    vi.spyOn(facebookClient, 'uploadPagePhoto').mockRejectedValue(new FacebookTokenExpiredError());

    const result = await scheduleService.publishSchedule(schedule.id);

    expect(result.outcome).toBe('failed');
    const channel = await prisma.channelConnection.findUnique({ where: { id: channelAId } });
    const saved = await prisma.scheduledPost.findUnique({ where: { id: schedule.id } });
    expect(channel?.status).toBe('EXPIRED');
    expect(saved?.status).toBe('FAILED');
    expect(saved?.errorMessage).toContain('hết hạn');
  });

  it('Lỗi tạm thời trước khi gửi feed được hẹn giờ lại', async () => {
    const postId = await createPost('APPROVED', ['IMAGE']);
    const scheduledAt = new Date(Date.now() - 60_000);
    const schedule = await prisma.scheduledPost.create({
      data: { postId, channelId: channelAId, scheduledAt, status: 'SCHEDULED' },
    });

    vi.spyOn(facebookClient, 'uploadPagePhoto').mockRejectedValue(
      new FacebookTransientError('mất mạng')
    );

    const result = await scheduleService.publishSchedule(schedule.id);

    expect(result.outcome).toBe('retry');
    const saved = await prisma.scheduledPost.findUnique({ where: { id: schedule.id } });
    expect(saved?.status).toBe('SCHEDULED');
    expect(saved?.retryCount).toBe(1);
    expect(saved?.scheduledAt?.getTime()).toBe(scheduledAt.getTime());
    expect(saved?.retryAt?.getTime()).toBeGreaterThan(Date.now());
  });

  it('Lịch đang chờ thử lại chưa đến giờ retry thì không được nhặt', async () => {
    const postId = await createPost();
    const schedule = await prisma.scheduledPost.create({
      data: {
        postId,
        channelId: channelAId,
        scheduledAt: new Date(Date.now() - 60_000),
        retryAt: new Date(Date.now() + 60_000),
        status: 'SCHEDULED',
      },
    });

    const publish = vi.spyOn(facebookClient, 'createPageFeedPost');

    await scheduleService.processDueSchedules();

    expect(publish).not.toHaveBeenCalled();
    const saved = await prisma.scheduledPost.findUnique({ where: { id: schedule.id } });
    expect(saved?.status).toBe('SCHEDULED');
  });

  it('Lỗi sau khi đã gửi feed không tự retry để tránh đăng trùng', async () => {
    const postId = await createPost();
    const schedule = await prisma.scheduledPost.create({
      data: { postId, channelId: channelAId, scheduledAt: null, status: 'SCHEDULED' },
    });

    vi.spyOn(facebookClient, 'uploadPagePhoto').mockResolvedValue('photo-1');
    vi.spyOn(facebookClient, 'createPageFeedPost').mockRejectedValue(
      new FacebookTransientError('timeout')
    );

    const result = await scheduleService.publishSchedule(schedule.id);

    expect(result.outcome).toBe('failed');
    const saved = await prisma.scheduledPost.findUnique({ where: { id: schedule.id } });
    expect(saved?.status).toBe('FAILED');
    expect(saved?.errorMessage).toContain('Không xác định');
  });

  it('processDueSchedules nhặt đúng lịch đến hạn', async () => {
    const postId = await createPost();
    const schedule = await prisma.scheduledPost.create({
      data: {
        postId,
        channelId: channelAId,
        scheduledAt: new Date(Date.now() - 60_000),
        status: 'SCHEDULED',
      },
    });

    vi.spyOn(facebookClient, 'createPageFeedPost').mockResolvedValue('page_post_due');

    const result = await scheduleService.processDueSchedules();

    expect(result.processed).toBeGreaterThanOrEqual(1);
    const saved = await prisma.scheduledPost.findUnique({ where: { id: schedule.id } });
    expect(saved?.status).toBe('PUBLISHED');
    expect(saved?.externalPostId).toBe('page_post_due');
  });

  it('Recovery đánh dấu lịch PROCESSING quá hạn là FAILED', async () => {
    const postId = await createPost();
    const schedule = await prisma.scheduledPost.create({
      data: {
        postId,
        channelId: channelAId,
        scheduledAt: null,
        status: 'PROCESSING',
        processingStartedAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    });

    await scheduleService.processDueSchedules();

    const saved = await prisma.scheduledPost.findUnique({ where: { id: schedule.id } });
    expect(saved?.status).toBe('FAILED');
    expect(saved?.errorMessage).toContain('worker dừng');
  });

  it('Không đăng khi lịch đang được worker khác xử lý', async () => {
    const postId = await createPost();
    const schedule = await prisma.scheduledPost.create({
      data: {
        postId,
        channelId: channelAId,
        scheduledAt: null,
        status: 'PROCESSING',
        processingStartedAt: new Date(),
      },
    });

    const feedSpy = vi.spyOn(facebookClient, 'createPageFeedPost');

    const result = await scheduleService.publishSchedule(schedule.id);

    expect(result.outcome).toBe('skipped');
    expect(feedSpy).not.toHaveBeenCalled();
  });

  it('Không đăng trùng khi lịch đã PUBLISHED', async () => {
    const postId = await createPost('APPROVED', ['IMAGE']);
    const schedule = await prisma.scheduledPost.create({
      data: { postId, channelId: channelAId, scheduledAt: null, status: 'SCHEDULED' },
    });

    const uploadSpy = vi.spyOn(facebookClient, 'uploadPagePhoto').mockResolvedValue('photo-1');
    vi.spyOn(facebookClient, 'createPageFeedPost').mockResolvedValue('page_post_1');

    await scheduleService.publishSchedule(schedule.id);
    const second = await scheduleService.publishSchedule(schedule.id);

    expect(second.outcome).toBe('skipped');
    expect(uploadSpy).toHaveBeenCalledTimes(1);
  });

  it('Post detail trả kèm schedules và không lộ token', async () => {
    const postId = await createPost();
    const created = await request(app)
      .post(`/api/v1/workspaces/${wsId}/posts/${postId}/schedules`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(schedulePayload([channelAId], new Date(Date.now() + 60 * 60 * 1000).toISOString()));

    const res = await request(app)
      .get(`/api/v1/workspaces/${wsId}/posts/${postId}`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.schedules).toHaveLength(1);
    expect(res.body.data.schedules[0].id).toBe(created.body.data.schedules[0].id);
    expect(JSON.stringify(res.body)).not.toContain('page-token');
  });
});
