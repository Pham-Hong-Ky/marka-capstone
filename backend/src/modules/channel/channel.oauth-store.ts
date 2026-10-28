import { getErrorMessage } from '../../utils/errorMessage.js';
import type { SocialPlatform } from '@prisma/client';
import redis from '../../config/redis.js';
import logger from '../../utils/logger.js';
import { ServiceUnavailableError } from '../../utils/errors/index.js';

const STATE_PREFIX = 'channel:oauth:state:';
const SESSION_PREFIX = 'channel:oauth:session:';
const TTL_SECONDS = 600;

export interface OauthState {
  userId: string;
  workspaceId: string;
  platform: SocialPlatform;
}

export interface OauthSessionAccount {
  externalAccountId: string;
  name: string;
  avatar: string | null;
  accessTokenEncrypted: string;
}

export interface OauthSession {
  userId: string;
  workspaceId: string;
  platform: SocialPlatform;
  accounts: OauthSessionAccount[];
}

const stateKey = (state: string) => `${STATE_PREFIX}${state}`;
const sessionKey = (sessionId: string) => `${SESSION_PREFIX}${sessionId}`;

// Redis có thể chỉ còn đọc (hết hạn mức, quyền hạn, mất kết nối tạm thời).
// Trả 503 để người dùng biết là sự cố tạm thời, thay vì 500 "lỗi hệ thống".
const runRedis = async <T>(action: string, command: () => Promise<T>): Promise<T> => {
  try {
    return await command();
  } catch (error) {
    const message = getErrorMessage(error);
    logger.warn(`Redis lỗi khi ${action} phiên OAuth: ${message}`);
    throw new ServiceUnavailableError(
      'Tạm thời không truy cập được bộ nhớ phiên kết nối. Vui lòng thử lại sau ít phút.'
    );
  }
};

export const saveOauthState = async (state: string, data: OauthState): Promise<void> => {
  await runRedis('lưu state', () => redis.setex(stateKey(state), TTL_SECONDS, JSON.stringify(data)));
};

export const consumeOauthState = async (state: string): Promise<OauthState | null> => {
  const raw = await runRedis('đọc state', () => redis.getdel(stateKey(state)));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OauthState;
  } catch (error) {
    const message = getErrorMessage(error);
    logger.warn(`Dữ liệu OAuth state trong Redis không hợp lệ: ${message}`);
    return null;
  }
};

export const saveOauthSession = async (sessionId: string, data: OauthSession): Promise<void> => {
  await runRedis('lưu session', () =>
    redis.setex(sessionKey(sessionId), TTL_SECONDS, JSON.stringify(data))
  );
};

export const getOauthSession = async (sessionId: string): Promise<OauthSession | null> => {
  const raw = await runRedis('đọc session', () => redis.get(sessionKey(sessionId)));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OauthSession;
  } catch (error) {
    const message = getErrorMessage(error);
    logger.warn(`Dữ liệu OAuth session trong Redis không hợp lệ: ${message}`);
    return null;
  }
};

export const deleteOauthSession = async (sessionId: string): Promise<void> => {
  await runRedis('xoá session', () => redis.del(sessionKey(sessionId)));
};

export default {
  saveOauthState,
  consumeOauthState,
  saveOauthSession,
  getOauthSession,
  deleteOauthSession,
};
