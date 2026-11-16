import type { PublishInput } from '../port/social-provider.port.js';
import { facebookPost, type FacebookIdResponse } from './facebook.graph.js';

const PUBLISH_TIMEOUT_MS = 30_000;

export class FacebookPublisher {
  async uploadPagePhoto(
    pageId: string,
    accessToken: string,
    imageUrl: string
  ): Promise<string> {
    const response = await facebookPost<FacebookIdResponse>(
      `/${pageId}/photos`,
      {
        published: 'false',
        url: imageUrl,
        access_token: accessToken,
      },
      PUBLISH_TIMEOUT_MS
    );

    return response.id;
  }

  async createPageFeedPost(
    pageId: string,
    accessToken: string,
    message: string,
    mediaIds: string[] = []
  ): Promise<string> {
    const form: Record<string, string> = {
      message,
      access_token: accessToken,
    };

    if (mediaIds.length > 0) {
      form.attached_media = JSON.stringify(mediaIds.map((id) => ({ media_fbid: id })));
    }

    const response = await facebookPost<FacebookIdResponse>(
      `/${pageId}/feed`,
      form,
      PUBLISH_TIMEOUT_MS
    );

    return response.id;
  }

  async publish(input: PublishInput): Promise<string> {
    const mediaIds: string[] = [];
    for (const imageUrl of input.imageUrls) {
      mediaIds.push(
        await this.uploadPagePhoto(input.externalAccountId, input.accessToken, imageUrl)
      );
    }

    input.onRemoteStart?.();

    return this.createPageFeedPost(
      input.externalAccountId,
      input.accessToken,
      input.text,
      mediaIds
    );
  }
}

export const facebookPublisher = new FacebookPublisher();
export default facebookPublisher;
