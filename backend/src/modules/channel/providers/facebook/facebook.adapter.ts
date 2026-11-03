import env from '../../../../config/env.js';
import type {
  ProviderCapabilities,
  ProviderMetrics,
  PublishInput,
  SocialAccount,
  SocialProfile,
  SocialProvider,
} from '../port/social-provider.port.js';
import { facebookGet } from './facebook.graph.js';
import { fetchFacebookMetrics } from './facebook.metrics.js';
import {
  buildFacebookAuthorizationUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchManagedPages,
} from './facebook.oauth.js';
import { facebookPublisher } from './facebook.publish.js';

/**
 * Adapter Facebook: chỉ chuyển các thao tác của port `SocialProvider`
 * xuống module Facebook tương ứng, không chứa chi tiết Graph API.
 */
export class FacebookAdapter implements SocialProvider {
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
    return buildFacebookAuthorizationUrl(state);
  }

  async exchangeCodeForAccounts(code: string): Promise<SocialAccount[]> {
    const shortToken = await exchangeCodeForToken(code);
    const userToken = await exchangeForLongLivedToken(shortToken);

    return fetchManagedPages(userToken);
  }

  async fetchProfile(accessToken: string): Promise<SocialProfile> {
    const response = await facebookGet<{
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

  publish(input: PublishInput): Promise<string> {
    return facebookPublisher.publish(input);
  }

  fetchMetrics(externalPostId: string, accessToken: string): Promise<ProviderMetrics> {
    return fetchFacebookMetrics(externalPostId, accessToken);
  }
}

export const facebookAdapter = new FacebookAdapter();
export default facebookAdapter;
