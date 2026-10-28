import { getErrorMessage } from '../../../utils/errorMessage.js';
import env from '../../../config/env.js';
import logger from '../../../utils/logger.js';
import { BadRequestError } from '../../../utils/errors/index.js';
import { requestGraph } from './graph-request.js';
import {
  SocialRateLimitError,
  SocialTokenExpiredError,
  SocialTransientError,
  type ProviderCapabilities,
  type ProviderMetrics,
  type PublishInput,
  type SocialAccount,
  type SocialProfile,
  type SocialProvider,
} from './social-provider.js';

interface ThreadsApiError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
}

interface ThreadsErrorBody {
  error?: ThreadsApiError;
  error_type?: string;
  error_message?: string;
}

interface ThreadsTokenResponse {
  access_token: string;
}

interface ThreadsProfileResponse {
  id: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
}

const GRAPH_BASE = 'https://graph.threads.com/v1.0';
const AUTHORIZE_URL = 'https://threads.com/oauth/authorize';
const TOKEN_URL = 'https://graph.threads.com/oauth/access_token';
const LONG_TOKEN_URL = 'https://graph.threads.com/access_token';
const REFRESH_URL = 'https://graph.threads.com/refresh_access_token';
const SCOPES = ['threads_basic', 'threads_content_publish', 'threads_manage_insights'];

const throwThreadsError = (status: number, body: ThreadsErrorBody | null): never => {
  const error = body?.error;
  const message = error?.message ?? body?.error_message ?? '';

  logger.warn(
    `Threads API lỗi [status: ${status}, code: ${error?.code ?? 'N/A'}, type: ${
      error?.type ?? body?.error_type ?? 'N/A'
    }]`
  );

  if (
    error?.code === 190 ||
    /expired|invalid.*token|session.*invalid/i.test(message)
  ) {
    throw new SocialTokenExpiredError();
  }

  if (
    error?.code === 4 ||
    error?.code === 17 ||
    error?.code === 32 ||
    error?.code === 613 ||
    status === 429
  ) {
    throw new SocialRateLimitError();
  }

  if (/24 hours|too new/i.test(message)) {
    throw new SocialTransientError('Token Threads chưa đủ 24 giờ để gia hạn.');
  }

  if (status >= 500) {
    throw new SocialTransientError('Threads đang gặp sự cố. Hệ thống sẽ thử lại sau.');
  }

  throw new BadRequestError('Threads từ chối yêu cầu. Vui lòng thử lại.');
};

const assertOk = <T extends ThreadsErrorBody>(
  result: { ok: boolean; status: number; body: T | null }
): T => {
  if (!result.ok || result.body?.error) {
    throwThreadsError(result.status, result.body);
  }
  return result.body ?? ({} as T);
};

const readProfile = async (accessToken: string): Promise<SocialProfile> => {
  const url = new URL(`${GRAPH_BASE}/me`);
  url.searchParams.set('fields', 'id,username,name,threads_profile_picture_url');
  url.searchParams.set('access_token', accessToken);

  const body = assertOk(
    await requestGraph<ThreadsProfileResponse & ThreadsErrorBody>(url)
  );

  return {
    id: body.id,
    name: body.name || (body.username ? `@${body.username}` : 'Threads'),
    avatar: body.threads_profile_picture_url ?? null,
  };
};

export class ThreadsProvider implements SocialProvider {
  readonly platform = 'THREADS' as const;

  readonly capabilities: ProviderCapabilities = {
    connect: 'single-account',
    supportsPublish: false,
    supportsMetrics: false,
    supportsRefreshProfile: true,
    supportsTokenRefresh: true,
    maxTextLength: 500,
    maxImages: 20,
  };

  isConfigured(): boolean {
    return Boolean(env.THREADS_APP_ID && env.THREADS_APP_SECRET && env.THREADS_REDIRECT_URI);
  }

  buildAuthorizationUrl(state: string): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', env.THREADS_APP_ID);
    url.searchParams.set('redirect_uri', env.THREADS_REDIRECT_URI);
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCodeForAccounts(code: string): Promise<SocialAccount[]> {
    const tokenBody = assertOk(
      await requestGraph<ThreadsTokenResponse & ThreadsErrorBody>(new URL(TOKEN_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.THREADS_APP_ID,
          client_secret: env.THREADS_APP_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: env.THREADS_REDIRECT_URI,
        }).toString(),
      })
    );

    const longUrl = new URL(LONG_TOKEN_URL);
    longUrl.searchParams.set('grant_type', 'th_exchange_token');
    longUrl.searchParams.set('client_secret', env.THREADS_APP_SECRET);
    longUrl.searchParams.set('access_token', tokenBody.access_token);

    const longBody = assertOk(
      await requestGraph<ThreadsTokenResponse & ThreadsErrorBody>(longUrl)
    );

    const profile = await readProfile(longBody.access_token);

    return [
      {
        externalAccountId: profile.id,
        name: profile.name,
        avatar: profile.avatar,
        accessToken: longBody.access_token,
      },
    ];
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    return readProfile(accessToken);
  }

  async refreshToken(accessToken: string): Promise<string> {
    const url = new URL(REFRESH_URL);
    url.searchParams.set('grant_type', 'th_refresh_token');
    url.searchParams.set('access_token', accessToken);

    try {
      const body = assertOk(
        await requestGraph<ThreadsTokenResponse & ThreadsErrorBody>(url)
      );
      return body.access_token;
    } catch (error) {
      const message = getErrorMessage(error);
      if (/24 hours|too new/i.test(message)) {
        throw new SocialTransientError('Token Threads chưa đủ 24 giờ để gia hạn.');
      }
      throw error;
    }
  }

  async publish(_input: PublishInput): Promise<string> {
    throw new BadRequestError('Threads chưa hỗ trợ đăng bài');
  }

  async fetchMetrics(_externalPostId: string, _accessToken: string): Promise<ProviderMetrics> {
    throw new BadRequestError('Threads chưa hỗ trợ đồng bộ số liệu');
  }
}

export const threadsProvider = new ThreadsProvider();

export default threadsProvider;
