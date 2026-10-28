import { AtSign, Link2, Share2, type LucideIcon } from 'lucide-react';
import type { ChannelPlatform } from './channel.types';

export type ChannelConnectKind = 'oauth' | 'unavailable';

export interface ChannelPlatformCapabilities {
  label: boolean;
  refreshProfile: boolean;
  metrics: boolean;
  scheduling: boolean;
  maxImages: number;
}

export interface ChannelPlatformMeta {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  connect: ChannelConnectKind;
  capabilities: ChannelPlatformCapabilities;
}

const PLATFORMS: Partial<Record<ChannelPlatform, ChannelPlatformMeta>> = {
  FACEBOOK: {
    label: 'Facebook Page',
    shortLabel: 'Facebook',
    icon: Share2,
    connect: 'oauth',
    capabilities: {
      label: true,
      refreshProfile: true,
      metrics: true,
      scheduling: true,
      maxImages: 10,
    },
  },
  THREADS: {
    label: 'Threads',
    shortLabel: 'Threads',
    icon: AtSign,
    connect: 'oauth',
    capabilities: {
      label: true,
      refreshProfile: true,
      metrics: true,
      scheduling: true,
      maxImages: 20,
    },
  },
};

export const CONNECTABLE_PLATFORMS = Object.keys(PLATFORMS) as ChannelPlatform[];

export const getChannelPlatformMeta = (platform: string): ChannelPlatformMeta => {
  const meta = PLATFORMS[platform as ChannelPlatform];
  if (meta) return meta;

  return {
    label: platform,
    shortLabel: platform,
    icon: Link2,
    connect: 'unavailable',
    capabilities: { label: false, refreshProfile: false, metrics: false, scheduling: false, maxImages: 0 },
  };
};
