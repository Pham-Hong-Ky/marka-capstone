import { buildPaginationMeta } from '../../utils/pagination.js';
import { getErrorMessage } from '../../utils/errorMessage.js';
import type { PublishStatus } from '@prisma/client';
import logger from '../../utils/logger.js';
import { BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError } from '../../utils/errors/index.js';
import { withTimeout } from '../../utils/timeout.js';
import { decryptOrNull } from '../../utils/encryption.js';
import auditService from '../audit/audit.service.js';
import channelService from '../channel/channel.service.js';
import {
  FacebookTokenExpiredError,
  FacebookTransientError,
  facebookClient,
} from '../channel/facebook.client.js';
import scheduleRepository, { type ScheduleSummary } from './schedule.repository.js';
import { PUBLISHABLE_POST_STATUSES } from '../post/post.status.js';
import { renderContentToPlainText } from './schedule.content.js';

const MAX_CHANNELS = 10;
const MAX_IMAGES = 10;
const MAX_MESSAGE_LENGTH = 63_206;
const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;
const MIN_SCHEDULE_AHEAD_MS = 60 * 1000;
const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000];
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const DUE_BATCH_SIZE = 10;

interface CreateScheduleInput {
  channelIds: string[];
  scheduledAt?: Date | null;
}

interface ListSchedulesQuery {
  status?: PublishStatus;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

const enqueueImmediate = async (scheduleId: string): Promise<void> => {
  try {
    const { scheduleQueue } = await import('../../workers/queues.js');
    await withTimeout(
      scheduleQueue.add(
        'schedule-one',
        { scheduleId },
        {
          jobId: `schedule-one-${scheduleId}`,
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        }
      ),
      5000,
      () => new ServiceUnavailableError('Hàng đợi tạm thời không khả dụng')
    );
  } catch (error) {
    const message = getErrorMessage(error);
    // Scheduler mỗi phút vẫn nhặt được row SCHEDULED nếu enqueue thất bại.
    logger.warn(`Không enqueue được job đăng ngay ${scheduleId}: ${message}`);
  }
};

const validatePostContent = (post: {
  content: unknown;
  mediaAssets: Array<{ type: string; url: string }>;
}): { message: string; imageUrls: string[] } => {
  const message = renderContentToPlainText(post.content);
  if (!message) {
    throw new BadRequestError('Bài viết chưa có nội dung để đăng');
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new BadRequestError('Nội dung bài viết vượt quá giới hạn của Facebook');
  }

  if (post.mediaAssets.some((media) => media.type !== 'IMAGE')) {
    throw new BadRequestError('Hiện chưa hỗ trợ đăng video lên Facebook');
  }

  if (post.mediaAssets.length > MAX_IMAGES) {
    throw new BadRequestError(`Chỉ được đăng tối đa ${MAX_IMAGES} ảnh mỗi bài`);
  }

  return { message, imageUrls: post.mediaAssets.map((media) => media.url) };
};

type SchedulablePost = NonNullable<
  Awaited<ReturnType<typeof scheduleRepository.findPostForSchedule>>
>;
type SchedulableChannel = Awaited<
  ReturnType<typeof scheduleRepository.findChannelsForSchedule>
>[number];

const loadSchedulablePost = async (postId: string, workspaceId: string): Promise<SchedulablePost> => {
  const post = await scheduleRepository.findPostForSchedule(postId, workspaceId);
  if (!post) {
    throw new NotFoundError('Bài viết không tồn tại');
  }
  if (!PUBLISHABLE_POST_STATUSES.includes(post.status)) {
    throw new ConflictError('Chỉ có thể đăng hoặc lên lịch bài đã được duyệt');
  }

  validatePostContent(post);
  return post;
};

const loadActiveFacebookChannels = async (workspaceId: string, inputChannelIds: string[]) => {
  const channelIds = [...new Set(inputChannelIds)];
  if (channelIds.length === 0 || channelIds.length > MAX_CHANNELS) {
    throw new BadRequestError(`Chọn từ 1 đến ${MAX_CHANNELS} kênh`);
  }

  const channels = await scheduleRepository.findChannelsForSchedule(workspaceId, channelIds);
  if (channels.length !== channelIds.length) {
    throw new BadRequestError('Kênh không hợp lệ hoặc không thuộc workspace');
  }

  const unsupported = channels.find(
    (channel) =>
      channel.platform !== 'FACEBOOK' || channel.type !== 'REAL' || channel.status !== 'ACTIVE'
  );
  if (unsupported) {
    throw new BadRequestError(
      `Kênh "${unsupported.name}" không khả dụng. Vui lòng kiểm tra lại kết nối Facebook.`
    );
  }

  return { channelIds, channels };
};

const resolveScheduledAt = (scheduledAt?: Date | null): Date | null => {
  if (!scheduledAt) return null;

  const diff = scheduledAt.getTime() - Date.now();
  if (diff < MIN_SCHEDULE_AHEAD_MS) {
    throw new BadRequestError('Thời gian hẹn đăng phải sau hiện tại ít nhất 1 phút');
  }
  if (diff > MAX_SCHEDULE_AHEAD_MS) {
    throw new BadRequestError('Thời gian hẹn đăng không được vượt quá 1 năm');
  }
  return scheduledAt;
};

const recordCreatedSchedules = async (params: {
  workspaceId: string;
  userId: string;
  postId: string;
  channels: SchedulableChannel[];
  schedules: ScheduleSummary[];
  scheduledAt: Date | null;
}) => {
  const { workspaceId, userId, postId, channels, schedules, scheduledAt } = params;

  for (const schedule of schedules) {
    const channel = channels.find((item) => item.id === schedule.channelId);
    await auditService.recordAuditLog({
      workspaceId,
      actorId: userId,
      action: 'SCHEDULE_CREATED',
      targetType: 'ScheduledPost',
      targetId: schedule.id,
      metadata: {
        postId,
        channelId: schedule.channelId,
        pageId: channel?.externalAccountId ?? null,
        scheduledAt: scheduledAt?.toISOString() ?? null,
      },
    });

    if (!scheduledAt) {
      await enqueueImmediate(schedule.id);
    }
  }
};

export const createSchedules = async (
  workspaceId: string,
  userId: string,
  postId: string,
  input: CreateScheduleInput
): Promise<{ schedules: ScheduleSummary[]; isImmediate: boolean }> => {
  await loadSchedulablePost(postId, workspaceId);
  const { channelIds, channels } = await loadActiveFacebookChannels(workspaceId, input.channelIds);
  const scheduledAt = resolveScheduledAt(input.scheduledAt);

  const result = await scheduleRepository.createSchedulesForPost({
    postId,
    workspaceId,
    channelIds,
    scheduledAt,
  });

  if (result.outcome === 'channel_taken') {
    throw new ConflictError('Bài viết đã được đăng hoặc đang chờ đăng trên Page đã chọn');
  }
  if (result.outcome === 'not_publishable') {
    throw new ConflictError('Bài viết đã được lên lịch hoặc không còn ở trạng thái đã duyệt');
  }

  await recordCreatedSchedules({
    workspaceId,
    userId,
    postId,
    channels,
    schedules: result.schedules,
    scheduledAt,
  });

  return { schedules: result.schedules, isImmediate: scheduledAt === null };
};

export const listSchedules = async (workspaceId: string, query: ListSchedulesQuery) => {
  const [schedules, total] = await scheduleRepository.listSchedulesAndCount({
    workspaceId,
    status: query.status,
    from: query.from,
    to: query.to,
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });

  return {
    schedules,
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
};

export const cancelSchedule = async (
  workspaceId: string,
  userId: string,
  scheduleId: string
): Promise<{ success: true }> => {
  const schedule = await scheduleRepository.findScheduleInWorkspace(scheduleId, workspaceId);
  if (!schedule) {
    throw new NotFoundError('Lịch đăng không tồn tại');
  }
  if (schedule.status !== 'SCHEDULED') {
    throw new ConflictError('Chỉ có thể huỷ lịch đang chờ đăng');
  }

  const result = await scheduleRepository.cancelSchedule(scheduleId, workspaceId);
  if (result.outcome === 'not_found') {
    throw new NotFoundError('Lịch đăng không tồn tại');
  }
  if (result.outcome === 'not_cancellable') {
    throw new ConflictError('Lịch đăng đã bắt đầu xử lý, không thể huỷ');
  }

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'SCHEDULE_CANCELLED',
    targetType: 'ScheduledPost',
    targetId: scheduleId,
    metadata: { postId: schedule.postId },
  });

