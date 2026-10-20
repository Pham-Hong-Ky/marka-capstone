export type ChannelPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'ZALO';
export type ChannelType = 'REAL' | 'SIMULATED';
export type ChannelStatus = 'ACTIVE' | 'EXPIRED';

export interface ChannelConnection {
  id: string;
  platform: ChannelPlatform;
  type: ChannelType;
  name: string;
  avatar: string | null;
  externalAccountId: string;
  status: ChannelStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelsResponse {
  channels: ChannelConnection[];
}

export interface FacebookPendingPage {
  id: string;
  name: string;
  avatar: string | null;
}

export interface FacebookPendingPagesResponse {
  pages: FacebookPendingPage[];
}

export interface FacebookOauthUrlResponse {
  url: string;
}
