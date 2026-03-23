import { Injectable } from '@nestjs/common';
import { ValidationException } from '../../integrations/meta/errors';
import { MetaClient } from '../../integrations/meta/meta.client';
import { MetaSendResult } from '../../integrations/meta/types';

export type MediaType = 'image' | 'document' | 'audio' | 'video';

export interface MediaPayload {
  type: MediaType;
  [key: string]: unknown;
}

@Injectable()
export class MediaService {
  constructor(private readonly metaClient: MetaClient) {}

  buildPayload(
    mediaType: MediaType,
    mediaUrl: string,
    caption?: string,
    filename?: string,
  ): MediaPayload {
    if (!mediaUrl.startsWith('https://')) {
      throw new ValidationException('Media URL must start with https://');
    }

    const mediaObject: Record<string, string> = { link: mediaUrl };

    if (caption && (mediaType === 'image' || mediaType === 'document')) {
      mediaObject.caption = caption;
    }

    if (filename && mediaType === 'document') {
      mediaObject.filename = filename;
    }

    return {
      type: mediaType,
      [mediaType]: mediaObject,
    };
  }

  async send(params: {
    accessToken: string;
    phoneNumberId: string;
    to: string;
    mediaType: MediaType;
    mediaUrl: string;
    caption?: string;
    filename?: string;
  }): Promise<MetaSendResult> {
    return this.metaClient.sendMedia(params);
  }
}
