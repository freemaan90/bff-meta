import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SendTemplateDto } from './dto/send-template.dto';
import axios from 'axios';

@Injectable()
export class WhatsappCoreService {
  constructor(private readonly prisma: PrismaService) {}

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

    const url = `https://graph.facebook.com/v20.0/${tenant.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: dto.phone,
      type: 'template',
      template: {
        name: dto.template,
        language: { code: dto.language },
        components: dto.variables
          ? [
              {
                type: 'body',
                parameters: Object.entries(dto.variables).map(
                  ([key, value]) => ({
                    type: 'text',
                    text: String(value),
                  }),
                ),
              },
            ]
          : [],
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${tenant.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        messageId: response.data.messages?.[0]?.id ?? null,
      };
    } catch (error) {
      console.error(
        'WhatsApp API error:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to send WhatsApp message');
    }
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

    const url = `https://graph.facebook.com/v20.0/${tenant.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: params.phone,
      type: 'text',
      text: {
        body: params.text,
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${tenant.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        messageId: response.data.messages?.[0]?.id ?? null,
      };
    } catch (error) {
      console.error(
        'WhatsApp API error:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to send WhatsApp message');
    }
  }
}
