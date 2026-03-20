import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { AiService } from "../ai-services/ai-services.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Tenant } from "src/generated/client";

@Injectable()
export class ChatbotService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    @InjectQueue('send-message') private sendMessageQueue: Queue,
  ) {}

  async handleIncomingMessage(msg: any, tenant: Tenant) {
    if (!tenant.chatbotEnabled) return;

    const text = msg.text?.body?.toLowerCase() ?? '';
    const from = msg.from;

    // Normalizar reglas
    const rules = Array.isArray(tenant.chatbotRules)
      ? tenant.chatbotRules as { contains: string; reply: string }[]
      : [];

    // 1. Modo reglas
    if (tenant.chatbotMode === 'rules') {
      return this.handleRules(text, tenant, from, rules);
    }

    // 2. Modo IA
    if (tenant.chatbotMode === 'ai') {
      return this.handleAI(text, tenant, from, rules);
    }

    // 3. Modo híbrido
    if (tenant.chatbotMode === 'hybrid') {
      const ruleResponse = this.tryRules(text, rules);

      if (ruleResponse) {
        return this.reply(tenant.id, from, ruleResponse);
      }

      const aiResponse = await this.ai.generateResponse(
        tenant.chatbotPrompt ?? 'Sos un asistente amable.',
        text,
        rules
      );

      return this.reply(tenant.id, from, aiResponse);
    }
  }

  private tryRules(text: string, rules: any[]) {
    for (const rule of rules) {
      if (text.includes(rule.contains.toLowerCase())) {
        return rule.reply;
      }
    }
    return null;
  }

  private async handleRules(text: string, tenant: Tenant, from: string, rules: any[]) {
    const response = this.tryRules(text, rules);

    if (response) {
      return this.reply(tenant.id, from, response);
    }

    return this.reply(tenant.id, from, 'No entendí tu mensaje, ¿podés repetirlo?');
  }

  private async handleAI(text: string, tenant: Tenant, from: string, rules: any[]) {
    const response = await this.ai.generateResponse(
      tenant.chatbotPrompt ?? 'Sos un asistente amable.',
      text,
      rules
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
}
