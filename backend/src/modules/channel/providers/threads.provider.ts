import { getErrorMessage } from '../../../utils/errorMessage.js';
import env from '../../../config/env.js';
import logger from '../../../utils/logger.js';
import { BadRequestError } from '../../../utils/errors/index.js';
import { countGraphemes } from '../../../utils/text.js';
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

interface ThreadsInsightsResponse {
  data?: Array<{
    name?: string;
    values?: Array<{ value?: number | Record<string, number> }>;
  }>;
}

const insightValue = (
  data: ThreadsInsightsResponse['data'],
  name: string
): number => {
  const insight = data?.find((item) => item.name === name);
  const value = insight?.values?.[0]?.value;
  return typeof value === 'number' ? value : 0;
};

const mapInsights = (
  body: ThreadsInsightsResponse,
  partialError: string | null
): ProviderMetrics => {
  const reposts = insightValue(body.data, 'reposts');
  const quotes = insightValue(body.data, 'quotes');
  const shares = insightValue(body.data, 'shares');

  return {
    reactions: insightValue(body.data, 'likes'),
    comments: insightValue(body.data, 'replies'),
    shares: reposts + quotes + shares,
    impressions: body.data?.some((item) => item.name === 'views')
      ? insightValue(body.data, 'views')
      : null,
    reach: null,
    reactionsDetail: null,
    partialError,
  };
};

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


const countUniqueLinks = (text: string): number =>
  new Set(text.match(/https?:\/\/[^\s]+/gi) ?? []).size;

const readProfile = async (accessToken: string): Promise<SocialProfile> => {  const url = new URL(`${GRAPH_BASE}/me`);
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
    supportsPublish: true,
    supportsMetrics: true,
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

  async publish(input: PublishInput): Promise<string> {
    const { externalAccountId, accessToken, text, imageUrls } = input;
    const label = 'Threads';

    if (!text.trim()) {
      throw new BadRequestError('Bài viết chưa có nội dung để đăng');
    }
    if (countGraphemes(text) > this.capabilities.maxTextLength) {
      throw new BadRequestError(`Nội dung vượt quá ${this.capabilities.maxTextLength} ký tự của Threads`);
    }
    if (imageUrls.length > this.capabilities.maxImages) {
      throw new BadRequestError(
        `Threads chỉ hỗ trợ tối đa ${this.capabilities.maxImages} ảnh mỗi bài`
      );
    }
    if (countUniqueLinks(text) > 5) {
      throw new BadRequestError('Threads chỉ cho phép tối đa 5 liên kết mỗi bài');
    }

    const createContainer = async (fields: Record<string, string>): Promise<string> => {
      const body = assertOk(
        await requestGraph<{ id: string } & ThreadsErrorBody>(
          new URL(`${GRAPH_BASE}/${externalAccountId}/threads`),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ ...fields, access_token: accessToken }).toString(),
          }
        )
      );
      return body.id;
    };

    const publishContainer = async (creationId: string): Promise<string> => {
      const body = assertOk(
        await requestGraph<{ id: string } & ThreadsErrorBody>(
          new URL(`${GRAPH_BASE}/${externalAccountId}/threads_publish`),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ creation_id: creationId, access_token: accessToken }).toString(),
          }
        )
      );
      return body.id;
    };

    let containerId: string;

    if (imageUrls.length === 0) {
      containerId = await createContainer({ media_type: 'TEXT', text });
    } else if (imageUrls.length === 1) {
      containerId = await createContainer({
        media_type: 'IMAGE',
        image_url: imageUrls[0],
        text,
      });
      await this.waitForContainer(containerId, accessToken);
    } else {
      const childIds: string[] = [];
      for (const imageUrl of imageUrls) {
        const childId = await createContainer({
          media_type: 'IMAGE',
          image_url: imageUrl,
          is_carousel_item: 'true',
        });
        await this.waitForContainer(childId, accessToken);
        childIds.push(childId);
      }

      containerId = await createContainer({
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        text,
      });
      await this.waitForContainer(containerId, accessToken);
    }

    input.onRemoteStart?.();
    logger.info(`Đăng Threads cho tài khoản ${externalAccountId} (${label})`);

    return publishContainer(containerId);
  }

  private async waitForContainer(containerId: string, accessToken: string): Promise<void> {
    const delays = [1000, 2000, 4000, 8000, 15_000, 30_000];

    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      const url = new URL(`${GRAPH_BASE}/${containerId}`);
      url.searchParams.set('fields', 'status,error_message');
      url.searchParams.set('access_token', accessToken);

      const body = assertOk(
        await requestGraph<{ status?: string; error_message?: string } & ThreadsErrorBody>(url)
      );

      if (body.status === 'FINISHED' || body.status === 'PUBLISHED') return;
      if (body.status === 'ERROR' || body.status === 'EXPIRED') {
        throw new BadRequestError(
          `Threads không xử lý được ảnh: ${body.error_message ?? body.status}`
        );
      }

      if (attempt === delays.length) break;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }

    throw new SocialTransientError('Threads đang xử lý ảnh. Hệ thống sẽ thử lại sau.');
  }

  async fetchMetrics(externalPostId: string, accessToken: string): Promise<ProviderMetrics> {
    const requestInsights = async (metric: string) => {
      const url = new URL(`${GRAPH_BASE}/${externalPostId}/insights`);
      url.searchParams.set('metric', metric);
      url.searchParams.set('access_token', accessToken);
      return requestGraph<ThreadsInsightsResponse & ThreadsErrorBody>(url);
    };

    const allMetrics = 'views,likes,replies,reposts,quotes,shares';
    const first = await requestInsights(allMetrics);

    if (first.ok && !first.body?.error) {
      return mapInsights(first.body ?? { data: [] }, null);
    }

    const partialError = (
      first.body?.error?.message ??
      first.body?.error_message ??
      `HTTP ${first.status}`
    ).slice(0, 255);

    const fallback = await requestInsights('likes,replies,reposts,quotes');
    const body = assertOk(fallback);
    return mapInsights(body, partialError);
  }
}

export const threadsProvider = new ThreadsProvider();

export default threadsProvider;
