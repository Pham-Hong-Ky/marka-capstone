import { getErrorMessage } from '../../utils/errorMessage.js';
import logger from '../../utils/logger.js';
import { decryptOrNull, encrypt } from '../../utils/encryption.js';
import channelRepository from './channel.repository.js';
import { getProvider, listProviders } from './providers/provider.registry.js';
import { SocialTokenExpiredError } from './providers/social-provider.js';

export interface TokenRefreshResult {
  total: number;
  refreshed: number;
  expired: number;
  skipped: number;
  failed: number;
}

const TOO_NEW_PATTERN = /24 giờ|24 hours|too new/i;

export const refreshChannelTokens = async (): Promise<TokenRefreshResult> => {
  const platforms = listProviders()
    .filter((provider) => provider.capabilities.supportsTokenRefresh)
    .map((provider) => provider.platform);

  if (platforms.length === 0) {
    return { total: 0, refreshed: 0, expired: 0, skipped: 0, failed: 0 };
  }

  const channels = await channelRepository.findChannelsWithRefreshableTokens(platforms);
  const result: TokenRefreshResult = {
    total: channels.length,
    refreshed: 0,
    expired: 0,
    skipped: 0,
    failed: 0,
  };

  for (const channel of channels) {
    const token = decryptOrNull(channel.accessToken);
    const provider = getProvider(channel.platform);

    if (!token || !provider.refreshToken) {
      result.skipped += 1;
      continue;
    }

    try {
      const refreshedToken = await provider.refreshToken(token);
      const encrypted = encrypt(refreshedToken);

      if (!encrypted) {
        result.failed += 1;
        logger.warn(`Không mã hoá được token mới của kênh ${channel.id}`);
        continue;
      }

      await channelRepository.updateChannelToken(channel.id, encrypted);
      result.refreshed += 1;
    } catch (error) {
      const message = getErrorMessage(error);

      if (error instanceof SocialTokenExpiredError) {
        await channelRepository.updateChannelStatus(channel.id, 'EXPIRED');
        result.expired += 1;
        logger.warn(`Token của kênh ${channel.id} đã hết hạn, chuyển EXPIRED`);
        continue;
      }

      if (TOO_NEW_PATTERN.test(message)) {
        result.skipped += 1;
        continue;
      }

      result.failed += 1;
      logger.warn(`Không gia hạn được token của kênh ${channel.id}: ${message}`);
    }
  }

  return result;
};

export default { refreshChannelTokens };
