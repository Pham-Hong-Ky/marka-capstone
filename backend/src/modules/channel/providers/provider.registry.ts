import type { SocialPlatform } from '@prisma/client';
import { BadRequestError } from '../../../utils/errors/index.js';
import { facebookAdapter } from './facebook/facebook.adapter.js';
import { threadsAdapter } from './threads/threads.adapter.js';
import type { SocialProvider } from './port/social-provider.port.js';

const providers: Partial<Record<SocialPlatform, SocialProvider>> = {
  FACEBOOK: facebookAdapter,
  THREADS: threadsAdapter,
};

export const getProvider = (platform: SocialPlatform): SocialProvider => {
  const provider = providers[platform];
  if (!provider) {
    throw new BadRequestError(`Nền tảng ${platform} chưa được hỗ trợ`);
  }
  return provider;
};

export const listProviders = (): SocialProvider[] =>
  Object.values(providers).filter((provider): provider is SocialProvider => Boolean(provider));
