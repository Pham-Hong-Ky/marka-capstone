import type { SocialPlatform } from '@prisma/client';
import { BadRequestError } from '../../utils/errors/index.js';
import channelRepository from '../channel/channel.repository.js';
import { getProvider } from '../channel/providers/provider.registry.js';

const isPublishable = (channel: { platform: SocialPlatform }): boolean => {
  try {
    return getProvider(channel.platform).capabilities.supportsPublish;
  } catch {
    return false;
  }
};

/**
 * Kênh mà AI có thể tối ưu nội dung: kênh thật, đang hoạt động và có provider đăng bài.
 * Trả về danh sách platform duy nhất theo thứ tự chọn của người dùng.
 */
export const resolveTargetPlatforms = async (
  workspaceId: string,
  channelIds?: string[]
): Promise<SocialPlatform[]> => {
  const channels = await channelRepository.findActiveRealChannels(workspaceId);
  const publishable = channels.filter(isPublishable);

  if (!channelIds || channelIds.length === 0) {
    if (publishable.length > 0) {
      throw new BadRequestError('Chọn ít nhất một kênh để AI viết nội dung phù hợp');
    }

    return [];
  }

  const ids = [...new Set(channelIds)];
  const selected = publishable.filter((channel) => ids.includes(channel.id));

  if (selected.length !== ids.length) {
    throw new BadRequestError('Kênh không hợp lệ hoặc không thuộc workspace');
  }

  return [...new Set(selected.map((channel) => channel.platform))];
};

export default { resolveTargetPlatforms };
