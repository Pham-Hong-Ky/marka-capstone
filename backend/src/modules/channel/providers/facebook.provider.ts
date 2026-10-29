import { createHmac } from 'node:crypto';
import env from '../../../config/env.js';
import logger from '../../../utils/logger.js';
import { getErrorMessage } from '../../../utils/errorMessage.js';
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

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const AUTH_DIALOG_URL = 'https://www.facebook.com/v21.0/dialog/oauth';
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'read_insights',
];
const MAX_PAGES_FETCH = 500;
const PUBLISH_TIMEOUT_MS = 30_000;

interface FacebookApiError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface FacebookErrorBody {
  error?: FacebookApiError;
}

interface FacebookIdResponse {
  id: string;
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
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
}

interface FacebookPostFieldsResponse {
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

interface FacebookInsightsResponse {
  data?: Array<{
    name?: string;
    values?: Array<{ value?: number | Record<string, number> }>;
  }>;
}

/** Map mã lỗi Graph API sang lỗi chung của provider. */
const throwGraphError = (status: number, error: FacebookApiError | undefined): never => {
  const message = error?.message ?? '';

  // Chỉ log mã lỗi do ta kiểm soát. Message thô từ Graph có thể kèm giá trị
  // tham số của request (kể cả access_token) nên không được ghi log.
  logger.warn(
    `Facebook Graph API lỗi [status: ${status}, code: ${error?.code ?? 'N/A'}, subcode: ${error?.error_subcode ?? 'N/A'}, type: ${error?.type ?? 'N/A'}]`
  );

  if (error?.code === 190) {
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

  if (
    error?.code === 100 &&
    (message.includes('code') || message.includes('expired') || message.includes('consumed'))
  ) {
    throw new BadRequestError('Mã xác thực Facebook không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
  }

  if (error?.code === 10 || error?.code === 200 || error?.code === 102) {
    throw new BadRequestError('Tài khoản Facebook không đủ quyền hoặc đã từ chối cấp quyền.');
  }

  if (status >= 500) {
    throw new SocialTransientError('Facebook đang gặp sự cố. Hệ thống sẽ thử lại sau.');
  }

  // Không trả nguyên văn message của nền tảng cho người dùng: thường là tiếng Anh.
  throw new BadRequestError('Facebook từ chối yêu cầu. Vui lòng thử lại.');
};

export class FacebookProvider implements SocialProvider {
  readonly platform = 'FACEBOOK' as const;

  readonly capabilities: ProviderCapabilities = {
    connect: 'multi-account',
    supportsPublish: true,
    supportsMetrics: true,
    supportsRefreshProfile: true,
    supportsTokenRefresh: false,
    maxTextLength: 63_206,
    maxImages: 10,
  };

  isConfigured(): boolean {
    return Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET && env.FACEBOOK_REDIRECT_URI);
  }

  buildAuthorizationUrl(state: string): string {
    const url = new URL(AUTH_DIALOG_URL);
    url.searchParams.set('client_id', env.FACEBOOK_APP_ID);
    url.searchParams.set('redirect_uri', env.FACEBOOK_REDIRECT_URI);
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES.join(','));
    return url.toString();
  }

  async exchangeCodeForAccounts(code: string): Promise<SocialAccount[]> {
    const shortToken = await this.exchangeCodeForToken(code);
    const userToken = await this.exchangeForLongLivedToken(shortToken);

    return this.fetchManagedPages(userToken);
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const response = await this.graphGet<FacebookTokenResponse>('/oauth/access_token', {
      client_id: env.FACEBOOK_APP_ID,
      client_secret: env.FACEBOOK_APP_SECRET,
      redirect_uri: env.FACEBOOK_REDIRECT_URI,
      code,
    });

    return response.access_token;
  }

  async exchangeForLongLivedToken(token: string): Promise<string> {
    const response = await this.graphGet<FacebookTokenResponse>('/oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: env.FACEBOOK_APP_ID,
      client_secret: env.FACEBOOK_APP_SECRET,
      fb_exchange_token: token,
    });

    return response.access_token;
  }

