import { createHmac } from 'node:crypto';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import { BadRequestError } from '../../utils/errors/index.js';

export class FacebookTokenExpiredError extends BadRequestError {
  constructor(message = 'Phiên đăng nhập hoặc Token Facebook đã hết hạn / bị thu hồi. Vui lòng kết nối lại.') {
    super(message);
    this.name = 'FacebookTokenExpiredError';
  }
}

/** Lỗi tạm thời (mạng/5xx) — có thể thử lại an toàn. */
export class FacebookTransientError extends BadRequestError {
  constructor(message = 'Không thể kết nối tới Facebook. Vui lòng thử lại.') {
    super(message);
    this.name = 'FacebookTransientError';
  }
}

export class FacebookRateLimitError extends FacebookTransientError {
  constructor(message = 'Facebook đang giới hạn tần suất. Hệ thống sẽ thử lại sau.') {
    super(message);
    this.name = 'FacebookRateLimitError';
  }
}

export interface FacebookPage {
  id: string;
  name: string;
  avatar: string | null;
  accessToken: string;
}

export interface FacebookApiError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface FacebookErrorBody {
  error?: FacebookApiError;
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

export class FacebookClient {
  private readonly graphBase = 'https://graph.facebook.com/v21.0';
  private readonly authBase = 'https://www.facebook.com/v21.0/dialog/oauth';
  private readonly scopes = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];

  isFacebookConfigured(): boolean {
    return Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET && env.FACEBOOK_REDIRECT_URI);
  }

  buildAuthorizationUrl(state: string): string {
    const url = new URL(this.authBase);
    url.searchParams.set('client_id', env.FACEBOOK_APP_ID);
    url.searchParams.set('redirect_uri', env.FACEBOOK_REDIRECT_URI);
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.scopes.join(','));
    return url.toString();
  }

  isTokenExpiredError(error: unknown): boolean {
    if (error instanceof FacebookTokenExpiredError) return true;
    if (error instanceof Error && (error.message.includes('190') || error.message.includes('hết hạn'))) {
      return true;
    }
    return false;
  }

  private async graphRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    params: Record<string, string>,
    form?: Record<string, string>,
    timeoutMs = 10_000
  ): Promise<T> {
    const url = new URL(`${this.graphBase}${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    try {
      const init: RequestInit = {
        method,
        signal: AbortSignal.timeout(timeoutMs),
      };
      if (form) {
        init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        init.body = new URLSearchParams(form).toString();
      }

      const response = await fetch(url, init);

      const rawBody = await response.text();
      let body: (T & FacebookErrorBody) | null = null;
      try {
        body = rawBody ? (JSON.parse(rawBody) as T & FacebookErrorBody) : null;
      } catch {
        body = null;
      }

      const err = body?.error;
      if (!response.ok || err) {
        const message = err?.message ?? `HTTP ${response.status}`;
        logger.warn(
          `Facebook Graph API lỗi [code: ${err?.code ?? 'N/A'}, subcode: ${err?.error_subcode ?? 'N/A'}]: ${message}`
        );

        if (err?.code === 190) {
          throw new FacebookTokenExpiredError();
        }

        if (
          err?.code === 4 ||
          err?.code === 17 ||
          err?.code === 32 ||
          err?.code === 613 ||
          response.status === 429
        ) {
          throw new FacebookRateLimitError();
        }

        if (
          err?.code === 100 &&
          (message.includes('code') || message.includes('expired') || message.includes('consumed'))
        ) {
          throw new BadRequestError('Mã xác thực Facebook không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
        }

        if (err?.code === 10 || err?.code === 200 || err?.code === 102) {
          throw new BadRequestError('Tài khoản Facebook không đủ quyền hoặc đã từ chối cấp quyền.');
        }

        if (response.status >= 500) {
          throw new FacebookTransientError('Facebook đang gặp sự cố. Hệ thống sẽ thử lại sau.');
        }

        throw new BadRequestError(
          err?.message ? `Facebook: ${err.message}` : 'Facebook từ chối yêu cầu. Vui lòng thử lại.'
        );
      }

      return (body ?? {}) as T;
    } catch (error) {
      if (error instanceof BadRequestError) throw error;

      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Không gọi được Facebook Graph API: ${message}`);
      throw new FacebookTransientError();
    }
  }

  private async graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
    return this.graphRequest<T>('GET', path, params);
  }

  async uploadPagePhoto(pageId: string, accessToken: string, imageUrl: string): Promise<string> {
    const response = await this.graphRequest<{ id: string }>(
      'POST',
      `/${pageId}/photos`,
      {},
      {
        published: 'false',
        url: imageUrl,
        access_token: accessToken,
      },
      30_000
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

    const response = await this.graphRequest<{ id: string }>(
      'POST',
      `/${pageId}/feed`,
      {},
      form,
      30_000
    );

    return response.id;
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

  async fetchManagedPages(userToken: string): Promise<FacebookPage[]> {
    const appSecretProof = createHmac('sha256', env.FACEBOOK_APP_SECRET)
      .update(userToken)
      .digest('hex');

    const allPages: FacebookPage[] = [];
    let afterCursor: string | undefined = undefined;
    const MAX_PAGES_FETCH = 500;

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
          id: page.id,
          name: page.name,
          avatar: page.picture?.data?.url ?? null,
          accessToken: page.access_token,
        }));

      allPages.push(...validPages);

      afterCursor =
        response.paging?.next && response.paging?.cursors?.after
          ? response.paging.cursors.after
          : undefined;
    } while (afterCursor && allPages.length < MAX_PAGES_FETCH);

    return allPages;
  }

  async verifyPageToken(pageToken: string): Promise<boolean> {
    try {
      await this.graphGet<{ id: string }>('/me', {
        fields: 'id',
        access_token: pageToken,
      });
      return true;
    } catch (error) {
      if (this.isTokenExpiredError(error)) {
        return false;
      }
      throw error;
    }
  }
}

export const facebookClient = new FacebookClient();

export default facebookClient;
