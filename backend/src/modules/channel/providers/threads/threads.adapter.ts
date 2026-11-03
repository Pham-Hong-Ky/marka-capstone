import env from '../../../../config/env.js';
import type {
  ProviderCapabilities,
  ProviderMetrics,
  PublishInput,
  SocialAccount,
  SocialProfile,
  SocialProvider,
} from '../port/social-provider.port.js';
import { fetchThreadsMetrics } from './threads.metrics.js';
import {
  buildThreadsAuthorizationUrl,
  exchangeCodeForThreadsAccounts,
  readThreadsProfile,
  refreshThreadsToken,
} from './threads.oauth.js';
import { publishThreadsPost } from './threads.publish.js';

/**
 * Adapter Threads: chuyển các thao tác của port `SocialProvider`
 * xuống module Threads tương ứng.
 */
export class ThreadsAdapter implements SocialProvider {
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
    return buildThreadsAuthorizationUrl(state);
  }

  exchangeCodeForAccounts(code: string): Promise<SocialAccount[]> {
    return exchangeCodeForThreadsAccounts(code);
  }

  fetchProfile(accessToken: string): Promise<SocialProfile> {
    return readThreadsProfile(accessToken);
  }

  refreshToken(accessToken: string): Promise<string> {
    return refreshThreadsToken(accessToken);
  }

  publish(input: PublishInput): Promise<string> {
    return publishThreadsPost(input, this.capabilities);
  }

  fetchMetrics(externalPostId: string, accessToken: string): Promise<ProviderMetrics> {
    return fetchThreadsMetrics(externalPostId, accessToken);
  }
}

export const threadsAdapter = new ThreadsAdapter();
export default threadsAdapter;
