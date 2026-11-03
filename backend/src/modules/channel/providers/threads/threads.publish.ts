import logger from '../../../../utils/logger.js';
import { BadRequestError } from '../../../../utils/errors/index.js';
import { countGraphemes } from '../../../../utils/text.js';
import { SocialTransientError } from '../errors/social.errors.js';
import type {
  ProviderCapabilities,
  PublishInput,
} from '../port/social-provider.port.js';
import { threadsApiUrl, threadsRequest } from './threads.graph.js';

const countUniqueLinks = (text: string): number =>
  new Set(text.match(/https?:\/\/[^\s]+/gi) ?? []).size;

const waitForContainer = async (containerId: string, accessToken: string): Promise<void> => {
  const delays = [1000, 2000, 4000, 8000, 15_000, 30_000];

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    const body = await threadsRequest<{ status?: string; error_message?: string }>(
      threadsApiUrl(`/${containerId}`, {
        fields: 'status,error_message',
        access_token: accessToken,
      })
    );

    if (body.status === 'FINISHED' || body.status === 'PUBLISHED') return;
    if (body.status === 'ERROR' || body.status === 'EXPIRED') {
      throw new BadRequestError(
        `Threads không xử lý được ảnh: ${body.error_message ?? body.status}`
      );
    }

    if (attempt === delays.length) break;
    await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
  }

  throw new SocialTransientError('Threads đang xử lý ảnh. Hệ thống sẽ thử lại sau.');
};

export const publishThreadsPost = async (
  input: PublishInput,
  capabilities: ProviderCapabilities
): Promise<string> => {
  const { externalAccountId, accessToken, text, imageUrls } = input;
  const label = 'Threads';

  if (!text.trim()) {
    throw new BadRequestError('Bài viết chưa có nội dung để đăng');
  }
  if (countGraphemes(text) > capabilities.maxTextLength) {
    throw new BadRequestError(`Nội dung vượt quá ${capabilities.maxTextLength} ký tự của Threads`);
  }
  if (imageUrls.length > capabilities.maxImages) {
    throw new BadRequestError(
      `Threads chỉ hỗ trợ tối đa ${capabilities.maxImages} ảnh mỗi bài`
    );
  }
  if (countUniqueLinks(text) > 5) {
    throw new BadRequestError('Threads chỉ cho phép tối đa 5 liên kết mỗi bài');
  }

  const createContainer = async (fields: Record<string, string>): Promise<string> => {
    const body = await threadsRequest<{ id: string }>(
      threadsApiUrl(`/${externalAccountId}/threads`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...fields, access_token: accessToken }).toString(),
      }
    );
    return body.id;
  };

  const publishContainer = async (creationId: string): Promise<string> => {
    const body = await threadsRequest<{ id: string }>(
      threadsApiUrl(`/${externalAccountId}/threads_publish`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ creation_id: creationId, access_token: accessToken }).toString(),
      }
    );
    return body.id;
  };

  let containerId: string;

  if (imageUrls.length === 0) {
    containerId = await createContainer({ media_type: 'TEXT', text });
  } else if (imageUrls.length === 1) {
    containerId = await createContainer({
      media_type: 'IMAGE',
      image_url: imageUrls[0],
      text,
    });
    await waitForContainer(containerId, accessToken);
  } else {
    const childIds: string[] = [];
    for (const imageUrl of imageUrls) {
      const childId = await createContainer({
        media_type: 'IMAGE',
        image_url: imageUrl,
        is_carousel_item: 'true',
      });
      await waitForContainer(childId, accessToken);
      childIds.push(childId);
    }

    containerId = await createContainer({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      text,
    });
    await waitForContainer(containerId, accessToken);
  }

  input.onRemoteStart?.();
  logger.info(`Đăng Threads cho tài khoản ${externalAccountId} (${label})`);

  return publishContainer(containerId);
};
