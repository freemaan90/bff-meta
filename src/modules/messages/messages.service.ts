import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MetaClient } from '../../integrations/meta/meta.client';
import { MetaApiError, MessageSendException } from '../../integrations/meta/errors';
import { PhoneValidator } from '../../common/phone-validator';
import { MediaService, MediaType } from './media.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaClient: MetaClient,
    private readonly mediaService: MediaService,
  ) {}

  async sendText(tenantId: string, phone: string, text: string): Promise<{ messageId: string }> {
    const normalizedPhone = PhoneValidator.validateOrThrow(phone);

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    const message = await this.prisma.message.create({
      data: { tenantId, phone: normalizedPhone, status: 'QUEUED' },
    });

    try {
      const result = await this.metaClient.sendText({
        accessToken: tenant.accessToken!,
        phoneNumberId: tenant.phoneNumberId!,
        to: normalizedPhone,
        text,
      });

      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'SENT', messageId: result.messageId },
      });

      return { messageId: result.messageId };
    } catch (error) {
      const errorMsg = this.handleSendError(error);
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED', error: errorMsg },
      });
      throw new MessageSendException(errorMsg, error instanceof MetaApiError ? error : undefined);
    }
  }

  async sendTemplate(
    tenantId: string,
    phone: string,
    template: string,
    language: string,
    variables?: Record<string, string>,
  ): Promise<{ messageId: string }> {
    const normalizedPhone = PhoneValidator.validateOrThrow(phone);

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    const message = await this.prisma.message.create({
      data: { tenantId, phone: normalizedPhone, status: 'QUEUED', variables: variables ?? undefined },
    });

    try {
      const result = await this.metaClient.sendTemplate({
        accessToken: tenant.accessToken!,
        phoneNumberId: tenant.phoneNumberId!,
        to: normalizedPhone,
        template,
        language,
        variables,
      });

      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'SENT', messageId: result.messageId },
      });

      return { messageId: result.messageId };
    } catch (error) {
      const errorMsg = this.handleSendError(error);
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED', error: errorMsg },
      });
      throw new MessageSendException(errorMsg, error instanceof MetaApiError ? error : undefined);
    }
  }

  async sendMedia(
    tenantId: string,
    phone: string,
    mediaType: MediaType,
    mediaUrl: string,
    caption?: string,
    filename?: string,
  ): Promise<{ messageId: string }> {
    const normalizedPhone = PhoneValidator.validateOrThrow(phone);

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    const message = await this.prisma.message.create({
      data: { tenantId, phone: normalizedPhone, status: 'QUEUED' },
    });

    try {
      const result = await this.mediaService.send({
        accessToken: tenant.accessToken!,
        phoneNumberId: tenant.phoneNumberId!,
        to: normalizedPhone,
        mediaType,
        mediaUrl,
        caption,
        filename,
      });

      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'SENT', messageId: result.messageId },
      });

      return { messageId: result.messageId };
    } catch (error) {
      const errorMsg = this.handleSendError(error);
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED', error: errorMsg },
      });
      throw new MessageSendException(errorMsg, error instanceof MetaApiError ? error : undefined);
    }
  }

  private handleSendError(error: unknown): string {
    if (error instanceof MetaApiError) {
      this.logger.error(
        `MetaApiError: code=${error.code} fbtrace_id=${error.fbtrace_id} message=${error.message}`,
      );
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }
}