  return { success: true };
};

const markChannelExpired = async (channelId: string): Promise<void> => {
  await channelService.markChannelExpired(channelId);
};

const failSchedule = async (
  schedule: {
    id: string;
    channelId: string;
    postId: string;
    post: { workspaceId: string; title: string };
    channel: { externalAccountId: string };
  },
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<{ outcome: 'failed' }> => {
  await scheduleRepository.markScheduleFailed(schedule.id, message);
  await auditService.recordAuditLog({
    workspaceId: schedule.post.workspaceId,
    action: 'SCHEDULE_PUBLISH_FAILED',
    targetType: 'ScheduledPost',
    targetId: schedule.id,
    reason: message,
    metadata: {
      postId: schedule.postId,
      channelId: schedule.channelId,
      pageId: schedule.channel.externalAccountId,
      ...metadata,
    },
  });
  return { outcome: 'failed' };
};

const handlePublishError = async (
  schedule: NonNullable<Awaited<ReturnType<typeof scheduleRepository.findScheduleForPublish>>>,
  error: unknown,
  feedStarted: boolean
): Promise<{ outcome: 'failed' | 'retry' }> => {
  const message = getErrorMessage(error);

  if (error instanceof FacebookTokenExpiredError || message.includes('hết hạn')) {
    await markChannelExpired(schedule.channelId);
    return failSchedule(schedule, 'Token Facebook đã hết hạn. Vui lòng kết nối lại Page.', {
      tokenExpired: true,
    });
  }

  if (error instanceof FacebookTransientError) {
    if (feedStarted) {
      return failSchedule(
        schedule,
        'Không xác định được kết quả đăng bài do lỗi kết nối sau khi gửi lên Facebook. Vui lòng kiểm tra Page trước khi đăng lại.',
        { ambiguous: true }
      );
    }

    if (schedule.retryCount < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[schedule.retryCount];
      await scheduleRepository.rescheduleSchedule(schedule.id, message, delay);
      logger.warn(`Sẽ thử lại lịch ${schedule.id} sau ${delay}ms: ${message}`);
      return { outcome: 'retry' };
    }
  }

  return failSchedule(schedule, message);
};

const uploadPostImages = async (
  pageId: string,
  token: string,
  imageUrls: string[]
): Promise<string[]> => {
  const mediaIds: string[] = [];
  for (const imageUrl of imageUrls) {
    mediaIds.push(await facebookClient.uploadPagePhoto(pageId, token, imageUrl));
  }
  return mediaIds;
};

export const publishSchedule = async (
  scheduleId: string
): Promise<{ outcome: 'published' | 'failed' | 'retry' | 'skipped' | 'not_found'; externalPostId?: string }> => {
  const schedule = await scheduleRepository.findScheduleForPublish(scheduleId);
  if (!schedule) return { outcome: 'not_found' };

  // Luôn claim nguyên tử: nếu worker khác đã giữ lịch (PROCESSING) hoặc lịch
  // đã kết thúc, bỏ qua để không đăng trùng.
  if (!(await scheduleRepository.claimSchedule(scheduleId))) {
    return { outcome: 'skipped' };
  }

  // Post/kênh có thể đã bị xoá mềm sau khi lịch được đọc nhưng trước khi claim.
  const publishablePost = await scheduleRepository.findPublishablePost(schedule.postId);
  if (!publishablePost) {
    return failSchedule(schedule, 'Bài viết đã bị xoá');
  }

  const publishableChannel = await scheduleRepository.findPublishableChannel(schedule.channelId);
  if (!publishableChannel) {
    return failSchedule(schedule, 'Kênh đã bị ngắt kết nối');
  }

  if (schedule.channel.platform !== 'FACEBOOK') {
    return failSchedule(schedule, 'Kênh không phải Facebook Page');
  }
  if (schedule.channel.status !== 'ACTIVE') {
    return failSchedule(schedule, 'Kênh đã hết hạn. Vui lòng kết nối lại Page.');
  }

  const token = decryptOrNull(schedule.channel.accessToken);

  if (!token) {
    await markChannelExpired(schedule.channelId);
    return failSchedule(schedule, 'Không đọc được token của Page. Vui lòng kết nối lại.');
  }

  let message: string;
  let imageUrls: string[];
  try {
    ({ message, imageUrls } = validatePostContent(schedule.post));
  } catch (error) {
    const text = getErrorMessage(error);
    return failSchedule(schedule, text);
  }

  let feedStarted = false;
  try {
    const mediaIds = await uploadPostImages(
      schedule.channel.externalAccountId,
      token,
      imageUrls
    );

    feedStarted = true;
    const externalPostId = await facebookClient.createPageFeedPost(
      schedule.channel.externalAccountId,
      token,
      message,
      mediaIds
    );

    const published = await scheduleRepository.markSchedulePublished(scheduleId, externalPostId);
    if (!published) {
      logger.error(`Đã đăng lên Facebook nhưng không cập nhật được lịch ${scheduleId}`);
      return { outcome: 'failed', externalPostId };
    }

    await auditService.recordAuditLog({
      workspaceId: schedule.post.workspaceId,
      action: 'SCHEDULE_PUBLISHED',
      targetType: 'ScheduledPost',
      targetId: schedule.id,
      metadata: {
        postId: schedule.postId,
        channelId: schedule.channelId,
        pageId: schedule.channel.externalAccountId,
        externalPostId,
      },
    });

    return { outcome: 'published', externalPostId };
  } catch (error) {
    return handlePublishError(schedule, error, feedStarted);
  }
};

export const processDueSchedules = async () => {
  const recovered = await scheduleRepository.recoverStaleSchedules(
    new Date(Date.now() - STALE_PROCESSING_MS)
  );
  const due = await scheduleRepository.findDueScheduleIds(DUE_BATCH_SIZE);

  const results: Array<{ id: string; outcome: string }> = [];
  for (const item of due) {
    try {
      const result = await publishSchedule(item.id);
      results.push({ id: item.id, outcome: result.outcome });
    } catch (error) {
      const message = getErrorMessage(error);
      logger.error(`Lỗi không mong đợi khi đăng lịch ${item.id}: ${message}`);
      results.push({ id: item.id, outcome: 'error' });
    }
  }

  return { recovered, processed: due.length, results };
};

export default {
  createSchedules,
  listSchedules,
  cancelSchedule,
  publishSchedule,
  processDueSchedules,
};
