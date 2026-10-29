export type ChannelPlatform = 'FACEBOOK' | 'THREADS' | 'INSTAGRAM' | 'TIKTOK' | 'ZALO';
export type ChannelType = 'REAL' | 'SIMULATED';
export type ChannelStatus = 'ACTIVE' | 'EXPIRED';

export interface ChannelConnection {
  id: string;
  platform: ChannelPlatform;
  type: ChannelType;
  name: string;
  label: string | null;
  avatar: string | null;
  externalAccountId: string;
  status: ChannelStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelsResponse {
  channels: ChannelConnection[];
}

export interface ChannelStats {
  publishedPosts: number;
  reactions: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  lastPublishedAt: string | null;
  lastSyncedAt: string | null;
}

export interface ChannelDetailResponse {
  channel: ChannelConnection;
  stats: ChannelStats;
}

export interface PendingAccount {
  externalAccountId: string;
  name: string;
  avatar: string | null;
}

export interface PendingAccountsResponse {
  accounts: PendingAccount[];
}

export interface OauthUrlResponse {
  url: string;
}
