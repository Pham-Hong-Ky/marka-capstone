import type { SocialPlatform } from '@prisma/client';
import { BadRequestError } from '../../../utils/errors/index.js';
import { facebookProvider } from './facebook.provider.js';
import { threadsProvider } from './threads.provider.js';
import type { SocialProvider } from './social-provider.js';

const providers: Partial<Record<SocialPlatform, SocialProvider>> = {
  FACEBOOK: facebookProvider,
  THREADS: threadsProvider,
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
