import type { SocialPlatform } from '@prisma/client';
import { BadRequestError } from '../../../utils/errors/index.js';

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

export class SocialTokenExpiredError extends BadRequestError {
  constructor(
    message = 'Phiên đăng nhập hoặc token đã hết hạn / bị thu hồi. Vui lòng kết nối lại.'
  ) {
    super(message);
    this.name = 'SocialTokenExpiredError';
  }
}

/** Lỗi tạm thời (mạng/timeout/5xx) — có thể thử lại an toàn. */
export class SocialTransientError extends BadRequestError {
  constructor(message = 'Không thể kết nối tới nền tảng. Vui lòng thử lại.') {
    super(message);
    this.name = 'SocialTransientError';
  }
}

export class SocialRateLimitError extends SocialTransientError {
  constructor(message = 'Nền tảng đang giới hạn tần suất. Hệ thống sẽ thử lại sau.') {
    super(message);
    this.name = 'SocialRateLimitError';
  }
}
