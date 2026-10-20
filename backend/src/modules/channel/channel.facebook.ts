import { createHmac } from 'node:crypto';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import { BadRequestError } from '../../utils/errors/index.js';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const AUTH_BASE = 'https://www.facebook.com/v21.0/dialog/oauth';
const SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];

export interface FacebookPage {
  id: string;
  name: string;
  avatar: string | null;
  accessToken: string;
}

interface FacebookErrorBody {
  error?: { message?: string };
}

interface FacebookTokenResponse {
  access_token: string;
}

interface FacebookAccountsResponse {
  data: Array<{
    id: string;
    name: string;
    access_token: string;
    picture?: { data?: { url?: string } };
  }>;
}

export const isFacebookConfigured = (): boolean =>
  Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET && env.FACEBOOK_REDIRECT_URI);

export const buildAuthorizationUrl = (state: string): string => {
  const url = new URL(AUTH_BASE);
  url.searchParams.set('client_id', env.FACEBOOK_APP_ID);
  url.searchParams.set('redirect_uri', env.FACEBOOK_REDIRECT_URI);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(','));
  return url.toString();
};

const graphGet = async <T>(path: string, params: Record<string, string>): Promise<T> => {
  const url = new URL(`${GRAPH_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = (await response.json()) as T & FacebookErrorBody;

    if (!response.ok || body.error) {
      const message = body.error?.message ?? `HTTP ${response.status}`;
      logger.warn(`Facebook Graph API lỗi: ${message}`);
      throw new BadRequestError('Facebook từ chối yêu cầu. Vui lòng thử lại.');
    }

    return body;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;

    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Không gọi được Facebook Graph API: ${message}`);
    throw new BadRequestError('Không thể kết nối tới Facebook. Vui lòng thử lại.');
  }
};

export const exchangeCodeForToken = async (code: string): Promise<string> => {
  const response = await graphGet<FacebookTokenResponse>('/oauth/access_token', {
    client_id: env.FACEBOOK_APP_ID,
    client_secret: env.FACEBOOK_APP_SECRET,
    redirect_uri: env.FACEBOOK_REDIRECT_URI,
    code,
  });

  return response.access_token;
};

export const exchangeForLongLivedToken = async (token: string): Promise<string> => {
  const response = await graphGet<FacebookTokenResponse>('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: env.FACEBOOK_APP_ID,
    client_secret: env.FACEBOOK_APP_SECRET,
    fb_exchange_token: token,
  });

  return response.access_token;
};

export const fetchManagedPages = async (userToken: string): Promise<FacebookPage[]> => {
  const appSecretProof = createHmac('sha256', env.FACEBOOK_APP_SECRET)
    .update(userToken)
    .digest('hex');

  const response = await graphGet<FacebookAccountsResponse>('/me/accounts', {
    fields: 'id,name,access_token,picture{url}',
    limit: '100',
    access_token: userToken,
    appsecret_proof: appSecretProof,
  });

  // Page không có access_token nghĩa là user không có quyền quản lý Page đó.
  return response.data
    .filter((page) => Boolean(page.access_token))
    .map((page) => ({
      id: page.id,
      name: page.name,
      avatar: page.picture?.data?.url ?? null,
      accessToken: page.access_token,
    }));
};

export default {
  isFacebookConfigured,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchManagedPages,
};