  async fetchManagedPages(userToken: string): Promise<SocialAccount[]> {
    const appSecretProof = createHmac('sha256', env.FACEBOOK_APP_SECRET)
      .update(userToken)
      .digest('hex');

    const accounts: SocialAccount[] = [];
    let afterCursor: string | undefined = undefined;

    do {
      const params: Record<string, string> = {
        fields: 'id,name,access_token,picture{url}',
        limit: '100',
        access_token: userToken,
        appsecret_proof: appSecretProof,
      };

      if (afterCursor) {
        params.after = afterCursor;
      }

      const response = await this.graphGet<FacebookAccountsResponse>('/me/accounts', params);

      const validPages = response.data
        .filter((page) => Boolean(page.access_token))
        .map((page) => ({
          externalAccountId: page.id,
          name: page.name,
          avatar: page.picture?.data?.url ?? null,
          accessToken: page.access_token,
        }));

      accounts.push(...validPages);

      afterCursor =
        response.paging?.next && response.paging?.cursors?.after
          ? response.paging.cursors.after
          : undefined;
    } while (afterCursor && accounts.length < MAX_PAGES_FETCH);

    return accounts;
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    const response = await this.graphGet<{
      id: string;
      name: string;
      picture?: { data?: { url?: string } };
    }>('/me', {
      fields: 'id,name,picture{url}',
      access_token: accessToken,
    });

    return {
      id: response.id,
      name: response.name,
      avatar: response.picture?.data?.url ?? null,
    };
  }

  async publish(input: PublishInput): Promise<string> {
    const mediaIds: string[] = [];
    for (const imageUrl of input.imageUrls) {
      mediaIds.push(
        await this.uploadPagePhoto(input.externalAccountId, input.accessToken, imageUrl)
      );
    }

    input.onRemoteStart?.();

    return this.createPageFeedPost(
      input.externalAccountId,
      input.accessToken,
      input.text,
      mediaIds
    );
  }

  async uploadPagePhoto(pageId: string, accessToken: string, imageUrl: string): Promise<string> {
    const response = await this.graph<FacebookIdResponse>(
      'POST',
      `/${pageId}/photos`,
      {},
      {
        published: 'false',
        url: imageUrl,
        access_token: accessToken,
      },
      PUBLISH_TIMEOUT_MS
    );

    return response.id;
  }

  async createPageFeedPost(
    pageId: string,
    accessToken: string,
    message: string,
    mediaIds: string[] = []
  ): Promise<string> {
    const form: Record<string, string> = {
      message,
      access_token: accessToken,
    };

    if (mediaIds.length > 0) {
      form.attached_media = JSON.stringify(mediaIds.map((id) => ({ media_fbid: id })));
    }

    const response = await this.graph<FacebookIdResponse>(
      'POST',
      `/${pageId}/feed`,
      {},
      form,
      PUBLISH_TIMEOUT_MS
    );

    return response.id;
  }

  async fetchMetrics(externalPostId: string, accessToken: string): Promise<ProviderMetrics> {
    const fields = await this.graphGet<FacebookPostFieldsResponse>(`/${externalPostId}`, {
      fields: 'reactions.limit(0).summary(true),comments.limit(0).summary(true),shares',
      access_token: accessToken,
    });

    const metrics: ProviderMetrics = {
      reactions: fields.reactions?.summary?.total_count ?? 0,
      comments: fields.comments?.summary?.total_count ?? 0,
      shares: fields.shares?.count ?? 0,
      impressions: null,
      reach: null,
      reactionsDetail: null,
      partialError: null,
    };

    try {
      const insights = await this.graphGet<FacebookInsightsResponse>(
        `/${externalPostId}/insights`,
        {
          metric: 'post_impressions,post_impressions_unique,post_reactions_by_type_total',
          period: 'lifetime',
          access_token: accessToken,
        }
      );

      for (const insight of insights.data ?? []) {
        const value = insight.values?.[0]?.value;

        if (insight.name === 'post_impressions' && typeof value === 'number') {
          metrics.impressions = value;
        }
        if (insight.name === 'post_impressions_unique' && typeof value === 'number') {
          metrics.reach = value;
        }
        if (insight.name === 'post_reactions_by_type_total' && value && typeof value === 'object') {
          metrics.reactionsDetail = value;
        }
      }
    } catch (error) {
      if (error instanceof SocialTokenExpiredError) throw error;

      metrics.partialError = getErrorMessage(error);
      logger.warn(
        `Không lấy được insights của bài ${externalPostId}: ${metrics.partialError}`
      );
    }

    return metrics;
  }

  private async graph<T>(
    method: 'GET' | 'POST',
    path: string,
    params: Record<string, string>,
    form?: Record<string, string>,
    timeoutMs?: number
  ): Promise<T> {
    const url = new URL(`${GRAPH_BASE}${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    const init: RequestInit = { method };
    if (form) {
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      init.body = new URLSearchParams(form).toString();
    }

    const { ok, status, body } = await requestGraph<T & FacebookErrorBody>(url, init, timeoutMs);

    if (!ok || body?.error) {
      throwGraphError(status, body?.error);
    }

    return (body ?? {}) as T;
  }

  private async graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
    return this.graph<T>('GET', path, params);
  }
}

export const facebookProvider = new FacebookProvider();

export default facebookProvider;
