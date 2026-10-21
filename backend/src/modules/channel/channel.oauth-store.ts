import redis from '../../config/redis.js';
import logger from '../../utils/logger.js';

const STATE_PREFIX = 'fb:oauth:state:';
const SESSION_PREFIX = 'fb:oauth:session:';
const TTL_SECONDS = 600;

export interface OauthState {
  userId: string;
  workspaceId: string;
}

export interface OauthSessionPage {
  id: string;
  name: string;
  avatar: string | null;
  accessTokenEncrypted: string;
}

export interface OauthSession {
  userId: string;
  workspaceId: string;
  pages: OauthSessionPage[];
}

const stateKey = (state: string) => `${STATE_PREFIX}${state}`;
const sessionKey = (sessionId: string) => `${SESSION_PREFIX}${sessionId}`;

export const saveOauthState = async (state: string, data: OauthState): Promise<void> => {
  await redis.setex(stateKey(state), TTL_SECONDS, JSON.stringify(data));
};

export const consumeOauthState = async (state: string): Promise<OauthState | null> => {
  const raw = await redis.getdel(stateKey(state));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OauthState;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Dữ liệu OAuth state trong Redis không hợp lệ: ${message}`);
    return null;
  }
};

export const saveOauthSession = async (sessionId: string, data: OauthSession): Promise<void> => {
  await redis.setex(sessionKey(sessionId), TTL_SECONDS, JSON.stringify(data));
};

export const getOauthSession = async (sessionId: string): Promise<OauthSession | null> => {
  const raw = await redis.get(sessionKey(sessionId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OauthSession;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Dữ liệu OAuth session trong Redis không hợp lệ: ${message}`);
    return null;
  }
};

export const deleteOauthSession = async (sessionId: string): Promise<void> => {
  await redis.del(sessionKey(sessionId));
};

export default {
  saveOauthState,
  consumeOauthState,
  saveOauthSession,
  getOauthSession,
  deleteOauthSession,
};
