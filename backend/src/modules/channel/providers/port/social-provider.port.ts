import type { SocialPlatform } from '@prisma/client';

export interface ProviderCapabilities {
  connect: 'multi-account' | 'single-account';
  supportsPublish: boolean;
  supportsMetrics: boolean;
  supportsRefreshProfile: boolean;
  supportsTokenRefresh: boolean;
  maxTextLength: number;
  maxImages: number;
}

export interface SocialAccount {
  externalAccountId: string;
  name: string;
  avatar: string | null;
  accessToken: string;
}

export interface SocialProfile {
  id: string;
  name: string;
  avatar: string | null;
}

export interface PublishInput {
  externalAccountId: string;
  accessToken: string;
  text: string;
  imageUrls: string[];
  /** Báo cho lớp trên biết phần tạo bài thật đã bắt đầu, để không retry gây đăng trùng. */
  onRemoteStart?: () => void;
}

export interface ProviderMetrics {
  reactions: number;
  comments: number;
  shares: number;
  impressions: number | null;
  reach: number | null;
  reactionsDetail: Record<string, number> | null;
  partialError: string | null;
}

//adapter
export interface SocialProvider {
  readonly platform: SocialPlatform;
  readonly capabilities: ProviderCapabilities;
  isConfigured(): boolean;
  buildAuthorizationUrl(state: string): string;
  exchangeCodeForAccounts(code: string): Promise<SocialAccount[]>;
  fetchProfile(accessToken: string): Promise<SocialProfile>;
  publish(input: PublishInput): Promise<string>;
  fetchMetrics(externalPostId: string, accessToken: string): Promise<ProviderMetrics>;
  refreshToken?(accessToken: string): Promise<string>;
}
