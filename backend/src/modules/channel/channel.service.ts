import { getErrorMessage } from '../../utils/errorMessage.js';
import { randomBytes } from 'node:crypto';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors/index.js';
import { decryptOrNull, encrypt } from '../../utils/encryption.js';
import auditService from '../audit/audit.service.js';
import channelRepository, { type ChannelSummary } from './channel.repository.js';
import { getProvider } from './providers/provider.registry.js';
import { SocialTokenExpiredError } from './providers/social-provider.js';
import * as oauthStore from './channel.oauth-store.js';
import type { OauthSession, OauthSessionPage } from './channel.oauth-store.js';

interface FacebookCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_reason?: string;
}

const buildClientRedirect = (params: Record<string, string>): string => {
  const url = new URL('/channels', env.CLIENT_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
};

const errorRedirect = (reason: string): string => buildClientRedirect({ fb: 'error', reason });

export const listChannels = async (
  workspaceId: string
): Promise<{ channels: ChannelSummary[] }> => ({
  channels: await channelRepository.findChannelsByWorkspace(workspaceId),
});

export const createFacebookAuthUrl = async (
  workspaceId: string,
  userId: string
): Promise<{ url: string }> => {
  const provider = getProvider('FACEBOOK');
  if (!provider.isConfigured()) {
    throw new BadRequestError('Chưa cấu hình Facebook App. Vui lòng liên hệ quản trị viên.');
  }

  const state = randomBytes(32).toString('hex');
  await oauthStore.saveOauthState(state, { userId, workspaceId });

  return { url: provider.buildAuthorizationUrl(state) };
};

export const handleFacebookCallback = async (
  query: FacebookCallbackQuery
): Promise<string> => {
  if (query.error) {
    if (query.state) {
      await oauthStore.consumeOauthState(query.state).catch((error: unknown) => {
        const message = getErrorMessage(error);
        logger.warn(`Không xoá được OAuth state sau khi người dùng từ chối: ${message}`);
        return null;
      });
    }
    return errorRedirect(
      query.error === 'access_denied' ? 'access_denied' : 'token_exchange_failed'
    );
  }

  if (!query.state || !query.code) {
    return errorRedirect('invalid_state');
  }

  const state = await oauthStore.consumeOauthState(query.state);
  if (!state) {
    return errorRedirect('invalid_state');
  }

  try {
    const accounts = await getProvider('FACEBOOK').exchangeCodeForAccounts(query.code);

    if (accounts.length === 0) {
      return errorRedirect('no_pages');
    }

    const sessionId = randomBytes(24).toString('hex');
    await oauthStore.saveOauthSession(sessionId, {
      userId: state.userId,
      workspaceId: state.workspaceId,
      pages: accounts.map((account) => ({
        id: account.externalAccountId,
        name: account.name,
        avatar: account.avatar,
        accessTokenEncrypted: encrypt(account.accessToken) as string,
      })),
    });

    return buildClientRedirect({ fb: 'select', session: sessionId });
  } catch (error) {
    const message = getErrorMessage(error);
    logger.warn(`Kết nối Facebook thất bại: ${message}`);
    return errorRedirect('token_exchange_failed');
  }
};

const getSessionForUser = async (
  sessionId: string,
  userId: string,
  workspaceId: string
): Promise<OauthSession> => {
  const session = await oauthStore.getOauthSession(sessionId);

  if (!session || session.userId !== userId || session.workspaceId !== workspaceId) {
    throw new NotFoundError('Phiên kết nối không tồn tại hoặc đã hết hạn');
  }

  return session;
};

export const getFacebookPendingPages = async (
  sessionId: string,
  userId: string,
  workspaceId: string
) => {
  const session = await getSessionForUser(sessionId, userId, workspaceId);

  return {
    pages: session.pages.map(({ id, name, avatar }) => ({ id, name, avatar })),
  };
};

const resolveSelectedPages = (session: OauthSession, pageIds: string[]): OauthSessionPage[] => {
  const pagesById = new Map(session.pages.map((page) => [page.id, page]));
  const uniquePageIds = [...new Set(pageIds)];
  const selectedPages = uniquePageIds
    .map((pageId) => pagesById.get(pageId))
    .filter((page): page is OauthSessionPage => Boolean(page));

  if (selectedPages.length !== uniquePageIds.length) {
    throw new BadRequestError('Page không hợp lệ trong phiên kết nối');
  }
  return selectedPages;
};

const buildFacebookChannelInputs = (pages: OauthSessionPage[]) =>
  pages.map((page) => {
    if (!decryptOrNull(page.accessTokenEncrypted)) {
      throw new BadRequestError('Không đọc được token của Page. Vui lòng kết nối lại.');
    }

    return {
      page,
      data: {
        externalAccountId: page.id,
        name: page.name,
        avatar: page.avatar,
        accessToken: page.accessTokenEncrypted,
      },
    };
  });

const auditConnectedChannels = async (
  workspaceId: string,
  userId: string,
  channels: ChannelSummary[],
  pages: OauthSessionPage[]
) => {
  for (const [index, channel] of channels.entries()) {
    const page = pages[index];
    await auditService.recordAuditLog({
      workspaceId,
      actorId: userId,
      action: 'CHANNEL_CONNECTED',
      targetType: 'ChannelConnection',
      targetId: channel.id,
      metadata: { pageId: page.id, name: page.name },
    });
  }
};

export const connectFacebookPages = async (
  sessionId: string,
  userId: string,
  workspaceId: string,
  pageIds: string[]
): Promise<{ channels: ChannelSummary[] }> => {
  const session = await getSessionForUser(sessionId, userId, workspaceId);
  const selectedPages = resolveSelectedPages(session, pageIds);
  const inputs = buildFacebookChannelInputs(selectedPages);

  const channels = await channelRepository.upsertFacebookChannels(
    workspaceId,
    inputs.map((item) => item.data)
  );

  await auditConnectedChannels(
    workspaceId,
    userId,
    channels,
    inputs.map((item) => item.page)
  );
  await oauthStore.deleteOauthSession(sessionId);

  return { channels };
};

export const markChannelExpired = async (channelId: string): Promise<void> => {
  await channelRepository.updateChannelStatus(channelId, 'EXPIRED');
};

export const disconnectChannel = async (
  channelId: string,
  workspaceId: string,
  userId: string
): Promise<{ success: true }> => {
  const channel = await channelRepository.findChannelInWorkspace(channelId, workspaceId);

  if (!channel) {
    throw new NotFoundError('Kênh không tồn tại');
  }

  const result = await channelRepository.disconnectChannelAndCancelSchedules(channelId);
  if (result === 'publishing') {
    throw new ConflictError('Kênh đang đăng bài, vui lòng thử lại sau');
  }

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'CHANNEL_DISCONNECTED',
    targetType: 'ChannelConnection',
    targetId: channelId,
    metadata: { pageId: channel.externalAccountId, name: channel.name },
  });

  return { success: true };
};

