import env from '../../../../config/env.js';
import { getErrorMessage } from '../../../../utils/errorMessage.js';
import { SocialTransientError } from '../errors/social.errors.js';
import type { SocialAccount, SocialProfile } from '../port/social-provider.port.js';
import {
  AUTHORIZE_URL,
  LONG_TOKEN_URL,
  REFRESH_URL,
  TOKEN_URL,
  threadsApiUrl,
  threadsRequest,
  type ThreadsProfileResponse,
  type ThreadsTokenResponse,
} from './threads.graph.js';

const SCOPES = ['threads_basic', 'threads_content_publish', 'threads_manage_insights'];

export const buildThreadsAuthorizationUrl = (state: string): string => {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', env.THREADS_APP_ID);
  url.searchParams.set('redirect_uri', env.THREADS_REDIRECT_URI);
  url.searchParams.set('scope', SCOPES.join(','));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
};

export const readThreadsProfile = async (accessToken: string): Promise<SocialProfile> => {
  const body = await threadsRequest<ThreadsProfileResponse>(
    threadsApiUrl('/me', {
      fields: 'id,username,name,threads_profile_picture_url',
      access_token: accessToken,
    })
  );

  return {
    id: body.id,
    name: body.name || (body.username ? `@${body.username}` : 'Threads'),
    avatar: body.threads_profile_picture_url ?? null,
  };
};

export const exchangeCodeForThreadsAccounts = async (code: string): Promise<SocialAccount[]> => {
  const tokenBody = await threadsRequest<ThreadsTokenResponse>(new URL(TOKEN_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.THREADS_APP_ID,
      client_secret: env.THREADS_APP_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.THREADS_REDIRECT_URI,
    }).toString(),
  });

  const longUrl = new URL(LONG_TOKEN_URL);
  longUrl.searchParams.set('grant_type', 'th_exchange_token');
  longUrl.searchParams.set('client_secret', env.THREADS_APP_SECRET);
  longUrl.searchParams.set('access_token', tokenBody.access_token);

  const longBody = await threadsRequest<ThreadsTokenResponse>(longUrl);

  const profile = await readThreadsProfile(longBody.access_token);

  return [
    {
      externalAccountId: profile.id,
      name: profile.name,
      avatar: profile.avatar,
      accessToken: longBody.access_token,
    },
  ];
};

export const refreshThreadsToken = async (accessToken: string): Promise<string> => {
  const url = new URL(REFRESH_URL);
  url.searchParams.set('grant_type', 'th_refresh_token');
  url.searchParams.set('access_token', accessToken);

  try {
    const body = await threadsRequest<ThreadsTokenResponse>(url);
    return body.access_token;
  } catch (error) {
    const message = getErrorMessage(error);
    if (/24 hours|too new/i.test(message)) {
      throw new SocialTransientError('Token Threads chưa đủ 24 giờ để gia hạn.');
    }
    throw error;
  }
};
