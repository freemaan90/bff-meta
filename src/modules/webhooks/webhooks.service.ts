import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) {}

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
    console.log('Mensaje entrante:', msg);
  }
}