export const getChannelDetail = async (
  channelId: string,
  workspaceId: string
): Promise<{ channel: ChannelSummary; stats: Awaited<ReturnType<typeof channelRepository.findChannelStats>> }> => {
  const channel = await channelRepository.findChannelDetail(channelId, workspaceId);

  if (!channel) {
    throw new NotFoundError('Kênh không tồn tại');
  }

  return { channel, stats: await channelRepository.findChannelStats(channelId) };
};

export const updateChannelLabel = async (
  channelId: string,
  workspaceId: string,
  userId: string,
  label: string | null
): Promise<{ channel: ChannelSummary }> => {
  const channel = await channelRepository.findChannelInWorkspace(channelId, workspaceId);

  if (!channel) {
    throw new NotFoundError('Kênh không tồn tại');
  }

  const updated = await channelRepository.updateChannelLabel(channelId, label);

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'CHANNEL_UPDATED',
    targetType: 'ChannelConnection',
    targetId: channelId,
    metadata: { label },
  });

  return { channel: updated };
};

export const refreshChannel = async (
  channelId: string,
  workspaceId: string,
  userId: string
): Promise<{ channel: ChannelSummary }> => {
  const channel = await channelRepository.findChannelWithToken(channelId, workspaceId);

  if (!channel) {
    throw new NotFoundError('Kênh không tồn tại');
  }

  const token = decryptOrNull(channel.accessToken);
  if (!token) {
    await channelRepository.updateChannelStatus(channelId, 'EXPIRED');
    throw new BadRequestError('Không đọc được token của Page. Vui lòng kết nối lại.');
  }

  let profile;
  try {
    profile = await getProvider(channel.platform).fetchProfile(token);
  } catch (error) {
    if (error instanceof SocialTokenExpiredError) {
      await channelRepository.updateChannelStatus(channelId, 'EXPIRED');
      throw new BadRequestError('Page đã hết hạn hoặc bị thu hồi quyền. Vui lòng kết nối lại.');
    }
    throw error;
  }

  if (profile.id !== channel.externalAccountId) {
    throw new BadRequestError('Token không thuộc Page đã kết nối. Vui lòng kết nối lại.');
  }

  const updated = await channelRepository.updateChannelProfile(channelId, {
    name: profile.name,
    avatar: profile.avatar,
  });

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'CHANNEL_REFRESHED',
    targetType: 'ChannelConnection',
    targetId: channelId,
    metadata: { pageId: profile.id, name: profile.name },
  });

  return { channel: updated };
};

export default {
  listChannels,
  createFacebookAuthUrl,
  handleFacebookCallback,
  getFacebookPendingPages,
  connectFacebookPages,
  markChannelExpired,
  disconnectChannel,
  getChannelDetail,
  updateChannelLabel,
  refreshChannel,
};
