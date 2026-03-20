import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ChatbotService } from '../chatbot/chatbot.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbotService: ChatbotService,
  ) {}

  verifyWebhook(mode: string, token: string, challenge: string) {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return challenge;
    }

    return 'Invalid token';
  }

  async handleWebhook(body: any) {
    if (!body.entry) return { status: 'ignored' };

    for (const entry of body.entry) {
      const changes = entry.changes ?? [];

      for (const change of changes) {
        const value = change.value;

        // 1. Estados de mensajes
        if (value.statuses) {
          for (const status of value.statuses) {
            await this.handleStatus(status);
          }
        }

        // 2. Mensajes entrantes (opcional)
        if (value.messages) {
          for (const msg of value.messages) {
            await this.handleIncomingMessage(msg);
          }
        }
      }
    }

    return { status: 'ok' };
  }

  async handleStatus(status: any) {
    const messageId = status.id;
    const newStatus = status.status.toUpperCase(); // sent, delivered, read, failed

    // Si Meta manda error
    const error = status.errors?.[0]?.message ?? null;

    await this.prisma.message.updateMany({
      where: { messageId },
      data: {
        status: newStatus,
        error,
      },
    });
  }

  async handleIncomingMessage(msg: any) {
    const messageId = msg.id;
    const from = msg.from;
    const type = msg.type;
    const text = msg.text?.body ?? null;

    // Meta no manda tenantId, lo sacamos del phoneNumberId
    const phoneNumberId = msg?.context?.phone_number_id ?? null;

    const tenant = await this.prisma.tenant.findFirst({
      where: { phoneNumberId },
    });

    if (!tenant) {
      console.warn('Mensaje entrante sin tenant asociado:', msg);
      return;
    }

    await this.prisma.incomingMessage.upsert({
      where: { messageId },
      create: {
        messageId,
        tenantId: tenant.id,
        from,
        type,
        text,
        raw: msg,
      },
      update: {}, // no actualizamos nada, solo evitamos duplicados
    });

    // Chatbot
    await this.chatbotService.handleIncomingMessage(msg, tenant);
  }
}
