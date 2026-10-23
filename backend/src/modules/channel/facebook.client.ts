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

  private async graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.graphBase}${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const body = (await response.json()) as T & FacebookErrorBody;

      if (!response.ok || body.error) {
        const err = body.error;
        const message = err?.message ?? `HTTP ${response.status}`;
        logger.warn(
          `Facebook Graph API lỗi [code: ${err?.code ?? 'N/A'}, subcode: ${err?.error_subcode ?? 'N/A'}]: ${message}`
        );

        if (err?.code === 190) {
          throw new FacebookTokenExpiredError();
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

        throw new BadRequestError(
          err?.message ? `Facebook: ${err.message}` : 'Facebook từ chối yêu cầu. Vui lòng thử lại.'
        );
      }

      return body;
    } catch (error) {
      if (error instanceof BadRequestError) throw error;

      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Không gọi được Facebook Graph API: ${message}`);
      throw new BadRequestError('Không thể kết nối tới Facebook. Vui lòng thử lại.');
    }
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
