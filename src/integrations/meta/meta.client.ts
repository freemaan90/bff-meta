import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { mapGraphApiError } from './error-mapper';
import { MetaApiError } from './errors';
import {
  CreateTemplateDto,
  MetaSendMediaParams,
  MetaSendResult,
  MetaSendTemplateParams,
  MetaSendTextParams,
  MetaTemplate,
  MetaTemplateResult,
} from './types';

const GRAPH_API_BASE = 'https://graph.facebook.com';
const DEFAULT_API_VERSION = 'v20.0';

@Injectable()
export class MetaClient {
  private readonly logger = new Logger(MetaClient.name);

  constructor(private readonly config: ConfigService) {}

  private getVersion(): string {
    return this.config.get<string>('META_API_VERSION') ?? DEFAULT_API_VERSION;
  }

  private buildUrl(phoneNumberId: string): string {
    const version = this.getVersion();
    return `${GRAPH_API_BASE}/${version}/${phoneNumberId}/messages`;
  }

  private buildHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private handleAxiosError(error: unknown): never {
    if (error instanceof AxiosError && error.response) {
      const metaError = mapGraphApiError(error.response.data);
      this.logger.error(
        `Graph API error: code=${metaError.code} type=${metaError.type} fbtrace_id=${metaError.fbtrace_id}`,
      );
      throw metaError;
    }
    throw error;
  }

  async sendText(params: MetaSendTextParams): Promise<MetaSendResult> {
    const { accessToken, phoneNumberId, to, text } = params;
    const url = this.buildUrl(phoneNumberId);
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    };

    this.logger.log(`Sending text message to ${to} via phoneNumberId=${phoneNumberId}`);

    try {
      const response = await axios.post(url, payload, { headers: this.buildHeaders(accessToken) });
      const messageId: string = response.data?.messages?.[0]?.id ?? '';
      this.logger.log(`Text message sent successfully messageId=${messageId}`);
      return { messageId };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async sendTemplate(params: MetaSendTemplateParams): Promise<MetaSendResult> {
    const { accessToken, phoneNumberId, to, template, language, variables } = params;
    const url = this.buildUrl(phoneNumberId);

    const components =
      variables && Object.keys(variables).length > 0
        ? [
            {
              type: 'body',
              parameters: Object.values(variables).map((v) => ({ type: 'text', text: v })),
            },
          ]
        : [];

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: language },
        components,
      },
    };

    this.logger.log(`Sending template message "${template}" to ${to} via phoneNumberId=${phoneNumberId}`);

    try {
      const response = await axios.post(url, payload, { headers: this.buildHeaders(accessToken) });
      const messageId: string = response.data?.messages?.[0]?.id ?? '';
      this.logger.log(`Template message sent successfully messageId=${messageId}`);
      return { messageId };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async sendMedia(params: MetaSendMediaParams): Promise<MetaSendResult> {
    const { accessToken, phoneNumberId, to, mediaType, mediaUrl, caption, filename } = params;
    const url = this.buildUrl(phoneNumberId);

    const mediaObject: Record<string, string> = { link: mediaUrl };
    if (caption && (mediaType === 'image' || mediaType === 'document')) {
      mediaObject.caption = caption;
    }
    if (filename && mediaType === 'document') {
      mediaObject.filename = filename;
    }

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: mediaType,
      [mediaType]: mediaObject,
    };

    this.logger.log(`Sending ${mediaType} message to ${to} via phoneNumberId=${phoneNumberId}`);

    try {
      const response = await axios.post(url, payload, { headers: this.buildHeaders(accessToken) });
      const messageId: string = response.data?.messages?.[0]?.id ?? '';
      this.logger.log(`Media message sent successfully messageId=${messageId}`);
      return { messageId };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async listTemplates(wabaId: string, accessToken: string): Promise<MetaTemplate[]> {
    const version = this.getVersion();
    const url = `${GRAPH_API_BASE}/${version}/${wabaId}/message_templates`;

    this.logger.log(`Listing templates for wabaId=${wabaId}`);

    try {
      const response = await axios.get(url, { headers: this.buildHeaders(accessToken) });
      return (response.data?.data ?? []) as MetaTemplate[];
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async createTemplate(
    wabaId: string,
    accessToken: string,
    template: CreateTemplateDto,
  ): Promise<MetaTemplateResult> {
    const version = this.getVersion();
    const url = `${GRAPH_API_BASE}/${version}/${wabaId}/message_templates`;

    this.logger.log(`Creating template "${template.name}" for wabaId=${wabaId}`);

    try {
      const response = await axios.post(url, template, { headers: this.buildHeaders(accessToken) });
      return { id: response.data?.id ?? '', status: response.data?.status ?? '' };
    } catch (error) {
      this.handleAxiosError(error);
    }
  }

  async deleteTemplate(wabaId: string, accessToken: string, name: string): Promise<void> {
    const version = this.getVersion();
    const url = `${GRAPH_API_BASE}/${version}/${wabaId}/message_templates`;

    this.logger.log(`Deleting template "${name}" for wabaId=${wabaId}`);

    try {
      await axios.delete(url, {
        headers: this.buildHeaders(accessToken),
        params: { name },
      });
    } catch (error) {
      this.handleAxiosError(error);
    }
  }
}
