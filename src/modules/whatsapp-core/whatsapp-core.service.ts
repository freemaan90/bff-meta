import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MetaClient } from '../../integrations/meta/meta.client';
import { SendTemplateDto } from './dto/send-template.dto';

@Injectable()
export class WhatsappCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaClient: MetaClient,
  ) {}

  async sendTemplate(dto: SendTemplateDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.accessToken || !tenant.phoneNumberId) {
      throw new Error('Tenant is missing WhatsApp credentials');
    }

    const result = await this.metaClient.sendTemplate({
      accessToken: tenant.accessToken,
      phoneNumberId: tenant.phoneNumberId,
      to: dto.phone,
      template: dto.template,
      language: dto.language,
      variables: dto.variables,
    });

    return { messageId: result.messageId ?? null };
  }

  async sendText(params: { tenantId: string; phone: string; text: string }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.accessToken || !tenant.phoneNumberId) {
      throw new Error('Tenant is missing WhatsApp credentials');
    }

    const result = await this.metaClient.sendText({
      accessToken: tenant.accessToken,
      phoneNumberId: tenant.phoneNumberId,
      to: params.phone,
      text: params.text,
    });

    return { messageId: result.messageId ?? null };
  }
}
