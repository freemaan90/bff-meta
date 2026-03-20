import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/database/prisma.service';
import { Tenant } from 'src/generated/client';

@Injectable()
export class ChatbotService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('send-message') private sendMessageQueue: Queue,
  ) {}

  async handleIncomingMessage(msg: any, tenant: Tenant) {
    if (!tenant.chatbotEnabled) return;

    const text = msg.text?.body?.toLowerCase() ?? '';
    const from = msg.from;

    // 1. Modo reglas
    if (tenant.chatbotMode === 'rules') {
      return this.handleRules(text, tenant, from);
    }

    // 2. Modo IA
    if (tenant.chatbotMode === 'ai') {
      return this.handleAI(text, tenant, from);
    }

    // 3. Modo híbrido
    if (tenant.chatbotMode === 'hybrid') {
      const ruleResponse = await this.tryRules(text, tenant);

      if (ruleResponse) {
        return this.reply(tenant.id, from, ruleResponse);
      }
      const rules = Array.isArray(tenant.chatbotRules)
        ? (tenant.chatbotRules as { contains: string; reply: string }[])
        : [];
      const aiResponse = await this.callAI(
        tenant.chatbotPrompt ?? 'Sos un asistente amable.',
        text,
        rules ?? [],
      );

      return this.reply(tenant.id, from, aiResponse);
    }
  }

  private async tryRules(text: string, tenant: Tenant) {
    const rules = Array.isArray(tenant.chatbotRules)
      ? (tenant.chatbotRules as { contains: string; reply: string }[])
      : [];

    for (const rule of rules) {
      if (text.includes(rule.contains.toLowerCase())) {
        return rule.reply;
      }
    }

    return null;
  }

  private async handleRules(text: string, tenant: Tenant, from: string) {
    const response = await this.tryRules(text, tenant);

    if (response) {
      return this.reply(tenant.id, from, response);
    }

    return this.reply(
      tenant.id,
      from,
      'No entendí tu mensaje, ¿podés repetirlo?',
    );
  }

  private async handleAI(text: string, tenant: Tenant, from: string) {
    const rules = Array.isArray(tenant.chatbotRules)
      ? (tenant.chatbotRules as { contains: string; reply: string }[])
      : [];

    const response = await this.callAI(
      tenant.chatbotPrompt ?? 'Sos un asistente amable.',
      text,
      rules ?? [],
    );

    return this.reply(tenant.id, from, response);
  }

  private async reply(tenantId: string, to: string, text: string) {
    await this.sendMessageQueue.add('send-message', {
      tenantId,
      to,
      type: 'text',
      text,
    });
  }

  private async callAI(
    prompt: string,
    userMessage: string,
    rules: any[],
  ): Promise<string> {
    // Acá después integrás OpenAI / Azure OpenAI
    return `IA: ${userMessage}`;
  }
}
